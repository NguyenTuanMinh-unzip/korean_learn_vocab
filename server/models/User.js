const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profile: {
    displayName: String,
    avatar: String,
    level: { type: String, default: '초급자' }, // 초급자, 중급자, 고급자
    studyStreak: { type: Number, default: 0 },
    totalWordsLearned: { type: Number, default: 0 },
    masteredWords: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 }
  },
  preferences: {
    studyReminder: { type: Boolean, default: true },
    voiceEnabled: { type: Boolean, default: true },
    difficulty: { type: String, default: 'mixed' } // easy, medium, hard, mixed
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
