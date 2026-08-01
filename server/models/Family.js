const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
  familyCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  familyName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Family', familySchema);
