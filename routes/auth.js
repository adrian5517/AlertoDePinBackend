import express from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { register, login, getCurrentUser } from '../controllers/authController.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('contactNumber').optional().trim(),
    body('userType').optional().isIn(['citizen', 'police', 'hospital', 'fire', 'family']),
  ],
  register
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', login);

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', authenticate, getCurrentUser);

export default router;
