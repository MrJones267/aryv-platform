# ARYV Platform API Documentation

**Version:** 1.0.0  
**Base URL:** `https://api.aryv-app.com/api` (Production) | `http://localhost:3001/api` (Development)  
**Author:** Claude-Code  
**Created:** 2025-01-21

## Overview

The ARYV Platform API provides comprehensive endpoints for ride-sharing functionality, including user management, ride creation and booking, real-time tracking, AI-powered matching, and payment processing.

## Authentication

All protected endpoints require JWT authentication via the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

### Obtaining a Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "passenger"
    }
  },
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

## Rate Limiting

- **Global Rate Limit:** 100 requests per 15 minutes per IP
- **Authentication Endpoints:** 10 requests per hour per IP
- **Ride Creation:** 10 rides per hour per user
- **AI Endpoints:** 50 requests per 15 minutes per user

Rate limit headers are included in all responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642751400
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": <response_data>,
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

## Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "role": "passenger"
}
```

**Validation Rules:**
- Email: Valid email format, unique
- Password: Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number
- Phone: Valid international format
- Role: "passenger" or "driver"

#### POST /auth/login
Authenticate user and receive JWT token.

#### POST /auth/logout
Invalidate current JWT token (requires authentication).

#### POST /auth/forgot-password
Request password reset via email.

#### POST /auth/reset-password
Reset password using reset token.

### Users

#### GET /users/profile
Get current user's profile (requires authentication).

#### PUT /users/profile
Update current user's profile (requires authentication).

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phoneNumber": "+1234567890",
  "profileImage": "https://example.com/image.jpg"
}
```

#### POST /users/upload-avatar
Upload user profile image (requires authentication).

**Content-Type:** `multipart/form-data`

### Vehicles

#### GET /vehicles
Get user's vehicles (requires authentication).

#### POST /vehicles
Add new vehicle (requires authentication).

**Request Body:**
```json
{
  "make": "Toyota",
  "model": "Camry",
  "year": 2022,
  "color": "Blue",
  "licensePlate": "ABC123",
  "vehicleType": "sedan",
  "seatsAvailable": 4,
  "insuranceExpiry": "2025-12-31",
  "registrationExpiry": "2025-06-30"
}
```

#### PUT /vehicles/:id
Update vehicle information (requires authentication).

#### DELETE /vehicles/:id
Delete vehicle (requires authentication).

### Rides

#### GET /rides/search
Search for available rides.

**Query Parameters:**
- `originLat` (required): Origin latitude
- `originLng` (required): Origin longitude
- `destinationLat` (required): Destination latitude
- `destinationLng` (required): Destination longitude
- `departureTime` (required): ISO 8601 datetime
- `seats`: Number of seats needed (default: 1)
- `maxDistance`: Maximum distance from origin in km (default: 10)
- `maxPrice`: Maximum price per seat
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "rides": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "driverId": "550e8400-e29b-41d4-a716-446655440001",
        "originAddress": "123 Main St, New York, NY",
        "originCoordinates": {
          "latitude": 40.7128,
          "longitude": -74.0060
        },
        "destinationAddress": "456 Broadway, New York, NY",
        "destinationCoordinates": {
          "latitude": 40.7589,
          "longitude": -73.9851
        },
        "departureTime": "2025-01-21T14:00:00.000Z",
        "availableSeats": 3,
        "pricePerSeat": 15.00,
        "distance": 5.2,
        "estimatedDuration": 25,
        "status": "pending",
        "driver": {
          "firstName": "Alice",
          "lastName": "Johnson",
          "rating": 4.8,
          "profileImage": "https://example.com/alice.jpg"
        },
        "vehicle": {
          "make": "Honda",
          "model": "Accord",
          "color": "White",
          "year": 2021
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  },
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

#### POST /rides
Create a new ride (requires authentication, driver role).

**Request Body:**
```json
{
  "originAddress": "123 Main St, New York, NY",
  "originCoordinates": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "destinationAddress": "456 Broadway, New York, NY",
  "destinationCoordinates": {
    "latitude": 40.7589,
    "longitude": -73.9851
  },
  "departureTime": "2025-01-21T14:00:00.000Z",
  "availableSeats": 3,
  "pricePerSeat": 15.00,
  "vehicleId": "550e8400-e29b-41d4-a716-446655440002",
  "description": "Comfortable ride with AC and music",
  "estimatedDuration": 25,
  "distance": 5.2
}
```

