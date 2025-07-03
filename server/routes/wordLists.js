const express = require('express');
const WordList = require('../models/WordList');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all word lists for user
router.get('/', auth, async (req, res) => {
  try {
    const wordLists = await WordList.find({ author: req.userId })
      .sort({ createdAt: -1 });
    res.json(wordLists);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get public word lists
router.get('/public', async (req, res) => {
  try {
    const wordLists = await WordList.find({ isPublic: true })
      .populate('author', 'username')
      .sort({ 'stats.totalStudents': -1 })
      .limit(20);
    res.json(wordLists);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new word list
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, words, category, isPublic, tags } = req.body;
    
    const wordList = new WordList({
      title,
      description,
      words: words.map(word => ({
        korean: word.korean || word.word,
        vietnamese: word.vietnamese || word.meaning,
        pronunciation: word.pronunciation,
        category: word.category,
        userProgress: {
          nextReview: new Date()
        }
      })),
      category,
      author: req.userId,
      isPublic: isPublic || false,
      tags: tags || []
    });

    await wordList.save();
    res.status(201).json(wordList);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update word list
router.put('/:id', auth, async (req, res) => {
  try {
    const wordList = await WordList.findOneAndUpdate(
      { _id: req.params.id, author: req.userId },
      req.body,
      { new: true }
    );
    
    if (!wordList) {
      return res.status(404).json({ message: 'Word list not found' });
    }
    
    res.json(wordList);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete word list
router.delete('/:id', auth, async (req, res) => {
  try {
    const wordList = await WordList.findOneAndDelete({
      _id: req.params.id,
      author: req.userId
    });
    
    if (!wordList) {
      return res.status(404).json({ message: 'Word list not found' });
    }
    
    res.json({ message: 'Word list deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update word progress
router.put('/:listId/words/:wordId/progress', auth, async (req, res) => {
  try {
    const { isCorrect, gameType } = req.body;
    
    const wordList = await WordList.findOne({
      _id: req.params.listId,
      author: req.userId
    });
    
    if (!wordList) {
      return res.status(404).json({ message: 'Word list not found' });
    }
    
    const word = wordList.words.id(req.params.wordId);
    if (!word) {
      return res.status(404).json({ message: 'Word not found' });
    }
    
    // Update progress
    if (isCorrect) {
      word.userProgress.correctCount++;
      word.userProgress.masteryLevel = Math.min(
        word.userProgress.masteryLevel + 0.2,
        5
      );
    } else {
      word.userProgress.incorrectCount++;
      word.userProgress.masteryLevel = Math.max(
        word.userProgress.masteryLevel - 0.1,
        0
      );
    }
    
    word.userProgress.lastReviewed = new Date();
    
    // Calculate next review date based on spaced repetition
    const intervals = [1, 3, 7, 14, 30]; // days
    const masteryLevel = Math.floor(word.userProgress.masteryLevel);
    const nextInterval = intervals[Math.min(masteryLevel, intervals.length - 1)];
    word.userProgress.nextReview = new Date(Date.now() + nextInterval * 24 * 60 * 60 * 1000);
    
    await wordList.save();
    res.json(word);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;