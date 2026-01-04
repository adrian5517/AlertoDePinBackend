import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  getAlerts,
  getAlertById,
  createAlert,
  updateAlert,
  respondToAlert,
  resolveAlert,
  cancelAlert,
  getNearbyAlerts,
  deleteAlert,
  createIoTAlert
} from '../controllers/alertController.js';

const router = express.Router();

// @route   GET /api/alerts
// @desc    Get all alerts with filters
// @access  Private
router.get('/', authenticate, getAlerts);

// @route   GET /api/alerts/nearby/:type
// @desc    Get nearby alerts by type
// @access  Private
router.get('/nearby/:type', authenticate, getNearbyAlerts);

// @route   GET /api/alerts/:id
// @desc    Get alert by ID
// @access  Private
router.get('/:id', authenticate, getAlertById);

// @route   POST /api/alerts
// @desc    Create new alert (web app, requires JWT)
// @access  Private
router.post('/', authenticate, createAlert);

// @route   POST /api/alerts/iot
// @desc    Create new alert (ESP32, no JWT)
// @access  Public
router.post('/iot', createIoTAlert);

// @route   PUT /api/alerts/:id
// @desc    Update alert
// @access  Private
router.put('/:id', authenticate, updateAlert);

// @route   PUT /api/alerts/:id/respond
// @desc    Respond to alert (Responders only)
// @access  Private
router.put(
  '/:id/respond',
  authenticate,
  authorizeRoles('police', 'hospital', 'fire', 'admin'),
  respondToAlert
);

// @route   PUT /api/alerts/:id/resolve
// @desc    Resolve alert
// @access  Private
router.put('/:id/resolve', authenticate, resolveAlert);

// @route   PUT /api/alerts/:id/cancel
// @desc    Cancel alert (Reporter only)
// @access  Private
router.put('/:id/cancel', authenticate, cancelAlert);

// @route   DELETE /api/alerts/:id
// @desc    Delete alert (Admin or Reporter only)
// @access  Private
router.delete('/:id', authenticate, deleteAlert);



export default router;
