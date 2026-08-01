const mongoose = require('mongoose');

const unknownQueueSchema = new mongoose.Schema(
  {
    familyCode: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    photoThumbnail: {
      type: String,
      required: true
    },
    embedding: {
      type: [Number],
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING_REVIEW', 'APPROVED', 'DISMISSED'],
      default: 'PENDING_REVIEW'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('UnknownQueue', unknownQueueSchema);
