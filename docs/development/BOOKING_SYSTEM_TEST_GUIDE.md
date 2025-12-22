# 🧪 Hitch Booking System - Comprehensive Testing Guide

## ✅ **BOOKING SYSTEM IMPLEMENTATION COMPLETE**

The Hitch platform now features a fully functional, production-ready booking system with the following capabilities:

### 🎯 **Features Implemented**

#### **Core Booking Operations**
- ✅ Complete CRUD operations for bookings
- ✅ Smart booking validation (seat availability, permissions, status transitions)
- ✅ Real-time booking status updates with Socket.io notifications
- ✅ User access control (drivers vs passengers with different permissions)

#### **Payment Integration**
- ✅ Full Stripe integration with real payment intent creation
- ✅ Payment verification and webhook handling
- ✅ Refund processing for cancellations
- ✅ Mock payment support for development environment
- ✅ Platform fee calculation and processing

#### **Real-time Features**
- ✅ Live booking notifications to drivers and passengers
- ✅ Status change alerts with personalized messages
- ✅ Real-time updates via Socket.io integration
- ✅ Rating and review notifications

#### **Advanced Features**
- ✅ Booking rating and review system
- ✅ Cancellation with reason tracking
- ✅ Seat count updates with availability validation
- ✅ Driver booking confirmation workflow
- ✅ Comprehensive error handling and logging

---

## 🔧 **Testing Setup**

### **Prerequisites**
1. **Backend Server Running**: `npm run dev` or `node src/index.ts`
2. **Database Connected**: PostgreSQL with PostGIS extension
3. **Environment Variables**: JWT_SECRET, database credentials
4. **Optional**: Stripe API keys for payment testing

### **Test Environment Setup**
```bash
# 1. Start backend server
cd backend
npm run dev

# 2. Verify health endpoint
curl http://localhost:3001/health

# 3. Check available endpoints
curl http://localhost:3001/ | jq
```

---

## 📋 **API Endpoint Testing Guide**

### **1. Authentication Setup**

Before testing booking endpoints, you need valid JWT tokens:

```bash
# Create test users (driver and passenger)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Driver",
    "email": "driver@test.com",
    "phoneNumber": "+1234567890",
    "password": "securePassword123"
  }'

curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Passenger",
    "email": "passenger@test.com",
    "phoneNumber": "+1234567891",
    "password": "securePassword123"
  }'

# Login to get JWT tokens
DRIVER_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "driver@test.com", "password": "securePassword123"}' | jq -r '.data.token')

PASSENGER_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "passenger@test.com", "password": "securePassword123"}' | jq -r '.data.token')
```

### **2. Create Test Data**

```bash
# Create vehicle for driver
VEHICLE_ID=$(curl -s -X POST http://localhost:3001/api/vehicles \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "make": "Toyota",
    "model": "Camry",
    "year": 2020,
    "color": "Blue",
    "licensePlate": "ABC123",
    "capacity": 4
  }' | jq -r '.data.id')

# Create ride
RIDE_ID=$(curl -s -X POST http://localhost:3001/api/rides \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originAddress": "123 Start St, City",
    "originCoordinates": {"latitude": 40.7128, "longitude": -74.006},
    "destinationAddress": "456 End Ave, City",
    "destinationCoordinates": {"latitude": 40.7484, "longitude": -73.9857},
    "departureTime": "'$(date -d "tomorrow 10:00" -Iseconds)'",
    "availableSeats": 3,
    "pricePerSeat": 25.00,
    "vehicleId": "'$VEHICLE_ID'",
    "estimatedDuration": 30,
    "distance": 15.5
  }' | jq -r '.data.id')
```

### **3. Booking Lifecycle Testing**

#### **Step 1: Create Booking**
```bash
# Passenger books a ride
BOOKING_ID=$(curl -s -X POST http://localhost:3001/api/rides/$RIDE_ID/book \
  -H "Authorization: Bearer $PASSENGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "seatsRequested": 2,
    "pickupAddress": "123 Start St, City",
    "dropoffAddress": "456 End Ave, City",
    "specialRequests": "Please wait outside the main entrance"
  }' | jq -r '.data.id')

echo "Booking created with ID: $BOOKING_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-booking-id",
    "seatsBooked": 2,
    "totalAmount": 52.5,
    "platformFee": 2.5,
    "status": "pending",
    "pickupAddress": "123 Start St, City",
    "dropoffAddress": "456 End Ave, City",
    "specialRequests": "Please wait outside the main entrance"
  }
}
```

