const express = require('express');
const GameSession = require('../models/GameSession');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Save game session
router.post('/session', auth, async (req, res) => {
  try {
    const gameSession = new GameSession({
      ...req.body,
      user: req.userId
    });
    
    await gameSession.save();
    
    // Update user stats
    const user = await User.findById(req.userId);
    user.profile.totalSessions++;
    
    if (req.body.results.accuracy >= 0.8) {
      user.profile.masteredWords += req.body.results.wordsReviewed.filter(w => w.isCorrect).length;
    }
    
    await user.save();
    
    res.status(201).json(gameSession);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user statistics
router.get('/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const sessions = await GameSession.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Calculate additional stats
    const totalSessions = await GameSession.countDocuments({ user: req.userId });
    const avgAccuracy = await GameSession.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, avgAccuracy: { $avg: '$results.accuracy' } } }
    ]);
    
    res.json({
      profile: user.profile,
      totalSessions,
      averageAccuracy: avgAccuracy[0]?.avgAccuracy || 0,
      recentSessions: sessions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get words due for review
router.get('/review', auth, async (req, res) => {
  try {
    const WordList = require('../models/WordList');
    const wordLists = await WordList.find({ author: req.userId });
    
    const wordsForReview = [];
    wordLists.forEach(list => {
      list.words.forEach(word => {
        if (word.userProgress.nextReview <= new Date()) {
          wordsForReview.push({
            ...word.toObject(),
            listId: list._id,
            listTitle: list.title
          });
        }
      });
    });
    
    res.json(wordsForReview);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;