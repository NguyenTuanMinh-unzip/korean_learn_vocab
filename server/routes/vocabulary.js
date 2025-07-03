// routes/vocabulary.js - Fixed version
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Initialize Gemini AI with correct model
let genAI, model;
try {
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in environment variables');
  } else {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // ✅ Fix: Use gemini-1.5-flash instead of gemini-pro
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('✅ Gemini AI initialized successfully with gemini-1.5-flash');
  }
} catch (error) {
  console.error('❌ Failed to initialize Gemini AI:', error.message);
}

// Fix rate limiting for development
const aiGenerateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  // ✅ Fix: Skip rate limiting in development to avoid X-Forwarded-For error
  skip: (req) => process.env.NODE_ENV === 'development',
  message: {
    error: 'Quá nhiều yêu cầu tạo từ vựng. Vui lòng thử lại sau 15 phút.',
    retryAfter: '15 minutes'
  }
});

// Mapping difficulty levels
const difficultyMapping = {
  'Cơ bản': 'beginner',
  'Trung bình': 'intermediate', 
  'Nâng cao': 'advanced'
};

// Mapping categories
const categoryMapping = {
  'Du lịch': 'travel',
  'Ẩm thực': 'food and dining',
  'Công việc': 'work and career',
  'Gia đình': 'family and relationships',
  'Học tập': 'study and education',
  'Y tế': 'health and medical',
  'Thể thao': 'sports and exercise',
  'Giải trí': 'entertainment and hobbies',
  'Mua sắm': 'shopping and commerce',
  'Giao thông': 'transportation and traffic'
};