#### GET /rides/:id
Get ride details by ID.

#### PUT /rides/:id
Update ride (requires authentication, driver only).

#### DELETE /rides/:id
Cancel ride (requires authentication, driver only).

#### POST /rides/:id/book
Book a ride (requires authentication).

**Request Body:**
```json
{
  "seatsRequested": 2,
  "pickupAddress": "123 Main St, New York, NY",
  "dropoffAddress": "456 Broadway, New York, NY",
  "specialRequests": "Please wait 2 minutes at pickup"
}
```

#### PUT /rides/:id/status
Update ride status (requires authentication, driver only).

**Request Body:**
```json
{
  "status": "confirmed"
}
```

**Valid Status Transitions:**
- `pending` → `confirmed`, `cancelled`
- `confirmed` → `in_progress`, `cancelled`
- `in_progress` → `completed`

### AI-Powered Features

#### POST /rides/ai/find-matches
Find compatible rides using AI matching algorithm (requires authentication).

**Request Body:**
```json
{
  "originCoordinates": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "destinationCoordinates": {
    "latitude": 40.7589,
    "longitude": -73.9851
  },
  "departureTime": "2025-01-21T14:00:00.000Z",
  "originAddress": "123 Main St, New York, NY",
  "destinationAddress": "456 Broadway, New York, NY",
  "preferences": {
    "maxDistance": 10,
    "maxTimeDifference": 2,
    "maxPrice": 20.00,
    "seatsNeeded": 1,
    "vehiclePreferences": {
      "maxAge": 5
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "ride_id": "550e8400-e29b-41d4-a716-446655440000",
        "driver_id": "550e8400-e29b-41d4-a716-446655440001",
        "compatibility_score": 0.856,
        "distance_from_origin": 0.8,
        "distance_to_destination": 1.2,
        "time_deviation_hours": 0.5,
        "price_per_seat": 15.00,
        "available_seats": 3,
        "driver_rating": 4.8,
        "vehicle_info": {
          "make": "Honda",
          "model": "Accord",
          "year": 2021,
          "color": "White",
          "license_plate": "ABC123"
        },
        "estimated_pickup_time": "2025-01-21T13:55:00.000Z",
        "estimated_arrival_time": "2025-01-21T14:25:00.000Z",
        "route_efficiency": 0.92
      }
    ],
    "total_matches": 1,
    "search_params": {
      "origin": {
        "address": "123 Main St, New York, NY",
        "coordinates": {
          "latitude": 40.7128,
          "longitude": -74.0060
        }
      },
      "destination": {
        "address": "456 Broadway, New York, NY",
        "coordinates": {
          "latitude": 40.7589,
          "longitude": -73.9851
        }
      },
      "departure_time": "2025-01-21T14:00:00.000Z"
    }
  },
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

#### POST /rides/ai/calculate-price
Calculate dynamic pricing (requires authentication).

**Request Body:**
```json
{
  "originCoordinates": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "destinationCoordinates": {
    "latitude": 40.7589,
    "longitude": -73.9851
  },
  "departureTime": "2025-01-21T14:00:00.000Z",
  "distance": 5.2,
  "estimatedDuration": 25,
  "marketConditions": {
    "weather": {
      "condition": "clear",
      "temperature": 22
    },
    "events": [
      {
        "location": {
          "latitude": 40.7580,
          "longitude": -73.9855
        },
        "impact": "medium"
      }
    ]
  }
}
```

#### POST /rides/ai/optimize-route
Optimize route for multiple passengers (requires authentication).

**Request Body:**
```json
{
  "waypoints": [
    {
      "id": "pickup_1",
      "type": "pickup",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "123 Main St, New York, NY",
      "passenger_id": "passenger_1",
      "estimated_time": 120
    },
    {
      "id": "dropoff_1",
      "type": "dropoff",
      "latitude": 40.7589,
      "longitude": -73.9851,
      "address": "456 Broadway, New York, NY",
      "passenger_id": "passenger_1",
      "estimated_time": 60
    }
  ],
  "constraints": {
    "maxPassengers": 4,
    "maxDetourFactor": 1.5
  }
}
```

#### POST /rides/ai/predict-demand
Predict ride demand for location and time (requires authentication).

**Request Body:**
```json
{
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "timeRange": {
    "start": "2025-01-21T14:00:00.000Z",
    "end": "2025-01-21T18:00:00.000Z"
  }
}
```

#### POST /rides/ai/recommendations
Get comprehensive AI ride recommendations (requires authentication).

### Bookings

#### GET /bookings
Get user's bookings (requires authentication).

#### GET /bookings/:id
Get booking details (requires authentication).

#### PUT /bookings/:id/cancel
Cancel booking (requires authentication).

#### PUT /bookings/:id/confirm
Confirm booking (requires authentication, driver only).

### Payments

#### POST /payments/create-intent
Create payment intent (requires authentication).

#### POST /payments/confirm
Confirm payment (requires authentication).

#### GET /payments/history
Get payment history (requires authentication).

### Reviews

#### POST /reviews
Submit review after ride completion (requires authentication).

**Request Body:**
```json
{
  "bookingId": "550e8400-e29b-41d4-a716-446655440000",
  "rating": 5,
  "comment": "Great ride, very comfortable and on time!",
  "isAnonymous": false
}
```

#### GET /reviews/user/:userId
Get reviews for a user.

### Real-time Features

#### WebSocket Connection
Connect to real-time updates at: `ws://localhost:3001` (Development)

