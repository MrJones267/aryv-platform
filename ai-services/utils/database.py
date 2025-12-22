"""
Database Manager - PostgreSQL connection and query utilities for AI services
Author: Claude-Code
Created: 2025-01-21
Last Modified: 2025-01-21
"""

import os
import logging
import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
from typing import List, Dict, Any, Optional
from contextlib import contextmanager
import time

class DatabaseManager:
    """PostgreSQL database manager with connection pooling"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.connection_pool = None
        self._initialize_connection_pool()
    
    def _initialize_connection_pool(self):
        """Initialize PostgreSQL connection pool"""
        try:
            # Get database configuration from environment
            database_url = os.environ.get('DATABASE_URL')
            
            if database_url:
                # Parse database URL
                self.connection_pool = ThreadedConnectionPool(
                    minconn=1,
                    maxconn=10,
                    dsn=database_url
                )
            else:
                # Use individual environment variables
                db_config = {
                    'host': os.environ.get('POSTGRES_HOST', 'postgres'),
                    'port': int(os.environ.get('POSTGRES_PORT', 5432)),
                    'database': os.environ.get('POSTGRES_DB', 'hitch_db'),
                    'user': os.environ.get('POSTGRES_USER', 'hitch_user'),
                    'password': os.environ.get('POSTGRES_PASSWORD', 'hitch_secure_password_change_me')
                }
                
                self.connection_pool = ThreadedConnectionPool(
                    minconn=1,
                    maxconn=10,
                    **db_config
                )
            
            self.logger.info("Database connection pool initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize database connection pool: {str(e)}")
            raise
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        connection = None
        try:
            connection = self.connection_pool.getconn()
            yield connection
        except Exception as e:
            if connection:
                connection.rollback()
            self.logger.error(f"Database connection error: {str(e)}")
            raise
        finally:
            if connection:
                self.connection_pool.putconn(connection)
    
    def execute_query(self, query: str, params: tuple = None, fetch_results: bool = True) -> Optional[List[Dict[str, Any]]]:
        """
        Execute a database query and return results
        
        Args:
            query: SQL query string
            params: Query parameters
            fetch_results: Whether to fetch and return results
            
        Returns:
            Query results as list of dictionaries or None
        """
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                    cursor.execute(query, params)
                    
                    if fetch_results:
                        results = cursor.fetchall()
                        return [dict(row) for row in results]
                    else:
                        conn.commit()
                        return None
                        
        except Exception as e:
            self.logger.error(f"Query execution error: {str(e)}")
            self.logger.error(f"Query: {query}")
            self.logger.error(f"Params: {params}")
            raise
    
    def execute_many(self, query: str, params_list: List[tuple]) -> bool:
        """
        Execute a query multiple times with different parameters
        
        Args:
            query: SQL query string
            params_list: List of parameter tuples
            
        Returns:
            Success status
        """
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.executemany(query, params_list)
                    conn.commit()
                    return True
                    
        except Exception as e:
            self.logger.error(f"Batch query execution error: {str(e)}")
            return False
    
    def check_connection(self) -> bool:
        """Check if database connection is healthy"""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    return True
                    
        except Exception as e:
            self.logger.error(f"Database health check failed: {str(e)}")
            return False
    
    def get_ride_requests_in_area(self, latitude: float, longitude: float, 
                                 radius_meters: int = 5000, 
                                 hours_back: int = 24) -> List[Dict[str, Any]]:
        """Get ride requests in a specific geographical area"""
        try:
            query = """
            SELECT 
                rr.id,
                rr.user_id,
                rr.origin_address,
                rr.destination_address,
                rr.origin_coordinates,
                rr.destination_coordinates,
                rr.created_at,
                rr.status,
                u.first_name,
                u.last_name
            FROM ride_requests rr
            JOIN users u ON rr.user_id = u.id
            WHERE 
                rr.created_at >= NOW() - INTERVAL '%s hours'
                AND ST_DWithin(
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                    rr.origin_coordinates::geography,
                    %s
                )
            ORDER BY rr.created_at DESC
            """
            
            return self.execute_query(query, (hours_back, longitude, latitude, radius_meters))
            
        except Exception as e:
            self.logger.error(f"Error getting ride requests in area: {str(e)}")
            return []
    
    def get_available_drivers_in_area(self, latitude: float, longitude: float,
                                     radius_meters: int = 10000) -> List[Dict[str, Any]]:
        """Get available drivers in a specific geographical area"""
        try:
            query = """
            SELECT 
                d.id,
                d.user_id,
                d.is_available,
                d.status,
                d.current_location,
                u.first_name,
                u.last_name,
                v.make,
                v.model,
                v.year,
                COALESCE(AVG(rev.rating), 5.0) as rating,
                COUNT(rev.id) as review_count
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            JOIN vehicles v ON d.current_vehicle_id = v.id
            LEFT JOIN reviews rev ON u.id = rev.reviewed_user_id
            WHERE 
                d.is_available = true
                AND d.status = 'online'
                AND d.current_location IS NOT NULL
                AND ST_DWithin(
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                    d.current_location::geography,
                    %s
                )
            GROUP BY d.id, u.id, v.id
            ORDER BY rating DESC
            """
            
            return self.execute_query(query, (longitude, latitude, radius_meters))
            
        except Exception as e:
            self.logger.error(f"Error getting available drivers: {str(e)}")
            return []
    
    def get_historical_demand_data(self, location: Dict[str, float], 
                                  days_back: int = 30) -> List[Dict[str, Any]]:
        """Get historical demand data for machine learning training"""
        try:
            query = """
            SELECT 
                DATE_TRUNC('hour', rr.created_at) as hour_timestamp,
                COUNT(*) as ride_count,
                EXTRACT(hour FROM rr.created_at) as hour,
                EXTRACT(dow FROM rr.created_at) as day_of_week,
                EXTRACT(month FROM rr.created_at) as month
            FROM ride_requests rr
            WHERE 
                rr.created_at >= NOW() - INTERVAL '%s days'
                AND ST_DWithin(
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                    rr.origin_coordinates::geography,
                    2000
                )
            GROUP BY DATE_TRUNC('hour', rr.created_at), 
                     EXTRACT(hour FROM rr.created_at),
                     EXTRACT(dow FROM rr.created_at),
                     EXTRACT(month FROM rr.created_at)
            ORDER BY hour_timestamp
            """
            
            return self.execute_query(query, (
                days_back,
                location.get('longitude', 0),
                location.get('latitude', 0)
            ))
            
        except Exception as e:
            self.logger.error(f"Error getting historical demand data: {str(e)}")
            return []
    
    def get_completed_rides_for_pricing(self, days_back: int = 7) -> List[Dict[str, Any]]:
        """Get completed rides data for pricing analysis"""
        try:
            query = """
            SELECT 
                r.id,
                r.origin_coordinates,
                r.destination_coordinates,
                r.departure_time,
                r.price_per_seat,
                r.distance,
                r.estimated_duration,
                EXTRACT(hour FROM r.departure_time) as hour,
                EXTRACT(dow FROM r.departure_time) as day_of_week,
                COUNT(b.id) as passenger_count
            FROM rides r
            LEFT JOIN bookings b ON r.id = b.ride_id
            WHERE 
                r.status = 'completed'
                AND r.departure_time >= NOW() - INTERVAL '%s days'
                AND r.price_per_seat IS NOT NULL
                AND r.distance IS NOT NULL
            GROUP BY r.id
            ORDER BY r.departure_time DESC
            """
            
            return self.execute_query(query, (days_back,))
            
        except Exception as e:
            self.logger.error(f"Error getting completed rides for pricing: {str(e)}")
            return []
    
    def log_ai_prediction(self, service_name: str, prediction_data: Dict[str, Any],
                         accuracy_score: Optional[float] = None) -> bool:
        """Log AI prediction for monitoring and improvement"""
        try:
            query = """
            INSERT INTO ai_predictions 
            (service_name, prediction_data, accuracy_score, created_at)
            VALUES (%s, %s, %s, NOW())
            """
            
            self.execute_query(
                query, 
                (service_name, psycopg2.extras.Json(prediction_data), accuracy_score),
                fetch_results=False
            )
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error logging AI prediction: {str(e)}")
            return False
    
    def get_route_optimization_data(self) -> List[Dict[str, Any]]:
        """Get data for route optimization algorithm training"""
        try:
            query = """
            SELECT 
                r.id,
                r.origin_coordinates,
                r.destination_coordinates,
                array_agg(
                    json_build_object(
                        'pickup_location', b.pickup_location,
                        'dropoff_location', b.dropoff_location,
                        'passenger_id', b.user_id
                    )
                ) as passenger_waypoints,
                r.actual_route,
                r.actual_duration,
                r.distance
            FROM rides r
            JOIN bookings b ON r.id = b.ride_id
            WHERE 
                r.status = 'completed'
                AND r.actual_route IS NOT NULL
                AND r.actual_duration IS NOT NULL
            GROUP BY r.id
            HAVING COUNT(b.id) > 1  -- Multiple passengers
            ORDER BY r.departure_time DESC
            LIMIT 1000
            """
            
            return self.execute_query(query)
            
        except Exception as e:
            self.logger.error(f"Error getting route optimization data: {str(e)}")
            return []
    
    def update_driver_ai_score(self, driver_id: str, ai_scores: Dict[str, float]) -> bool:
        """Update driver AI compatibility scores"""
        try:
            query = """
            UPDATE drivers 
            SET ai_compatibility_scores = %s,
                updated_at = NOW()
            WHERE id = %s
            """
            
            self.execute_query(
                query,
                (psycopg2.extras.Json(ai_scores), driver_id),
                fetch_results=False
            )
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating driver AI score: {str(e)}")
            return False
    
    def close_connections(self):
        """Close all database connections"""
        try:
            if self.connection_pool:
                self.connection_pool.closeall()
                self.logger.info("Database connections closed")
        except Exception as e:
            self.logger.error(f"Error closing database connections: {str(e)}")
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        self.close_connections()