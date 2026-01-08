import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import routes
import authRoutes from './routes/auth.js';
import alertRoutes from './routes/alerts.js';
import userRoutes from './routes/users.js';
import notificationRoutes from './routes/notifications.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const httpServer = createServer(app);

// Socket.IO setup
// Allow multiple origins via FRONTEND_URL env (comma-separated), fallback to localhost
const rawFrontend = process.env.FRONTEND_URL || 'http://localhost:5173';
// normalize: split, trim, remove trailing slashes, and filter empties
const allowedOrigins = rawFrontend
  .split(',')
  .map(s => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const socketCorsOrigin = allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins;

// Helpful startup log for debugging CORS origins
console.log('FRONTEND_URL (raw):', rawFrontend);
console.log('Allowed CORS origins:', allowedOrigins);

const io = new Server(httpServer, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
// CORS: allow requests only from configured FRONTEND_URL(s)
const corsOptions = {
  origin: (origin, callback) => {
    // allow non-browser or same-origin requests (e.g., server-to-server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: Origin not allowed'), false);
  },
  credentials: true
};

app.use((req, res, next) => {
  // use CORS middleware with dynamic origin check
  cors(corsOptions)(req, res, (err) => {
    if (err) {
      // respond with standard CORS failure status for preflight
      res.status(403).json({ message: 'CORS Error: Origin not allowed' });
      return;
    }
    next();
  });
});

// JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Friendly handler for malformed JSON payloads produced by body-parser
app.use((err, req, res, next) => {
  if (err && err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.warn('Invalid JSON received:', err.message);
    return res.status(400).json({ message: 'Invalid JSON payload', error: err.message });
  }
  next(err);
});

// Track online users
const onlineUsers = new Map(); // userId -> { socketId, location, userType, name, lastUpdate }

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // User goes online
  socket.on('user-online', (userData) => {
    const { userId, location, userType, name } = userData;
    onlineUsers.set(userId, {
      socketId: socket.id,
      location,
      userType,
      name,
      lastUpdate: new Date()
    });
    console.log(`User ${name} (${userType}) is now online at`, location);
    
    // Broadcast updated online users to all clients
    io.emit('online-users-update', Array.from(onlineUsers.entries()).map(([id, data]) => ({
      userId: id,
      location: data.location,
      userType: data.userType,
      name: data.name,
      lastUpdate: data.lastUpdate
    })));
  });

  // User updates location
  socket.on('update-location', (data) => {
    const { userId, location } = data;
    const user = onlineUsers.get(userId);
    if (user) {
      user.location = location;
      user.lastUpdate = new Date();
      onlineUsers.set(userId, user);
      
      // Broadcast updated location to all clients
      io.emit('user-location-update', {
        userId,
        location,
        userType: user.userType,
        name: user.name
      });
    }
  });

  socket.on('join-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove user from online users
    let disconnectedUserId = null;
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userData.socketId === socket.id) {
        disconnectedUserId = userId;
        onlineUsers.delete(userId);
        break;
      }
    }
    
    if (disconnectedUserId) {
      console.log(`User ${disconnectedUserId} went offline`);
      // Broadcast updated online users
      io.emit('online-users-update', Array.from(onlineUsers.entries()).map(([id, data]) => ({
        userId: id,
        location: data.location,
        userType: data.userType,
        name: data.name,
        lastUpdate: data.lastUpdate
      })));
    }
  });
});

// Make io and onlineUsers accessible to routes
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alerto-de-pin')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Debug endpoints (temporary)
app.get('/api/debug/origins', (req, res) => {
  res.json({ rawFrontend, allowedOrigins });
});

// Emit a test alert event to all connected clients. POST body may include `alert` object.
app.post('/api/debug/emit-test', (req, res) => {
  const ioInstance = req.app.get('io');
  const payload = req.body && Object.keys(req.body).length ? req.body : {
    id: `test-${Date.now()}`,
    title: 'Test Alert',
    message: 'This is a test alert emitted from /api/debug/emit-test',
    location: { type: 'Point', coordinates: [121.0, 14.6] },
    createdAt: new Date()
  };

  try {
    ioInstance.emit('new-alert', payload);
    return res.json({ ok: true, emitted: payload });
  } catch (err) {
    console.error('Emit test failed', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'ALERTO DE PIN API is running',
    timestamp: new Date().toISOString()
  });
});

// Get online users endpoint
app.get('/api/online-users', (req, res) => {
  const onlineUsers = req.app.get('onlineUsers');
  const users = Array.from(onlineUsers.entries()).map(([id, data]) => ({
    userId: id,
    location: data.location,
    userType: data.userType,
    name: data.name,
    lastUpdate: data.lastUpdate
  }));
  res.json({ users, count: users.length });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready`);
});

export default app;
