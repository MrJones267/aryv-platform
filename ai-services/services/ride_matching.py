"""
Ride Matching Service - AI-powered algorithm for matching passengers with rides
Author: Claude-Code
Created: 2025-01-21
Last Modified: 2025-01-21
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from geopy.distance import geodesic
import logging
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler

@dataclass
class RideMatch:
    ride_id: str
    driver_id: str
    compatibility_score: float
    distance_from_origin: float
    distance_to_destination: float
    time_deviation: float
    price_per_seat: float
    available_seats: int
    driver_rating: float
    vehicle_info: Dict[str, Any]
    estimated_pickup_time: str
    estimated_arrival_time: str
    route_efficiency: float

class RideMatchingService:
    """AI-powered ride matching service using machine learning algorithms"""
    
    def __init__(self, db_manager, redis_client):
        self.db = db_manager
        self.redis = redis_client
        self.logger = logging.getLogger(__name__)
        self.scaler = StandardScaler()
        
        # Matching algorithm weights
        self.weights = {
            'distance': 0.25,      # Distance from origin/destination
            'time': 0.20,          # Time compatibility
            'price': 0.15,         # Price match with preferences
            'driver_rating': 0.15, # Driver rating and reviews
            'vehicle': 0.10,       # Vehicle preferences
            'route_efficiency': 0.10, # Route optimization score
            'availability': 0.05   # Seat availability
        }
        
        # Cache settings
        self.cache_ttl = 300  # 5 minutes cache for matching results
        
    def find_matches(self, origin: Dict[str, float], destination: Dict[str, float], 
                    departure_time: str, preferences: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Find compatible rides using AI matching algorithm
        
        Args:
            origin: {'latitude': float, 'longitude': float}
            destination: {'latitude': float, 'longitude': float}
            departure_time: ISO timestamp string
            preferences: User preferences dictionary
            
        Returns:
            List of matched rides with compatibility scores
        """
        try:
            # Create cache key for this search
            cache_key = self._generate_cache_key(origin, destination, departure_time, preferences)
            
            # Check cache first
            cached_result = self.redis.get(cache_key)
            if cached_result:
                self.logger.info("Returning cached matching results")
                return cached_result
            
            # Parse departure time
            departure_dt = datetime.fromisoformat(departure_time.replace('Z', '+00:00'))
            
            # Get available rides from database
            available_rides = self._get_available_rides(departure_dt, preferences)
            
            if not available_rides:
                self.logger.info("No available rides found")
                return []
            
            # Calculate compatibility scores for each ride
            matches = []
            for ride in available_rides:
                match = self._calculate_compatibility(ride, origin, destination, departure_dt, preferences)
                if match and match.compatibility_score > 0.3:  # Minimum threshold
                    matches.append(match)
            
            # Sort by compatibility score (descending)
            matches.sort(key=lambda x: x.compatibility_score, reverse=True)
            
            # Convert to dictionaries and limit results
            result = [self._match_to_dict(match) for match in matches[:20]]
            
            # Cache the results
            self.redis.setex(cache_key, self.cache_ttl, result)
            
            self.logger.info(f"Found {len(result)} compatible rides")
            return result
            
        except Exception as e:
            self.logger.error(f"Error in ride matching: {str(e)}")
            raise
    
    def _get_available_rides(self, departure_time: datetime, preferences: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get available rides from database within time window"""
        try:
            # Time window for search (2 hours before/after requested time)
            time_window = timedelta(hours=2)
            start_time = departure_time - time_window
            end_time = departure_time + time_window
            
            # Build SQL query with filters
            query = """
            SELECT 
                r.id as ride_id,
                r.driver_id,
                r.origin_address,
                r.origin_coordinates,
                r.destination_address,
                r.destination_coordinates,
                r.departure_time,
                r.available_seats,
                r.price_per_seat,
                r.status,
                r.description,
                u.first_name,
                u.last_name,
                u.profile_image,
                v.make,
                v.model,
                v.year,
                v.color,
                v.license_plate,
                COALESCE(AVG(rev.rating), 5.0) as driver_rating,
                COUNT(rev.id) as review_count
            FROM rides r
            JOIN users u ON r.driver_id = u.id
            JOIN vehicles v ON r.vehicle_id = v.id
            LEFT JOIN reviews rev ON u.id = rev.reviewed_user_id
            WHERE 
                r.status IN ('pending', 'confirmed')
                AND r.departure_time BETWEEN %s AND %s
                AND r.available_seats > 0
            GROUP BY r.id, u.id, v.id
            ORDER BY r.departure_time
            """
            
            results = self.db.execute_query(query, (start_time, end_time))
            
            # Convert coordinates from PostGIS format
            rides = []
            for row in results:
                ride = dict(row)
                
                # Parse PostGIS coordinates
                if ride['origin_coordinates']:
                    coords = self._parse_postgis_point(ride['origin_coordinates'])
                    ride['origin_lat'] = coords[1]
                    ride['origin_lng'] = coords[0]
                
                if ride['destination_coordinates']:
                    coords = self._parse_postgis_point(ride['destination_coordinates'])
                    ride['destination_lat'] = coords[1]
                    ride['destination_lng'] = coords[0]
                
                rides.append(ride)
            
            return rides
            
        except Exception as e:
            self.logger.error(f"Error getting available rides: {str(e)}")
            return []
    
    def _calculate_compatibility(self, ride: Dict[str, Any], origin: Dict[str, float], 
                               destination: Dict[str, float], departure_time: datetime, 
                               preferences: Dict[str, Any]) -> RideMatch:
        """Calculate compatibility score between passenger request and available ride"""
        try:
            # Extract ride coordinates
            ride_origin = (ride['origin_lat'], ride['origin_lng'])
            ride_destination = (ride['destination_lat'], ride['destination_lng'])
            passenger_origin = (origin['latitude'], origin['longitude'])
            passenger_destination = (destination['latitude'], destination['longitude'])
            
            # Calculate distance scores (closer is better)
            origin_distance = geodesic(passenger_origin, ride_origin).kilometers
            destination_distance = geodesic(passenger_destination, ride_destination).kilometers
            
            # Distance score (normalized, closer gets higher score)
            max_acceptable_distance = preferences.get('max_distance', 10)  # km
            distance_score = max(0, 1 - (origin_distance + destination_distance) / (2 * max_acceptable_distance))
            
            # Time compatibility score
            ride_departure = ride['departure_time']
            time_diff = abs((departure_time - ride_departure).total_seconds() / 3600)  # hours
            max_time_diff = preferences.get('max_time_difference', 2)  # hours
            time_score = max(0, 1 - time_diff / max_time_diff)
            
            # Price compatibility score
            price_per_seat = ride['price_per_seat']
            max_price = preferences.get('max_price', price_per_seat * 1.5)
            price_score = max(0, 1 - max(0, price_per_seat - max_price) / max_price)
            
            # Driver rating score (normalized to 0-1)
            driver_rating = ride['driver_rating']
            rating_score = (driver_rating - 1) / 4  # Convert 1-5 scale to 0-1
            
            # Vehicle preference score
            vehicle_score = self._calculate_vehicle_score(ride, preferences.get('vehicle_preferences', {}))
            
            # Route efficiency score
            route_efficiency = self._calculate_route_efficiency(
                passenger_origin, passenger_destination, ride_origin, ride_destination
            )
            
            # Seat availability score
            availability_score = min(1.0, ride['available_seats'] / preferences.get('seats_needed', 1))
            
            # Calculate weighted compatibility score
            compatibility_score = (
                distance_score * self.weights['distance'] +
                time_score * self.weights['time'] +
                price_score * self.weights['price'] +
                rating_score * self.weights['driver_rating'] +
                vehicle_score * self.weights['vehicle'] +
                route_efficiency * self.weights['route_efficiency'] +
                availability_score * self.weights['availability']
            )
            
            # Estimate pickup and arrival times
            pickup_time, arrival_time = self._estimate_times(
                ride_departure, origin_distance, destination_distance
            )
            
            return RideMatch(
                ride_id=ride['ride_id'],
                driver_id=ride['driver_id'],
                compatibility_score=compatibility_score,
                distance_from_origin=origin_distance,
                distance_to_destination=destination_distance,
                time_deviation=time_diff,
                price_per_seat=price_per_seat,
                available_seats=ride['available_seats'],
                driver_rating=driver_rating,
                vehicle_info={
                    'make': ride['make'],
                    'model': ride['model'],
                    'year': ride['year'],
                    'color': ride['color'],
                    'license_plate': ride['license_plate']
                },
                estimated_pickup_time=pickup_time,
                estimated_arrival_time=arrival_time,
                route_efficiency=route_efficiency
            )
            
        except Exception as e:
            self.logger.error(f"Error calculating compatibility: {str(e)}")
            return None
    
    def _calculate_vehicle_score(self, ride: Dict[str, Any], vehicle_prefs: Dict[str, Any]) -> float:
        """Calculate vehicle preference compatibility score"""
        if not vehicle_prefs:
            return 1.0  # No preferences = full score
        
        score = 1.0
        
        # Preferred vehicle types
        if 'preferred_types' in vehicle_prefs:
            # This would require vehicle type classification
            # For now, return neutral score
            pass
        
        # Vehicle age preference
        if 'max_age' in vehicle_prefs:
            current_year = datetime.now().year
            vehicle_age = current_year - ride['year']
            if vehicle_age > vehicle_prefs['max_age']:
                score *= 0.7
        
        return score
    
    def _calculate_route_efficiency(self, passenger_origin: Tuple[float, float], 
                                  passenger_destination: Tuple[float, float],
                                  ride_origin: Tuple[float, float], 
                                  ride_destination: Tuple[float, float]) -> float:
        """Calculate how efficient the route is for both passengers"""
        try:
            # Direct distance for passenger
            passenger_direct = geodesic(passenger_origin, passenger_destination).kilometers
            
            # Distance via ride route
            leg1 = geodesic(passenger_origin, ride_origin).kilometers
            leg2 = geodesic(ride_origin, ride_destination).kilometers
            leg3 = geodesic(ride_destination, passenger_destination).kilometers
            total_via_ride = leg1 + leg2 + leg3
            
            # Efficiency score (1.0 = perfectly efficient, lower = less efficient)
            if total_via_ride == 0:
                return 0.0
            
            efficiency = passenger_direct / total_via_ride
            return min(1.0, efficiency)
            
        except Exception:
            return 0.5  # Neutral score on error
    
    def _estimate_times(self, ride_departure: datetime, origin_distance: float, 
                       destination_distance: float) -> Tuple[str, str]:
        """Estimate pickup and arrival times"""
        try:
            # Assume average speed of 40 km/h in city
            avg_speed = 40
            
            # Pickup time (time to reach passenger)
            pickup_travel_time = timedelta(hours=origin_distance / avg_speed)
            pickup_time = ride_departure + pickup_travel_time
            
            # Arrival time (pickup time + travel to destination)
            arrival_travel_time = timedelta(hours=destination_distance / avg_speed)
            arrival_time = pickup_time + arrival_travel_time
            
            return pickup_time.isoformat(), arrival_time.isoformat()
            
        except Exception:
            return ride_departure.isoformat(), ride_departure.isoformat()
    
    def _parse_postgis_point(self, point_data) -> Tuple[float, float]:
        """Parse PostGIS POINT data to coordinates"""
        try:
            if hasattr(point_data, 'coordinates'):
                return point_data.coordinates
            elif isinstance(point_data, dict) and 'coordinates' in point_data:
                return point_data['coordinates']
            else:
                # Try to parse string format
                coords_str = str(point_data).replace('POINT(', '').replace(')', '')
                lng, lat = map(float, coords_str.split())
                return lng, lat
        except Exception:
            return 0.0, 0.0
    
    def _generate_cache_key(self, origin: Dict[str, float], destination: Dict[str, float], 
                           departure_time: str, preferences: Dict[str, Any]) -> str:
        """Generate cache key for matching request"""
        import hashlib
        
        key_data = f"{origin['latitude']},{origin['longitude']}"
        key_data += f"{destination['latitude']},{destination['longitude']}"
        key_data += f"{departure_time}"
        key_data += str(sorted(preferences.items()))
        
        return f"ride_matches:{hashlib.md5(key_data.encode()).hexdigest()}"
    
    def _match_to_dict(self, match: RideMatch) -> Dict[str, Any]:
        """Convert RideMatch object to dictionary"""
        return {
            'ride_id': match.ride_id,
            'driver_id': match.driver_id,
            'compatibility_score': round(match.compatibility_score, 3),
            'distance_from_origin': round(match.distance_from_origin, 2),
            'distance_to_destination': round(match.distance_to_destination, 2),
            'time_deviation_hours': round(match.time_deviation, 2),
            'price_per_seat': match.price_per_seat,
            'available_seats': match.available_seats,
            'driver_rating': round(match.driver_rating, 1),
            'vehicle_info': match.vehicle_info,
            'estimated_pickup_time': match.estimated_pickup_time,
            'estimated_arrival_time': match.estimated_arrival_time,
            'route_efficiency': round(match.route_efficiency, 3)
        }