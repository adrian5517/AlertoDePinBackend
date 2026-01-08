import Alert from '../models/Alert.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import fetch from 'node-fetch';


const reverseGeocode = async (lat, lng) => {
  try {
    const key = process.env.LOCATIONIQ_KEY;
    console.log('LocationIQ key prefix:', (key || 'NONE').slice(0, 10));

    if (!key) {
      console.error('LOCATIONIQ_KEY missing from environment');
      return null;
    }

    const url = `https://us1.locationiq.com/v1/reverse?key=${key}&lat=${lat}&lon=${lng}&format=json`;
    console.log('Reverse geocode URL:', url);

    const res = await fetch(url);

    if (!res.ok) {
      console.error('Reverse geocode HTTP error:', res.status);
      const bodyText = await res.text();
      console.error('Reverse geocode response body:', bodyText); // <-- mahalaga 'to
      return null;
    }

    const data = await res.json();

    if (data && data.display_name) {
      return data.display_name;
    }

    return null;
  } catch (err) {
    console.error('LocationIQ reverse geocode error:', err);
    return null;
  }
};


// @desc    Get all alerts with filters
// @route   GET /api/alerts
// @access  Private
export const getAlerts = async (req, res) => {
  try {
    const { status, type, priority, page = 1, limit = 100 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (priority) query.priority = priority;

    // If user is not admin, show only relevant alertss
    if (req.user.userType !== 'admin') {
      if (req.user.userType === 'citizen' || req.user.userType === 'family') {
        // Citizens and family see their own alerts AND alerts from users who listed them as family members
        try {
          const reporters = await User.find({ familyMembers: req.user.id }).select('_id').lean();
          const reporterIds = reporters.map(r => r._id.toString());
          // include self
          reporterIds.unshift(req.user.id);
          query.reporter = { $in: reporterIds };
        } catch (e) {
          console.error('Error expanding family reporter list:', e);
          // fallback to only own alerts
          query.reporter = req.user.id;
        }
      } else if (req.user.userType === 'police' || req.user.userType === 'hospital' || req.user.userType === 'fire') {
        // Responders see alerts they can respond to OR alerts they're assigned to
        query.$or = [
          { type: req.user.userType },
          { responder: req.user.id },
        ];
      }
    }

    const alerts = await Alert.find(query)
      .populate('reporter', 'name email contactNumber userType')
      .populate('responder', 'name email contactNumber userType')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Alert.countDocuments(query);

    res.json({
      alerts,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single alert by ID
// @route   GET /api/alerts/:id
// @access  Private
export const getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('reporter', 'name email contactNumber userType location')
      .populate('responder', 'name email contactNumber userType')
      .populate('timeline.user', 'name userType');

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    console.error('Get alert by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getIoTReporterUser = async () => {
  const IOT_REPORTER_NAME = 'AlertoDePin Device';
  const IOT_REPORTER_EMAIL = 'device@alertodepin.local';

  let user = await User.findOne({ email: IOT_REPORTER_EMAIL });

  if (!user) {
    user = await User.create({
      name: IOT_REPORTER_NAME,
      email: IOT_REPORTER_EMAIL,
      password: 'ChangeMe123!',   // di naman gagamitin mag-login
      userType: 'citizen',
      status: 'active',
    });
  }

  return user;
};

// @desc    Create new alert from IoT (ESP32)
// @route   POST /api/alerts/iot
// @access  Public
export const createIoTAlert = async (req, res) => {
  try {
    const { type, latitude, longitude } = req.body;

    if (!type || latitude == null || longitude == null) {
      return res.status(400).json({
        message: 'Fields required: type, latitude, longitude',
      });
    }

    const deviceUser = await getIoTReporterUser();

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    // 🔥 Try to get real address from lat/lon
    let addressText = await reverseGeocode(latNum, lngNum);
    // fallback kung mag-fail ang API
    if (!addressText) {
      addressText = `Lat: ${latNum.toFixed(5)}, Lon: ${lngNum.toFixed(5)} (IoT device)`;
    }

    const alert = await Alert.create({
      title: `IoT ${type} alert`,
      description: `Automatic alert from IoT device`,
      type,
      priority: 'critical',
      status: 'active',
      location: {
        address: addressText,   
        coordinates: {
          type: 'Point',
          coordinates: [lngNum, latNum], // [longitude, latitude]
        },
      },
      reporter: deviceUser._id,
      timeline: [{
        action: 'Alert created from IoT (auto-active)',
        user: deviceUser._id,
        timestamp: new Date(),
        notes: 'Initial status set to active from IoT device',
      }],
    });

    const populatedAlert = await Alert.findById(alert._id)
      .populate('reporter', 'name email userType');

    const io = req.app.get('io');
    if (io) {
      io.emit('new-alert', populatedAlert);
      console.log('Broadcasting new IOT alert:', populatedAlert._id);
    }

    res.status(201).json({
      message: 'IoT alert created successfully',
      alert: populatedAlert,
    });
  } catch (error) {
    console.error('Create IoT alert error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};


// @desc    Create new alert
// @route   POST /api/alerts
// @access  Private
export const createAlert = async (req, res) => {
  try {
    const { title, description, type, priority, location, notes, images } = req.body;

    const alert = await Alert.create({
      title,
      description,
      type,
      priority: priority || 'medium',
      location,
      reporter: req.user.id,
      notes,
      images,
      timeline: [{
        action: 'Alert created',
        user: req.user.id,
        timestamp: new Date(),
      }],
    });

    const populatedAlert = await Alert.findById(alert._id)
      .populate('reporter', 'name email contactNumber userType');

    // Find nearby responders - simplified version without geospatial query for now
    // TODO: Fix geospatial query once indexes are properly configured
    const nearbyResponders = await User.find({
      userType: type,
      status: 'active',
    }).limit(20);

    // Emit real-time notification to responders
    const io = req.app.get('io');
    if (io && nearbyResponders.length > 0) {
      nearbyResponders.forEach(responder => {
        io.to(responder._id.toString()).emit('newAlert', {
          alert: populatedAlert,
          message: `New ${type} alert in your area`,
        });

        // Create notification in database
        Notification.create({
          user: responder._id,
          alert: alert._id,
          type: 'alert',
          title: `New ${type} alert`,
          message: `New ${type} alert: ${title}`,
        }).catch(err => console.error('Error creating notification:', err));
      });
    }
    
    // Notify family members of the reporter (if any)
    try {
      const reporter = await User.findById(req.user.id).populate('familyMembers', 'name email');
      if (reporter && reporter.familyMembers && reporter.familyMembers.length > 0 && io) {
        for (const fam of reporter.familyMembers) {
          // Create notification record
          const notif = await Notification.create({
            user: fam._id,
            alert: alert._id,
            type: 'family_alert',
            title: `Family alert from ${reporter.name}`,
            message: `${reporter.name} sent an emergency alert: ${title}`,
          }).catch(err => { console.error('Error creating family notification', err); return null; });

          // Emit notification to family member socket room
          if (io && fam._id) {
            io.to(fam._id.toString()).emit('newNotification', notif);
            io.to(fam._id.toString()).emit('new-alert', populatedAlert);
          }
        }
      }
    } catch (famErr) {
      console.error('Error notifying family members:', famErr);
    }
    
    // Broadcast to all connected clients for live map updates
    if (io) {
      io.emit('new-alert', populatedAlert);
      console.log('Broadcasting new alert to all clients:', populatedAlert._id);
    }

    res.status(201).json({
      message: 'Alert created successfully',
      alert: populatedAlert,
      notifiedResponders: nearbyResponders.length,
    });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Update alert
// @route   PUT /api/alerts/:id
// @access  Private
export const updateAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Only reporter or assigned responder can update
    if (alert.reporter.toString() !== req.user.id && 
        (!alert.responder || alert.responder.toString() !== req.user.id) &&
        req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this alert' });
    }

    const updatedAlert = await Alert.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('reporter responder', 'name email contactNumber userType');

    // Notify reporter of updates via Socket.IO
    const io = req.app.get('io');
    if (io && updatedAlert.reporter) {
      io.to(updatedAlert.reporter._id.toString()).emit('alertUpdated', {
        alert: updatedAlert,
        message: req.body.notes || 'Alert status updated',
      });
    }

    res.json({
      message: 'Alert updated successfully',
      alert: updatedAlert,
    });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Respond to alert
// @route   PUT /api/alerts/:id/respond
// @access  Private (Responders only)
export const respondToAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (alert.status !== 'pending' && alert.status !== 'active') {
      return res.status(400).json({ message: 'Alert is not available for response' });
    }

    // Check if user type matches alert type
    if (req.user.userType !== alert.type && req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to respond to this alert type' });
    }

    alert.responder = req.user.id;
    alert.status = 'responded';
    alert.responseTime = Date.now();
    alert.timeline.push({
      action: 'Responder assigned and en route',
      user: req.user.id,
      timestamp: new Date(),
    });

    await alert.save();

    const populatedAlert = await Alert.findById(alert._id)
      .populate('reporter responder', 'name email contactNumber userType');

    // Notify reporter via Socket.IO
    const io = req.app.get('io');
    io.to(alert.reporter.toString()).emit('alertResponded', {
      alert: populatedAlert,
      message: 'A responder is on the way',
    });

    // Create notification for reporter
    const notification = await Notification.create({
      user: alert.reporter,
      alert: alert._id,
      type: 'alert_responded',
      title: 'Alert Responded',
      message: `Your alert has been responded to by ${req.user.name}`,
    });
    // Emit notification to reporter via Socket.IO
    if (io) {
      io.to(alert.reporter.toString()).emit('newNotification', notification);
    }

    res.json({
      message: 'Successfully responded to alert',
      alert: populatedAlert,
    });
  } catch (error) {
    console.error('Respond to alert error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Resolve alert
// @route   PUT /api/alerts/:id/resolve
// @access  Private
export const resolveAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Only responder or admin can resolve
    if ((!alert.responder || alert.responder.toString() !== req.user.id) && 
        req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to resolve this alert' });
    }

    alert.status = 'resolved';
    alert.resolvedTime = Date.now();
    alert.timeline.push({
      action: 'Alert resolved',
      user: req.user.id,
      timestamp: new Date(),
      notes: req.body.notes,
    });

    await alert.save();

    const populatedAlert = await Alert.findById(alert._id)
      .populate('reporter responder', 'name email contactNumber userType');

    // Notify reporter
    const io = req.app.get('io');
    if (io) {
      io.to(alert.reporter.toString()).emit('alertResolved', {
        alert: populatedAlert,
        message: 'Your alert has been resolved',
      });
      // Also emit generic alertUpdated event
      io.to(alert.reporter.toString()).emit('alertUpdated', {
        alert: populatedAlert,
        message: 'Your alert has been resolved',
      });
    }

    const notification = await Notification.create({
      user: alert.reporter,
      alert: alert._id,
      type: 'alert_resolved',
      title: 'Alert Resolved',
      message: 'Your alert has been resolved',
    });
    // Emit notification to reporter via Socket.IO
    if (io) {
      io.to(alert.reporter.toString()).emit('newNotification', notification);
    }

    res.json({
      message: 'Alert resolved successfully',
      alert: populatedAlert,
    });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Cancel alert
// @route   PUT /api/alerts/:id/cancel
// @access  Private (Reporter only)
export const cancelAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Only the reporter can cancel their own alert
    if (alert.reporter.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the reporter can cancel this alert' });
    }

    // Cannot cancel if someone has already responded
    if (alert.responder) {
      return res.status(400).json({ 
        message: 'Cannot cancel alert - a responder has already been assigned. Please contact them directly.' 
      });
    }

    // Can only cancel pending or active alerts without responder
    if (alert.status !== 'pending' && alert.status !== 'active') {
      return res.status(400).json({ 
        message: `Cannot cancel alert with status: ${alert.status}` 
      });
    }

    alert.status = 'cancelled';
    alert.timeline.push({
      action: 'Alert cancelled by reporter',
      user: req.user.id,
      timestamp: new Date(),
      notes: 'Reporter cancelled the alert before response',
    });

    await alert.save();

    const populatedAlert = await Alert.findById(alert._id)
      .populate('reporter responder', 'name email contactNumber userType');

    res.json({
      message: 'Alert cancelled successfully',
      alert: populatedAlert,
    });
  } catch (error) {
    console.error('Cancel alert error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get nearby alerts
// @route   GET /api/alerts/nearby/:type
// @access  Private
export const getNearbyAlerts = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    const { type } = req.params;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Please provide latitude and longitude' });
    }

    const alerts = await Alert.find({
      type,
      status: { $in: ['pending', 'active'] },
      'location.coordinates.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radius * 1000, // Convert km to meters
        },
      },
    })
      .populate('reporter', 'name email contactNumber')
      .limit(50);

    res.json({
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('Get nearby alerts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete alert
// @route   DELETE /api/alerts/:id
// @access  Private (Admin or Reporter only)
export const deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Only reporter or admin can delete
    if (alert.reporter.toString() !== req.user.id && req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this alert' });
    }

    await alert.deleteOne();

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

