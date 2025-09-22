const mongoose = require('mongoose');

const codeFileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  filename: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  code: {
    type: String,
    required: true,
    maxlength: 100000 // 100KB limit
  },
  language: {
    type: String,
    required: true,
    enum: ['javascript', 'python', 'java', 'cpp', 'c', 'php']
  }
}, {
  timestamps: true
});

// Compound index for user-specific file queries
codeFileSchema.index({ userId: 1, filename: 1 }, { unique: true });
codeFileSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('CodeFile', codeFileSchema);