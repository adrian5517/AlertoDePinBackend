import User from '../models/User.js';
import Alert from '../models/Alert.js';
import bcrypt from 'bcryptjs';

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { name, contactNumber, address, emergencyContacts } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (name) user.name = name;
    if (contactNumber) user.contactNumber = contactNumber;
    if (address) user.address = address;
    if (emergencyContacts) user.emergencyContacts = emergencyContacts;

    await user.save();

    const updatedUser = await User.findById(req.user.id).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword , newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current and new password' });
    } 
    if  (newPassword.length < 6 ){
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    //Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
// @desc    Update user location
// @route   PUT /api/users/location
// @access  Private
export const updateLocation = async (req, res) => {
  try {
    const { coordinates } = req.body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ message: 'Please provide valid coordinates [longitude, latitude]' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.location.coordinates = coordinates;
    user.lastActive = Date.now();
    await user.save();

    res.json({
      message: 'Location updated successfully',
      location: user.location,
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const { userType, status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (userType) query.userType = userType;
    if (status) query.status = status;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user by ID (Admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user status (Admin only)
// @route   PUT /api/users/:id/status
// @access  Private/Admin
export const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User status updated successfully',
      user,
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/users/stats
// @access  Private
export const getStats = async (req, res) => {
  try {
    const stats = {};

    if (req.user.userType === 'admin') {
      // Admin gets overall statistics
      stats.totalUsers = await User.countDocuments();
      stats.activeAlerts = await Alert.countDocuments({ status: { $in: ['pending', 'active', 'responded'] } });
      stats.resolvedAlerts = await Alert.countDocuments({ status: 'resolved' });
      stats.usersByType = await User.aggregate([
        { $group: { _id: '$userType', count: { $sum: 1 } } }
      ]);
      stats.alertsByType = await Alert.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);
      stats.alertsByStatus = await Alert.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
    } else if (['police', 'hospital', 'fire'].includes(req.user.userType)) {
      // Responders get their statistics
      stats.assignedAlerts = await Alert.countDocuments({ 
        responder: req.user.id,
        status: { $in: ['responded', 'active'] }
      });
      stats.resolvedAlerts = await Alert.countDocuments({ 
        responder: req.user.id,
        status: 'resolved'
      });
      stats.pendingAlerts = await Alert.countDocuments({ 
        type: req.user.userType,
        status: 'pending'
      });
      
      // Average response time
      const responseStats = await Alert.aggregate([
        { $match: { responder: req.user.id, responseTime: { $exists: true } } },
        { $project: { 
          responseTime: { $subtract: ['$responseTime', '$createdAt'] }
        }},
        { $group: { 
          _id: null, 
          avgResponseTime: { $avg: '$responseTime' }
        }}
      ]);
      
      stats.avgResponseTime = responseStats[0]?.avgResponseTime || 0;
    } else {
      // Citizens/Family get their statistics
      const userId = req.user.id;
      console.log('Getting stats for citizen:', userId);
      
      stats.myAlerts = await Alert.countDocuments({ reporter: userId });
      stats.activeAlerts = await Alert.countDocuments({ 
        reporter: userId,
        status: { $in: ['pending', 'active', 'responded'] }
      });
      stats.resolvedAlerts = await Alert.countDocuments({ 
        reporter: userId,
        status: 'resolved'
      });
      
      console.log('Citizen stats:', stats);
    }

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow deleting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    await user.deleteOne();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
