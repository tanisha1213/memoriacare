const mongoose = require('mongoose');

const RoutineSchema = new mongoose.Schema({
  familyCode: {
    type: String,
    required: true,
    index: true
  },
  activityName: {
    type: String,
    required: true
  },
  time: {
    type: String, // 24-hour format "HH:MM" (e.g. "09:00", "13:30", "20:00")
    required: true
  },
  reminderMessage: {
    type: String,
    required: true
  },
  repeatFrequency: {
    type: String,
    enum: ['EVERY_DAY', 'WEEKDAYS', 'WEEKENDS', 'SELECTED_DAYS'],
    default: 'EVERY_DAY'
  },
  daysOfWeek: {
    type: [String], // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  },
  priority: {
    type: String,
    enum: ['NORMAL', 'IMPORTANT', 'URGENT'],
    default: 'NORMAL'
  },
  voiceReminder: {
    type: Boolean,
    default: true
  },
  notifyCaregiver: {
    type: Boolean,
    default: true
  },
  unackTimeoutMinutes: {
    type: Number,
    default: 5
  },
  isPaused: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Routine', RoutineSchema);
