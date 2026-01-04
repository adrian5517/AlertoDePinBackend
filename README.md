# ALERTO DE PIN - Backend API

## MVC Architecture

This backend follows the **Model-View-Controller (MVC)** design pattern for better code organization, maintainability, and scalability.

### Project Structure

```
backend/
├── controllers/          # Business logic layer
│   ├── authController.js       # Authentication logic
│   ├── alertController.js      # Alert management logic
│   ├── userController.js       # User management logic
│   └── notificationController.js # Notification logic
├── models/              # Data layer (MongoDB schemas)
│   ├── User.js                # User model
│   ├── Alert.js               # Alert model
│   └── Notification.js        # Notification model
├── routes/              # Routes layer (API endpoints)
│   ├── auth.js                # Authentication routes
│   ├── alerts.js              # Alert routes
│   ├── users.js               # User routes
│   └── notifications.js       # Notification routes
├── middleware/          # Middleware functions
│   └── auth.js                # JWT authentication & authorization
├── server.js            # Express server setup
├── seed.js              # Database seeder
├── .env                 # Environment variables
└── package.json         # Dependencies
```

## Architecture Layers

### 1. **Models** (Data Layer)
Location: `models/`

Defines the data structure and database schemas using Mongoose.

**Files:**
- `User.js` - User schema (citizen, police, hospital, fire, family, admin)
- `Alert.js` - Emergency alert schema with geospatial coordinates
- `Notification.js` - Notification schema

**Example:**
```javascript
// models/User.js
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  userType: { type: String, enum: ['citizen', 'police', 'hospital', 'fire', 'family', 'admin'] },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [123.1816, 13.6218] }
  }
});
```

### 2. **Controllers** (Business Logic Layer)
Location: `controllers/`

Contains all business logic and data processing. Interacts with models to perform CRUD operations.

**Files:**
- `authController.js` - Login, register, get current user
- `alertController.js` - Create, update, respond, resolve alerts
- `userController.js` - Profile management, location updates, statistics
- `notificationController.js` - Notification management

**Example:**
```javascript
// controllers/authController.js
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    // ... business logic
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
```

### 3. **Routes** (API Layer)
Location: `routes/`

Defines API endpoints and connects them to controller functions. Handles middleware (authentication, validation).

**Files:**
- `auth.js` - `/api/auth/*` endpoints
- `alerts.js` - `/api/alerts/*` endpoints
- `users.js` - `/api/users/*` endpoints
- `notifications.js` - `/api/notifications/*` endpoints

**Example:**
```javascript
// routes/auth.js
import { login, register, getCurrentUser } from '../controllers/authController.js';

router.post('/login', login);
router.post('/register', register);
router.get('/me', authenticate, getCurrentUser);
```

### 4. **Middleware** (Security Layer)
Location: `middleware/`

Handles cross-cutting concerns like authentication and authorization.

**Files:**
- `auth.js` - JWT authentication, role-based authorization

**Functions:**
- `authenticate` - Verifies JWT token
- `authorizeAdmin` - Checks if user is admin
- `authorizeRoles(...roles)` - Checks if user has specific roles

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /me` - Get current user (Protected)

### Alerts (`/api/alerts`)
- `GET /` - Get all alerts (Protected)
- `GET /:id` - Get alert by ID (Protected)
- `GET /nearby/:type` - Get nearby alerts (Protected)
- `POST /` - Create new alert (Protected)
- `PUT /:id` - Update alert (Protected)
- `PUT /:id/respond` - Respond to alert (Responders only)
- `PUT /:id/resolve` - Resolve alert (Protected)
- `DELETE /:id` - Delete alert (Admin/Reporter only)

### Users (`/api/users`)
- `GET /profile` - Get user profile (Protected)
- `PUT /profile` - Update profile (Protected)
- `PUT /location` - Update location (Protected)
- `GET /stats` - Get dashboard statistics (Protected)
- `GET /` - Get all users (Admin only)
- `GET /:id` - Get user by ID (Admin only)
- `PUT /:id/status` - Update user status (Admin only)
- `DELETE /:id` - Delete user (Admin only)

### Notifications (`/api/notifications`)
- `GET /` - Get all notifications (Protected)
- `PUT /:id/read` - Mark as read (Protected)
- `PUT /read-all` - Mark all as read (Protected)
- `DELETE /:id` - Delete notification (Protected)
- `DELETE /clear-read` - Clear read notifications (Protected)

## Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=5000
MONGODB_URI=mongodb+srv://admin:password@cluster.mongodb.net/AlertoDePin
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Installation & Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your MongoDB connection string
```

### 3. Seed Database
```bash
npm run seed
# or
node seed.js
```

### 4. Start Server
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

Server will run on `http://localhost:5000`

## Test Accounts

After seeding, you can use these accounts:

| Email | Password | Role |
|-------|----------|------|
| police1@naga.gov.ph | password123 | Police |
| police2@naga.gov.ph | password123 | Police |
| bmc@hospital.ph | password123 | Hospital |
| ncgh@hospital.ph | password123 | Hospital |
| fire@naga.gov.ph | password123 | Fire |
| juan@email.com | password123 | Citizen |
| maria@email.com | password123 | Citizen |
| pedro@email.com | password123 | Family |
| admin@naga.gov.ph | password123 | Admin |

## Real-time Features (Socket.IO)

The backend uses Socket.IO for real-time notifications:

**Events:**
- `newAlert` - Emitted when a new alert is created
- `alertResponded` - Emitted when a responder accepts an alert
- `alertResolved` - Emitted when an alert is resolved

**Connection:**
```javascript
// Client connects with user ID
socket.emit('join', userId);
```

## Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Role-based access control (RBAC)
- Protected routes with middleware
- CORS configuration
- Input validation with express-validator

## Database Schema

### User Schema
- Geospatial location support (2dsphere index)
- Emergency contacts
- User types: citizen, police, hospital, fire, family, admin
- Status: active, inactive, suspended

### Alert Schema
- Geospatial coordinates (2dsphere index)
- Timeline tracking with status changes
- Priority levels: low, medium, high, critical
- Status: pending, active, responded, resolved, cancelled
- Reporter and responder references

### Notification Schema
- User reference
- Alert reference
- Read/unread status
- Type-based notifications

## Benefits of MVC Architecture

✅ **Separation of Concerns** - Each layer has a specific responsibility
✅ **Maintainability** - Easy to locate and fix bugs
✅ **Scalability** - Easy to add new features
✅ **Testability** - Controllers can be tested independently
✅ **Reusability** - Business logic can be reused across different routes
✅ **Clean Code** - Routes are concise and readable

## Adding New Features

### Example: Adding a new endpoint

1. **Create Controller Function** (`controllers/userController.js`):
```javascript
export const getActiveSessions = async (req, res) => {
  try {
    const sessions = await User.find({ status: 'active' });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
```

2. **Add Route** (`routes/users.js`):
```javascript
import { getActiveSessions } from '../controllers/userController.js';
router.get('/sessions', authenticate, getActiveSessions);
```

3. **Done!** The new endpoint is ready: `GET /api/users/sessions`

## Technologies Used

- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Socket.IO** - Real-time communication
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variables

## License

This project is part of the ALERTO DE PIN emergency response system.
