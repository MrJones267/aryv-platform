"""
Logger Setup - Centralized logging configuration for AI services
Author: Claude-Code
Created: 2025-01-21
Last Modified: 2025-01-21
"""

import os
import sys
import logging
import logging.handlers
from datetime import datetime
from typing import Optional
import json

def setup_logger(name: str, 
                log_level: Optional[str] = None,
                log_file: Optional[str] = None,
                max_file_size: int = 10 * 1024 * 1024,  # 10MB
                backup_count: int = 5) -> logging.Logger:
    """
    Setup centralized logging with file rotation and structured output
    
    Args:
        name: Logger name
        log_level: Logging level (DEBUG, INFO, WARN, ERROR)
        log_file: Optional log file path
        max_file_size: Maximum log file size in bytes
        backup_count: Number of backup files to keep
        
    Returns:
        Configured logger instance
    """
    
    # Get log level from environment or parameter
    if not log_level:
        log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
    
    # Convert string level to logging constant
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(numeric_level)
    
    # Remove existing handlers to avoid duplicates
    logger.handlers = []
    
    # Create formatters
    detailed_formatter = StructuredFormatter()
    simple_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    
    # Use structured format for production, simple for development
    if os.environ.get('NODE_ENV') == 'production' or os.environ.get('FLASK_ENV') == 'production':
        console_handler.setFormatter(detailed_formatter)
    else:
        console_handler.setFormatter(simple_formatter)
    
    logger.addHandler(console_handler)
    
    # File handler with rotation
    if log_file:
        try:
            # Ensure log directory exists
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            
            file_handler = logging.handlers.RotatingFileHandler(
                log_file,
                maxBytes=max_file_size,
                backupCount=backup_count
            )
            file_handler.setLevel(numeric_level)
            file_handler.setFormatter(detailed_formatter)
            logger.addHandler(file_handler)
            
        except Exception as e:
            logger.error(f"Failed to setup file logging: {str(e)}")
    
    # Error file handler (for errors only)
    error_log_file = os.environ.get('ERROR_LOG_FILE')
    if error_log_file:
        try:
            os.makedirs(os.path.dirname(error_log_file), exist_ok=True)
            
            error_handler = logging.handlers.RotatingFileHandler(
                error_log_file,
                maxBytes=max_file_size,
                backupCount=backup_count
            )
            error_handler.setLevel(logging.ERROR)
            error_handler.setFormatter(detailed_formatter)
            logger.addHandler(error_handler)
            
        except Exception as e:
            logger.error(f"Failed to setup error file logging: {str(e)}")
    
    # Add startup log entry
    logger.info(f"Logger '{name}' initialized with level {log_level}")
    
    return logger


