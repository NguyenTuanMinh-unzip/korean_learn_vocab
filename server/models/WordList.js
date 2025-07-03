const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
  korean: { type: String, required: true },
  vietnamese: { type: String, required: true },
  pronunciation: String,
  difficulty: { type: Number, default: 1, min: 1, max: 5 },
  category: String,
  examples: [{
    korean: String,
    vietnamese: String
  }],
  userProgress: {
    correctCount: { type: Number, default: 0 },
    incorrectCount: { type: Number, default: 0 },
    lastReviewed: Date,
    nextReview: Date,
    masteryLevel: { type: Number, default: 0, min: 0, max: 5 }
  }
});

const wordListSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: { type: String, default: '일반' },
  words: [wordSchema],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: { type: Boolean, default: false },
  tags: [String],
  difficulty: { type: String, default: 'mixed' },
  totalWords: { type: Number, default: 0 },
  stats: {
    totalStudents: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Update totalWords when words array changes
wordListSchema.pre('save', function(next) {
  this.totalWords = this.words.length;
  next();
});

module.exports = mongoose.model('WordList', wordListSchema);