// Generate vocabulary
router.post('/generate-vocabulary', aiGenerateLimit, async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Request received', JSON.stringify(req.body, null, 2));

    if (!model) {
      return res.status(500).json({
        error: 'Gemini API chưa được cấu hình. Vui lòng kiểm tra GEMINI_API_KEY.',
        code: 'GEMINI_NOT_CONFIGURED'
      });
    }

    const { category, difficulty, count = 20 } = req.body;

    if (!category || !difficulty) {
      return res.status(400).json({
        error: 'Thiếu thông tin chủ đề hoặc cấp độ',
        code: 'MISSING_PARAMETERS'
      });
    }

    console.log('🔍 [DEBUG] Input validated', { category, difficulty, count });

    const englishCategory = categoryMapping[category] || category;
    const englishDifficulty = difficultyMapping[difficulty] || difficulty;

    // Improved prompt for better results
    const prompt = `Tạo ${count} từ vựng tiếng Hàn về chủ đề "${category}" (${englishCategory}) ở cấp độ ${difficulty} (${englishDifficulty}).

Yêu cầu:
- Mỗi từ gồm: từ tiếng Hàn (한글), nghĩa tiếng Việt, phát âm romanization
- Từ vựng thông dụng, phù hợp cấp độ ${difficulty}
- Liên quan trực tiếp đến chủ đề ${category}

Trả về JSON array chính xác theo format:
[
  {
    "korean": "밥",
    "vietnamese": "cơm",
    "pronunciation": "bap"
  },
  {
    "korean": "물",
    "vietnamese": "nước",
    "pronunciation": "mul"
  }
]

CHỈ trả về JSON array, KHÔNG có text khác.`;

    console.log('🔍 [DEBUG] Calling Gemini API with gemini-1.5-flash...');

    // Call Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('🔍 [DEBUG] Gemini response received', { 
      length: text.length, 
      preview: text.substring(0, 200) 
    });

    // Parse response
    let words;
    try {
      // Clean response
      let cleanedText = text
        .replace(/```json|```/g, '')
        .replace(/^\s*|\s*$/g, '')
        .trim();

      // Extract JSON array
      const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }

      console.log('🔍 [DEBUG] Cleaned text for parsing', { 
        cleanedText: cleanedText.substring(0, 300) 
      });

      words = JSON.parse(cleanedText);
      console.log('🔍 [DEBUG] JSON parsing successful', { wordCount: words.length });

    } catch (parseError) {
      console.log('🔍 [DEBUG] JSON parsing failed, trying text extraction', parseError.message);
      words = extractWordsFromText(text);
      console.log('🔍 [DEBUG] Text extraction result', { wordCount: words.length });
    }

    // Validate words
    if (!Array.isArray(words)) {
      throw new Error('Response is not an array');
    }

    const validWords = words
      .filter(word => {
        const isValid = word && 
          typeof word === 'object' &&
          word.korean && 
          word.vietnamese && 
          word.pronunciation &&
          /[가-힣]/.test(word.korean);
        
        if (!isValid) {
          console.log('🔍 [DEBUG] Invalid word filtered out', word);
        }
        return isValid;
      })
      .slice(0, count)
      .map(word => ({
        korean: word.korean.trim(),
        vietnamese: word.vietnamese.trim(),
        pronunciation: word.pronunciation.trim()
      }));

    console.log('🔍 [DEBUG] Valid words processed', { count: validWords.length });

    if (validWords.length === 0) {
      return res.status(500).json({
        error: 'Không thể tạo từ vựng hợp lệ. Vui lòng thử lại.',
        code: 'NO_VALID_WORDS',
        debug: process.env.NODE_ENV === 'development' ? { originalResponse: text } : undefined
      });
    }

    console.log('✅ [DEBUG] Success - returning words', { count: validWords.length });

    res.json({
      success: true,
      words: validWords,
      category: category,
      difficulty: difficulty,
      count: validWords.length,
      requestedCount: count
    });

  } catch (error) {
    console.log('❌ [DEBUG] Error in generate-vocabulary', {
      message: error.message,
      stack: error.stack
    });

    // Handle specific Gemini API errors
    if (error.message.includes('models/gemini-pro is not found')) {
      return res.status(500).json({
        error: 'Model Gemini không tìm thấy. Đã cập nhật sang model mới.',
        code: 'MODEL_NOT_FOUND'
      });
    }

    if (error.message.includes('API key')) {
      return res.status(500).json({
        error: 'API key không hợp lệ. Vui lòng kiểm tra GEMINI_API_KEY.',
        code: 'API_KEY_ERROR'
      });
    }

    res.status(500).json({
      error: 'Lỗi khi tạo danh sách từ vựng. Vui lòng thử lại.',
      code: 'UNKNOWN_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Text extraction fallback
function extractWordsFromText(text) {
  console.log('🔍 [DEBUG] Starting text extraction from:', text.substring(0, 200));
  
  const words = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const patterns = [
      /([가-힣]+)\s*-\s*([^-\n]+?)\s*-\s*([a-zA-Z\s]+)/,
      /"korean":\s*"([^"]+)".*?"vietnamese":\s*"([^"]+)".*?"pronunciation":\s*"([^"]+)"/,
      /([가-힣]+):\s*([^-\n(]+?)\s*\(([^)]+)\)/,
      /\d+\.\s*([가-힣]+)\s*-\s*([^-\n]+?)\s*-\s*([a-zA-Z\s]+)/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match.length >= 4) {
        const korean = match[1];
        const vietnamese = match[2];
        const pronunciation = match[3];

        if (korean && vietnamese && pronunciation && /[가-힣]/.test(korean)) {
          words.push({
            korean: korean.trim(),
            vietnamese: vietnamese.trim(),
            pronunciation: pronunciation.trim()
          });
          console.log('🔍 [DEBUG] Extracted word', { korean, vietnamese, pronunciation });
          break;
        }
      }
    }
  }

  console.log('🔍 [DEBUG] Text extraction completed', { extractedCount: words.length });
  return words;
}

// Test endpoint with new model
router.get('/test-gemini', async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Testing Gemini connection with gemini-1.5-flash...');

    if (!model) {
      return res.status(500).json({
        success: false,
        error: 'Gemini API not configured',
        hasApiKey: !!process.env.GEMINI_API_KEY
      });
    }

    const result = await model.generateContent('Say "Hello" in Korean with pronunciation');
    const response = await result.response;
    const text = response.text();

    console.log('✅ [DEBUG] Gemini test successful', { response: text });

    res.json({
      success: true,
      message: 'Gemini API connected successfully with gemini-1.5-flash',
      response: text,
      model: 'gemini-1.5-flash',
      hasApiKey: !!process.env.GEMINI_API_KEY
    });

  } catch (error) {
    console.log('❌ [DEBUG] Gemini test failed', error.message);

    res.status(500).json({
      success: false,
      error: 'Failed to connect to Gemini API',
      details: error.message,
      hasApiKey: !!process.env.GEMINI_API_KEY
    });
  }
});

module.exports = router;