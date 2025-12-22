"""
Hitch AI Services - Main Flask application
Author: Claude-Code
Created: 2025-01-20
Last Modified: 2025-01-21
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import logging
from datetime import datetime
from services.ride_matching import RideMatchingService
from services.dynamic_pricing import DynamicPricingService
from services.route_optimization import RouteOptimizationService
from services.demand_prediction import DemandPredictionService
from utils.database import DatabaseManager
from utils.redis_client import RedisClient
from utils.logger import setup_logger

# Create Flask application
app = Flask(__name__)

# Enable CORS
CORS(app, origins=[
    "http://localhost:3000",  # Admin panel
    "http://localhost:3001",  # Backend API
    "http://localhost:19006", # Mobile app dev
])

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['DEBUG'] = os.environ.get('FLASK_ENV') == 'development'

# Setup logging
logger = setup_logger('hitch-ai-services')

# Initialize services
try:
    db_manager = DatabaseManager()
    redis_client = RedisClient()
    
    ride_matching_service = RideMatchingService(db_manager, redis_client)
    pricing_service = DynamicPricingService(db_manager, redis_client)
    route_service = RouteOptimizationService(db_manager, redis_client)
    demand_service = DemandPredictionService(db_manager, redis_client)
    
    logger.info("AI services initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize AI services: {str(e)}")
    raise

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring service status"""
    return jsonify({
        'success': True,
        'message': 'Hitch AI Services are running',
        'timestamp': datetime.utcnow().isoformat(),
        'environment': os.environ.get('FLASK_ENV', 'development'),
        'version': '1.0.0'
    }), 200

# Root endpoint
@app.route('/', methods=['GET'])
def root():
    """Root endpoint with service information"""
    return jsonify({
        'success': True,
        'message': 'Welcome to Hitch AI Services',
        'services': [
            'Ride Matching Algorithm',
            'Dynamic Pricing Engine',
            'Route Optimization',
            'Demand Prediction',
            'User Behavior Analysis'
        ],
        'endpoints': {
            'health': '/health',
            'ride_matching': '/api/match-rides',
            'pricing': '/api/calculate-price',
            'route_optimization': '/api/optimize-route',
            'demand_prediction': '/api/predict-demand'
        },
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

# AI Service Endpoints

@app.route('/api/match-rides', methods=['POST'])
def match_rides():
    """Match passengers with compatible rides using AI algorithm"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided',
                'code': 'MISSING_DATA'
            }), 400
            
        # Extract required parameters
        origin = data.get('origin')
        destination = data.get('destination')
        departure_time = data.get('departure_time')
        passenger_preferences = data.get('preferences', {})
        
        if not all([origin, destination, departure_time]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: origin, destination, departure_time',
                'code': 'MISSING_REQUIRED_FIELDS'
            }), 400
            
        # Use AI service to find matching rides
        matches = ride_matching_service.find_matches(
            origin=origin,
            destination=destination,
            departure_time=departure_time,
            preferences=passenger_preferences
        )
        
        return jsonify({
            'success': True,
            'data': {
                'matches': matches,
                'total_matches': len(matches),
                'search_params': {
                    'origin': origin,
                    'destination': destination,
                    'departure_time': departure_time
                }
            },
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in match_rides: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to match rides',
            'code': 'MATCHING_FAILED',
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/api/calculate-price', methods=['POST'])
def calculate_dynamic_price():
    """Calculate dynamic pricing based on demand, supply, and other factors"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided',
                'code': 'MISSING_DATA'
            }), 400
            
        # Extract pricing parameters
        ride_data = data.get('ride_data')
        market_conditions = data.get('market_conditions', {})
        
        if not ride_data:
            return jsonify({
                'success': False,
                'error': 'Missing ride_data',
                'code': 'MISSING_RIDE_DATA'
            }), 400
            
        # Calculate dynamic price
        pricing_result = pricing_service.calculate_price(
            ride_data=ride_data,
            market_conditions=market_conditions
        )
        
        return jsonify({
            'success': True,
            'data': pricing_result,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in calculate_dynamic_price: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to calculate price',
            'code': 'PRICING_FAILED',
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/api/optimize-route', methods=['POST'])
def optimize_route():
    """Optimize route for multiple stops and passengers"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided',
                'code': 'MISSING_DATA'
            }), 400
            
        # Extract route parameters
        waypoints = data.get('waypoints')
        constraints = data.get('constraints', {})
        
        if not waypoints or len(waypoints) < 2:
            return jsonify({
                'success': False,
                'error': 'At least 2 waypoints required',
                'code': 'INSUFFICIENT_WAYPOINTS'
            }), 400
            
        # Optimize route
        optimized_route = route_service.optimize_route(
            waypoints=waypoints,
            constraints=constraints
        )
        
        return jsonify({
            'success': True,
            'data': optimized_route,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in optimize_route: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to optimize route',
            'code': 'OPTIMIZATION_FAILED',
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/api/predict-demand', methods=['POST'])
def predict_demand():
    """Predict ride demand for specific areas and times"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided',
                'code': 'MISSING_DATA'
            }), 400
            
        # Extract prediction parameters
        location = data.get('location')
        time_range = data.get('time_range')
        
        if not all([location, time_range]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: location, time_range',
                'code': 'MISSING_REQUIRED_FIELDS'
            }), 400
            
        # Predict demand
        demand_prediction = demand_service.predict_demand(
            location=location,
            time_range=time_range
        )
        
        return jsonify({
            'success': True,
            'data': demand_prediction,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in predict_demand: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to predict demand',
            'code': 'PREDICTION_FAILED',
            'timestamp': datetime.utcnow().isoformat()
        }), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'success': False,
        'error': 'Endpoint not found',
        'code': 'ENDPOINT_NOT_FOUND',
        'timestamp': datetime.utcnow().isoformat()
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'success': False,
        'error': 'Internal server error',
        'code': 'INTERNAL_SERVER_ERROR',
        'timestamp': datetime.utcnow().isoformat()
    }), 500

@app.errorhandler(Exception)
def handle_exception(e):
    """Handle all other exceptions"""
    app.logger.error(f"Unhandled exception: {str(e)}")
    return jsonify({
        'success': False,
        'error': 'An unexpected error occurred',
        'code': 'UNEXPECTED_ERROR',
        'timestamp': datetime.utcnow().isoformat()
    }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    print(f"🤖 Hitch AI Services starting on port {port}")
    print(f"📊 Environment: {os.environ.get('FLASK_ENV', 'development')}")
    print(f"🔗 Health check: http://localhost:{port}/health")
    
    app.run(host='0.0.0.0', port=port, debug=debug)