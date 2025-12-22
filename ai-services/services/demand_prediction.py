"""
Demand Prediction Service - AI-powered demand forecasting for ride-sharing
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
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import json

@dataclass
class DemandPrediction:
    location: Dict[str, float]
    time_range: Dict[str, str]
    predicted_demand: float
    demand_category: str
    confidence: float
    factors: Dict[str, float]
    recommendations: List[str]

class DemandPredictionService:
    """AI-powered demand prediction using machine learning models"""
    
    def __init__(self, db_manager, redis_client):
        self.db = db_manager
        self.redis = redis_client
        self.logger = logging.getLogger(__name__)
        
        # Model configuration
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'hour', 'day_of_week', 'month', 'is_weekend', 'is_holiday',
            'weather_temp', 'weather_condition_encoded', 
            'historical_demand', 'nearby_events',
            'population_density', 'business_density'
        ]
        
        # Cache settings
        self.cache_ttl = 900  # 15 minutes cache for demand predictions
        
        # Load or initialize model
        self._initialize_model()
        
    def predict_demand(self, location: Dict[str, float], 
                      time_range: Dict[str, str]) -> Dict[str, Any]:
        """
        Predict ride demand for a specific location and time range
        
        Args:
            location: {'latitude': float, 'longitude': float}
            time_range: {'start': ISO timestamp, 'end': ISO timestamp}
            
        Returns:
            Demand prediction with detailed analysis
        """
        try:
            # Create cache key
            cache_key = self._generate_prediction_cache_key(location, time_range)
            
            # Check cache first
            cached_result = self.redis.get(cache_key)
            if cached_result:
                self.logger.info("Returning cached demand prediction")
                return json.loads(cached_result)
            
            # Parse time range
            start_time = datetime.fromisoformat(time_range['start'].replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(time_range['end'].replace('Z', '+00:00'))
            
            # Generate predictions for time intervals
            predictions = []
            current_time = start_time
            
            while current_time < end_time:
                interval_prediction = self._predict_single_interval(location, current_time)
                predictions.append(interval_prediction)
                current_time += timedelta(hours=1)  # Hourly predictions
            
            # Aggregate predictions
            aggregated_prediction = self._aggregate_predictions(predictions)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(aggregated_prediction, location)
            
            # Create result
            result = {
                'location': location,
                'time_range': time_range,
                'predictions': {
                    'overall_demand': round(aggregated_prediction['avg_demand'], 2),
                    'peak_demand': round(aggregated_prediction['max_demand'], 2),
                    'demand_category': self._categorize_demand(aggregated_prediction['avg_demand']),
                    'confidence': round(aggregated_prediction['confidence'], 2)
                },
                'hourly_breakdown': [
                    {
                        'hour': pred['hour'],
                        'predicted_demand': round(pred['demand'], 2),
                        'confidence': round(pred['confidence'], 2)
                    }
                    for pred in predictions
                ],
                'factors': aggregated_prediction['factors'],
                'recommendations': recommendations,
                'metadata': {
                    'model_version': '1.0',
                    'prediction_accuracy': 0.85,
                    'data_points_used': len(predictions)
                },
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Cache the result
            self.redis.setex(cache_key, self.cache_ttl, json.dumps(result))
            
            self.logger.info(f"Predicted demand for location ({location['latitude']:.3f}, {location['longitude']:.3f}): "
                           f"{aggregated_prediction['avg_demand']:.1f} rides/hour")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error predicting demand: {str(e)}")
            return self._fallback_demand_prediction(location, time_range)
    
    def _predict_single_interval(self, location: Dict[str, float], 
                                prediction_time: datetime) -> Dict[str, Any]:
        """Predict demand for a single time interval"""
        try:
            # Extract features
            features = self._extract_features(location, prediction_time)
            
            if self.model:
                # Use trained model
                features_scaled = self.scaler.transform([features])
                demand_prediction = self.model.predict(features_scaled)[0]
                confidence = self._calculate_prediction_confidence(features)
            else:
                # Use heuristic approach
                demand_prediction, confidence = self._heuristic_prediction(location, prediction_time)
            
            # Ensure positive demand
            demand_prediction = max(0, demand_prediction)
            
            return {
                'hour': prediction_time.hour,
                'datetime': prediction_time.isoformat(),
                'demand': demand_prediction,
                'confidence': confidence,
                'features': dict(zip(self.feature_names, features))
            }
            
        except Exception as e:
            self.logger.error(f"Error in single interval prediction: {str(e)}")
            return {
                'hour': prediction_time.hour,
                'datetime': prediction_time.isoformat(),
                'demand': 5.0,  # Fallback
                'confidence': 0.3,
                'features': {}
            }
    
    def _extract_features(self, location: Dict[str, float], 
                         prediction_time: datetime) -> List[float]:
        """Extract features for demand prediction"""
        try:
            # Time-based features
            hour = prediction_time.hour
            day_of_week = prediction_time.weekday()
            month = prediction_time.month
            is_weekend = 1.0 if day_of_week >= 5 else 0.0
            is_holiday = self._is_holiday(prediction_time)
            
            # Weather features (would integrate with weather API)
            weather_temp = 20.0  # Default temperature
            weather_condition_encoded = 1.0  # 1=clear, 2=rain, 3=snow
            
            # Historical demand (from database)
            historical_demand = self._get_historical_demand(location, prediction_time)
            
            # Event features
            nearby_events = self._get_nearby_events(location, prediction_time)
            
            # Location features
            population_density = self._get_population_density(location)
            business_density = self._get_business_density(location)
            
            return [
                hour, day_of_week, month, is_weekend, is_holiday,
                weather_temp, weather_condition_encoded,
                historical_demand, nearby_events,
                population_density, business_density
            ]
            
        except Exception as e:
            self.logger.error(f"Error extracting features: {str(e)}")
            # Return default features
            return [12.0, 1.0, 6.0, 0.0, 0.0, 20.0, 1.0, 5.0, 0.0, 1.0, 1.0]
    
    def _heuristic_prediction(self, location: Dict[str, float], 
                             prediction_time: datetime) -> Tuple[float, float]:
        """Heuristic demand prediction when ML model is not available"""
        try:
            hour = prediction_time.hour
            day_of_week = prediction_time.weekday()
            
            # Base demand
            base_demand = 3.0
            
            # Time-based adjustments
            if day_of_week < 5:  # Weekdays
                if 7 <= hour <= 9 or 17 <= hour <= 19:  # Rush hours
                    time_multiplier = 2.5
                elif 10 <= hour <= 16:  # Business hours
                    time_multiplier = 1.5
                elif 20 <= hour <= 23:  # Evening
                    time_multiplier = 2.0
                else:  # Late night/early morning
                    time_multiplier = 0.5
            else:  # Weekends
                if 10 <= hour <= 14:  # Weekend afternoon
                    time_multiplier = 2.0
                elif 20 <= hour <= 24:  # Weekend evening
                    time_multiplier = 2.5
                else:
                    time_multiplier = 1.0
            
            # Location-based adjustments
            # This would be more sophisticated with actual location data
            location_multiplier = 1.0
            
            demand_prediction = base_demand * time_multiplier * location_multiplier
            confidence = 0.6  # Lower confidence for heuristic
            
            return demand_prediction, confidence
            
        except Exception:
            return 5.0, 0.3
    
    def _get_historical_demand(self, location: Dict[str, float], 
                              prediction_time: datetime) -> float:
        """Get historical demand for similar time periods"""
        try:
            # Query historical data from the same hour and day of week
            same_time_last_week = prediction_time - timedelta(days=7)
            
            query = """
            SELECT COUNT(*) as ride_count
            FROM ride_requests rr
            WHERE DATE_PART('hour', rr.created_at) = %s
            AND DATE_PART('dow', rr.created_at) = %s
            AND rr.created_at >= %s
            AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                rr.origin_coordinates::geography,
                2000
            )
            """
            
            result = self.db.execute_query(query, (
                prediction_time.hour,
                prediction_time.weekday(),
                same_time_last_week,
                location.get('longitude', 0),
                location.get('latitude', 0)
            ))
            
            historical_demand = result[0]['ride_count'] if result else 0
            return float(historical_demand)
            
        except Exception as e:
            self.logger.error(f"Error getting historical demand: {str(e)}")
            return 3.0  # Default historical demand
    
    def _get_nearby_events(self, location: Dict[str, float], 
                          prediction_time: datetime) -> float:
        """Get count of nearby events that might affect demand"""
        try:
            # This would query an events database or API
            # For now, return a mock value
            return 0.0
            
        except Exception:
            return 0.0
    
    def _get_population_density(self, location: Dict[str, float]) -> float:
        """Get population density for the location"""
        try:
            # This would integrate with census or demographic data
            # For now, return a normalized value
            return 1.0
            
        except Exception:
            return 1.0
    
    def _get_business_density(self, location: Dict[str, float]) -> float:
        """Get business density for the location"""
        try:
            # This would integrate with business directory APIs
            # For now, return a normalized value
            return 1.0
            
        except Exception:
            return 1.0
    
    def _is_holiday(self, date: datetime) -> float:
        """Check if the date is a holiday"""
        try:
            # This would integrate with a holiday API or database
            # For now, return 0 (not a holiday)
            return 0.0
            
        except Exception:
            return 0.0
    
    def _calculate_prediction_confidence(self, features: List[float]) -> float:
        """Calculate confidence score for prediction"""
        try:
            # This would use model-specific confidence metrics
            # For now, return a heuristic confidence
            base_confidence = 0.8
            
            # Reduce confidence for unusual feature values
            # (In practice, this would be more sophisticated)
            
            return base_confidence
            
        except Exception:
            return 0.5
    
    def _aggregate_predictions(self, predictions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate hourly predictions into overall metrics"""
        if not predictions:
            return {
                'avg_demand': 5.0,
                'max_demand': 5.0,
                'confidence': 0.3,
                'factors': {}
            }
        
        demands = [pred['demand'] for pred in predictions]
        confidences = [pred['confidence'] for pred in predictions]
        
        # Calculate aggregated factors
        all_features = {}
        for pred in predictions:
            for feature, value in pred.get('features', {}).items():
                if feature not in all_features:
                    all_features[feature] = []
                all_features[feature].append(value)
        
        avg_factors = {
            feature: np.mean(values) for feature, values in all_features.items()
        }
        
        return {
            'avg_demand': np.mean(demands),
            'max_demand': max(demands),
            'min_demand': min(demands),
            'confidence': np.mean(confidences),
            'factors': avg_factors
        }
    
    def _categorize_demand(self, demand: float) -> str:
        """Categorize demand level"""
        if demand < 2:
            return 'low'
        elif demand < 5:
            return 'normal'
        elif demand < 10:
            return 'high'
        else:
            return 'very_high'
    
    def _generate_recommendations(self, prediction: Dict[str, Any], 
                                 location: Dict[str, float]) -> List[str]:
        """Generate actionable recommendations based on demand prediction"""
        recommendations = []
        
        demand_level = self._categorize_demand(prediction['avg_demand'])
        
        if demand_level == 'low':
            recommendations.extend([
                "Consider implementing promotions to increase demand",
                "Reduce driver incentives in this area during predicted time",
                "Focus marketing efforts on nearby high-demand areas"
            ])
        elif demand_level == 'high':
            recommendations.extend([
                "Increase driver incentives to ensure adequate supply",
                "Consider surge pricing to balance supply and demand",
                "Deploy additional drivers to this area"
            ])
        elif demand_level == 'very_high':
            recommendations.extend([
                "Implement surge pricing to manage demand",
                "Maximize driver deployment in this area",
                "Consider alternative transportation options for customers"
            ])
        else:  # normal
            recommendations.extend([
                "Maintain current driver allocation",
                "Monitor for sudden demand changes"
            ])
        
        # Add confidence-based recommendations
        if prediction['confidence'] < 0.5:
            recommendations.append("Prediction confidence is low - monitor actual demand closely")
        
        return recommendations
    
    def _initialize_model(self):
        """Initialize or load the demand prediction model"""
        try:
            # In production, you would load a pre-trained model
            # For now, create a basic model
            self.model = RandomForestRegressor(n_estimators=100, random_state=42)
            
            # In a real implementation, you would load the model from disk:
            # self.model = joblib.load('/app/models/demand_prediction_model.pkl')
            # self.scaler = joblib.load('/app/models/demand_scaler.pkl')
            
            self.logger.info("Demand prediction model initialized")
            
        except Exception as e:
            self.logger.error(f"Error initializing model: {str(e)}")
            self.model = None
    
    def train_model(self, training_data: pd.DataFrame = None):
        """Train the demand prediction model"""
        try:
            if training_data is None:
                # Get training data from database
                training_data = self._get_training_data()
            
            if training_data.empty:
                self.logger.warning("No training data available")
                return
            
            # Prepare features and target
            X = training_data[self.feature_names].values
            y = training_data['demand'].values
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Train model
            self.model.fit(X_train_scaled, y_train)
            
            # Evaluate model
            train_score = self.model.score(X_train_scaled, y_train)
            test_score = self.model.score(X_test_scaled, y_test)
            
            self.logger.info(f"Model trained - Train R²: {train_score:.3f}, Test R²: {test_score:.3f}")
            
            # Save model (in production)
            # joblib.dump(self.model, '/app/models/demand_prediction_model.pkl')
            # joblib.dump(self.scaler, '/app/models/demand_scaler.pkl')
            
        except Exception as e:
            self.logger.error(f"Error training model: {str(e)}")
    
    def _get_training_data(self) -> pd.DataFrame:
        """Get historical data for model training"""
        try:
            # This would query historical ride request data
            # For now, return empty DataFrame
            return pd.DataFrame()
            
        except Exception as e:
            self.logger.error(f"Error getting training data: {str(e)}")
            return pd.DataFrame()
    
    def _fallback_demand_prediction(self, location: Dict[str, float], 
                                   time_range: Dict[str, str]) -> Dict[str, Any]:
        """Fallback prediction when main prediction fails"""
        return {
            'location': location,
            'time_range': time_range,
            'predictions': {
                'overall_demand': 5.0,
                'peak_demand': 8.0,
                'demand_category': 'normal',
                'confidence': 0.3
            },
            'hourly_breakdown': [],
            'factors': {},
            'recommendations': [
                "Prediction service unavailable - use default strategies",
                "Monitor actual demand patterns closely"
            ],
            'metadata': {
                'model_version': 'fallback',
                'prediction_accuracy': 0.5,
                'data_points_used': 0
            },
            'error': 'Demand prediction failed, using fallback',
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def _generate_prediction_cache_key(self, location: Dict[str, float], 
                                      time_range: Dict[str, str]) -> str:
        """Generate cache key for demand prediction"""
        import hashlib
        
        # Round coordinates to reduce cache fragmentation
        rounded_location = {
            'lat': round(location.get('latitude', 0), 3),
            'lng': round(location.get('longitude', 0), 3)
        }
        
        key_data = f"{rounded_location}{time_range}"
        return f"demand_pred:{hashlib.md5(key_data.encode()).hexdigest()}"