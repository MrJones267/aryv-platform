"""
Dynamic Pricing Service - AI-powered pricing algorithm based on supply/demand
Author: Claude-Code
Created: 2025-01-21
Last Modified: 2025-01-21
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass
import logging
import json
import math

@dataclass
class PricingResult:
    base_price: float
    surge_multiplier: float
    final_price: float
    demand_factor: float
    supply_factor: float
    time_factor: float
    distance_factor: float
    weather_factor: float
    event_factor: float
    confidence_score: float

class DynamicPricingService:
    """AI-powered dynamic pricing service using supply/demand analysis"""
    
    def __init__(self, db_manager, redis_client):
        self.db = db_manager
        self.redis = redis_client
        self.logger = logging.getLogger(__name__)
        
        # Pricing configuration
        self.base_price_per_km = 1.2  # Base rate per kilometer
        self.base_price_per_minute = 0.2  # Base rate per minute
        self.minimum_fare = 5.0  # Minimum fare
        self.maximum_surge = 3.0  # Maximum surge multiplier
        
        # Pricing factors weights
        self.weights = {
            'demand': 0.25,    # Demand in area
            'supply': 0.20,    # Available drivers
            'time': 0.15,      # Time of day
            'distance': 0.15,  # Trip distance
            'weather': 0.10,   # Weather conditions
            'events': 0.10,    # Special events
            'historical': 0.05 # Historical pricing data
        }
        
        # Cache settings
        self.cache_ttl = 180  # 3 minutes cache for pricing
        
    def calculate_price(self, ride_data: Dict[str, Any], 
                       market_conditions: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Calculate dynamic pricing for a ride
        
        Args:
            ride_data: Ride information (origin, destination, departure_time, etc.)
            market_conditions: Current market conditions and external factors
            
        Returns:
            Pricing result with detailed breakdown
        """
        try:
            # Create cache key
            cache_key = self._generate_pricing_cache_key(ride_data, market_conditions)
            
            # Check cache first
            cached_result = self.redis.get(cache_key)
            if cached_result:
                self.logger.info("Returning cached pricing result")
                return json.loads(cached_result)
            
            # Calculate base price
            base_price = self._calculate_base_price(ride_data)
            
            # Calculate various pricing factors
            demand_factor = self._calculate_demand_factor(ride_data, market_conditions)
            supply_factor = self._calculate_supply_factor(ride_data, market_conditions)
            time_factor = self._calculate_time_factor(ride_data)
            distance_factor = self._calculate_distance_factor(ride_data)
            weather_factor = self._calculate_weather_factor(market_conditions)
            event_factor = self._calculate_event_factor(ride_data, market_conditions)
            
            # Calculate surge multiplier using weighted factors
            surge_multiplier = self._calculate_surge_multiplier({
                'demand': demand_factor,
                'supply': supply_factor,
                'time': time_factor,
                'distance': distance_factor,
                'weather': weather_factor,
                'events': event_factor
            })
            
            # Calculate final price
            final_price = max(base_price * surge_multiplier, self.minimum_fare)
            
            # Calculate confidence score
            confidence_score = self._calculate_confidence_score(ride_data, market_conditions)
            
            # Create pricing result
            pricing_result = PricingResult(
                base_price=base_price,
                surge_multiplier=surge_multiplier,
                final_price=final_price,
                demand_factor=demand_factor,
                supply_factor=supply_factor,
                time_factor=time_factor,
                distance_factor=distance_factor,
                weather_factor=weather_factor,
                event_factor=event_factor,
                confidence_score=confidence_score
            )
            
            # Convert to dictionary for response
            result_dict = self._pricing_result_to_dict(pricing_result)
            
            # Cache the result
            self.redis.setex(cache_key, self.cache_ttl, json.dumps(result_dict))
            
            self.logger.info(f"Calculated dynamic price: ${final_price:.2f} (surge: {surge_multiplier:.2f}x)")
            return result_dict
            
        except Exception as e:
            self.logger.error(f"Error calculating dynamic price: {str(e)}")
            # Return fallback pricing
            return self._fallback_pricing(ride_data)
    
    def _calculate_base_price(self, ride_data: Dict[str, Any]) -> float:
        """Calculate base price based on distance and estimated time"""
        try:
            distance_km = ride_data.get('distance_km', 0)
            estimated_duration_minutes = ride_data.get('estimated_duration_minutes', distance_km * 3)  # ~20km/h average
            
            # Base calculation
            distance_cost = distance_km * self.base_price_per_km
            time_cost = estimated_duration_minutes * self.base_price_per_minute
            
            base_price = distance_cost + time_cost
            return max(base_price, self.minimum_fare)
            
        except Exception as e:
            self.logger.error(f"Error calculating base price: {str(e)}")
            return self.minimum_fare
    
    def _calculate_demand_factor(self, ride_data: Dict[str, Any], 
                                market_conditions: Dict[str, Any]) -> float:
        """Calculate demand factor based on ride requests in the area"""
        try:
            origin = ride_data.get('origin', {})
            departure_time = datetime.fromisoformat(ride_data.get('departure_time', datetime.now().isoformat()))
            
            # Get recent ride requests in area (last hour)
            time_window = timedelta(hours=1)
            start_time = departure_time - time_window
            
            # Query recent ride requests within 5km radius
            query = """
            SELECT COUNT(*) as request_count
            FROM ride_requests rr
            WHERE rr.created_at >= %s 
            AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                rr.origin_coordinates::geography,
                5000
            )
            """
            
            result = self.db.execute_query(query, (
                start_time, 
                origin.get('longitude', 0), 
                origin.get('latitude', 0)
            ))
            
            request_count = result[0]['request_count'] if result else 0
            
            # Normalize demand (0 = low, 1 = normal, 2+ = high demand)
            demand_factor = min(2.0, request_count / 10.0)  # Scale: 10 requests = normal demand
            
            return demand_factor
            
        except Exception as e:
            self.logger.error(f"Error calculating demand factor: {str(e)}")
            return 1.0  # Normal demand as fallback
    
    def _calculate_supply_factor(self, ride_data: Dict[str, Any], 
                                market_conditions: Dict[str, Any]) -> float:
        """Calculate supply factor based on available drivers in area"""
        try:
            origin = ride_data.get('origin', {})
            
            # Get available drivers within 10km radius
            query = """
            SELECT COUNT(*) as driver_count
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            WHERE d.is_available = true
            AND d.status = 'online'
            AND d.current_location IS NOT NULL
            AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                d.current_location::geography,
                10000
            )
            """
            
            result = self.db.execute_query(query, (
                origin.get('longitude', 0), 
                origin.get('latitude', 0)
            ))
            
            driver_count = result[0]['driver_count'] if result else 0
            
            # Normalize supply (inverse factor: more drivers = lower prices)
            # 0 drivers = 2.0 factor, 5+ drivers = 0.5 factor
            if driver_count == 0:
                supply_factor = 2.0  # High multiplier for low supply
            elif driver_count >= 5:
                supply_factor = 0.5  # Low multiplier for high supply
            else:
                supply_factor = 1.5 - (driver_count * 0.2)  # Linear scale
            
            return max(0.3, supply_factor)  # Minimum 0.3 factor
            
        except Exception as e:
            self.logger.error(f"Error calculating supply factor: {str(e)}")
            return 1.0  # Normal supply as fallback
    
    def _calculate_time_factor(self, ride_data: Dict[str, Any]) -> float:
        """Calculate time-based pricing factor (rush hours, late night, etc.)"""
        try:
            departure_time = datetime.fromisoformat(ride_data.get('departure_time', datetime.now().isoformat()))
            hour = departure_time.hour
            weekday = departure_time.weekday()  # 0=Monday, 6=Sunday
            
            # Define time-based multipliers
            if weekday < 5:  # Weekdays
                if 7 <= hour <= 9 or 17 <= hour <= 19:  # Rush hours
                    time_factor = 1.4
                elif 22 <= hour or hour <= 5:  # Late night/early morning
                    time_factor = 1.2
                else:  # Regular hours
                    time_factor = 1.0
            else:  # Weekends
                if 22 <= hour or hour <= 5:  # Late night
                    time_factor = 1.3
                elif 10 <= hour <= 14:  # Weekend afternoon
                    time_factor = 1.1
                else:  # Regular weekend hours
                    time_factor = 1.0
            
            return time_factor
            
        except Exception as e:
            self.logger.error(f"Error calculating time factor: {str(e)}")
            return 1.0
    
    def _calculate_distance_factor(self, ride_data: Dict[str, Any]) -> float:
        """Calculate distance-based pricing adjustment"""
        try:
            distance_km = ride_data.get('distance_km', 0)
            
            # Distance-based adjustments
            if distance_km < 2:  # Short trips - slight premium
                distance_factor = 1.1
            elif distance_km > 20:  # Long trips - slight discount
                distance_factor = 0.9
            else:  # Normal distance
                distance_factor = 1.0
            
            return distance_factor
            
        except Exception:
            return 1.0
    
    def _calculate_weather_factor(self, market_conditions: Dict[str, Any]) -> float:
        """Calculate weather-based pricing factor"""
        try:
            if not market_conditions:
                return 1.0
            
            weather = market_conditions.get('weather', {})
            condition = weather.get('condition', 'clear').lower()
            temperature = weather.get('temperature', 20)  # Celsius
            
            # Weather-based multipliers
            weather_factor = 1.0
            
            if 'rain' in condition or 'storm' in condition:
                weather_factor = 1.3
            elif 'snow' in condition:
                weather_factor = 1.5
            elif temperature < 0 or temperature > 35:  # Extreme temperatures
                weather_factor = 1.2
            
            return weather_factor
            
        except Exception:
            return 1.0
    
    def _calculate_event_factor(self, ride_data: Dict[str, Any], 
                               market_conditions: Dict[str, Any]) -> float:
        """Calculate event-based pricing factor (concerts, sports, etc.)"""
        try:
            if not market_conditions:
                return 1.0
            
            events = market_conditions.get('events', [])
            origin = ride_data.get('origin', {})
            
            event_factor = 1.0
            
            for event in events:
                event_location = event.get('location', {})
                event_impact = event.get('impact', 'low')
                
                # Calculate distance to event (simplified)
                # In production, you'd use proper geospatial calculations
                distance_to_event = abs(origin.get('latitude', 0) - event_location.get('latitude', 0)) + \
                                  abs(origin.get('longitude', 0) - event_location.get('longitude', 0))
                
                if distance_to_event < 0.01:  # Very close to event (~1km)
                    if event_impact == 'high':
                        event_factor = max(event_factor, 1.5)
                    elif event_impact == 'medium':
                        event_factor = max(event_factor, 1.3)
                    else:
                        event_factor = max(event_factor, 1.2)
            
            return event_factor
            
        except Exception:
            return 1.0
    
    def _calculate_surge_multiplier(self, factors: Dict[str, float]) -> float:
        """Calculate overall surge multiplier using weighted factors"""
        try:
            # Calculate weighted average of all factors
            weighted_score = 0.0
            
            for factor_name, factor_value in factors.items():
                weight = self.weights.get(factor_name, 0)
                weighted_score += factor_value * weight
            
            # Add base weight for remaining factors
            remaining_weight = 1.0 - sum(self.weights.values())
            weighted_score += remaining_weight
            
            # Apply surge multiplier constraints
            surge_multiplier = min(self.maximum_surge, max(0.8, weighted_score))
            
            return round(surge_multiplier, 2)
            
        except Exception as e:
            self.logger.error(f"Error calculating surge multiplier: {str(e)}")
            return 1.0
    
    def _calculate_confidence_score(self, ride_data: Dict[str, Any], 
                                   market_conditions: Dict[str, Any]) -> float:
        """Calculate confidence score for pricing accuracy"""
        try:
            confidence = 1.0
            
            # Reduce confidence if missing data
            if not ride_data.get('distance_km'):
                confidence -= 0.2
            if not ride_data.get('departure_time'):
                confidence -= 0.1
            if not market_conditions:
                confidence -= 0.1
            
            return max(0.1, confidence)
            
        except Exception:
            return 0.5
    
    def _fallback_pricing(self, ride_data: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback pricing when main calculation fails"""
        base_price = max(ride_data.get('distance_km', 5) * self.base_price_per_km, self.minimum_fare)
        
        return {
            'base_price': base_price,
            'surge_multiplier': 1.0,
            'final_price': base_price,
            'demand_factor': 1.0,
            'supply_factor': 1.0,
            'time_factor': 1.0,
            'distance_factor': 1.0,
            'weather_factor': 1.0,
            'event_factor': 1.0,
            'confidence_score': 0.3,
            'breakdown': {
                'distance_cost': base_price * 0.8,
                'time_cost': base_price * 0.2,
                'surge_amount': 0.0
            },
            'currency': 'USD',
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def _generate_pricing_cache_key(self, ride_data: Dict[str, Any], 
                                   market_conditions: Dict[str, Any]) -> str:
        """Generate cache key for pricing request"""
        import hashlib
        
        origin = ride_data.get('origin', {})
        destination = ride_data.get('destination', {})
        departure_time = ride_data.get('departure_time', '')
        
        # Round coordinates to reduce cache fragmentation
        origin_rounded = {
            'lat': round(origin.get('latitude', 0), 3),
            'lng': round(origin.get('longitude', 0), 3)
        }
        destination_rounded = {
            'lat': round(destination.get('latitude', 0), 3),
            'lng': round(destination.get('longitude', 0), 3)
        }
        
        key_data = f"{origin_rounded}{destination_rounded}{departure_time[:16]}"  # Hour precision
        return f"pricing:{hashlib.md5(key_data.encode()).hexdigest()}"
    
    def _pricing_result_to_dict(self, result: PricingResult) -> Dict[str, Any]:
        """Convert PricingResult to dictionary"""
        return {
            'base_price': round(result.base_price, 2),
            'surge_multiplier': result.surge_multiplier,
            'final_price': round(result.final_price, 2),
            'demand_factor': round(result.demand_factor, 2),
            'supply_factor': round(result.supply_factor, 2),
            'time_factor': round(result.time_factor, 2),
            'distance_factor': round(result.distance_factor, 2),
            'weather_factor': round(result.weather_factor, 2),
            'event_factor': round(result.event_factor, 2),
            'confidence_score': round(result.confidence_score, 2),
            'breakdown': {
                'distance_cost': round(result.base_price * 0.7, 2),
                'time_cost': round(result.base_price * 0.3, 2),
                'surge_amount': round((result.final_price - result.base_price), 2)
            },
            'currency': 'USD',
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def get_historical_pricing(self, area: Dict[str, float], days: int = 7) -> Dict[str, Any]:
        """Get historical pricing data for an area"""
        try:
            # This would query historical pricing data
            # For now, return sample data
            return {
                'average_price': 12.50,
                'average_surge': 1.2,
                'peak_hours': [8, 9, 17, 18, 19],
                'days_analyzed': days
            }
        except Exception as e:
            self.logger.error(f"Error getting historical pricing: {str(e)}")
            return {}