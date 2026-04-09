Product Requirements Document (PRD)
Mobile Car Cleaning Marketplace Platform

Product Type: Two-Sided Marketplace Platform
Platform Components:
• Customer Mobile App (iOS & Android)
• Service Provider Mobile App (iOS & Android)
• Admin Web Dashboard

1. Product Overview
The platform is a two-sided marketplace for mobile car cleaning services, connecting customers who need car cleaning services with nearby service providers who can perform the service at the customer’s location.
Customers will be able to:
• discover nearby providers
• book services
• track service progress
• pay securely within the app
Service providers will be able to:
• manage bookings
• update job status
• navigate to customers
• track their earnings
Administrators will be able to:
• manage users and providers
• monitor bookings
• configure commissions
• track revenue and platform activity

2. Product Goals
The platform aims to:
• simplify booking car cleaning services
• enable providers to receive and manage jobs easily
• ensure secure and reliable payments
• provide real-time service visibility to customers
• create a scalable system for future expansion

3. Platform Architecture
The system will consist of three main components:
Component
Description
Customer App
Mobile app for customers to discover providers and book services
Provider App
Mobile app for service providers to manage jobs
Admin Panel
Web dashboard for managing the platform


4. Customer Mobile Application
4.1 User Accounts
Customers must be able to create and manage accounts.
Features:
• Sign up using email or phone
• Social login via Google or Apple
• Login and logout
• Profile management
Customer profile includes:
• name
• phone number
• email
• saved locations

4.2 Favorites
Customers can save preferred providers.
Features:
• Save provider to favorites
• View list of favorite providers
• Remove providers from favorites

4.3 Booking History
Customers can view previous bookings.
Information shown:
• provider name
• service type
• booking date
• booking status
• payment information

5. Service Discovery
Customers must be able to find service providers nearby.
Features:
• map view showing nearby providers
• search providers
• filter providers
Filters may include:
• service type
• rating
• availability
Provider profiles include:
• provider name
• profile photos
• service descriptions
• ratings and reviews

6. Booking System
Customers must be able to create bookings.
Booking flow:
Select provider
Select service type
Select location
View estimated price
Schedule service or request immediate service
Confirm booking
Booking statuses:
• requested
• accepted
• on the way
• service started
• service completed

7. Live Service Tracking
Customers can track service progress.
Features:
• see provider location on map
• receive status updates
Status updates include:
• provider accepted booking
• provider on the way
• service started
• service completed

8. Payments
All payments will be processed within the app.
Features:
• secure payment processing
• customer pays through mobile app
• platform automatically deducts commission
• payment confirmation
Stripe or equivalent payment provider will be used.

9. Ratings and Reviews
Customers can rate providers after service completion.
Features:
• star rating system
• written review
• provider rating display

10. Notifications
Users will receive push notifications.
Events include:
• new booking request
• booking accepted
• provider on the way
• service started
• service completed

11. Service Provider Mobile Application
11.1 Provider Registration
Providers must create an account.
Registration includes:
• account creation
• provider profile setup
• upload ID verification documents
• upload service photos
Providers require admin approval before activation.

12. Provider Dashboard
Providers will have a dashboard displaying:
• upcoming bookings
• booking details
• earnings summary
Providers can:
• accept or reject bookings
• view booking schedule

13. Availability Management
Providers can control availability.
Features:
• online / offline toggle
• receive bookings only when online

14. Navigation
Providers can navigate to customer location.
Features:
• view customer location
• open GPS navigation (Google Maps / Apple Maps)

15. Earnings
Providers can track income.
Features:
• earnings summary
• payout history

16. Provider Ratings
Providers can view feedback from customers.
Features:
• rating score
• review list

17. Admin Web Dashboard
17.1 Admin Authentication
Admins must log in securely.
Features:
• secure admin login
• access control

18. User Management
Admins can manage users.
Features:
• view customers
• view service providers
• suspend or block accounts

19. Provider Approval
Admins must approve providers.
Features:
• review applications
• approve or reject provider registration

20. Booking Management
Admins can manage bookings.
Features:
• view all bookings
• filter bookings by status
• view booking details

21. Payments & Commission
Admins can manage platform revenue.
Features:
• set commission percentage
• track platform transactions
• view provider payouts

22. Reporting
Admin dashboard will provide analytics.
Reports include:
• daily bookings
• weekly bookings
• monthly bookings
• revenue reports

23. Messaging
The platform will include a messaging system.
Features:
• chat between customer and provider
• real-time messaging
• message notifications

24. Real-Time System
The system will support real-time updates.
Features:
• live booking status updates
• push notifications

25. Security
Security measures include:
• user verification
• secure payment processing
• encrypted communication

26. Technical Architecture
Backend
Node.js / NestJS backend architecture.
Features:
• REST API
• scalable service architecture

Database
PostgreSQL relational database.
Used for:
• users
• bookings
• payments
• reviews

Infrastructure
Cloud infrastructure such as AWS.
Components include:
• API servers
• database hosting
• file storage

Maps Integration
Google Maps API used for:
• location detection
• provider discovery
• service tracking

Payments
Stripe Connect used for:
• payment processing
• commission deduction
• provider payouts

27. Deliverables
The development project will deliver:
• Customer mobile app (iOS & Android)
• Service provider mobile app (iOS & Android)
• Admin web dashboard
• Backend API
• Cloud deployment
• App Store & Play Store ready builds
• Basic technical documentation












Feature Coverage Table
Combined Scope (Original + Additional Features)
Category
Feature
User Accounts
Email signup/login


Phone signup/login


Google login


Apple login


Profile management


User verification
Customer Features
Save favorite providers


Booking history
Service Discovery
View provider profiles


Provider photos


Ratings display


Map view of providers


Search providers


Filter providers
Booking System
Create booking request


Accept / reject booking


Select service type


Choose location


Estimated price


Schedule booking


Instant booking
Booking Status Flow
Requested


Accepted


On the way


Service started


Service completed
Live Tracking
Provider location tracking


Live service updates
Payments
Stripe payment processing


Platform commission deduction


Secure in-app payment
Ratings & Reviews
Rate provider


Leave review
Notifications
Booking notifications


Push notifications


Status update notifications
Provider Features
Provider signup


Provider profile setup


Upload service photos


Upload ID verification


Admin approval workflow
Provider Dashboard
Accept / reject bookings


View upcoming bookings


Earnings summary
Availability
Online/offline toggle
Navigation
View customer location


GPS navigation integration
Provider Payments
Earnings tracking


Payout history
Provider Ratings
View ratings


View customer feedback
Admin Panel
Secure admin login


View customers


View providers


Approve/reject providers


Suspend/block accounts
Booking Management
View bookings


Filter bookings


View booking details
Payments & Commission
Set commission %


Track transactions


Provider payout tracking
Reports
Booking reports


Revenue reports
Messaging
In-app chat between users
Real-Time System
Live booking updates


Push notifications system
Technical Stack
Node.js / NestJS backend


PostgreSQL database


Cloud hosting (AWS)


Google Maps integration


Stripe Connect
Deliverables
Customer mobile app


Provider mobile app


Admin dashboard


Backend API


Cloud deployment


App Store / Play Store builds


Basic documentation