class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging"""
    
    def format(self, record):
        """Format log record as JSON"""
        
        # Base log entry
        log_entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'process_id': os.getpid(),
            'thread_id': record.thread
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
                'traceback': self.formatException(record.exc_info)
            }
        
        # Add extra fields from record
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                          'filename', 'module', 'exc_info', 'exc_text', 'stack_info',
                          'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
                          'thread', 'threadName', 'processName', 'process', 'getMessage',
                          'message']:
                extra_fields[key] = value
        
        if extra_fields:
            log_entry['extra'] = extra_fields
        
        # Add service-specific context
        log_entry['service'] = 'hitch-ai-services'
        log_entry['environment'] = os.environ.get('FLASK_ENV', 'development')
        
        # Add request ID if available (from Flask context)
        try:
            from flask import g, has_request_context
            if has_request_context() and hasattr(g, 'request_id'):
                log_entry['request_id'] = g.request_id
        except ImportError:
            pass
        
        return json.dumps(log_entry, default=str)


class AIServiceLogger:
    """Specialized logger for AI services with performance tracking"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.logger = setup_logger(f"ai-services.{service_name}")
    
    def log_prediction_start(self, prediction_id: str, input_data: dict):
        """Log start of AI prediction"""
        self.logger.info(
            "AI prediction started",
            extra={
                'prediction_id': prediction_id,
                'service': self.service_name,
                'input_size': len(str(input_data)),
                'event': 'prediction_start'
            }
        )
    
    def log_prediction_end(self, prediction_id: str, execution_time_ms: float, 
                          success: bool, result_size: int = 0):
        """Log end of AI prediction"""
        self.logger.info(
            "AI prediction completed",
            extra={
                'prediction_id': prediction_id,
                'service': self.service_name,
                'execution_time_ms': execution_time_ms,
                'success': success,
                'result_size': result_size,
                'event': 'prediction_end'
            }
        )
    
    def log_model_performance(self, model_name: str, accuracy: float, 
                             precision: float, recall: float):
        """Log model performance metrics"""
        self.logger.info(
            "Model performance metrics",
            extra={
                'model_name': model_name,
                'service': self.service_name,
                'accuracy': accuracy,
                'precision': precision,
                'recall': recall,
                'event': 'model_performance'
            }
        )
    
    def log_cache_hit(self, cache_key: str, cache_type: str = 'redis'):
        """Log cache hit"""
        self.logger.debug(
            "Cache hit",
            extra={
                'cache_key': cache_key,
                'cache_type': cache_type,
                'service': self.service_name,
                'event': 'cache_hit'
            }
        )
    
    def log_cache_miss(self, cache_key: str, cache_type: str = 'redis'):
        """Log cache miss"""
        self.logger.debug(
            "Cache miss",
            extra={
                'cache_key': cache_key,
                'cache_type': cache_type,
                'service': self.service_name,
                'event': 'cache_miss'
            }
        )
    
    def log_database_query(self, query_type: str, execution_time_ms: float, 
                          rows_affected: int = 0):
        """Log database query performance"""
        self.logger.debug(
            "Database query executed",
            extra={
                'query_type': query_type,
                'execution_time_ms': execution_time_ms,
                'rows_affected': rows_affected,
                'service': self.service_name,
                'event': 'database_query'
            }
        )
    
    def log_error(self, error_type: str, error_message: str, context: dict = None):
        """Log service error with context"""
        self.logger.error(
            f"{error_type}: {error_message}",
            extra={
                'error_type': error_type,
                'service': self.service_name,
                'context': context or {},
                'event': 'service_error'
            }
        )
    
    def log_warning(self, warning_type: str, warning_message: str, context: dict = None):
        """Log service warning with context"""
        self.logger.warning(
            f"{warning_type}: {warning_message}",
            extra={
                'warning_type': warning_type,
                'service': self.service_name,
                'context': context or {},
                'event': 'service_warning'
            }
        )


def get_request_logger() -> logging.Logger:
    """Get logger for HTTP request tracking"""
    return setup_logger('hitch-ai-services.requests')


def get_performance_logger() -> logging.Logger:
    """Get logger for performance monitoring"""
    return setup_logger('hitch-ai-services.performance')


def get_security_logger() -> logging.Logger:
    """Get logger for security events"""
    return setup_logger('hitch-ai-services.security')


# Context manager for performance logging
class PerformanceTimer:
    """Context manager for timing operations"""
    
    def __init__(self, operation_name: str, logger: logging.Logger = None):
        self.operation_name = operation_name
        self.logger = logger or get_performance_logger()
        self.start_time = None
    
    def __enter__(self):
        self.start_time = datetime.utcnow()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time:
            duration_ms = (datetime.utcnow() - self.start_time).total_seconds() * 1000
            
            if exc_type is None:
                self.logger.info(
                    f"Operation completed: {self.operation_name}",
                    extra={
                        'operation': self.operation_name,
                        'duration_ms': duration_ms,
                        'success': True,
                        'event': 'operation_completed'
                    }
                )
            else:
                self.logger.error(
                    f"Operation failed: {self.operation_name}",
                    extra={
                        'operation': self.operation_name,
                        'duration_ms': duration_ms,
                        'success': False,
                        'error_type': exc_type.__name__ if exc_type else None,
                        'error_message': str(exc_val) if exc_val else None,
                        'event': 'operation_failed'
                    }
                )