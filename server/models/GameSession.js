const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  wordList: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WordList',
    required: true
  },
  gameType: {
    type: String,
    required: true,
    enum: ['flashcard', 'quiz', 'fillblank', 'scramble', 'matching', 'sentence']
  },
  results: {
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    timeSpent: Number, // in seconds
    accuracy: Number,
    wordsReviewed: [{
      wordId: mongoose.Schema.Types.ObjectId,
      isCorrect: Boolean,
      timeSpent: Number
    }]
  },
  completed: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('GameSession', gameSessionSchema);