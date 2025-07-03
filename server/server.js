// File: server.js hoặc app.js (Backend)
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/korean_vocab_app';
let db;

// Kết nối MongoDB khi server start
MongoClient.connect(MONGODB_URI)
  .then(client => {
    console.log('🇰🇷 MongoDB Connected - Korean Vocab DB');
    db = client.db('korean_vocab_app');
  })
  .catch(error => {
    console.error('❌ MongoDB connection failed:', error);
  });

// ===== API ROUTES =====

// Health check
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check request received');
  res.json({
    status: 'OK',
    message: 'Korean Vocab API is running',
    timestamp: new Date().toISOString(),
    mongodb: db ? 'Connected' : 'Disconnected',
    geminiAPI: process.env.GEMINI_API_KEY ? 'Configured' : 'Not configured'
  });
});
// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../korean-vocab-app/build')));
     
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../korean-vocab-app/build', 'index.html'));
  });
}

// Save data to MongoDB
app.post('/api/save-data', async (req, res) => {
  console.log('📤 POST /api/save-data - Request received');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { type, data, userId = 'default_user' } = req.body;
    
    if (!type || !data) {
      console.error('❌ Missing required fields: type or data');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing type or data in request body' 
      });
    }

    if (!db) {
      console.error('❌ MongoDB not connected');
      return res.status(500).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }

    console.log(`💾 Saving data - Type: ${type}, UserId: ${userId}`);
    
    const collection = db.collection('user_data');

    // Upsert: update nếu có, insert nếu chưa có
    const result = await collection.replaceOne(
      { type, userId },
      { 
        type, 
        data, 
        userId,
        updatedAt: new Date(),
        createdAt: new Date()
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
  }
});

// Load data from MongoDB
app.get('/api/load-data', async (req, res) => {
  console.log('📥 GET /api/load-data - Request received');
  console.log('Query params:', req.query);
  
  try {
    const { type, userId = 'default_user' } = req.query;
    
    if (!type) {
      console.error('❌ Missing required parameter: type');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing type parameter in query' 
      });
    }

    if (!db) {
      console.error('❌ MongoDB not connected');
      return res.status(500).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }

    console.log(`📖 Loading data - Type: ${type}, UserId: ${userId}`);
    
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
  }
});

// Test MongoDB connection
app.get('/api/test-mongodb', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'MongoDB not connected' 
      });
    }

    // Test ping
    await db.admin().ping();
    
    // Count documents
    const collection = db.collection('user_data');
    const count = await collection.countDocuments();
    
    res.json({
      success: true,
      message: 'MongoDB connection test successful',
      database: 'korean_vocab_app',
      collection: 'user_data',
      documentCount: count,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ MongoDB test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'MongoDB test failed',
      details: error.message 
    });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/wordlists', require('./routes/wordLists'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api', require('./routes/vocabulary'));
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Korean Vocabulary API Server is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    geminiAPI: process.env.GEMINI_API_KEY ? 'Configured' : 'Not configured'
  });
});
// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false, 
    error: 'API route not found',
    method: req.method,
    path: req.originalUrl,
    availableRoutes: [
      'GET /api/health',
      'POST /api/save-data',
      'GET /api/load-data',
      'GET /api/test-mongodb'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    details: error.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Korean Vocabulary API: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 MongoDB test: http://localhost:${PORT}/api/test-mongodb`);
  console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Ready' : '❌ Not configured'}`)
});

module.exports = app;