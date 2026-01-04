import express from 'express';
import { authenticate, authorizeAdmin } from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  updateLocation,
  changePassword,
  getAllUsers,
  getUserById,
  updateUserStatus,
  getStats,
  deleteUser,
} from '../controllers/userController.js';

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authenticate, getProfile);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, updateProfile);

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authenticate, changePassword);

// @route   PUT /api/users/location
// @desc    Update user location
// @access  Private
router.put('/location', authenticate, updateLocation);

// @route   GET /api/users/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', authenticate, getStats);

// Admin routes
// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/', authenticate, authorizeAdmin, getAllUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID (Admin only)
// @access  Private/Admin
router.get('/:id', authenticate, authorizeAdmin, getUserById);

// @route   PUT /api/users/:id/status
// @desc    Update user status (Admin only)
// @access  Private/Admin
router.put('/:id/status', authenticate, authorizeAdmin, updateUserStatus);

// @route   DELETE /api/users/:id
// @desc    Delete user (Admin only)
// @access  Private/Admin
router.delete('/:id', authenticate, authorizeAdmin, deleteUser);

export default router;
