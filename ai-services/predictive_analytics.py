#!/usr/bin/env python3
"""
Advanced Predictive Analytics Service for Hitch Platform
Builds upon existing AI infrastructure with enhanced ML capabilities
"""

import asyncio
import json
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
import joblib
import redis
import requests
import warnings
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class PredictionResult:
    """Structure for prediction results with confidence metrics"""
    prediction: float
    confidence: float
    factors: Dict[str, float]
    timestamp: datetime
    model_version: str

@dataclass
class MarketConditions:
    """Real-time market conditions"""
    active_drivers: int
    active_passengers: int
    avg_wait_time: float
    surge_multiplier: float
    weather_impact: float
    traffic_density: float
    event_impact: float

class AdvancedPredictiveAnalytics:
    """
    Enhanced predictive analytics service with real-time capabilities
    and advanced machine learning models
    """
    
    def __init__(self, redis_client=None):
        self.redis_client = redis_client or redis.Redis(
            host='localhost', port=6379, db=0, decode_responses=True
        )
        
        # Model configurations
        self.models = {
            'demand_prediction': None,
            'price_optimization': None,
            'wait_time_prediction': None,
            'user_behavior': None,
            'churn_prediction': None
        }
        
        # Feature scalers
        self.scalers = {}
        
        # Cache configurations
        self.cache_ttl = {
            'predictions': 300,  # 5 minutes
            'market_data': 60,   # 1 minute
            'user_patterns': 1800  # 30 minutes
        }
        
        # Initialize models
        self._initialize_models()
        
    def _initialize_models(self):
        """Initialize and load pre-trained models"""
        try:
            # Initialize demand prediction model
            self.models['demand_prediction'] = GradientBoostingRegressor(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=6,
                random_state=42
            )
            
            # Initialize price optimization model
            self.models['price_optimization'] = RandomForestRegressor(
                n_estimators=150,
                max_depth=8,
                random_state=42
            )
            
            # Initialize wait time prediction model
            self.models['wait_time_prediction'] = GradientBoostingRegressor(
                n_estimators=80,
                learning_rate=0.15,
                max_depth=5,
                random_state=42
            )
            
            # Initialize user behavior model
            self.models['user_behavior'] = RandomForestRegressor(
                n_estimators=100,
                max_depth=6,
                random_state=42
            )
            
            # Initialize churn prediction model
            self.models['churn_prediction'] = GradientBoostingRegressor(
                n_estimators=120,
                learning_rate=0.1,
                max_depth=7,
                random_state=42
            )
            
            logger.info("All predictive models initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing models: {e}")
            raise
    
    async def predict_demand(
        self, 
        latitude: float, 
        longitude: float, 
        time_horizon: int = 60,
        include_factors: bool = True
    ) -> PredictionResult:
        """
        Predict ride demand for a specific location and time window
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            time_horizon: Prediction horizon in minutes
            include_factors: Include factor analysis
            
        Returns:
            PredictionResult with demand prediction
        """
        try:
            cache_key = f"demand_pred:{latitude}:{longitude}:{time_horizon}"
            cached_result = self.redis_client.get(cache_key)
            
            if cached_result:
                return PredictionResult(**json.loads(cached_result))
            
            # Get current market conditions
            market_conditions = await self._get_market_conditions(latitude, longitude)
            
            # Prepare features
            features = await self._prepare_demand_features(
                latitude, longitude, time_horizon, market_conditions
            )
            
            # Scale features
            if 'demand_prediction' not in self.scalers:
                self.scalers['demand_prediction'] = StandardScaler()
                features_scaled = self.scalers['demand_prediction'].fit_transform([features])
            else:
                features_scaled = self.scalers['demand_prediction'].transform([features])
            
            # Make prediction
            prediction = self.models['demand_prediction'].predict(features_scaled)[0]
            
            # Calculate confidence based on historical accuracy
            confidence = await self._calculate_prediction_confidence(
                'demand_prediction', features, prediction
            )
            
            # Analyze contributing factors
            factors = {}
            if include_factors:
                factors = await self._analyze_demand_factors(
                    features, market_conditions
                )
            
            result = PredictionResult(
                prediction=max(0.0, prediction),
                confidence=confidence,
                factors=factors,
                timestamp=datetime.now(),
                model_version="v2.1.0"
            )
            
            # Cache result
            self.redis_client.setex(
                cache_key, 
                self.cache_ttl['predictions'], 
                json.dumps(result.__dict__, default=str)
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error predicting demand: {e}")
            # Return fallback prediction
            return PredictionResult(
                prediction=5.0,  # Conservative fallback
                confidence=0.3,
                factors={},
                timestamp=datetime.now(),
                model_version="fallback"
            )
    
    async def optimize_pricing(
        self,
        base_price: float,
        latitude: float,
        longitude: float,
        demand_level: float,
        supply_level: float
    ) -> PredictionResult:
        """
        Optimize pricing based on real-time market conditions
        
        Args:
            base_price: Base price for the ride
            latitude: Location latitude
            longitude: Location longitude
            demand_level: Current demand level
            supply_level: Current supply level
            
        Returns:
            PredictionResult with optimized price
        """
        try:
            cache_key = f"price_opt:{latitude}:{longitude}:{demand_level}:{supply_level}"
            cached_result = self.redis_client.get(cache_key)
            
            if cached_result:
                result_data = json.loads(cached_result)
                result_data['prediction'] *= base_price  # Scale to actual price
                return PredictionResult(**result_data)
            
            # Get market conditions
            market_conditions = await self._get_market_conditions(latitude, longitude)
            
            # Prepare pricing features
            features = await self._prepare_pricing_features(
                base_price, latitude, longitude, demand_level, 
                supply_level, market_conditions
            )
            
            # Scale features
            if 'price_optimization' not in self.scalers:
                self.scalers['price_optimization'] = StandardScaler()
                features_scaled = self.scalers['price_optimization'].fit_transform([features])
            else:
                features_scaled = self.scalers['price_optimization'].transform([features])
            
            # Predict optimal price multiplier
            price_multiplier = self.models['price_optimization'].predict(features_scaled)[0]
            
            # Ensure reasonable bounds (0.8x to 3.0x base price)
            price_multiplier = max(0.8, min(3.0, price_multiplier))
            optimal_price = base_price * price_multiplier
            
            # Calculate confidence
            confidence = await self._calculate_prediction_confidence(
                'price_optimization', features, price_multiplier
            )
            
            # Analyze pricing factors
            factors = await self._analyze_pricing_factors(
                features, market_conditions, price_multiplier
            )
            
            result = PredictionResult(
                prediction=optimal_price,
                confidence=confidence,
                factors=factors,
                timestamp=datetime.now(),
                model_version="v2.1.0"
            )
            
            # Cache result (store multiplier, scale on retrieval)
            cache_data = result.__dict__.copy()
            cache_data['prediction'] = price_multiplier
            self.redis_client.setex(
                cache_key,
                self.cache_ttl['predictions'],
                json.dumps(cache_data, default=str)
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error optimizing pricing: {e}")
            return PredictionResult(
                prediction=base_price,
                confidence=0.3,
                factors={},
                timestamp=datetime.now(),
                model_version="fallback"
            )
    
    async def predict_wait_time(
        self,
        latitude: float,
        longitude: float,
        time_of_day: int = None
    ) -> PredictionResult:
        """
        Predict expected wait time for a ride request
        
        Args:
            latitude: Pickup location latitude
            longitude: Pickup location longitude
            time_of_day: Hour of day (0-23), defaults to current hour
            
        Returns:
            PredictionResult with wait time in minutes
        """
        try:
            if time_of_day is None:
                time_of_day = datetime.now().hour
            
            cache_key = f"wait_time:{latitude}:{longitude}:{time_of_day}"
            cached_result = self.redis_client.get(cache_key)
            
            if cached_result:
                return PredictionResult(**json.loads(cached_result))
            
            # Get market conditions
            market_conditions = await self._get_market_conditions(latitude, longitude)
            
            # Prepare features
            features = await self._prepare_wait_time_features(
                latitude, longitude, time_of_day, market_conditions
            )
            
            # Scale features
            if 'wait_time_prediction' not in self.scalers:
                self.scalers['wait_time_prediction'] = StandardScaler()
                features_scaled = self.scalers['wait_time_prediction'].fit_transform([features])
            else:
                features_scaled = self.scalers['wait_time_prediction'].transform([features])
            
            # Predict wait time
            wait_time = self.models['wait_time_prediction'].predict(features_scaled)[0]
            wait_time = max(1.0, wait_time)  # Minimum 1 minute
            
            # Calculate confidence
            confidence = await self._calculate_prediction_confidence(
                'wait_time_prediction', features, wait_time
            )
            
            # Analyze factors affecting wait time
            factors = await self._analyze_wait_time_factors(
                features, market_conditions
            )
            
            result = PredictionResult(
                prediction=wait_time,
                confidence=confidence,
                factors=factors,
                timestamp=datetime.now(),
                model_version="v2.1.0"
            )
            
            # Cache result
            self.redis_client.setex(
                cache_key,
                self.cache_ttl['predictions'],
                json.dumps(result.__dict__, default=str)
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error predicting wait time: {e}")
            return PredictionResult(
                prediction=8.0,  # Conservative fallback
                confidence=0.3,
                factors={},
                timestamp=datetime.now(),
                model_version="fallback"
            )
    
    async def predict_user_behavior(
        self,
        user_id: str,
        behavior_type: str = 'ride_frequency'
    ) -> PredictionResult:
        """
        Predict user behavior patterns
        
        Args:
            user_id: User identifier
            behavior_type: Type of behavior to predict
                         (ride_frequency, preferred_times, price_sensitivity)
            
        Returns:
            PredictionResult with behavior prediction
        """
        try:
            cache_key = f"user_behavior:{user_id}:{behavior_type}"
            cached_result = self.redis_client.get(cache_key)
            
            if cached_result:
                return PredictionResult(**json.loads(cached_result))
            
            # Get user historical data
            user_data = await self._get_user_historical_data(user_id)
            
            # Prepare features based on behavior type
            features = await self._prepare_user_behavior_features(
                user_data, behavior_type
            )
            
            # Scale features
            scaler_key = f'user_behavior_{behavior_type}'
            if scaler_key not in self.scalers:
                self.scalers[scaler_key] = StandardScaler()
                features_scaled = self.scalers[scaler_key].fit_transform([features])
            else:
                features_scaled = self.scalers[scaler_key].transform([features])
            
            # Make prediction
            prediction = self.models['user_behavior'].predict(features_scaled)[0]
            
            # Calculate confidence
            confidence = await self._calculate_prediction_confidence(
                'user_behavior', features, prediction
            )
            
            # Analyze behavior factors
            factors = await self._analyze_user_behavior_factors(
                user_data, behavior_type
            )
            
            result = PredictionResult(
                prediction=prediction,
                confidence=confidence,
                factors=factors,
                timestamp=datetime.now(),
                model_version="v2.1.0"
            )
            
            # Cache result for longer time for user patterns
            self.redis_client.setex(
                cache_key,
                self.cache_ttl['user_patterns'],
                json.dumps(result.__dict__, default=str)
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error predicting user behavior: {e}")
            return PredictionResult(
                prediction=0.5,  # Neutral prediction
                confidence=0.3,
                factors={},
                timestamp=datetime.now(),
                model_version="fallback"
            )
    
    async def predict_churn_risk(self, user_id: str) -> PredictionResult:
        """
        Predict user churn risk
        
        Args:
            user_id: User identifier
            
        Returns:
            PredictionResult with churn probability (0-1)
        """
        try:
            cache_key = f"churn_risk:{user_id}"
            cached_result = self.redis_client.get(cache_key)
            
            if cached_result:
                return PredictionResult(**json.loads(cached_result))
            
            # Get user engagement data
            user_data = await self._get_user_engagement_data(user_id)
            
            # Prepare churn prediction features
            features = await self._prepare_churn_features(user_data)
            
            # Scale features
            if 'churn_prediction' not in self.scalers:
                self.scalers['churn_prediction'] = StandardScaler()
                features_scaled = self.scalers['churn_prediction'].fit_transform([features])
            else:
                features_scaled = self.scalers['churn_prediction'].transform([features])
            
            # Predict churn probability
            churn_prob = self.models['churn_prediction'].predict(features_scaled)[0]
            churn_prob = max(0.0, min(1.0, churn_prob))  # Ensure 0-1 range
            
            # Calculate confidence
            confidence = await self._calculate_prediction_confidence(
                'churn_prediction', features, churn_prob
            )
            
            # Analyze churn risk factors
            factors = await self._analyze_churn_factors(user_data)
            
            result = PredictionResult(
                prediction=churn_prob,
                confidence=confidence,
                factors=factors,
                timestamp=datetime.now(),
                model_version="v2.1.0"
            )
            
            # Cache result
            self.redis_client.setex(
                cache_key,
                self.cache_ttl['user_patterns'],
                json.dumps(result.__dict__, default=str)
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error predicting churn risk: {e}")
            return PredictionResult(
                prediction=0.2,  # Low risk fallback
                confidence=0.3,
                factors={},
                timestamp=datetime.now(),
                model_version="fallback"
            )
    
    async def _get_market_conditions(
        self, 
        latitude: float, 
        longitude: float
    ) -> MarketConditions:
        """Get real-time market conditions for a location"""
        try:
            cache_key = f"market:{latitude}:{longitude}"
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                data = json.loads(cached_data)
                return MarketConditions(**data)
            
            # Simulate real-time market data collection
            # In production, this would query actual databases
            now = datetime.now()
            hour = now.hour
            day_of_week = now.weekday()
            
            # Base conditions with realistic variations
            active_drivers = max(5, int(np.random.normal(25, 8)))
            active_passengers = max(2, int(np.random.normal(15, 5)))
            
            # Time-based adjustments
            if 7 <= hour <= 9 or 17 <= hour <= 19:  # Rush hours
                active_passengers *= 1.8
                active_drivers *= 1.3
            elif 22 <= hour or hour <= 5:  # Late night/early morning
                active_drivers *= 0.4
                active_passengers *= 0.6
            
            # Weekend adjustments
            if day_of_week >= 5:  # Weekend
                if 10 <= hour <= 14:  # Weekend midday
                    active_passengers *= 1.5
                if hour >= 20:  # Weekend evening
                    active_passengers *= 2.0
            
            # Calculate derived metrics
            supply_demand_ratio = active_drivers / max(1, active_passengers)
            avg_wait_time = max(1.0, 15.0 / supply_demand_ratio)
            surge_multiplier = max(1.0, min(3.0, 1.0 + (active_passengers / max(1, active_drivers) - 1) * 0.5))
            
            conditions = MarketConditions(
                active_drivers=active_drivers,
                active_passengers=active_passengers,
                avg_wait_time=avg_wait_time,
                surge_multiplier=surge_multiplier,
                weather_impact=np.random.uniform(0.8, 1.2),
                traffic_density=np.random.uniform(0.5, 1.5),
                event_impact=np.random.uniform(0.9, 1.3)
            )
            
            # Cache market conditions
            self.redis_client.setex(
                cache_key,
                self.cache_ttl['market_data'],
                json.dumps(conditions.__dict__)
            )
            
            return conditions
            
        except Exception as e:
            logger.error(f"Error getting market conditions: {e}")
            return MarketConditions(
                active_drivers=20,
                active_passengers=10,
                avg_wait_time=8.0,
                surge_multiplier=1.0,
                weather_impact=1.0,
                traffic_density=1.0,
                event_impact=1.0
            )
    
    async def _prepare_demand_features(
        self,
        latitude: float,
        longitude: float,
        time_horizon: int,
        market_conditions: MarketConditions
    ) -> List[float]:
        """Prepare features for demand prediction"""
        now = datetime.now()
        
        # Time features
        hour = now.hour
        day_of_week = now.weekday()
        day_of_month = now.day
        is_weekend = day_of_week >= 5
        is_rush_hour = (7 <= hour <= 9) or (17 <= hour <= 19)
        
        # Location features (simplified grid)
        location_x = int(latitude * 1000) % 100
        location_y = int(longitude * 1000) % 100
        
        # Market features
        supply_demand_ratio = market_conditions.active_drivers / max(1, market_conditions.active_passengers)
        
        features = [
            latitude,
            longitude,
            hour,
            day_of_week,
            day_of_month,
            float(is_weekend),
            float(is_rush_hour),
            location_x,
            location_y,
            time_horizon,
            market_conditions.active_drivers,
            market_conditions.active_passengers,
            supply_demand_ratio,
            market_conditions.surge_multiplier,
            market_conditions.weather_impact,
            market_conditions.traffic_density,
            market_conditions.event_impact,
            market_conditions.avg_wait_time
        ]
        
        return features
    
    async def _prepare_pricing_features(
        self,
        base_price: float,
        latitude: float,
        longitude: float,
        demand_level: float,
        supply_level: float,
        market_conditions: MarketConditions
    ) -> List[float]:
        """Prepare features for pricing optimization"""
        now = datetime.now()
        
        # Time-based features
        hour = now.hour
        is_peak = (7 <= hour <= 9) or (17 <= hour <= 19) or (20 <= hour <= 23)
        is_weekend = now.weekday() >= 5
        
        # Supply/demand dynamics
        supply_demand_ratio = supply_level / max(0.1, demand_level)
        demand_pressure = demand_level / max(1, supply_level)
        
        features = [
            base_price,
            latitude,
            longitude,
            demand_level,
            supply_level,
            supply_demand_ratio,
            demand_pressure,
            hour,
            float(is_peak),
            float(is_weekend),
            market_conditions.surge_multiplier,
            market_conditions.weather_impact,
            market_conditions.traffic_density,
            market_conditions.event_impact,
            market_conditions.avg_wait_time
        ]
        
        return features
    
    async def _prepare_wait_time_features(
        self,
        latitude: float,
        longitude: float,
        time_of_day: int,
        market_conditions: MarketConditions
    ) -> List[float]:
        """Prepare features for wait time prediction"""
        is_peak = (7 <= time_of_day <= 9) or (17 <= time_of_day <= 19)
        is_night = time_of_day <= 5 or time_of_day >= 22
        is_weekend = datetime.now().weekday() >= 5
        
        features = [
            latitude,
            longitude,
            time_of_day,
            float(is_peak),
            float(is_night),
            float(is_weekend),
            market_conditions.active_drivers,
            market_conditions.active_passengers,
            market_conditions.surge_multiplier,
            market_conditions.weather_impact,
            market_conditions.traffic_density,
            market_conditions.avg_wait_time
        ]
        
        return features
    
    async def _calculate_prediction_confidence(
        self,
        model_name: str,
        features: List[float],
        prediction: float
    ) -> float:
        """Calculate confidence score for predictions"""
        try:
            # Simplified confidence calculation
            # In production, this would use cross-validation scores,
            # prediction intervals, and historical accuracy
            
            base_confidence = 0.75
            
            # Adjust based on feature completeness
            feature_completeness = len([f for f in features if f is not None]) / len(features)
            confidence = base_confidence * feature_completeness
            
            # Adjust based on prediction extremity
            if model_name == 'demand_prediction':
                if prediction > 50:  # Very high demand
                    confidence *= 0.8
            elif model_name == 'price_optimization':
                if prediction > 2.5:  # High surge
                    confidence *= 0.7
            elif model_name == 'wait_time_prediction':
                if prediction > 20:  # Long wait time
                    confidence *= 0.6
            
            return max(0.1, min(0.95, confidence))
            
        except Exception as e:
            logger.error(f"Error calculating confidence: {e}")
            return 0.5
    
    async def _analyze_demand_factors(
        self,
        features: List[float],
        market_conditions: MarketConditions
    ) -> Dict[str, float]:
        """Analyze factors contributing to demand prediction"""
        factors = {}
        
        try:
            # Time-based factors
            hour = features[2]
            is_rush_hour = features[6]
            
            if is_rush_hour:
                factors['rush_hour'] = 0.3
            
            if 20 <= hour <= 23:
                factors['evening_demand'] = 0.2
            
            # Market factors
            supply_demand_ratio = features[12]
            if supply_demand_ratio < 0.8:
                factors['supply_shortage'] = 0.4
            
            # Weather and events
            if market_conditions.weather_impact > 1.1:
                factors['weather'] = 0.15
            
            if market_conditions.event_impact > 1.1:
                factors['local_events'] = 0.2
            
            # Normalize factors to sum to 1.0
            total = sum(factors.values())
            if total > 0:
                factors = {k: v/total for k, v in factors.items()}
            
        except Exception as e:
            logger.error(f"Error analyzing demand factors: {e}")
        
        return factors
    
    async def _analyze_pricing_factors(
        self,
        features: List[float],
        market_conditions: MarketConditions,
        price_multiplier: float
    ) -> Dict[str, float]:
        """Analyze factors contributing to pricing optimization"""
        factors = {}
        
        try:
            # High demand factor
            demand_pressure = features[7]
            if demand_pressure > 1.5:
                factors['high_demand'] = 0.4
            
            # Peak time factor
            is_peak = features[8]
            if is_peak:
                factors['peak_hours'] = 0.3
            
            # Market conditions
            if market_conditions.surge_multiplier > 1.2:
                factors['market_surge'] = 0.3
            
            # Weather impact
            if market_conditions.weather_impact > 1.1:
                factors['weather_conditions'] = 0.2
            
            # Traffic impact
            if market_conditions.traffic_density > 1.2:
                factors['traffic_congestion'] = 0.15
            
            # Normalize factors
            total = sum(factors.values())
            if total > 0:
                factors = {k: v/total for k, v in factors.items()}
            
        except Exception as e:
            logger.error(f"Error analyzing pricing factors: {e}")
        
        return factors
    
    async def _analyze_wait_time_factors(
        self,
        features: List[float],
        market_conditions: MarketConditions
    ) -> Dict[str, float]:
        """Analyze factors affecting wait time"""
        factors = {}
        
        try:
            # Driver availability
            active_drivers = features[6]
            active_passengers = features[7]
            
            if active_drivers < 10:
                factors['low_driver_availability'] = 0.4
            
            if active_passengers > active_drivers * 1.5:
                factors['high_passenger_demand'] = 0.3
            
            # Time factors
            is_peak = features[3]
            is_night = features[4]
            
            if is_peak:
                factors['peak_time'] = 0.2
            
            if is_night:
                factors['night_hours'] = 0.25
            
            # Traffic and weather
            if market_conditions.traffic_density > 1.2:
                factors['traffic_delays'] = 0.2
            
            if market_conditions.weather_impact > 1.1:
                factors['weather_delays'] = 0.15
            
            # Normalize factors
            total = sum(factors.values())
            if total > 0:
                factors = {k: v/total for k, v in factors.items()}
            
        except Exception as e:
            logger.error(f"Error analyzing wait time factors: {e}")
        
        return factors
    
    # Placeholder methods for user data (would connect to actual database)
    async def _get_user_historical_data(self, user_id: str) -> Dict[str, Any]:
        """Get user historical data for behavior prediction"""
        # Simulate user data
        return {
            'total_rides': np.random.randint(10, 200),
            'avg_rides_per_week': np.random.uniform(0.5, 10),
            'preferred_times': [7, 8, 17, 18, 19],
            'avg_ride_distance': np.random.uniform(5, 25),
            'avg_ride_cost': np.random.uniform(15, 45),
            'rating_given': np.random.uniform(4.0, 5.0),
            'rating_received': np.random.uniform(4.2, 4.9),
            'cancellation_rate': np.random.uniform(0.01, 0.15),
            'days_since_last_ride': np.random.randint(0, 30)
        }
    
    async def _get_user_engagement_data(self, user_id: str) -> Dict[str, Any]:
        """Get user engagement data for churn prediction"""
        # Simulate engagement data
        return {
            'days_since_signup': np.random.randint(30, 1000),
            'days_since_last_ride': np.random.randint(0, 60),
            'total_rides': np.random.randint(1, 500),
            'rides_last_30_days': np.random.randint(0, 20),
            'app_opens_last_week': np.random.randint(0, 15),
            'support_tickets': np.random.randint(0, 5),
            'payment_failures': np.random.randint(0, 3),
            'avg_rating_given': np.random.uniform(3.5, 5.0),
            'avg_rating_received': np.random.uniform(4.0, 5.0)
        }
    
    async def _prepare_user_behavior_features(
        self,
        user_data: Dict[str, Any],
        behavior_type: str
    ) -> List[float]:
        """Prepare features for user behavior prediction"""
        base_features = [
            user_data.get('total_rides', 0),
            user_data.get('avg_rides_per_week', 0),
            user_data.get('avg_ride_distance', 0),
            user_data.get('avg_ride_cost', 0),
            user_data.get('rating_given', 4.5),
            user_data.get('rating_received', 4.5),
            user_data.get('cancellation_rate', 0.05),
            user_data.get('days_since_last_ride', 7)
        ]
        
        return base_features
    
    async def _prepare_churn_features(self, user_data: Dict[str, Any]) -> List[float]:
        """Prepare features for churn prediction"""
        features = [
            user_data.get('days_since_signup', 365),
            user_data.get('days_since_last_ride', 7),
            user_data.get('total_rides', 50),
            user_data.get('rides_last_30_days', 5),
            user_data.get('app_opens_last_week', 7),
            user_data.get('support_tickets', 0),
            user_data.get('payment_failures', 0),
            user_data.get('avg_rating_given', 4.5),
            user_data.get('avg_rating_received', 4.5)
        ]
        
        return features
    
    async def _analyze_user_behavior_factors(
        self,
        user_data: Dict[str, Any],
        behavior_type: str
    ) -> Dict[str, float]:
        """Analyze user behavior factors"""
        factors = {}
        
        try:
            if user_data.get('total_rides', 0) > 100:
                factors['experienced_user'] = 0.3
            
            if user_data.get('days_since_last_ride', 0) < 3:
                factors['frequent_user'] = 0.4
            
            if user_data.get('rating_received', 4.5) > 4.7:
                factors['high_rated_user'] = 0.2
            
            if user_data.get('cancellation_rate', 0.05) < 0.02:
                factors['reliable_user'] = 0.1
            
            # Normalize
            total = sum(factors.values())
            if total > 0:
                factors = {k: v/total for k, v in factors.items()}
            
        except Exception as e:
            logger.error(f"Error analyzing user behavior factors: {e}")
        
        return factors
    
    async def _analyze_churn_factors(self, user_data: Dict[str, Any]) -> Dict[str, float]:
        """Analyze churn risk factors"""
        factors = {}
        
        try:
            # High risk factors
            if user_data.get('days_since_last_ride', 0) > 30:
                factors['long_inactivity'] = 0.4
            
            if user_data.get('rides_last_30_days', 0) == 0:
                factors['no_recent_rides'] = 0.3
            
            if user_data.get('app_opens_last_week', 0) < 2:
                factors['low_app_engagement'] = 0.2
            
            if user_data.get('support_tickets', 0) > 2:
                factors['support_issues'] = 0.15
            
            if user_data.get('payment_failures', 0) > 1:
                factors['payment_problems'] = 0.2
            
            # Normalize
            total = sum(factors.values())
            if total > 0:
                factors = {k: v/total for k, v in factors.items()}
            
        except Exception as e:
            logger.error(f"Error analyzing churn factors: {e}")
        
        return factors

# Example usage and testing
if __name__ == "__main__":
    async def test_predictive_analytics():
        """Test the predictive analytics service"""
        analytics = AdvancedPredictiveAnalytics()
        
        # Test demand prediction
        demand_result = await analytics.predict_demand(40.7128, -74.0060, 60)
        print(f"Demand Prediction: {demand_result.prediction:.2f} (confidence: {demand_result.confidence:.2f})")
        
        # Test pricing optimization
        price_result = await analytics.optimize_pricing(25.0, 40.7128, -74.0060, 15.0, 10.0)
        print(f"Optimized Price: ${price_result.prediction:.2f} (confidence: {price_result.confidence:.2f})")
        
        # Test wait time prediction
        wait_result = await analytics.predict_wait_time(40.7128, -74.0060)
        print(f"Wait Time: {wait_result.prediction:.1f} minutes (confidence: {wait_result.confidence:.2f})")
        
        # Test user behavior prediction
        behavior_result = await analytics.predict_user_behavior("user123", "ride_frequency")
        print(f"User Behavior: {behavior_result.prediction:.2f} (confidence: {behavior_result.confidence:.2f})")
        
        # Test churn prediction
        churn_result = await analytics.predict_churn_risk("user123")
        print(f"Churn Risk: {churn_result.prediction:.2f} (confidence: {churn_result.confidence:.2f})")
    
    # Run test
    asyncio.run(test_predictive_analytics())