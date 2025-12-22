"""
Redis Client - Caching and session management for AI services
Author: Claude-Code
Created: 2025-01-21
Last Modified: 2025-01-21
"""

import os
import redis
import json
import logging
import pickle
from typing import Any, Optional, Union, Dict
from datetime import timedelta

class RedisClient:
    """Redis client wrapper with serialization and error handling"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.redis_client = None
        self._initialize_connection()
    
    def _initialize_connection(self):
        """Initialize Redis connection"""
        try:
            redis_url = os.environ.get('REDIS_URL')
            
            if redis_url:
                # Parse Redis URL
                self.redis_client = redis.from_url(
                    redis_url,
                    decode_responses=False,  # We'll handle encoding ourselves
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True,
                    health_check_interval=30
                )
            else:
                # Use individual environment variables
                redis_config = {
                    'host': os.environ.get('REDIS_HOST', 'redis'),
                    'port': int(os.environ.get('REDIS_PORT', 6379)),
                    'password': os.environ.get('REDIS_PASSWORD'),
                    'db': int(os.environ.get('REDIS_DB', 0)),
                    'decode_responses': False,
                    'socket_connect_timeout': 5,
                    'socket_timeout': 5,
                    'retry_on_timeout': True,
                    'health_check_interval': 30
                }
                
                self.redis_client = redis.Redis(**redis_config)
            
            # Test connection
            self.redis_client.ping()
            self.logger.info("Redis connection initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize Redis connection: {str(e)}")
            raise
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from Redis with automatic deserialization
        
        Args:
            key: Redis key
            
        Returns:
            Deserialized value or None if key doesn't exist
        """
        try:
            value = self.redis_client.get(key)
            
            if value is None:
                return None
            
            # Try to deserialize as JSON first, then pickle
            try:
                return json.loads(value.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                try:
                    return pickle.loads(value)
                except pickle.PickleError:
                    # Return as string if all else fails
                    return value.decode('utf-8', errors='ignore')
                    
        except Exception as e:
            self.logger.error(f"Error getting key '{key}' from Redis: {str(e)}")
            return None
    
    def set(self, key: str, value: Any, expire: Optional[Union[int, timedelta]] = None) -> bool:
        """
        Set value in Redis with automatic serialization
        
        Args:
            key: Redis key
            value: Value to store
            expire: Expiration time in seconds or timedelta
            
        Returns:
            Success status
        """
        try:
            # Serialize value
            if isinstance(value, (dict, list, tuple)):
                serialized_value = json.dumps(value)
            elif isinstance(value, (int, float, bool)):
                serialized_value = json.dumps(value)
            elif isinstance(value, str):
                serialized_value = value
            else:
                # Use pickle for complex objects
                serialized_value = pickle.dumps(value)
            
            # Set with expiration
            if expire:
                if isinstance(expire, timedelta):
                    expire = int(expire.total_seconds())
                return self.redis_client.setex(key, expire, serialized_value)
            else:
                return self.redis_client.set(key, serialized_value)
                
        except Exception as e:
            self.logger.error(f"Error setting key '{key}' in Redis: {str(e)}")
            return False
    
    def setex(self, key: str, time: int, value: Any) -> bool:
        """
        Set value with expiration time
        
        Args:
            key: Redis key
            time: Expiration time in seconds
            value: Value to store
            
        Returns:
            Success status
        """
        return self.set(key, value, expire=time)
    
    def delete(self, *keys: str) -> int:
        """
        Delete keys from Redis
        
        Args:
            keys: Keys to delete
            
        Returns:
            Number of keys deleted
        """
        try:
            return self.redis_client.delete(*keys)
        except Exception as e:
            self.logger.error(f"Error deleting keys from Redis: {str(e)}")
            return 0
    
    def exists(self, key: str) -> bool:
        """
        Check if key exists in Redis
        
        Args:
            key: Redis key
            
        Returns:
            True if key exists, False otherwise
        """
        try:
            return bool(self.redis_client.exists(key))
        except Exception as e:
            self.logger.error(f"Error checking key existence in Redis: {str(e)}")
            return False
    
    def expire(self, key: str, time: int) -> bool:
        """
        Set expiration time for key
        
        Args:
            key: Redis key
            time: Expiration time in seconds
            
        Returns:
            Success status
        """
        try:
            return self.redis_client.expire(key, time)
        except Exception as e:
            self.logger.error(f"Error setting expiration for key '{key}': {str(e)}")
            return False
    
    def ttl(self, key: str) -> int:
        """
        Get time to live for key
        
        Args:
            key: Redis key
            
        Returns:
            TTL in seconds, -1 if no expiration, -2 if key doesn't exist
        """
        try:
            return self.redis_client.ttl(key)
        except Exception as e:
            self.logger.error(f"Error getting TTL for key '{key}': {str(e)}")
            return -2
    
    def keys(self, pattern: str = "*") -> list:
        """
        Get keys matching pattern
        
        Args:
            pattern: Key pattern
            
        Returns:
            List of matching keys
        """
        try:
            keys = self.redis_client.keys(pattern)
            return [key.decode('utf-8') for key in keys]
        except Exception as e:
            self.logger.error(f"Error getting keys with pattern '{pattern}': {str(e)}")
            return []
    
    def flushdb(self) -> bool:
        """
        Clear all keys in current database
        
        Returns:
            Success status
        """
        try:
            self.redis_client.flushdb()
            return True
        except Exception as e:
            self.logger.error(f"Error flushing Redis database: {str(e)}")
            return False
    
    def incr(self, key: str, amount: int = 1) -> Optional[int]:
        """
        Increment key value
        
        Args:
            key: Redis key
            amount: Amount to increment
            
        Returns:
            New value or None on error
        """
        try:
            return self.redis_client.incr(key, amount)
        except Exception as e:
            self.logger.error(f"Error incrementing key '{key}': {str(e)}")
            return None
    
    def decr(self, key: str, amount: int = 1) -> Optional[int]:
        """
        Decrement key value
        
        Args:
            key: Redis key
            amount: Amount to decrement
            
        Returns:
            New value or None on error
        """
        try:
            return self.redis_client.decr(key, amount)
        except Exception as e:
            self.logger.error(f"Error decrementing key '{key}': {str(e)}")
            return None
    
    def hget(self, name: str, key: str) -> Optional[Any]:
        """
        Get field from hash
        
        Args:
            name: Hash name
            key: Field key
            
        Returns:
            Field value or None
        """
        try:
            value = self.redis_client.hget(name, key)
            if value is None:
                return None
            
            try:
                return json.loads(value.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return value.decode('utf-8', errors='ignore')
                
        except Exception as e:
            self.logger.error(f"Error getting hash field '{key}' from '{name}': {str(e)}")
            return None
    
    def hset(self, name: str, key: str, value: Any) -> bool:
        """
        Set field in hash
        
        Args:
            name: Hash name
            key: Field key
            value: Field value
            
        Returns:
            Success status
        """
        try:
            if isinstance(value, (dict, list, tuple)):
                serialized_value = json.dumps(value)
            elif isinstance(value, str):
                serialized_value = value
            else:
                serialized_value = str(value)
            
            return bool(self.redis_client.hset(name, key, serialized_value))
            
        except Exception as e:
            self.logger.error(f"Error setting hash field '{key}' in '{name}': {str(e)}")
            return False
    
    def hgetall(self, name: str) -> Dict[str, Any]:
        """
        Get all fields from hash
        
        Args:
            name: Hash name
            
        Returns:
            Hash fields as dictionary
        """
        try:
            hash_data = self.redis_client.hgetall(name)
            
            result = {}
            for key, value in hash_data.items():
                key_str = key.decode('utf-8')
                try:
                    result[key_str] = json.loads(value.decode('utf-8'))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    result[key_str] = value.decode('utf-8', errors='ignore')
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error getting all hash fields from '{name}': {str(e)}")
            return {}
    
    def lpush(self, key: str, *values: Any) -> Optional[int]:
        """
        Push values to left of list
        
        Args:
            key: List key
            values: Values to push
            
        Returns:
            New list length or None on error
        """
        try:
            serialized_values = []
            for value in values:
                if isinstance(value, (dict, list, tuple)):
                    serialized_values.append(json.dumps(value))
                else:
                    serialized_values.append(str(value))
            
            return self.redis_client.lpush(key, *serialized_values)
            
        except Exception as e:
            self.logger.error(f"Error pushing to list '{key}': {str(e)}")
            return None
    
    def rpop(self, key: str) -> Optional[Any]:
        """
        Pop value from right of list
        
        Args:
            key: List key
            
        Returns:
            Popped value or None
        """
        try:
            value = self.redis_client.rpop(key)
            if value is None:
                return None
            
            try:
                return json.loads(value.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return value.decode('utf-8', errors='ignore')
                
        except Exception as e:
            self.logger.error(f"Error popping from list '{key}': {str(e)}")
            return None
    
    def llen(self, key: str) -> int:
        """
        Get list length
        
        Args:
            key: List key
            
        Returns:
            List length
        """
        try:
            return self.redis_client.llen(key)
        except Exception as e:
            self.logger.error(f"Error getting list length for '{key}': {str(e)}")
            return 0
    
    def ping(self) -> bool:
        """
        Test Redis connection
        
        Returns:
            True if connection is healthy
        """
        try:
            return self.redis_client.ping()
        except Exception as e:
            self.logger.error(f"Redis ping failed: {str(e)}")
            return False
    
    def info(self, section: Optional[str] = None) -> Dict[str, Any]:
        """
        Get Redis server information
        
        Args:
            section: Optional section to get info for
            
        Returns:
            Server information
        """
        try:
            return self.redis_client.info(section)
        except Exception as e:
            self.logger.error(f"Error getting Redis info: {str(e)}")
            return {}
    
    def cache_ai_result(self, cache_key: str, result: Any, ttl: int = 300) -> bool:
        """
        Cache AI service result
        
        Args:
            cache_key: Unique cache key
            result: Result to cache
            ttl: Time to live in seconds
            
        Returns:
            Success status
        """
        return self.setex(f"ai_cache:{cache_key}", ttl, result)
    
    def get_cached_ai_result(self, cache_key: str) -> Optional[Any]:
        """
        Get cached AI service result
        
        Args:
            cache_key: Unique cache key
            
        Returns:
            Cached result or None
        """
        return self.get(f"ai_cache:{cache_key}")
    
    def store_ml_model_metadata(self, model_name: str, metadata: Dict[str, Any]) -> bool:
        """
        Store machine learning model metadata
        
        Args:
            model_name: Model identifier
            metadata: Model metadata
            
        Returns:
            Success status
        """
        return self.set(f"ml_model:{model_name}", metadata)
    
    def get_ml_model_metadata(self, model_name: str) -> Optional[Dict[str, Any]]:
        """
        Get machine learning model metadata
        
        Args:
            model_name: Model identifier
            
        Returns:
            Model metadata or None
        """
        return self.get(f"ml_model:{model_name}")
    
    def close_connection(self):
        """Close Redis connection"""
        try:
            if self.redis_client:
                self.redis_client.close()
                self.logger.info("Redis connection closed")
        except Exception as e:
            self.logger.error(f"Error closing Redis connection: {str(e)}")
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        self.close_connection()