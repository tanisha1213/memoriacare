const mongoose = require('mongoose');

const RoutineSchema = new mongoose.Schema({
  familyCode: { type: String, required: true, index: true },
  activityName: { type: String, required: true },
  time: { type: String, required: true }, // Format "HH:MM" (e.g. "09:00", "14:30")
  reminderMessage: { type: String, default: '' },
  frequency: { type: String, default: 'EVERYDAY' }, // 'EVERYDAY', 'WEEKDAYS', 'WEEKENDS', 'SELECTED_DAYS'
  days: { type: [String], default: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
  priority: { type: String, default: 'NORMAL' }, // 'NORMAL', 'IMPORTANT', 'URGENT'
  voiceEnabled: { type: Boolean, default: true },
  caregiverNotify: { type: Boolean, default: true },
  timeoutMinutes: { type: Number, default: 5 },
  isActive: { type: Boolean, default: true },
  lastAcknowledgedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Routine', RoutineSchema);
