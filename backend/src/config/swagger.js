/**
 * @fileoverview Swagger/OpenAPI Configuration for ARYV Platform API
 * @author Oabona-Majoko
 * @created 2025-01-27
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ARYV Platform API',
    version: '1.0.0',
    description: 'Comprehensive REST API for the ARYV ride-sharing and courier platform',
    termsOfService: 'https://aryv-app.com/terms',
    contact: {
      name: 'ARYV API Support',
      url: 'https://aryv-app.com/support',
      email: 'api-support@aryv-app.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server'
    },
    {
      url: 'https://staging-api.aryv-app.com',
      description: 'Staging server'
    },
    {
      url: 'https://api.aryv-app.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for authentication. Format: Bearer <token>'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for service-to-service communication'
      }
    },
    schemas: {
      User: {
        type: 'object',
        required: ['email', 'firstName', 'lastName', 'role'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the user'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          firstName: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'User first name'
          },
          lastName: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'User last name'
          },
          phone: {
            type: 'string',
            pattern: '^\\+?[1-9]\\d{1,14}$',
            description: 'User phone number in E.164 format'
          },
          role: {
            type: 'string',
            enum: ['user', 'driver', 'admin', 'courier'],
            description: 'User role in the system'
          },
          status: {
            type: 'string',
            enum: ['pending', 'active', 'suspended', 'banned'],
            description: 'User account status'
          },
          profilePictureUrl: {
            type: 'string',
            format: 'uri',
            description: 'URL to user profile picture'
          },
          rating: {
            type: 'number',
            minimum: 1,
            maximum: 5,
            description: 'User average rating'
          },
          totalRides: {
            type: 'integer',
            minimum: 0,
            description: 'Total number of rides taken'
          },
          totalDrives: {
            type: 'integer',
            minimum: 0,
            description: 'Total number of rides provided (drivers only)'
          },
          emailVerified: {
            type: 'boolean',
            description: 'Whether email has been verified'
          },
          phoneVerified: {
            type: 'boolean',
            description: 'Whether phone has been verified'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last account update timestamp'
          }
        }
      },
      Vehicle: {
        type: 'object',
        required: ['make', 'model', 'year', 'color', 'licensePlate', 'vehicleType'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the vehicle'
          },
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the vehicle owner'
          },
          make: {
            type: 'string',
            maxLength: 50,
            description: 'Vehicle manufacturer'
          },
          model: {
            type: 'string',
            maxLength: 50,
            description: 'Vehicle model'
          },
          year: {
            type: 'integer',
            minimum: 1900,
            maximum: 2030,
            description: 'Vehicle year'
          },
          color: {
            type: 'string',
            maxLength: 30,
            description: 'Vehicle color'
          },
          licensePlate: {
            type: 'string',
            maxLength: 20,
            description: 'Vehicle license plate number'
          },
          vehicleType: {
            type: 'string',
            enum: ['car', 'motorcycle', 'bicycle', 'van', 'truck'],
            description: 'Type of vehicle'
          },
          capacity: {
            type: 'integer',
            minimum: 1,
            maximum: 50,
            description: 'Passenger capacity'
          },
          isVerified: {
            type: 'boolean',
            description: 'Whether vehicle is verified'
          },
          isActive: {
            type: 'boolean',
            description: 'Whether vehicle is active'
          },
          features: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Vehicle features (AC, WiFi, etc.)'
          }
        }
      },
      Ride: {
        type: 'object',
        required: ['pickupLocation', 'destinationLocation', 'requestedPickupTime'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the ride'
          },
          riderId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the ride requester'
          },
          driverId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the assigned driver'
          },
          vehicleId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the assigned vehicle'
          },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
            description: 'Current ride status'
          },
          pickupLocation: {
            $ref: '#/components/schemas/Location'
          },
          destinationLocation: {
            $ref: '#/components/schemas/Location'
          },
          pickupAddress: {
            type: 'string',
            description: 'Human-readable pickup address'
          },
          destinationAddress: {
            type: 'string',
            description: 'Human-readable destination address'
          },
          requestedPickupTime: {
            type: 'string',
            format: 'date-time',
            description: 'Requested pickup time'
          },
          actualPickupTime: {
            type: 'string',
            format: 'date-time',
            description: 'Actual pickup time'
          },
          estimatedArrivalTime: {
            type: 'string',
            format: 'date-time',
            description: 'Estimated arrival time'
          },
          actualArrivalTime: {
            type: 'string',
            format: 'date-time',
            description: 'Actual arrival time'
          },
          estimatedFare: {
            type: 'number',
            minimum: 0,
            description: 'Estimated fare amount'
          },
          finalFare: {
            type: 'number',
            minimum: 0,
            description: 'Final fare amount'
          },
          currency: {
            type: 'string',
            enum: ['USD', 'EUR', 'GBP'],
            default: 'USD',
            description: 'Fare currency'
          },
          surgeMultiplier: {
            type: 'number',
            minimum: 1,
            default: 1,
            description: 'Surge pricing multiplier'
          },
          estimatedDistance: {
            type: 'number',
            minimum: 0,
            description: 'Estimated distance in kilometers'
          },
          actualDistance: {
            type: 'number',
            minimum: 0,
            description: 'Actual distance in kilometers'
          },
          passengerCount: {
            type: 'integer',
            minimum: 1,
            maximum: 8,
            default: 1,
            description: 'Number of passengers'
          },
          preferences: {
            type: 'object',
            description: 'Ride preferences (temperature, music, etc.)'
          },
          riderRating: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
            description: 'Rating given by rider'
          },
          driverRating: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
            description: 'Rating given by driver'
          }
        }
      },
      Location: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: {
            type: 'number',
            minimum: -90,
            maximum: 90,
            description: 'Latitude coordinate'
          },
          longitude: {
            type: 'number',
            minimum: -180,
            maximum: 180,
            description: 'Longitude coordinate'
          },
          accuracy: {
            type: 'number',
            minimum: 0,
            description: 'GPS accuracy in meters'
          },
          heading: {
            type: 'number',
            minimum: 0,
            maximum: 360,
            description: 'Compass heading in degrees'
          },
          speed: {
            type: 'number',
            minimum: 0,
            description: 'Speed in km/h'
          }
        }
      },
      Package: {
        type: 'object',
        required: ['title', 'pickupLocation', 'deliveryLocation', 'deliveryFee'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the package'
          },
          senderId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the package sender'
          },
          courierId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the assigned courier'
          },
          receiverId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the package receiver'
          },
          title: {
            type: 'string',
            maxLength: 200,
            description: 'Package title/description'
          },
          description: {
            type: 'string',
            description: 'Detailed package description'
          },
          weight: {
            type: 'number',
            minimum: 0,
            maximum: 50,
            description: 'Package weight in kilograms'
          },
          dimensions: {
            type: 'object',
            properties: {
              length: { type: 'number', minimum: 0 },
              width: { type: 'number', minimum: 0 },
              height: { type: 'number', minimum: 0 }
            },
            description: 'Package dimensions in centimeters'
          },
          packageValue: {
            type: 'number',
            minimum: 0,
            description: 'Declared package value'
          },
          isFragile: {
            type: 'boolean',
            default: false,
            description: 'Whether package is fragile'
          },
          status: {
            type: 'string',
            enum: ['created', 'picked_up', 'in_transit', 'delivered', 'failed'],
            description: 'Current package status'
          },
          pickupLocation: {
            $ref: '#/components/schemas/Location'
          },
          deliveryLocation: {
            $ref: '#/components/schemas/Location'
          },
          deliveryFee: {
            type: 'number',
            minimum: 0,
            description: 'Delivery fee amount'
          },
          smartContractAddress: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'Ethereum smart contract address'
          }
        }
      },
      Payment: {
        type: 'object',
        required: ['amount', 'currency', 'paymentMethod'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the payment'
          },
          rideId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated ride ID'
          },
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'User making the payment'
          },
          amount: {
            type: 'number',
            minimum: 0,
            description: 'Payment amount'
          },
          currency: {
            type: 'string',
            enum: ['USD', 'EUR', 'GBP'],
            default: 'USD',
            description: 'Payment currency'
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'failed', 'refunded'],
            description: 'Payment status'
          },
          paymentMethod: {
            type: 'string',
            enum: ['card', 'wallet', 'cash', 'bank_transfer'],
            description: 'Payment method used'
          },
          transactionId: {
            type: 'string',
            description: 'External transaction identifier'
          },
          platformFee: {
            type: 'number',
            minimum: 0,
            description: 'Platform fee amount'
          },
          driverEarnings: {
            type: 'number',
            minimum: 0,
            description: 'Driver earnings amount'
          }
        }
      },
      Error: {
        type: 'object',
        required: ['success', 'error', 'code'],
        properties: {
          success: {
            type: 'boolean',
            example: false,
            description: 'Indicates request failure'
          },
          error: {
            type: 'string',
            description: 'Error message'
          },
          code: {
            type: 'string',
            description: 'Error code for programmatic handling'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Error timestamp'
          },
          details: {
            type: 'object',
            description: 'Additional error details'
          }
        }
      },
      Success: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
            description: 'Indicates request success'
          },
          data: {
            type: 'object',
            description: 'Response data'
          },
          message: {
            type: 'string',
            description: 'Success message'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Response timestamp'
          }
        }
      }
    },
    responses: {
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Resource not found',
              code: 'NOT_FOUND',
              timestamp: '2025-01-27T12:00:00.000Z'
            }
          }
        }
      },
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Authentication required',
              code: 'UNAUTHORIZED',
              timestamp: '2025-01-27T12:00:00.000Z'
            }
          }
        }
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Insufficient permissions',
              code: 'FORBIDDEN',
              timestamp: '2025-01-27T12:00:00.000Z'
            }
          }
        }
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Validation failed',
              code: 'VALIDATION_ERROR',
              details: {
                email: 'Invalid email format',
                password: 'Password must be at least 8 characters'
              },
              timestamp: '2025-01-27T12:00:00.000Z'
            }
          }
        }
      },
      ServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Internal server error',
              code: 'INTERNAL_ERROR',
              timestamp: '2025-01-27T12:00:00.000Z'
            }
          }
        }
      }
    },
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        }
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        }
      },
      SortParam: {
        name: 'sort',
        in: 'query',
        description: 'Sort field and direction (e.g., createdAt:desc)',
        required: false,
        schema: {
          type: 'string',
          pattern: '^[a-zA-Z_][a-zA-Z0-9_]*:(asc|desc)$'
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization operations'
    },
    {
      name: 'Users',
      description: 'User management operations'
    },
    {
      name: 'Vehicles',
      description: 'Vehicle management operations'
    },
    {
      name: 'Rides',
      description: 'Ride booking and management operations'
    },
    {
      name: 'Packages',
      description: 'Package delivery and courier operations'
    },
    {
      name: 'Payments',
      description: 'Payment processing operations'
    },
    {
      name: 'Admin',
      description: 'Administrative operations'
    },
    {
      name: 'Health',
      description: 'System health and monitoring'
    }
  ]
};

// Options for swagger-jsdoc
const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

// Initialize swagger-jsdoc
const specs = swaggerJsdoc(options);

// Swagger UI options
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    filter: true,
    showRequestHeaders: true,
    showResponseHeaders: true,
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      // Add custom headers or modify requests
      return req;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #3b82f6; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 20px; border-radius: 8px; }
  `,
  customSiteTitle: 'ARYV Platform API Documentation'
};

module.exports = {
  specs,
  swaggerUi,
  swaggerUiOptions
};