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
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
