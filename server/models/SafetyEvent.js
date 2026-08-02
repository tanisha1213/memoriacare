const mongoose = require('mongoose');

const SafetyEventSchema = new mongoose.Schema({
  familyCode: { type: String, required: true, index: true },
  eventType: {
    type: String,
    enum: ['SAFE_ZONE_EXIT', 'WANDERING', 'NIGHT_ACTIVITY', 'POSSIBLE_FALL', 'UNUSUAL_INACTIVITY'],
    required: true
  },
  alertLevel: {
    type: String,
    enum: ['Attention', 'Warning', 'Emergency'],
    required: true
  },
  locationZone: { type: String, default: 'Living Room' },
  description: { type: String, required: true },
  status: { type: String, enum: ['Alerted', 'Checked', 'Resolved'], default: 'Alerted' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.models.SafetyEvent || mongoose.model('SafetyEvent', SafetyEventSchema);
