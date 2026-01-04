import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Authenticate user
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended or inactive' });
    }

    req.user = {
      id: user._id.toString(),
      userType: user.userType,
      email: user.email,
      name: user.name
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    // Handle expired JWT specifically so clients can respond accordingly
    if (error && error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', expiredAt: error.expiredAt });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Authorize admin
export const authorizeAdmin = (req, res, next) => {
  if (req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Authorize specific user types
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.userType)) {
      return res.status(403).json({ 
        message: `Access denied. Required roles: ${roles.join(', ')}` 
      });
    }
    next();
  };
};