**Authentication:**
Send JWT token in connection query: `?token=<jwt_token>`

**Events:**

- `ride_update`: Ride status changes
- `booking_update`: Booking status changes
- `location_update`: Driver location updates
- `message`: Chat messages

**Example Message:**
```json
{
  "type": "ride_update",
  "data": {
    "rideId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "in_progress",
    "driverLocation": {
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  },
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource conflict |
| `RATE_LIMITED` | Rate limit exceeded |
| `INTERNAL_ERROR` | Internal server error |
| `SERVICE_UNAVAILABLE` | External service unavailable |
| `AI_MATCHING_FAILED` | AI service unavailable |
| `PAYMENT_FAILED` | Payment processing failed |

## Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `422`: Validation Error
- `429`: Too Many Requests
- `500`: Internal Server Error
- `503`: Service Unavailable

## Data Types

### Coordinates
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

### Ride Status
- `pending`: Ride created, awaiting bookings
- `confirmed`: Ride has confirmed bookings
- `in_progress`: Ride is currently active
- `completed`: Ride finished successfully
- `cancelled`: Ride cancelled by driver

### Booking Status
- `pending`: Booking submitted, awaiting confirmation
- `confirmed`: Booking confirmed by driver
- `cancelled`: Booking cancelled
- `completed`: Booking completed successfully

### User Roles
- `passenger`: Can book rides
- `driver`: Can create and drive rides
- `admin`: Administrative access

## Best Practices

### Pagination
All list endpoints support pagination:
```http
GET /rides/search?page=1&limit=20
```

### Filtering
Use query parameters for filtering:
```http
GET /rides/search?minPrice=10&maxPrice=50&seats=2
```

### Sorting
Use `sort` parameter:
```http
GET /rides/search?sort=departureTime:asc,price:desc
```

### Error Handling
Always check the `success` field and handle errors appropriately:

```javascript
if (!response.success) {
  console.error(`Error ${response.code}: ${response.error}`);
}
```

### Rate Limiting
Implement exponential backoff when receiving 429 responses.

### Real-time Updates
Use WebSocket connections for live updates instead of polling.

## SDKs and Libraries

- **JavaScript/TypeScript**: `@hitch/api-client`
- **React Native**: `@hitch/react-native-sdk`
- **Python**: `hitch-python-sdk`
- **iOS**: `ARYViOSSDK`
- **Android**: `ARYVAndroidSDK`

## Support

- **API Documentation**: https://docs.hitch.com/api
- **Status Page**: https://status.hitch.com
- **Developer Portal**: https://developers.hitch.com
- **Support Email**: api-support@hitch.com