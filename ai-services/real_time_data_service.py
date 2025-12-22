#!/usr/bin/env python3
"""
Real-time Data Integration Service for Hitch Platform
Integrates with external APIs for weather, traffic, and events data
"""

import asyncio
import aiohttp
import json
import logging
import redis
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class WeatherData:
    """Weather information for a location"""
    temperature: float
    humidity: float
    precipitation_probability: float
    wind_speed: float
    visibility: float
    weather_condition: str
    severity_score: float  # 0.0-1.0, higher means more impact

@dataclass
class TrafficData:
    """Traffic information for a location"""
    traffic_density: float  # 0.0-1.0
    average_speed: float    # km/h
    incidents_count: int
    congestion_level: str   # 'low', 'moderate', 'high', 'severe'
    estimated_delay: float  # minutes

@dataclass
class EventData:
    """Event information affecting transportation demand"""
    event_type: str
    event_name: str
    start_time: datetime
    end_time: datetime
    attendees_estimate: int
    impact_radius: float  # km
    impact_score: float   # 0.0-1.0

class RealTimeDataService:
    """
    Service for collecting and processing real-time data
    from external sources to enhance AI predictions
    """
    
    def __init__(self, redis_client=None):
        self.redis_client = redis_client or redis.Redis(
            host='localhost', port=6379, db=0, decode_responses=True
        )
        
        # API configurations (would be loaded from environment in production)
        self.api_keys = {
            'weather': 'demo_weather_api_key',
            'traffic': 'demo_traffic_api_key',
            'events': 'demo_events_api_key'
        }
        
        # Cache TTL settings
        self.cache_ttl = {
            'weather': 600,      # 10 minutes
            'traffic': 180,      # 3 minutes
            'events': 3600,      # 1 hour
            'aggregated': 300    # 5 minutes
        }
        
        # Data update intervals
        self.update_intervals = {
            'weather': 600,      # 10 minutes
            'traffic': 180,      # 3 minutes
            'events': 3600       # 1 hour
        }
        
        # Background tasks
        self.background_tasks = []
    
    async def start_background_collection(self):
        """Start background data collection tasks"""
        try:
            # Start weather data collection
            weather_task = asyncio.create_task(
                self._weather_collection_loop()
            )
            self.background_tasks.append(weather_task)
            
            # Start traffic data collection
            traffic_task = asyncio.create_task(
                self._traffic_collection_loop()
            )
            self.background_tasks.append(traffic_task)
            
            # Start event data collection
            events_task = asyncio.create_task(
                self._events_collection_loop()
            )
            self.background_tasks.append(events_task)
            
            logger.info("Background data collection started")
            
        except Exception as e:
            logger.error(f"Error starting background collection: {e}")
    
    async def stop_background_collection(self):
        """Stop background data collection tasks"""
        for task in self.background_tasks:
            task.cancel()
        
        await asyncio.gather(*self.background_tasks, return_exceptions=True)
        self.background_tasks.clear()
        logger.info("Background data collection stopped")
    
    async def get_weather_data(
        self, 
        latitude: float, 
        longitude: float
    ) -> WeatherData:
        """
        Get current weather data for a location
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            
        Returns:
            WeatherData object with current conditions
        """
        try:
            cache_key = f"weather:{latitude:.3f}:{longitude:.3f}"
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                data = json.loads(cached_data)
                return WeatherData(**data)
            
            # Fetch from weather API (simulated for development)
            weather_data = await self._fetch_weather_api(latitude, longitude)
            
            # Cache the result
            self.redis_client.setex(
                cache_key,
                self.cache_ttl['weather'],
                json.dumps(weather_data.__dict__)
            )
            
            return weather_data
            
        except Exception as e:
            logger.error(f"Error getting weather data: {e}")
            return self._get_fallback_weather()
    
    async def get_traffic_data(
        self, 
        latitude: float, 
        longitude: float,
        radius_km: float = 5.0
    ) -> TrafficData:
        """
        Get current traffic data for a location
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            radius_km: Radius to check traffic data
            
        Returns:
            TrafficData object with current conditions
        """
        try:
            cache_key = f"traffic:{latitude:.3f}:{longitude:.3f}:{radius_km}"
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                data = json.loads(cached_data)
                return TrafficData(**data)
            
            # Fetch from traffic API (simulated for development)
            traffic_data = await self._fetch_traffic_api(latitude, longitude, radius_km)
            
            # Cache the result
            self.redis_client.setex(
                cache_key,
                self.cache_ttl['traffic'],
                json.dumps(traffic_data.__dict__)
            )
            
            return traffic_data
            
        except Exception as e:
            logger.error(f"Error getting traffic data: {e}")
            return self._get_fallback_traffic()
    
    async def get_events_data(
        self, 
        latitude: float, 
        longitude: float,
        radius_km: float = 10.0,
        time_window_hours: int = 24
    ) -> List[EventData]:
        """
        Get upcoming events data for a location
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            radius_km: Radius to search for events
            time_window_hours: Time window to look ahead
            
        Returns:
            List of EventData objects
        """
        try:
            cache_key = f"events:{latitude:.3f}:{longitude:.3f}:{radius_km}:{time_window_hours}"
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                events_list = json.loads(cached_data)
                return [EventData(**event) for event in events_list]
            
            # Fetch from events API (simulated for development)
            events_data = await self._fetch_events_api(
                latitude, longitude, radius_km, time_window_hours
            )
            
            # Cache the result
            events_dict = [event.__dict__ for event in events_data]
            self.redis_client.setex(
                cache_key,
                self.cache_ttl['events'],
                json.dumps(events_dict, default=str)
            )
            
            return events_data
            
        except Exception as e:
            logger.error(f"Error getting events data: {e}")
            return []
    
    async def get_aggregated_conditions(
        self, 
        latitude: float, 
        longitude: float
    ) -> Dict[str, Any]:
        """
        Get aggregated real-time conditions for AI models
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            
        Returns:
            Dictionary with all relevant conditions
        """
        try:
            cache_key = f"aggregated:{latitude:.3f}:{longitude:.3f}"
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                return json.loads(cached_data)
            
            # Gather all data concurrently
            weather_task = self.get_weather_data(latitude, longitude)
            traffic_task = self.get_traffic_data(latitude, longitude)
            events_task = self.get_events_data(latitude, longitude)
            
            weather_data, traffic_data, events_data = await asyncio.gather(
                weather_task, traffic_task, events_task
            )
            
            # Calculate composite scores
            conditions = {
                'weather': {
                    'temperature': weather_data.temperature,
                    'precipitation_probability': weather_data.precipitation_probability,
                    'severity_score': weather_data.severity_score,
                    'condition': weather_data.weather_condition
                },
                'traffic': {
                    'density': traffic_data.traffic_density,
                    'congestion_level': traffic_data.congestion_level,
                    'incidents_count': traffic_data.incidents_count,
                    'estimated_delay': traffic_data.estimated_delay
                },
                'events': {
                    'count': len(events_data),
                    'max_impact': max([e.impact_score for e in events_data], default=0.0),
                    'total_attendees': sum([e.attendees_estimate for e in events_data])
                },
                'composite_scores': {
                    'demand_multiplier': self._calculate_demand_multiplier(
                        weather_data, traffic_data, events_data
                    ),
                    'price_impact': self._calculate_price_impact(
                        weather_data, traffic_data, events_data
                    ),
                    'wait_time_impact': self._calculate_wait_time_impact(
                        weather_data, traffic_data, events_data
                    )
                },
                'timestamp': datetime.now().isoformat()
            }
            
            # Cache aggregated conditions
            self.redis_client.setex(
                cache_key,
                self.cache_ttl['aggregated'],
                json.dumps(conditions, default=str)
            )
            
            return conditions
            
        except Exception as e:
            logger.error(f"Error getting aggregated conditions: {e}")
            return self._get_fallback_conditions()
    
    async def _weather_collection_loop(self):
        """Background loop for weather data collection"""
        while True:
            try:
                # Define key locations for data collection
                key_locations = [
                    (40.7128, -74.0060),  # New York
                    (34.0522, -118.2437), # Los Angeles
                    (41.8781, -87.6298),  # Chicago
                    (29.7604, -95.3698),  # Houston
                ]
                
                for lat, lng in key_locations:
                    await self.get_weather_data(lat, lng)
                    await asyncio.sleep(1)  # Rate limiting
                
                await asyncio.sleep(self.update_intervals['weather'])
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in weather collection loop: {e}")
                await asyncio.sleep(60)  # Wait before retrying
    
    async def _traffic_collection_loop(self):
        """Background loop for traffic data collection"""
        while True:
            try:
                # Define key locations for traffic monitoring
                key_locations = [
                    (40.7128, -74.0060),  # New York
                    (34.0522, -118.2437), # Los Angeles
                    (41.8781, -87.6298),  # Chicago
                    (29.7604, -95.3698),  # Houston
                ]
                
                for lat, lng in key_locations:
                    await self.get_traffic_data(lat, lng)
                    await asyncio.sleep(0.5)  # Rate limiting
                
                await asyncio.sleep(self.update_intervals['traffic'])
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in traffic collection loop: {e}")
                await asyncio.sleep(30)  # Wait before retrying
    
    async def _events_collection_loop(self):
        """Background loop for events data collection"""
        while True:
            try:
                # Define key locations for event monitoring
                key_locations = [
                    (40.7128, -74.0060),  # New York
                    (34.0522, -118.2437), # Los Angeles
                    (41.8781, -87.6298),  # Chicago
                    (29.7604, -95.3698),  # Houston
                ]
                
                for lat, lng in key_locations:
                    await self.get_events_data(lat, lng)
                    await asyncio.sleep(2)  # Rate limiting
                
                await asyncio.sleep(self.update_intervals['events'])
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in events collection loop: {e}")
                await asyncio.sleep(300)  # Wait before retrying
    
    async def _fetch_weather_api(
        self, 
        latitude: float, 
        longitude: float
    ) -> WeatherData:
        """Fetch weather data from external API (simulated)"""
        try:
            # In production, this would make actual API calls
            # For development, we simulate realistic weather data
            
            # Simulate seasonal and time-based weather patterns
            now = datetime.now()
            hour = now.hour
            month = now.month
            
            # Base temperature varies by season
            if month in [12, 1, 2]:  # Winter
                base_temp = np.random.normal(-2, 8)
            elif month in [3, 4, 5]:  # Spring
                base_temp = np.random.normal(15, 6)
            elif month in [6, 7, 8]:  # Summer
                base_temp = np.random.normal(25, 5)
            else:  # Fall
                base_temp = np.random.normal(12, 7)
            
            # Daily temperature variation
            temp_variation = 8 * np.sin((hour - 6) * np.pi / 12)
            temperature = base_temp + temp_variation
            
            # Other weather conditions
            humidity = np.random.uniform(30, 90)
            precipitation_prob = np.random.uniform(0, 1)
            wind_speed = np.random.uniform(0, 25)
            visibility = np.random.uniform(5, 15)
            
            # Determine weather condition
            if precipitation_prob > 0.7:
                if temperature < 0:
                    condition = "snow"
                else:
                    condition = "rain"
            elif precipitation_prob > 0.4:
                condition = "cloudy"
            else:
                condition = "clear"
            
            # Calculate severity score (impact on ride demand)
            severity = 0.0
            if condition == "rain":
                severity += 0.3
            elif condition == "snow":
                severity += 0.6
            
            if wind_speed > 15:
                severity += 0.2
            
            if visibility < 8:
                severity += 0.3
            
            if temperature < -5 or temperature > 35:
                severity += 0.4
            
            severity = min(1.0, severity)
            
            return WeatherData(
                temperature=temperature,
                humidity=humidity,
                precipitation_probability=precipitation_prob,
                wind_speed=wind_speed,
                visibility=visibility,
                weather_condition=condition,
                severity_score=severity
            )
            
        except Exception as e:
            logger.error(f"Error fetching weather API: {e}")
            return self._get_fallback_weather()
    
    async def _fetch_traffic_api(
        self, 
        latitude: float, 
        longitude: float,
        radius_km: float
    ) -> TrafficData:
        """Fetch traffic data from external API (simulated)"""
        try:
            # Simulate traffic patterns based on time and location
            now = datetime.now()
            hour = now.hour
            day_of_week = now.weekday()
            
            # Base traffic density
            if 7 <= hour <= 9 or 17 <= hour <= 19:  # Rush hours
                base_density = np.random.uniform(0.7, 1.0)
                avg_speed = np.random.uniform(20, 40)
            elif day_of_week < 5 and 9 <= hour <= 17:  # Business hours
                base_density = np.random.uniform(0.4, 0.7)
                avg_speed = np.random.uniform(40, 60)
            elif day_of_week >= 5 and 19 <= hour <= 23:  # Weekend evenings
                base_density = np.random.uniform(0.5, 0.8)
                avg_speed = np.random.uniform(30, 50)
            else:  # Off-peak
                base_density = np.random.uniform(0.1, 0.4)
                avg_speed = np.random.uniform(50, 80)
            
            # Random incidents
            incidents_count = np.random.poisson(0.2 * radius_km * base_density)
            
            # Adjust for incidents
            if incidents_count > 0:
                base_density = min(1.0, base_density + 0.2 * incidents_count)
                avg_speed *= 0.8
            
            # Determine congestion level
            if base_density < 0.3:
                congestion_level = "low"
                estimated_delay = np.random.uniform(0, 2)
            elif base_density < 0.6:
                congestion_level = "moderate"
                estimated_delay = np.random.uniform(2, 8)
            elif base_density < 0.8:
                congestion_level = "high"
                estimated_delay = np.random.uniform(8, 20)
            else:
                congestion_level = "severe"
                estimated_delay = np.random.uniform(20, 45)
            
            return TrafficData(
                traffic_density=base_density,
                average_speed=avg_speed,
                incidents_count=incidents_count,
                congestion_level=congestion_level,
                estimated_delay=estimated_delay
            )
            
        except Exception as e:
            logger.error(f"Error fetching traffic API: {e}")
            return self._get_fallback_traffic()
    
    async def _fetch_events_api(
        self, 
        latitude: float, 
        longitude: float,
        radius_km: float,
        time_window_hours: int
    ) -> List[EventData]:
        """Fetch events data from external API (simulated)"""
        try:
            events = []
            now = datetime.now()
            
            # Simulate various types of events
            event_types = [
                ("concert", 5000, 0.8),
                ("sports", 20000, 0.9),
                ("conference", 2000, 0.3),
                ("festival", 15000, 0.7),
                ("theater", 800, 0.2),
                ("exhibition", 1500, 0.3)
            ]
            
            # Generate random events within the time window
            num_events = np.random.poisson(2.0)  # Average 2 events
            
            for _ in range(num_events):
                event_type, base_attendees, base_impact = np.random.choice(
                    event_types, 1
                )[0]
                
                # Random event timing within window
                hours_offset = np.random.uniform(0, time_window_hours)
                start_time = now + timedelta(hours=hours_offset)
                duration = np.random.uniform(2, 8)  # 2-8 hours
                end_time = start_time + timedelta(hours=duration)
                
                # Vary attendees and impact
                attendees = int(base_attendees * np.random.uniform(0.5, 1.5))
                impact_score = min(1.0, base_impact * np.random.uniform(0.7, 1.3))
                
                # Calculate impact radius based on event size
                impact_radius = min(10.0, 2.0 + (attendees / 5000) * 3.0)
                
                event = EventData(
                    event_type=event_type,
                    event_name=f"{event_type.title()} Event {len(events) + 1}",
                    start_time=start_time,
                    end_time=end_time,
                    attendees_estimate=attendees,
                    impact_radius=impact_radius,
                    impact_score=impact_score
                )
                
                events.append(event)
            
            return events
            
        except Exception as e:
            logger.error(f"Error fetching events API: {e}")
            return []
    
    def _calculate_demand_multiplier(
        self,
        weather: WeatherData,
        traffic: TrafficData,
        events: List[EventData]
    ) -> float:
        """Calculate demand multiplier based on conditions"""
        multiplier = 1.0
        
        # Weather impact
        if weather.weather_condition in ["rain", "snow"]:
            multiplier += 0.3
        elif weather.weather_condition == "cloudy":
            multiplier += 0.1
        
        if weather.temperature < 0 or weather.temperature > 35:
            multiplier += 0.2
        
        # Traffic impact
        if traffic.congestion_level == "high":
            multiplier += 0.2
        elif traffic.congestion_level == "severe":
            multiplier += 0.4
        
        # Events impact
        total_event_impact = sum([e.impact_score for e in events])
        multiplier += min(0.5, total_event_impact * 0.3)
        
        return min(2.5, multiplier)  # Cap at 2.5x
    
    def _calculate_price_impact(
        self,
        weather: WeatherData,
        traffic: TrafficData,
        events: List[EventData]
    ) -> float:
        """Calculate price impact multiplier"""
        impact = 1.0
        
        # Weather-driven price adjustments
        if weather.severity_score > 0.5:
            impact += weather.severity_score * 0.3
        
        # Traffic-driven adjustments
        if traffic.traffic_density > 0.7:
            impact += 0.2
        
        # Event-driven adjustments
        if events:
            max_event_impact = max([e.impact_score for e in events])
            impact += max_event_impact * 0.25
        
        return min(2.0, impact)  # Cap at 2.0x
    
    def _calculate_wait_time_impact(
        self,
        weather: WeatherData,
        traffic: TrafficData,
        events: List[EventData]
    ) -> float:
        """Calculate wait time impact multiplier"""
        impact = 1.0
        
        # Weather increases wait times
        impact += weather.severity_score * 0.5
        
        # Traffic increases wait times
        impact += traffic.traffic_density * 0.3
        
        # Events can increase wait times
        if events:
            total_attendees = sum([e.attendees_estimate for e in events])
            impact += min(0.4, total_attendees / 50000)
        
        return min(3.0, impact)  # Cap at 3.0x
    
    def _get_fallback_weather(self) -> WeatherData:
        """Return fallback weather data"""
        return WeatherData(
            temperature=20.0,
            humidity=50.0,
            precipitation_probability=0.1,
            wind_speed=5.0,
            visibility=10.0,
            weather_condition="clear",
            severity_score=0.1
        )
    
    def _get_fallback_traffic(self) -> TrafficData:
        """Return fallback traffic data"""
        return TrafficData(
            traffic_density=0.5,
            average_speed=50.0,
            incidents_count=0,
            congestion_level="moderate",
            estimated_delay=5.0
        )
    
    def _get_fallback_conditions(self) -> Dict[str, Any]:
        """Return fallback aggregated conditions"""
        return {
            'weather': {
                'temperature': 20.0,
                'precipitation_probability': 0.1,
                'severity_score': 0.1,
                'condition': 'clear'
            },
            'traffic': {
                'density': 0.5,
                'congestion_level': 'moderate',
                'incidents_count': 0,
                'estimated_delay': 5.0
            },
            'events': {
                'count': 0,
                'max_impact': 0.0,
                'total_attendees': 0
            },
            'composite_scores': {
                'demand_multiplier': 1.0,
                'price_impact': 1.0,
                'wait_time_impact': 1.0
            },
            'timestamp': datetime.now().isoformat()
        }