#### **Step 2: Get User Bookings**
```bash
# Passenger views their bookings
curl -X GET "http://localhost:3001/api/bookings/my-bookings?type=passenger" \
  -H "Authorization: Bearer $PASSENGER_TOKEN" | jq

# Driver views bookings for their rides
curl -X GET "http://localhost:3001/api/bookings/my-bookings?type=driver" \
  -H "Authorization: Bearer $DRIVER_TOKEN" | jq
```

#### **Step 3: Driver Confirms Booking**
```bash
# Driver confirms the booking
curl -X POST http://localhost:3001/api/bookings/$BOOKING_ID/confirm \
  -H "Authorization: Bearer $DRIVER_TOKEN" | jq

# Verify status changed to 'confirmed'
curl -X GET http://localhost:3001/api/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $PASSENGER_TOKEN" | jq '.data.status'
```

#### **Step 4: Payment Processing**
```bash
# Create payment intent
PAYMENT_INTENT=$(curl -s -X GET http://localhost:3001/api/bookings/$BOOKING_ID/payment-intent \
  -H "Authorization: Bearer $PASSENGER_TOKEN" | jq -r '.data.id')

echo "Payment Intent ID: $PAYMENT_INTENT"

# Confirm payment (mock or real Stripe)
curl -X POST http://localhost:3001/api/bookings/$BOOKING_ID/payment-confirm \
  -H "Authorization: Bearer $PASSENGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId": "'$PAYMENT_INTENT'"}' | jq
```

#### **Step 5: Update Booking Details**
```bash
# Passenger updates pickup address
curl -X PUT http://localhost:3001/api/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $PASSENGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupAddress": "124 New Pickup St, City",
    "specialRequests": "Updated: Please call when you arrive"
  }' | jq

# Passenger updates seat count
curl -X PUT http://localhost:3001/api/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $PASSENGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"seatsBooked": 1}' | jq
```

#### **Step 6: Rate Completed Booking**
```bash
# First, mark booking as completed (normally done by driver)
curl -X PUT http://localhost:3001/api/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}' | jq

# Passenger rates the booking
curl -X POST http://localhost:3001/api/bookings/$BOOKING_ID/rate \
  -H "Authorization: Bearer $PASSENGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "review": "Excellent ride! Driver was punctual and friendly."
  }' | jq
```

#### **Step 7: Cancellation Testing**
```bash
# Create another booking for cancellation test
BOOKING_ID_2=$(curl -s -X POST http://localhost:3001/api/rides/$RIDE_ID/book \
  -H "Authorization: Bearer $PASSENGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "seatsRequested": 1,
    "pickupAddress": "789 Cancel St, City",
    "dropoffAddress": "456 End Ave, City"
  }' | jq -r '.data.id')

# Cancel the booking
curl -X POST http://localhost:3001/api/bookings/$BOOKING_ID_2/cancel \
  -H "Authorization: Bearer $PASSENGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Change of plans, cannot make it"}' | jq
```

---

## 🔄 **Real-time Features Testing**

### **Socket.io Connection Testing**

```javascript
// Browser console or Node.js script
const io = require('socket.io-client');

// Connect to Socket.io server
const socket = io('http://localhost:3001', {
  auth: { token: 'your-jwt-token' }
});

socket.on('connect', () => {
  console.log('Connected to Socket.io server');
  
  // Join booking room
  socket.emit('join_booking', { bookingId: 'your-booking-id', userId: 'your-user-id' });
  
  // Listen for booking notifications
  socket.on('booking_notification', (data) => {
    console.log('Booking notification:', data);
  });
  
  // Listen for status changes
  socket.on('booking_status_change', (data) => {
    console.log('Booking status changed:', data);
  });
  
  // Listen for new booking requests (drivers)
  socket.on('new_booking_request', (data) => {
    console.log('New booking request:', data);
  });
});
```

### **Real-time Notification Flow**

1. **Driver receives notification** when passenger creates booking
2. **Passenger receives notification** when driver confirms booking
3. **Both parties receive notifications** for status changes
4. **Driver receives notification** when passenger rates the ride

---

## 🛡️ **Error Handling Testing**

### **Authentication Errors**
```bash
# Test without token
curl -X GET http://localhost:3001/api/bookings/my-bookings

# Expected: 401 Unauthorized
```

### **Authorization Errors**
```bash
# Passenger tries to confirm booking (only driver can)
curl -X POST http://localhost:3001/api/bookings/$BOOKING_ID/confirm \
  -H "Authorization: Bearer $PASSENGER_TOKEN"

# Expected: 403 Forbidden
```

