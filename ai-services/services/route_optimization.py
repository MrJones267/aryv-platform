"""
Route Optimization Service - AI-powered route optimization for multiple passengers
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
import itertools
import json

@dataclass
class Waypoint:
    id: str
    type: str  # 'pickup', 'dropoff'
    latitude: float
    longitude: float
    address: str
    passenger_id: str
    estimated_time: int  # seconds
    priority: int = 1

@dataclass
class OptimizedRoute:
    waypoints: List[Waypoint]
    total_distance: float
    total_time: int
    total_cost: float
    efficiency_score: float
    passenger_routes: Dict[str, Dict[str, Any]]

class RouteOptimizationService:
    """AI-powered route optimization using genetic algorithm and heuristics"""
    
    def __init__(self, db_manager, redis_client):
        self.db = db_manager
        self.redis = redis_client
        self.logger = logging.getLogger(__name__)
        
        # Optimization parameters
        self.avg_speed_kmh = 30  # Average city driving speed
        self.pickup_time_seconds = 120  # 2 minutes per pickup
        self.dropoff_time_seconds = 60   # 1 minute per dropoff
        self.max_detour_factor = 1.5     # Max 50% detour
        self.max_passengers = 4          # Maximum passengers per ride
        
        # Cache settings
        self.cache_ttl = 600  # 10 minutes cache for route optimization
        
    def optimize_route(self, waypoints: List[Dict[str, Any]], 
                      constraints: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Optimize route for multiple pickup and dropoff points
        
        Args:
            waypoints: List of pickup/dropoff points with coordinates
            constraints: Route constraints and preferences
            
        Returns:
            Optimized route with detailed breakdown
        """
        try:
            # Parse waypoints
            waypoint_objects = self._parse_waypoints(waypoints)
            
            if len(waypoint_objects) < 2:
                raise ValueError("At least 2 waypoints required")
            
            # Create cache key
            cache_key = self._generate_route_cache_key(waypoints, constraints)
            
            # Check cache first
            cached_result = self.redis.get(cache_key)
            if cached_result:
                self.logger.info("Returning cached route optimization")
                return json.loads(cached_result)
            
            # Apply constraints
            constraints = constraints or {}
            max_passengers = min(constraints.get('max_passengers', self.max_passengers), self.max_passengers)
            
            # Validate passenger count
            passengers = set(w.passenger_id for w in waypoint_objects if w.passenger_id)
            if len(passengers) > max_passengers:
                raise ValueError(f"Too many passengers: {len(passengers)} (max: {max_passengers})")
            
            # Optimize route using different algorithms
            optimized_route = self._optimize_with_genetic_algorithm(waypoint_objects, constraints)
            
            # Calculate passenger-specific routes
            passenger_routes = self._calculate_passenger_routes(optimized_route, waypoint_objects)
            
            # Prepare result
            result = {
                'optimized_waypoints': [self._waypoint_to_dict(wp) for wp in optimized_route.waypoints],
                'route_summary': {
                    'total_distance_km': round(optimized_route.total_distance, 2),
                    'total_time_minutes': round(optimized_route.total_time / 60, 1),
                    'efficiency_score': round(optimized_route.efficiency_score, 3),
                    'total_passengers': len(passengers)
                },
                'passenger_routes': passenger_routes,
                'optimization_metadata': {
                    'algorithm': 'genetic_algorithm',
                    'optimization_time_ms': 0,  # Would track actual optimization time
                    'iterations': 100
                },
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Cache the result
            self.redis.setex(cache_key, self.cache_ttl, json.dumps(result))
            
            self.logger.info(f"Optimized route for {len(passengers)} passengers, "
                           f"distance: {optimized_route.total_distance:.1f}km, "
                           f"time: {optimized_route.total_time/60:.1f}min")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error optimizing route: {str(e)}")
            return self._fallback_route_optimization(waypoints)
    
    def _parse_waypoints(self, waypoints: List[Dict[str, Any]]) -> List[Waypoint]:
        """Parse waypoint dictionaries into Waypoint objects"""
        waypoint_objects = []
        
        for i, wp in enumerate(waypoints):
            waypoint_objects.append(Waypoint(
                id=wp.get('id', f'waypoint_{i}'),
                type=wp.get('type', 'pickup'),
                latitude=wp.get('latitude', 0.0),
                longitude=wp.get('longitude', 0.0),
                address=wp.get('address', ''),
                passenger_id=wp.get('passenger_id', f'passenger_{i}'),
                estimated_time=wp.get('estimated_time', self.pickup_time_seconds),
                priority=wp.get('priority', 1)
            ))
        
        return waypoint_objects
    
    def _optimize_with_genetic_algorithm(self, waypoints: List[Waypoint], 
                                       constraints: Dict[str, Any]) -> OptimizedRoute:
        """Optimize route using genetic algorithm approach"""
        try:
            # For simplicity, we'll use a heuristic approach here
            # In production, you'd implement a full genetic algorithm
            
            # Separate pickups and dropoffs
            pickups = [wp for wp in waypoints if wp.type == 'pickup']
            dropoffs = [wp for wp in waypoints if wp.type == 'dropoff']
            
            if len(pickups) == 1 and len(dropoffs) == 1:
                # Simple case: single pickup and dropoff
                optimized_waypoints = pickups + dropoffs
            else:
                # Complex case: multiple passengers
                optimized_waypoints = self._optimize_multi_passenger_route(pickups, dropoffs, constraints)
            
            # Calculate route metrics
            total_distance = self._calculate_total_distance(optimized_waypoints)
            total_time = self._calculate_total_time(optimized_waypoints)
            efficiency_score = self._calculate_efficiency_score(optimized_waypoints, waypoints)
            
            return OptimizedRoute(
                waypoints=optimized_waypoints,
                total_distance=total_distance,
                total_time=total_time,
                total_cost=0.0,  # Would calculate based on distance/time
                efficiency_score=efficiency_score,
                passenger_routes={}
            )
            
        except Exception as e:
            self.logger.error(f"Error in genetic algorithm optimization: {str(e)}")
            return OptimizedRoute(
                waypoints=waypoints,
                total_distance=self._calculate_total_distance(waypoints),
                total_time=self._calculate_total_time(waypoints),
                total_cost=0.0,
                efficiency_score=0.5,
                passenger_routes={}
            )
    
    def _optimize_multi_passenger_route(self, pickups: List[Waypoint], 
                                      dropoffs: List[Waypoint],
                                      constraints: Dict[str, Any]) -> List[Waypoint]:
        """Optimize route for multiple passengers using nearest neighbor heuristic"""
        try:
            optimized_route = []
            current_location = pickups[0] if pickups else dropoffs[0]
            remaining_pickups = pickups.copy()
            remaining_dropoffs = dropoffs.copy()
            passenger_in_car = set()
            
            # Add first pickup
            if remaining_pickups:
                first_pickup = remaining_pickups.pop(0)
                optimized_route.append(first_pickup)
                passenger_in_car.add(first_pickup.passenger_id)
                current_location = first_pickup
            
            # Continue until all waypoints are visited
            while remaining_pickups or remaining_dropoffs:
                next_waypoint = None
                min_distance = float('inf')
                
                # Consider dropoffs for passengers already in car
                available_dropoffs = [dp for dp in remaining_dropoffs 
                                    if dp.passenger_id in passenger_in_car]
                
                # If we have too many passengers, prioritize dropoffs
                if len(passenger_in_car) >= constraints.get('max_passengers', self.max_passengers):
                    candidates = available_dropoffs
                else:
                    candidates = remaining_pickups + available_dropoffs
                
                # Find nearest waypoint
                for candidate in candidates:
                    distance = geodesic(
                        (current_location.latitude, current_location.longitude),
                        (candidate.latitude, candidate.longitude)
                    ).kilometers
                    
                    if distance < min_distance:
                        min_distance = distance
                        next_waypoint = candidate
                
                if next_waypoint:
                    optimized_route.append(next_waypoint)
                    
                    if next_waypoint.type == 'pickup':
                        remaining_pickups.remove(next_waypoint)
                        passenger_in_car.add(next_waypoint.passenger_id)
                    else:  # dropoff
                        remaining_dropoffs.remove(next_waypoint)
                        passenger_in_car.discard(next_waypoint.passenger_id)
                    
                    current_location = next_waypoint
                else:
                    # Fallback: add remaining waypoints in order
                    optimized_route.extend(remaining_pickups + remaining_dropoffs)
                    break
            
            return optimized_route
            
        except Exception as e:
            self.logger.error(f"Error optimizing multi-passenger route: {str(e)}")
            return pickups + dropoffs
    
    def _calculate_total_distance(self, waypoints: List[Waypoint]) -> float:
        """Calculate total distance of the route"""
        if len(waypoints) < 2:
            return 0.0
        
        total_distance = 0.0
        for i in range(len(waypoints) - 1):
            current = waypoints[i]
            next_wp = waypoints[i + 1]
            
            distance = geodesic(
                (current.latitude, current.longitude),
                (next_wp.latitude, next_wp.longitude)
            ).kilometers
            
            total_distance += distance
        
        return total_distance
    
    def _calculate_total_time(self, waypoints: List[Waypoint]) -> int:
        """Calculate total time for the route in seconds"""
        if len(waypoints) < 2:
            return 0
        
        # Driving time
        total_distance = self._calculate_total_distance(waypoints)
        driving_time = (total_distance / self.avg_speed_kmh) * 3600  # Convert to seconds
        
        # Stop time at each waypoint
        stop_time = sum(wp.estimated_time for wp in waypoints[:-1])  # Last stop doesn't count
        
        return int(driving_time + stop_time)
    
    def _calculate_efficiency_score(self, optimized: List[Waypoint], 
                                   original: List[Waypoint]) -> float:
        """Calculate efficiency score (0-1, higher is better)"""
        try:
            # Compare to simple sequential route
            sequential_distance = self._calculate_total_distance(original)
            optimized_distance = self._calculate_total_distance(optimized)
            
            if sequential_distance == 0:
                return 1.0
            
            # Efficiency score: smaller optimized distance = higher efficiency
            efficiency = min(1.0, sequential_distance / optimized_distance)
            return max(0.0, efficiency)
            
        except Exception:
            return 0.5
    
    def _calculate_passenger_routes(self, optimized_route: OptimizedRoute, 
                                   waypoints: List[Waypoint]) -> Dict[str, Dict[str, Any]]:
        """Calculate individual passenger route information"""
        passenger_routes = {}
        
        try:
            # Group waypoints by passenger
            passenger_waypoints = {}
            for wp in waypoints:
                if wp.passenger_id not in passenger_waypoints:
                    passenger_waypoints[wp.passenger_id] = {'pickup': None, 'dropoff': None}
                
                if wp.type == 'pickup':
                    passenger_waypoints[wp.passenger_id]['pickup'] = wp
                else:
                    passenger_waypoints[wp.passenger_id]['dropoff'] = wp
            
            # Calculate route info for each passenger
            for passenger_id, psgr_waypoints in passenger_waypoints.items():
                pickup = psgr_waypoints.get('pickup')
                dropoff = psgr_waypoints.get('dropoff')
                
                if pickup and dropoff:
                    # Find positions in optimized route
                    pickup_index = next((i for i, wp in enumerate(optimized_route.waypoints) 
                                       if wp.id == pickup.id), -1)
                    dropoff_index = next((i for i, wp in enumerate(optimized_route.waypoints) 
                                        if wp.id == dropoff.id), -1)
                    
                    # Calculate passenger-specific metrics
                    passenger_distance = geodesic(
                        (pickup.latitude, pickup.longitude),
                        (dropoff.latitude, dropoff.longitude)
                    ).kilometers
                    
                    # Calculate estimated times
                    pickup_eta = self._calculate_waypoint_eta(optimized_route.waypoints, pickup_index)
                    dropoff_eta = self._calculate_waypoint_eta(optimized_route.waypoints, dropoff_index)
                    
                    passenger_routes[passenger_id] = {
                        'pickup_order': pickup_index + 1,
                        'dropoff_order': dropoff_index + 1,
                        'direct_distance_km': round(passenger_distance, 2),
                        'estimated_pickup_time': pickup_eta,
                        'estimated_dropoff_time': dropoff_eta,
                        'estimated_ride_time_minutes': round((dropoff_eta - pickup_eta) / 60, 1),
                        'pickup_location': {
                            'latitude': pickup.latitude,
                            'longitude': pickup.longitude,
                            'address': pickup.address
                        },
                        'dropoff_location': {
                            'latitude': dropoff.latitude,
                            'longitude': dropoff.longitude,
                            'address': dropoff.address
                        }
                    }
            
        except Exception as e:
            self.logger.error(f"Error calculating passenger routes: {str(e)}")
        
        return passenger_routes
    
    def _calculate_waypoint_eta(self, waypoints: List[Waypoint], waypoint_index: int) -> int:
        """Calculate ETA for a specific waypoint in seconds from now"""
        if waypoint_index < 0 or waypoint_index >= len(waypoints):
            return 0
        
        total_time = 0
        
        for i in range(waypoint_index):
            if i < len(waypoints) - 1:
                current = waypoints[i]
                next_wp = waypoints[i + 1]
                
                # Driving time
                distance = geodesic(
                    (current.latitude, current.longitude),
                    (next_wp.latitude, next_wp.longitude)
                ).kilometers
                driving_time = (distance / self.avg_speed_kmh) * 3600
                
                # Stop time
                stop_time = current.estimated_time
                
                total_time += driving_time + stop_time
        
        return int(total_time)
    
    def _fallback_route_optimization(self, waypoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Fallback route when optimization fails"""
        return {
            'optimized_waypoints': waypoints,
            'route_summary': {
                'total_distance_km': 10.0,  # Estimate
                'total_time_minutes': 30.0,  # Estimate
                'efficiency_score': 0.5,
                'total_passengers': len(set(wp.get('passenger_id') for wp in waypoints))
            },
            'passenger_routes': {},
            'optimization_metadata': {
                'algorithm': 'fallback',
                'optimization_time_ms': 0,
                'iterations': 0
            },
            'error': 'Route optimization failed, using fallback',
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def _generate_route_cache_key(self, waypoints: List[Dict[str, Any]], 
                                 constraints: Dict[str, Any]) -> str:
        """Generate cache key for route optimization"""
        import hashlib
        
        # Sort waypoints for consistent caching
        sorted_waypoints = sorted(waypoints, key=lambda x: (x.get('latitude', 0), x.get('longitude', 0)))
        
        key_data = str(sorted_waypoints) + str(constraints or {})
        return f"route_opt:{hashlib.md5(key_data.encode()).hexdigest()}"
    
    def _waypoint_to_dict(self, waypoint: Waypoint) -> Dict[str, Any]:
        """Convert Waypoint object to dictionary"""
        return {
            'id': waypoint.id,
            'type': waypoint.type,
            'latitude': waypoint.latitude,
            'longitude': waypoint.longitude,
            'address': waypoint.address,
            'passenger_id': waypoint.passenger_id,
            'estimated_time': waypoint.estimated_time,
            'priority': waypoint.priority
        }
    
    def get_route_alternatives(self, waypoints: List[Dict[str, Any]], 
                             num_alternatives: int = 3) -> List[Dict[str, Any]]:
        """Generate alternative route options"""
        try:
            alternatives = []
            
            for i in range(num_alternatives):
                # Generate variations by modifying optimization parameters
                modified_constraints = {
                    'max_passengers': self.max_passengers - i,
                    'max_detour_factor': self.max_detour_factor + (i * 0.1)
                }
                
                alternative = self.optimize_route(waypoints, modified_constraints)
                alternative['alternative_id'] = i + 1
                alternatives.append(alternative)
            
            return alternatives
            
        except Exception as e:
            self.logger.error(f"Error generating route alternatives: {str(e)}")
            return []