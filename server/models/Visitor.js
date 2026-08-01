const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema(
  {
    familyCode: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    relationship: {
      type: String,
      required: true,
      trim: true
    },
    contextNote: {
      type: String,
      default: '',
      trim: true
    },
    embedding: {
      type: [Number],
      required: true
    },
    photoThumbnail: {
      type: String,
      default: ''
    },
    isRegistered: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Visitor', visitorSchema);
