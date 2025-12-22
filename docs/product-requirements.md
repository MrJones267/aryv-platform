# Product Requirement Document: "Hitch" - An Integrated Mobility Platform with Automated Agreements

**Author:** Oabona Majoko, WiredGenix Pty Ltd  
**Date:** July 20, 2025  
**Version:** 5.0

## 1. Introduction

"Hitch" is a comprehensive mobile application poised to redefine urban and intercity mobility by creating a single, intelligent platform for a multitude of transportation needs. This document outlines the requirements for a full-stack application that integrates private carpooling, public transportation, and a secure Courier Service.

This version (5.0) specifies that the delivery service will be implemented using a Server-Controlled Automated Agreement model. This backend-driven approach emulates the deterministic and automated properties of a smart contract within a centralized, secure, and scalable architecture, foregoing the use of blockchain technology. The core of this system is a state machine managed by our backend, providing a reliable and cost-effective mechanism for automated escrow, delivery verification, and payment release.

This platform will be guided by an advanced AI matching engine and AI-powered dynamic pricing. A unified gamification and loyalty program will further drive user engagement across all services.

## 2. Vision and Opportunity

Our vision is to build the definitive platform for integrated, on-demand mobility and logistics. We aim to create a self-sustaining ecosystem where commuters, travelers, public transport operators, and individuals needing to send packages can connect and transact with ease and confidence. The core opportunity lies in providing a trustworthy, efficient, and unified platform that optimizes existing vehicle capacity, reduces travel costs, and contributes to a more sustainable transportation network.

## 3. User Personas

The primary target users for the "Hitch" platform:

### The Driver: "Commuter Chloe"
- Regular commuter looking to offset travel costs
- Values safety, reliability, and ease of use
- Wants to maximize route efficiency

### The Passenger: "Student Sam"
- Cost-conscious traveler seeking affordable transport
- Values convenience and real-time information
- Comfortable with app-based services

### The Public Transport Operator: "Bus Operator Bob"
- Seeks to modernize services and increase ridership
- Needs tools for route management and passenger communication
- Focused on operational efficiency

### The Sender/Recipient: "Artisan Alice"
- Small business owner needing flexible delivery options
- Values transparency and security in package handling
- Requires cost-effective logistics solutions

## 4. Functional Requirements (Mobile & Web App)

### 4.1. User Onboarding & Profile Management

| Feature | Description | Priority |
|---------|-------------|----------|
| Registration | Phone/email registration with OTP verification | High |
| Profile Setup | Complete profile with photo, preferences, and verification documents | High |
| Vehicle Management | Add/edit vehicle details for drivers | High |
| Identity Verification | Document upload and verification process | High |

### 4.2. Passenger Experience

| Feature | Description | Priority |
|---------|-------------|----------|
| Route Search | Find available rides by origin, destination, and time | High |
| Ride Booking | Reserve seats with instant confirmation | High |
| Real-time Updates | Live tracking and ETA updates | High |
| Payment Integration | Seamless in-app payments | High |

### 4.3. Driver Experience

| Feature | Description | Priority |
|---------|-------------|----------|
| Route Publishing | Create and publish available routes | High |
| Passenger Management | Accept/decline booking requests | High |
| Earnings Dashboard | Track income and trip history | High |
| Navigation Integration | GPS guidance for optimal routes | Medium |

### 4.4. In-Trip Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Real-time Tracking | GPS tracking for all parties | High |
| In-app Chat | Secure messaging between users | High |
| Emergency Features | Panic button and emergency contacts | High |
| Trip Status Updates | Automated status notifications | High |

### 4.5. Payments, Cancellations & Ratings

| Feature | Description | Priority |
|---------|-------------|----------|
| Digital Wallet | In-app wallet with multiple payment methods | High |
| Automated Payments | Seamless transaction processing | High |
| Cancellation Policies | Clear policies with appropriate charges | High |
| Rating System | Two-way rating system for trust building | High |

### 4.6. Public Transport Integration

| Feature | Description | Priority |
|---------|-------------|----------|
| Route Publication | Tools for operators to publish routes, schedules, and pricing | High |
| Real-Time Bus Tracking | GPS integration for live bus tracking | High |
| Digital Ticketing | In-app booking and payment for bus tickets | Medium |

### 4.7. Courier Services

This section details the full lifecycle and logic for the in-app package delivery service. This service operates on a Server-Controlled Automated Agreement model, where the "Hitch" backend acts as a trusted, centralized intermediary to manage escrow, state transitions, and automated payouts.

#### Core Principles:

- **Sender-Led Pricing:** The sender initiates the process by defining the maximum amount they are willing to pay for a delivery.
- **System-Guided Estimation:** To assist the sender, the app provides a non-binding price estimate based on distance and package size.
- **Centralized Trust:** All funds are held in an in-app escrow system, and all state transitions are governed by secure, server-side logic.
- **Immutable History:** Every significant action is logged, creating a transparent and verifiable history for each delivery.

#### Functional Requirements Breakdown:

| Feature | Description | Priority |
|---------|-------------|----------|
| **1. Package Listing & Price Offer** | As a Sender: I can create a new delivery request by providing package details:<br>- Dimensions & Weight: Predefined categories or custom input<br>- Photos: Option to upload multiple images of the package<br>- Pickup & Drop-off Locations: Using map pinning or address search<br>- Handling Instructions: Free-text field for notes like "Fragile"<br>- Price Offer: The sender must enter the maximum amount they are willing to pay | High |
| **2. Price Estimation Guide** | As a Sender: While entering my Price Offer, the app displays a "Suggested Price" estimate. This calculation is a guide based on:<br>- Base Fare: A system-defined flat fee<br>- Distance Fee: A calculated charge per kilometer/mile<br>- Size/Weight Surcharge: An additional fee for larger packages | High |
| **3. Courier Discovery & Acceptance** | As a Driver (Courier): I can see available packages along my planned route, each showing the sender's Price Offer.<br>- One-Tap Acceptance: I can accept a delivery request, which signifies agreement to the offered price<br>- No Bidding: The system does not support counter-offers to maintain simplicity | High |
| **4. Automated Agreement & Escrow** | System Action (Backend): The moment a courier accepts a delivery request:<br>1. A new DeliveryAgreement record is created in the database with a PENDING_PICKUP status<br>2. The sender's payment method is immediately charged for the offered amount<br>3. These funds are transferred into a dedicated in-app escrow account<br>4. Both parties are notified, and a dedicated chat channel is opened | High |
| **5. In-Transit State Management** | As a Courier: After physically picking up the package, I must tap "Confirm Pickup".<br>- System Action: This transitions the DeliveryAgreement status to IN_TRANSIT<br>- Real-Time Tracking: The sender can now track the courier's real-time location | High |
| **6. Verifiable Proof of Delivery** | As a Courier: Upon arrival, I present a dynamic QR code on my app screen to the recipient.<br>- As a Recipient: The recipient scans this QR code<br>- System Action: The backend verifies the QR code's authenticity, which serves as irrefutable proof of delivery | High |
| **7. Automated Payment Release** | System Action (Backend): Immediately upon successful QR scan verification:<br>1. The DeliveryAgreement status is transitioned to COMPLETED<br>2. A command is sent to the payment provider to release the escrowed funds to the courier<br>3. Both parties receive a "Delivery Complete" notification | High |
| **8. Immutable Event Logging** | System Action (Backend): Every single state transition and key action is automatically recorded in the DeliveryAgreement's event_log field. This log is the source of truth for all disputes | High |
| **9. Dispute & Resolution Flow** | As a Sender: I can tap a "Raise Dispute" button if there is an issue.<br>- System Action: This transitions the agreement status to DISPUTED. The automated payout is permanently halted, and the case is flagged in the Admin Dispute Resolution Queue for manual review | High |

### 4.8. Intelligence Layer (AI & Gamification)

| Feature | Description | Priority |
|---------|-------------|----------|
| AI-Powered Dynamic Pricing | AI dynamically adjusts prices for rides based on real-time supply and demand, with full transparency to the user | High |
| Gamification & Unified Loyalty | A unified rewards system with points, badges, and challenges for all platform activities | High |
| AI Matching & Recommendations | The core engine for multimodal route optimization and personalized suggestions | High |

## 5. Administrator (Web Panel) Requirements

| Feature | Description |
|---------|-------------|
| User & Ride Management | View, filter, and manage all users and rides |
| Financial Management | Define commission percentages and manage cancellation charges |
| Offer & Content Management | Create promotional offers and manage static app content |
| Dispute Resolution Queue | A dedicated dashboard to view all DISPUTED deliveries. Admins can review the event_log for each case and have the authority to manually resolve the dispute (e.g., release funds or issue a refund) |

## 6. User Journeys (Courier Service Examples)

### A. Successful Package Delivery & Payment Release (Happy Path):

```gherkin
Scenario: End-to-End Courier Service Success
    Given a verified sender and a verified driver are logged in
    When the sender lists a package and the driver accepts the delivery request
    Then the Hitch backend creates a Delivery Agreement and places the sender's payment into in-app escrow
    And when the driver picks up and delivers the package, and the recipient confirms receipt via QR code scan
    Then the backend logic verifies the confirmation and automatically triggers the payment release to the driver's wallet
    And the package status updates to "Delivered" for all parties.
```

### B. Disputed Delivery (Edge Case):

```gherkin
Scenario: Recipient Disputes Package Delivery
    Given a driver has marked a package as "Delivered"
    When the sender raises a dispute for the package through the app
    Then the Hitch backend changes the Delivery Agreement status to "Disputed"
    And the automated payment release is paused
    And a notification is sent to the administrator's dispute resolution queue for manual intervention.
```

## 7. Non-Functional Requirements

| Requirement | Description |
|-------------|-------------|
| **Performance** | Highly responsive with minimal latency, especially in real-time tracking and state transitions |
| **Scalability** | Architecture must handle a large volume of concurrent users and active delivery agreements |
| **Security** | All user data and financial transactions must be encrypted. The backend logic governing the agreements must be secure and protected from unauthorized access |
| **Usability** | Intuitive UI for all user roles. Mobile app is Portrait Mode only |
| **Reliability** | High availability and data integrity are critical, especially for the escrow and payment release system. The database must be backed up regularly |

## 8. Technical Considerations

| Area | Consideration |
|------|---------------|
| **Mobile Application** | To be developed for both iOS and Android using a cross-platform (React Native, Flutter) or native (Swift/Kotlin) approach |
| **Backend Architecture** | A web-based backend (e.g., Node.js/Express.js) is required. A microservices architecture is recommended to decouple services like User Management, Ride Matching, and the Courier Service Agreement Engine |
| **Database** | A robust relational database (PostgreSQL) is essential. It must support JSONB data types for the event log and the PostGIS extension for geospatial queries |
| **Payment Gateway** | Integration with a payment provider that supports marketplace functionality and escrow (Stripe Connect, PayPal for Marketplaces) is required to handle holding and releasing funds |
| **Real-time Communication** | WebSockets (e.g., Socket.IO) will be used for real-time location tracking and chat functionality |
| **AI & Machine Learning** | A dedicated MLOps pipeline will be necessary to develop, train, and deploy the matching and dynamic pricing models |