// File: /api/save-data.js
const express = require('express');
const { MongoClient } = require('mongodb');

const router = express.Router();

// Sử dụng connection string từ môi trường hoặc mặc định
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/korean_vocab_app';

router.post('/save-data', async (req, res) => {
  console.log('📤 POST /api/save-data - Request received:', req.body);
  
  let client;
  try {
    const { type, data, userId = 'default_user' } = req.body;
    
    if (!type || !data) {
      console.error('❌ Missing required fields: type or data');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing type or data in request body' 
      });
    }

    console.log(`💾 Saving data type: ${type}, userId: ${userId}`);
    
    // Kết nối MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ MongoDB connected for save operation');

    const db = client.db('korean_vocab_app');
    const collection = db.collection('user_data');

    // Upsert: update nếu có, insert nếu chưa có
    const result = await collection.replaceOne(
      { type, userId },
      { 
        type, 
        data, 
        userId,
        updatedAt: new Date(),
        createdAt: new Date() // Sẽ không overwrite nếu đã có
      },
      { upsert: true }
    );

    console.log('✅ MongoDB save result:', {
      acknowledged: result.acknowledged,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount
    });

    res.status(200).json({ 
      success: true, 
      message: `Data type '${type}' saved successfully`,
      result: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      }
    });

  } catch (error) {
    console.error('❌ Error saving to MongoDB:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save data to MongoDB',
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
});

module.exports = router;