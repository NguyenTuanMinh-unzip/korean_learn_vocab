// File: /api/load-data.js
const express = require('express');
const { MongoClient } = require('mongodb');

const router = express.Router();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/korean_vocab_app';

router.get('/load-data', async (req, res) => {
  console.log('📥 GET /api/load-data - Request received:', req.query);
  
  let client;
  try {
    const { type, userId = 'default_user' } = req.query;
    
    if (!type) {
      console.error('❌ Missing required parameter: type');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing type parameter in query' 
      });
    }

    console.log(`📖 Loading data type: ${type}, userId: ${userId}`);
    
    // Kết nối MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ MongoDB connected for load operation');

    const db = client.db('korean_vocab_app');
    const collection = db.collection('user_data');

    const result = await collection.findOne({ type, userId });

    if (result) {
      console.log('✅ Data found in MongoDB:', {
        type: result.type,
        dataLength: Array.isArray(result.data) ? result.data.length : 'N/A',
        lastUpdated: result.updatedAt
      });

      res.status(200).json({ 
        success: true, 
        data: result.data,
        metadata: {
          type: result.type,
          lastUpdated: result.updatedAt,
          dataSize: JSON.stringify(result.data).length
        }
      });
    } else {
      console.log('⚠️ No data found in MongoDB for:', { type, userId });
      res.status(404).json({ 
        success: false, 
        message: `No data found for type '${type}' and userId '${userId}'`,
        data: null
      });
    }

  } catch (error) {
    console.error('❌ Error loading from MongoDB:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load data from MongoDB',
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