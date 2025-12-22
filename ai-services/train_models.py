#!/usr/bin/env python3
"""
ML Model Training Pipeline - Train and update AI models for Hitch services
Author: Claude-Code
Created: 2025-01-21
Last Modified: 2025-01-21
"""

import os
import sys
import argparse
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
import joblib

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.database import DatabaseManager
from utils.redis_client import RedisClient
from utils.logger import setup_logger

class ModelTrainingPipeline:
    """Machine Learning model training pipeline for Hitch AI services"""
    
    def __init__(self):
        self.logger = setup_logger('model-training')
        self.db = None
        self.redis = None
        self.models_dir = '/app/models'
        
        # Ensure models directory exists
        os.makedirs(self.models_dir, exist_ok=True)
        
        self.models_config = {
            'demand_prediction': {
                'model_class': RandomForestRegressor,
                'model_params': {
                    'n_estimators': 100,
                    'max_depth': 20,
                    'min_samples_split': 5,
                    'min_samples_leaf': 2,
                    'random_state': 42
                },
                'feature_columns': [
                    'hour', 'day_of_week', 'month', 'is_weekend', 'is_holiday',
                    'weather_temp', 'weather_condition_encoded',
                    'historical_demand', 'nearby_events',
                    'population_density', 'business_density'
                ],
                'target_column': 'demand'
            },
            'price_prediction': {
                'model_class': RandomForestRegressor,
                'model_params': {
                    'n_estimators': 150,
                    'max_depth': 15,
                    'min_samples_split': 3,
                    'min_samples_leaf': 1,
                    'random_state': 42
                },
                'feature_columns': [
                    'distance_km', 'duration_minutes', 'hour', 'day_of_week',
                    'demand_factor', 'supply_factor', 'weather_factor',
                    'event_factor', 'historical_price'
                ],
                'target_column': 'price_per_km'
            }
        }
    
    def initialize_connections(self):
        """Initialize database and Redis connections"""
        try:
            self.db = DatabaseManager()
            self.redis = RedisClient()
            self.logger.info("Database and Redis connections initialized")
        except Exception as e:
            self.logger.error(f"Failed to initialize connections: {str(e)}")
            raise
    
    def collect_training_data(self, model_name: str, days_back: int = 90) -> pd.DataFrame:
        """Collect training data for specified model"""
        try:
            self.logger.info(f"Collecting training data for {model_name} model")
            
            if model_name == 'demand_prediction':
                return self._collect_demand_data(days_back)
            elif model_name == 'price_prediction':
                return self._collect_pricing_data(days_back)
            else:
                raise ValueError(f"Unknown model name: {model_name}")
                
        except Exception as e:
            self.logger.error(f"Error collecting training data for {model_name}: {str(e)}")
            raise
    
    def _collect_demand_data(self, days_back: int) -> pd.DataFrame:
        """Collect historical demand data for training"""
        try:
            # Get historical ride requests data
            cutoff_date = datetime.utcnow() - timedelta(days=days_back)
            
            query = """
            SELECT 
                DATE_TRUNC('hour', rr.created_at) as hour_timestamp,
                COUNT(*) as demand,
                EXTRACT(hour FROM rr.created_at) as hour,
                EXTRACT(dow FROM rr.created_at) as day_of_week,
                EXTRACT(month FROM rr.created_at) as month,
                CASE 
                    WHEN EXTRACT(dow FROM rr.created_at) IN (0, 6) THEN 1 
                    ELSE 0 
                END as is_weekend,
                0 as is_holiday,  -- Placeholder for holiday detection
                20.0 as weather_temp,  -- Placeholder for weather data
                1.0 as weather_condition_encoded,  -- Placeholder
                3.0 as historical_demand,  -- Placeholder
                0.0 as nearby_events,  -- Placeholder
                1.0 as population_density,  -- Placeholder
                1.0 as business_density  -- Placeholder
            FROM ride_requests rr
            WHERE rr.created_at >= %s
            GROUP BY 
                DATE_TRUNC('hour', rr.created_at),
                EXTRACT(hour FROM rr.created_at),
                EXTRACT(dow FROM rr.created_at),
                EXTRACT(month FROM rr.created_at)
            ORDER BY hour_timestamp
            """
            
            results = self.db.execute_query(query, (cutoff_date,))
            
            if not results:
                self.logger.warning("No demand data found, generating synthetic data")
                return self._generate_synthetic_demand_data()
            
            df = pd.DataFrame(results)
            self.logger.info(f"Collected {len(df)} demand data points")
            return df
            
        except Exception as e:
            self.logger.error(f"Error collecting demand data: {str(e)}")
            return self._generate_synthetic_demand_data()
    
    def _collect_pricing_data(self, days_back: int) -> pd.DataFrame:
        """Collect historical pricing data for training"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_back)
            
            query = """
            SELECT 
                r.distance as distance_km,
                r.estimated_duration as duration_minutes,
                r.price_per_seat as price,
                EXTRACT(hour FROM r.departure_time) as hour,
                EXTRACT(dow FROM r.departure_time) as day_of_week,
                1.0 as demand_factor,  -- Placeholder
                1.0 as supply_factor,  -- Placeholder
                1.0 as weather_factor,  -- Placeholder
                1.0 as event_factor,  -- Placeholder
                r.price_per_seat as historical_price
            FROM rides r
            WHERE 
                r.created_at >= %s
                AND r.price_per_seat IS NOT NULL
                AND r.distance IS NOT NULL
                AND r.estimated_duration IS NOT NULL
                AND r.distance > 0
                AND r.price_per_seat > 0
            ORDER BY r.created_at
            """
            
            results = self.db.execute_query(query, (cutoff_date,))
            
            if not results:
                self.logger.warning("No pricing data found, generating synthetic data")
                return self._generate_synthetic_pricing_data()
            
            df = pd.DataFrame(results)
            
            # Calculate price per km
            df['price_per_km'] = df['price'] / df['distance_km']
            
            self.logger.info(f"Collected {len(df)} pricing data points")
            return df
            
        except Exception as e:
            self.logger.error(f"Error collecting pricing data: {str(e)}")
            return self._generate_synthetic_pricing_data()
    
    def _generate_synthetic_demand_data(self) -> pd.DataFrame:
        """Generate synthetic demand data for initial model training"""
        np.random.seed(42)
        
        # Generate 2000 synthetic data points
        n_samples = 2000
        
        data = {
            'hour': np.random.randint(0, 24, n_samples),
            'day_of_week': np.random.randint(0, 7, n_samples),
            'month': np.random.randint(1, 13, n_samples),
            'is_weekend': np.random.choice([0, 1], n_samples, p=[0.7, 0.3]),
            'is_holiday': np.random.choice([0, 1], n_samples, p=[0.95, 0.05]),
            'weather_temp': np.random.normal(20, 10, n_samples),
            'weather_condition_encoded': np.random.choice([1, 2, 3], n_samples, p=[0.7, 0.2, 0.1]),
            'historical_demand': np.random.uniform(1, 10, n_samples),
            'nearby_events': np.random.choice([0, 1, 2], n_samples, p=[0.8, 0.15, 0.05]),
            'population_density': np.random.uniform(0.5, 2.0, n_samples),
            'business_density': np.random.uniform(0.5, 2.0, n_samples)
        }
        
        df = pd.DataFrame(data)
        
        # Generate demand based on features (with some realistic patterns)
        demand = (
            2 +  # Base demand
            (df['hour'].apply(lambda h: 2 if 7 <= h <= 9 or 17 <= h <= 19 else 0)) +  # Rush hour
            (df['is_weekend'] * 1.5) +  # Weekend boost
            (df['weather_condition_encoded'] - 1) * 0.5 +  # Weather impact
            (df['nearby_events'] * 1.2) +  # Event impact
            np.random.normal(0, 0.5, n_samples)  # Random noise
        )
        
        df['demand'] = np.maximum(demand, 0.1)  # Ensure positive demand
        
        self.logger.info("Generated 2000 synthetic demand data points")
        return df
    
    def _generate_synthetic_pricing_data(self) -> pd.DataFrame:
        """Generate synthetic pricing data for initial model training"""
        np.random.seed(42)
        
        n_samples = 1500
        
        # Generate realistic trip data
        distance_km = np.random.exponential(10, n_samples)  # Most trips are short
        distance_km = np.clip(distance_km, 1, 100)  # Limit range
        
        duration_minutes = distance_km * np.random.uniform(2, 4, n_samples)  # Realistic speed
        
        data = {
            'distance_km': distance_km,
            'duration_minutes': duration_minutes,
            'hour': np.random.randint(0, 24, n_samples),
            'day_of_week': np.random.randint(0, 7, n_samples),
            'demand_factor': np.random.uniform(0.8, 2.0, n_samples),
            'supply_factor': np.random.uniform(0.5, 1.8, n_samples),
            'weather_factor': np.random.uniform(0.9, 1.5, n_samples),
            'event_factor': np.random.uniform(1.0, 1.8, n_samples),
        }
        
        df = pd.DataFrame(data)
        
        # Historical price based on distance (with variation)
        df['historical_price'] = distance_km * np.random.uniform(1.0, 1.5, n_samples)
        
        # Generate price per km with realistic factors
        base_price_per_km = 1.2
        price_per_km = (
            base_price_per_km *
            df['demand_factor'] *
            df['supply_factor'] *
            df['weather_factor'] *
            df['event_factor'] *
            np.random.uniform(0.9, 1.1, n_samples)  # Random variation
        )
        
        df['price_per_km'] = np.clip(price_per_km, 0.5, 5.0)  # Reasonable range
        
        self.logger.info("Generated 1500 synthetic pricing data points")
        return df
    
    def train_model(self, model_name: str, data: pd.DataFrame) -> Dict[str, Any]:
        """Train a machine learning model"""
        try:
            self.logger.info(f"Training {model_name} model")
            
            config = self.models_config[model_name]
            feature_columns = config['feature_columns']
            target_column = config['target_column']
            
            # Prepare data
            X = data[feature_columns].values
            y = data[target_column].values
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Train model
            model_class = config['model_class']
            model_params = config['model_params']
            model = model_class(**model_params)
            
            model.fit(X_train_scaled, y_train)
            
            # Evaluate model
            train_score = model.score(X_train_scaled, y_train)
            test_score = model.score(X_test_scaled, y_test)
            
            # Predictions for detailed metrics
            y_pred = model.predict(X_test_scaled)
            mse = mean_squared_error(y_test, y_pred)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            # Cross-validation
            cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5)
            
            # Save model and scaler
            model_path = os.path.join(self.models_dir, f"{model_name}_model.pkl")
            scaler_path = os.path.join(self.models_dir, f"{model_name}_scaler.pkl")
            
            joblib.dump(model, model_path)
            joblib.dump(scaler, scaler_path)
            
            # Store model metadata in Redis
            metadata = {
                'model_name': model_name,
                'training_date': datetime.utcnow().isoformat(),
                'train_score': train_score,
                'test_score': test_score,
                'mse': mse,
                'mae': mae,
                'r2_score': r2,
                'cv_mean': cv_scores.mean(),
                'cv_std': cv_scores.std(),
                'feature_columns': feature_columns,
                'target_column': target_column,
                'training_samples': len(X_train),
                'test_samples': len(X_test),
                'model_path': model_path,
                'scaler_path': scaler_path
            }
            
            if self.redis:
                self.redis.store_ml_model_metadata(model_name, metadata)
            
            self.logger.info(f"Model {model_name} trained successfully:")
            self.logger.info(f"  - Train R²: {train_score:.4f}")
            self.logger.info(f"  - Test R²: {test_score:.4f}")
            self.logger.info(f"  - MSE: {mse:.4f}")
            self.logger.info(f"  - MAE: {mae:.4f}")
            self.logger.info(f"  - CV Mean: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
            
            return metadata
            
        except Exception as e:
            self.logger.error(f"Error training {model_name} model: {str(e)}")
            raise
    
    def train_all_models(self, days_back: int = 90):
        """Train all configured models"""
        self.logger.info("Starting training for all models")
        
        results = {}
        
        for model_name in self.models_config.keys():
            try:
                self.logger.info(f"Training {model_name}")
                
                # Collect data
                data = self.collect_training_data(model_name, days_back)
                
                if data.empty:
                    self.logger.warning(f"No data available for {model_name}")
                    continue
                
                # Train model
                result = self.train_model(model_name, data)
                results[model_name] = result
                
            except Exception as e:
                self.logger.error(f"Failed to train {model_name}: {str(e)}")
                results[model_name] = {'error': str(e)}
        
        self.logger.info("Model training pipeline completed")
        return results
    
    def close_connections(self):
        """Close database and Redis connections"""
        try:
            if self.db:
                self.db.close_connections()
            if self.redis:
                self.redis.close_connection()
        except Exception as e:
            self.logger.error(f"Error closing connections: {str(e)}")

def main():
    """Main training pipeline execution"""
    parser = argparse.ArgumentParser(description='Train ML models for Hitch AI services')
    parser.add_argument('--model', type=str, help='Specific model to train (demand_prediction, price_prediction)')
    parser.add_argument('--days-back', type=int, default=90, help='Days of historical data to use')
    parser.add_argument('--no-db', action='store_true', help='Skip database connection (use synthetic data)')
    
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logger('model-training-main')
    
    try:
        logger.info("Starting ML model training pipeline")
        
        # Initialize pipeline
        pipeline = ModelTrainingPipeline()
        
        # Initialize connections (unless skipped)
        if not args.no_db:
            try:
                pipeline.initialize_connections()
            except Exception as e:
                logger.warning(f"Database connection failed, using synthetic data: {str(e)}")
                args.no_db = True
        
        # Train models
        if args.model:
            # Train specific model
            if args.model not in pipeline.models_config:
                logger.error(f"Unknown model: {args.model}")
                return 1
            
            data = pipeline.collect_training_data(args.model, args.days_back)
            result = pipeline.train_model(args.model, data)
            
            logger.info(f"Training completed for {args.model}")
            logger.info(f"Results: {json.dumps(result, indent=2, default=str)}")
        else:
            # Train all models
            results = pipeline.train_all_models(args.days_back)
            
            logger.info("All models training completed")
            logger.info(f"Results summary: {json.dumps(results, indent=2, default=str)}")
        
        # Close connections
        pipeline.close_connections()
        
        logger.info("Training pipeline completed successfully")
        return 0
        
    except Exception as e:
        logger.error(f"Training pipeline failed: {str(e)}")
        return 1

if __name__ == '__main__':
    exit(main())