# Example usage and testing
if __name__ == "__main__":
    async def test_real_time_data():
        """Test the real-time data service"""
        service = RealTimeDataService()
        
        # Test weather data
        weather = await service.get_weather_data(40.7128, -74.0060)
        print(f"Weather: {weather.weather_condition}, {weather.temperature:.1f}°C, "
              f"severity: {weather.severity_score:.2f}")
        
        # Test traffic data
        traffic = await service.get_traffic_data(40.7128, -74.0060)
        print(f"Traffic: {traffic.congestion_level}, density: {traffic.traffic_density:.2f}, "
              f"delay: {traffic.estimated_delay:.1f}min")
        
        # Test events data
        events = await service.get_events_data(40.7128, -74.0060)
        print(f"Events: {len(events)} events found")
        for event in events:
            print(f"  - {event.event_name}: {event.attendees_estimate} attendees, "
                  f"impact: {event.impact_score:.2f}")
        
        # Test aggregated conditions
        conditions = await service.get_aggregated_conditions(40.7128, -74.0060)
        print(f"Aggregated conditions:")
        print(f"  - Demand multiplier: {conditions['composite_scores']['demand_multiplier']:.2f}")
        print(f"  - Price impact: {conditions['composite_scores']['price_impact']:.2f}")
        print(f"  - Wait time impact: {conditions['composite_scores']['wait_time_impact']:.2f}")
    
    # Run test
    asyncio.run(test_real_time_data())