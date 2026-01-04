import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  title: {
    type: String,
    // required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    // required: [true, 'Description is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['police', 'hospital', 'fire', 'family'],
    // required: [true, 'Alert type is required']
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'responded', 'resolved', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  location: {
    address: {
      type: String,
      required: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    }
  },
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // required: true
  },
  responder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  notes: {
    type: String,
    trim: true
  },
  images: [{
    type: String // URLs to images
  }],
  responseTime: {
    type: Date
  },
  resolvedTime: {
    type: Date
  },
  timeline: [{
    action: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create geospatial index for location-based queries
alertSchema.index({ 'location.coordinates': '2dsphere' });

// Update the updatedAt timestamp before saving
alertSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;