### **Validation Errors**
```bash
# Invalid booking data
curl -X POST http://localhost:3001/api/rides/$RIDE_ID/book \
  -H "Authorization: Bearer $PASSENGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"seatsRequested": 10}' # More seats than available

# Expected: 400 Bad Request with INSUFFICIENT_SEATS error
```

### **Business Logic Errors**
```bash
# Driver tries to book their own ride
curl -X POST http://localhost:3001/api/rides/$RIDE_ID/book \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"seatsRequested": 1}'

# Expected: 400 Bad Request with CANNOT_BOOK_OWN_RIDE error
```

---

## 🚀 **Performance Testing**

### **Load Testing with curl**
```bash
# Create multiple concurrent bookings
for i in {1..10}; do
  (curl -X POST http://localhost:3001/api/rides/$RIDE_ID/book \
    -H "Authorization: Bearer $PASSENGER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"seatsRequested": 1}' &)
done
wait
```

### **WebSocket Connection Testing**
```bash
# Test multiple Socket.io connections
for i in {1..50}; do
  node -e "
    const io = require('socket.io-client');
    const socket = io('http://localhost:3001', {auth: {token: '$PASSENGER_TOKEN'}});
    socket.on('connect', () => console.log('Connected $i'));
  " &
done
```

---

## 📊 **Expected Test Results**

### **Successful Booking Flow**
1. ✅ Booking creation returns 201 with booking details
2. ✅ Driver receives real-time notification
3. ✅ Driver can confirm booking (status → 'confirmed')
4. ✅ Passenger receives confirmation notification
5. ✅ Payment intent created successfully
6. ✅ Payment confirmation updates booking
7. ✅ Booking details can be updated by appropriate users
8. ✅ Completed booking can be rated by passenger
9. ✅ Booking can be cancelled with reason

### **Error Handling Validation**
1. ✅ Unauthorized requests return 401
2. ✅ Forbidden actions return 403
3. ✅ Invalid data returns 400 with specific error codes
4. ✅ Business rule violations return appropriate errors
5. ✅ Non-existent resources return 404

### **Real-time Features**
1. ✅ Socket.io connections authenticate successfully
2. ✅ Notifications sent to correct users
3. ✅ Multiple socket connections handled properly
4. ✅ Room-based messaging works correctly

---

## 🎯 **Production Readiness Checklist**

- ✅ **Authentication & Authorization**: JWT-based with role permissions
- ✅ **Input Validation**: Comprehensive validation with express-validator
- ✅ **Error Handling**: Structured error responses with specific codes
- ✅ **Real-time Updates**: Socket.io integration with room management
- ✅ **Payment Processing**: Stripe integration with webhook handling
- ✅ **Database Transactions**: ACID compliance for critical operations
- ✅ **Rate Limiting**: Protection against API abuse
- ✅ **Logging**: Comprehensive logging for debugging and monitoring
- ✅ **Security**: CORS, Helmet, input sanitization
- ✅ **Testing**: Unit and integration test frameworks in place

---

## 🔧 **Troubleshooting**

### **Common Issues**

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection credentials in .env
   - Ensure PostGIS extension is installed

2. **JWT Token Invalid**
   - Ensure JWT_SECRET is set in environment
   - Check token expiration
   - Verify Authorization header format: `Bearer <token>`

3. **Socket.io Connection Issues**
   - Check CORS settings
   - Verify Socket.io authentication middleware
   - Ensure proper token format in auth object

4. **Payment Integration Issues**
   - Verify STRIPE_SECRET_KEY in environment
   - Check webhook endpoint configuration
   - Ensure proper error handling for failed payments

### **Debug Commands**
```bash
# Check server logs
tail -f backend/logs/combined.log

# Verify database connection
node -e "require('./src/config/database').testConnection()"

# Test specific endpoint
curl -v http://localhost:3001/api/bookings/my-bookings \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🎉 **Success Confirmation**

When all tests pass, you should see:
- ✅ All API endpoints responding correctly
- ✅ Real-time notifications working
- ✅ Payment flow completing successfully
- ✅ Proper error handling for edge cases
- ✅ Database transactions maintaining consistency

**The booking system is now production-ready and ready for mobile app integration!**

---

## 📱 **Next Steps**

1. **Mobile App Integration**: Connect React Native app to booking APIs
2. **Admin Panel Integration**: Add booking management to admin interface
3. **Advanced Features**: Implement AI-powered matching and pricing
4. **Production Deployment**: Deploy with monitoring and scaling setup

For detailed API documentation, visit: `http://localhost:3001/docs` when the server is running.