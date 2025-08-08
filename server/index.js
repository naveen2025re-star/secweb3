import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Import new Web3 auth and database modules
import { testConnection } from './database.js';
import web3AuthRoutes from './routes/web3Auth.js';
import createTables from './migrations/001_create_tables.js';

// __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to generate UUID using crypto
const generateUUID = () => crypto.randomUUID();

// Load environment variables safely for production (Railway provides env vars directly)
let result;
if (process.env.NODE_ENV === 'production') {
  // In production, Railway provides environment variables directly
  result = { parsed: process.env };
  console.log('🔍 Using Railway environment variables');
} else {
  // In development, load from .env file
  result = dotenv.config({ path: path.join(__dirname, '.env') });
}

// Debug environment loading
console.log('🔍 Environment loading result:', result.error ? result.error.message : 'Success');

const app = express();
const PORT = process.env.PORT || 8000;

// Validate required environment variables
if (!process.env.SHIPABLE_JWT_TOKEN) {
  console.error('❌ SHIPABLE_JWT_TOKEN is required but not found in environment variables');
  console.error('   Available SHIPABLE vars:', Object.keys(process.env).filter(key => key.startsWith('SHIPABLE')));
  // Don't exit in production, let Railway handle restart
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
}

// Shipable AI configuration
const SHIPABLE_API_BASE = process.env.SHIPABLE_BASE_URL || 'https://api.shipable.ai/v2';
const SHIPABLE_JWT_TOKEN = process.env.SHIPABLE_JWT_TOKEN;

// In-memory session storage (use Redis in production)
const sessions = new Map();

// Log initialization status (masking token for security)
console.log('🔍 SHIPABLE_JWT_TOKEN found:', !!SHIPABLE_JWT_TOKEN);
if (SHIPABLE_JWT_TOKEN) {
  if (SHIPABLE_JWT_TOKEN) {
    console.log(`🔑 Shipable JWT Token: ${SHIPABLE_JWT_TOKEN ? SHIPABLE_JWT_TOKEN.substring(0, 20) + '...' : 'NOT_SET'}`);
  } else {
    console.log('🔑 Shipable JWT Token: Not provided');
  }
} else {
  console.log('🔑 Shipable JWT Token: Not provided');
}
console.log(`🌐 Shipable API: ${SHIPABLE_API_BASE}`);

// No custom system prompt - using Shipable AI's built-in smart contract auditor prompt

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// No rate limiting - removed as requested

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.sol', '.vy', '.move', '.cairo'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported. Allowed: ${allowedExtensions.join(', ')}`), false);
    }
  }
});

// Utility functions
const detectContractLanguage = (code, filename = '') => {
  const lowerCode = code ? code.toLowerCase() : '';
  const lowerFilename = filename ? filename.toLowerCase() : '';

  if (lowerFilename.endsWith('.sol') || lowerCode.includes('pragma solidity') || lowerCode.includes('contract ')) {
    return 'Solidity';
  }
  if (lowerFilename.endsWith('.vy') || lowerCode.includes('# @version') || lowerCode.includes('@external')) {
    return 'Vyper';
  }
  if (lowerFilename.endsWith('.move') || lowerCode.includes('module ') || lowerCode.includes('public fun ')) {
    return 'Move';
  }
  if (lowerFilename.endsWith('.cairo') || lowerCode.includes('#[contract]') || lowerCode.includes('func ')) {
    return 'Cairo';
  }

  return 'Unknown';
};

const validateContractCode = (code) => {
  if (!code || typeof code !== 'string') {
    throw new Error('Contract code is required and must be a string');
  }

  if (code.trim().length < 10) {
    throw new Error('Contract code is too short to analyze');
  }

  if (code.length > 500000) { // 500KB limit
    throw new Error('Contract code is too large (max 500KB)');
  }

  return true;
};

// API Routes

// Initialize database on startup
const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database connection...');
    const isConnected = await testConnection();

    if (isConnected) {
      console.log('🔄 Running database migrations...');
      await createTables();
      console.log('✅ Database initialized successfully');
    } else {
      console.log('⚠️ Database connection failed, running without database features');
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    console.log('⚠️ Continuing without database features');
  }
};

// Initialize database when server starts
initializeDatabase();

// Add Web3 authentication routes
app.use('/api/auth', web3AuthRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      web3Auth: true,
      database: true,
      shipableIntegration: true
    }
  });
});

// Test Shipable session creation endpoint
app.post('/api/test-session', async (req, res) => {
  try {
    console.log('🧪 Testing Shipable session creation...');

    const sessionResponse = await fetch(`${SHIPABLE_API_BASE}/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SHIPABLE_JWT_TOKEN}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        source: "website"
      })
    });

    console.log('🧪 Test session response status:', sessionResponse.status);

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('🧪 Test session failed:', errorText);
      return res.status(502).json({
        success: false,
        error: `Shipable API error: ${sessionResponse.status} - ${errorText}`,
        details: {
          url: `${SHIPABLE_API_BASE}/chat/sessions`,
          status: sessionResponse.status,
          statusText: sessionResponse.statusText
        }
      });
    }

    const sessionData = await sessionResponse.json();
    console.log('🧪 Test session successful:', sessionData);

    res.json({
      success: true,
      sessionData,
      message: 'Shipable session creation test successful'
    });

  } catch (error) {
    console.error('🧪 Test session error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to test Shipable session creation'
    });
  }
});

// Create new analysis session using Shipable API
app.post('/api/analyze', async (req, res) => {
  try {
    console.log('Received analyze request:', { hasCode: !!req.body?.code, filename: req.body?.filename });

    const { code, filename } = req.body;

    // Validate input
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Contract code is required'
      });
    }

    validateContractCode(code);

    const language = detectContractLanguage(code, filename);
    const lineCount = code.split('\n').length;

    console.log(`[${new Date().toISOString()}] Creating Shipable session for ${language} contract analysis: ${lineCount} lines`);

    // Create session via Shipable API
    console.log('🔄 Calling Shipable session endpoint:', `${SHIPABLE_API_BASE}/chat/sessions`);
    console.log('📦 Session payload:', { source: "website" });
    console.log('🔐 Using JWT token:', SHIPABLE_JWT_TOKEN ? 'Present' : 'Missing');

    const sessionResponse = await fetch(`${SHIPABLE_API_BASE}/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SHIPABLE_JWT_TOKEN}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        source: "website"
      })
    });

    console.log('🔄 Shipable session response status:', sessionResponse.status);
    console.log('🔄 Shipable session response headers:', Object.fromEntries(sessionResponse.headers.entries()));

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('❌ Shipable session creation failed:');
      console.error('   Status:', sessionResponse.status);
      console.error('   Status Text:', sessionResponse.statusText);
      console.error('   Response:', errorText);
      console.error('   URL:', `${SHIPABLE_API_BASE}/chat/sessions`);
      throw new Error(`Failed to create Shipable session: ${sessionResponse.status} - ${errorText}`);
    }

    const sessionData = await sessionResponse.json();
    console.log('✅ Shipable session created successfully:');
    console.log('   Response:', JSON.stringify(sessionData, null, 2));

    if (!sessionData || sessionData.statusCode !== 201 || !sessionData.data?.key) {
      console.error('❌ Invalid session response structure:');
      console.error('   Expected: { statusCode: 201, data: { key: "..." } }');
      console.error('   Received:', sessionData);
      throw new Error(`Invalid session response from Shipable API: ${JSON.stringify(sessionData)}`);
    }

    const sessionKey = sessionData.data.key;
    console.log('🔑 Session key obtained:', sessionKey);

    // Store session info locally for metadata
    sessions.set(sessionKey, {
      code,
      filename,
      language,
      lineCount,
      shipableSessionId: sessionData.data.id,
      createdAt: new Date().toISOString()
    });

    console.log('Session created successfully:', sessionKey);

    res.json({
      success: true,
      sessionKey,
      metadata: {
        language,
        filename: filename || null,
        lineCount,
        timestamp: new Date().toISOString(),
        shipableSessionId: sessionData.data.id
      }
    });

  } catch (error) {
    console.error('Analysis session creation error:', error);
    console.error('Error stack:', error.stack);

    let statusCode = 500;
    let errorMessage = 'Internal server error during session creation';

    if (error.message.includes('Contract code')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('Failed to create Shipable session')) {
      statusCode = 502;
      errorMessage = 'Failed to connect to AI service';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Handle preflight requests for streaming endpoint
app.options('/api/analyze/stream/:sessionKey', (req, res) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Cache-Control');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Stream analysis results
app.post('/api/analyze/stream/:sessionKey', async (req, res) => {
  try {
    const { sessionKey } = req.params;

    if (!sessionKey) {
      return res.status(400).json({
        success: false,
        error: 'Session key is required'
      });
    }

    const session = sessions.get(sessionKey);

    if (!session) {
      console.error('Session not found:', sessionKey);
      console.error('Available sessions:', Array.from(sessions.keys()));
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    console.log('Starting analysis stream for session:', sessionKey);

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Cache-Control',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    });

    // Create analysis prompt
    const analysisPrompt = `Please analyze this ${session.language} smart contract for security vulnerabilities:

\`\`\`${session.language.toLowerCase()}
${session.code}
\`\`\`

Provide a comprehensive security audit including:
1. Critical vulnerabilities
2. High-risk issues  
3. Medium-risk concerns
4. Best practice recommendations
5. Gas optimization opportunities`;

    console.log('🔄 Calling Shipable AI streaming endpoint...');
    console.log('   Prompt length:', analysisPrompt.length);
    console.log('   Session key:', sessionKey);

    // Call Shipable AI streaming endpoint with correct format
    const payload = {
      sessionKey: sessionKey,
      messages: [
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      token: SHIPABLE_JWT_TOKEN,
      stream: true
    };

    console.log('📦 Streaming payload prepared:');
    console.log('   Session key:', sessionKey);
    console.log('   Messages count:', payload.messages.length);
    console.log('   Token present:', !!SHIPABLE_JWT_TOKEN);
    console.log('   Stream enabled:', payload.stream);

    console.log('🔄 Calling:', `${SHIPABLE_API_BASE}/chat/open-playground`);

    const response = await fetch(`${SHIPABLE_API_BASE}/chat/open-playground`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${SHIPABLE_JWT_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    console.log('Shipable API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shipable API error response:', errorText);
      throw new Error(`Shipable API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body from Shipable API');
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('Streaming completed');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data && data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                if (parsed.body) {
                  res.write(`data: ${JSON.stringify({ content: parsed.body })}\n\n`);
                }
              } catch (parseError) {
                console.error('Error parsing streaming data:', parseError, 'Data:', data);
              }
            } else if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }
          }
        }
      }
    } catch (streamError) {
      console.error('Streaming read error:', streamError);
      throw streamError;
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Streaming error:', error);
    console.error('Error stack:', error.stack);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

// Get session messages from Shipable API
app.get('/api/sessions/:sessionKey', async (req, res) => {
  try {
    const { sessionKey } = req.params;
    const session = sessions.get(sessionKey);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found locally'
      });
    }

    console.log('Fetching session messages from Shipable for:', sessionKey);

    // Get messages from Shipable API
    const messagesResponse = await fetch(`${SHIPABLE_API_BASE}/chat/sessions/${sessionKey}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error('Failed to fetch session messages:', messagesResponse.status, errorText);
      throw new Error(`Failed to fetch session messages: ${messagesResponse.status}`);
    }

    const messagesData = await messagesResponse.json();
    console.log('Session messages retrieved:', messagesData);

    res.json({
      success: true,
      session: {
        sessionKey,
        messages: messagesData.data || [],
        metadata: {
          language: session.language,
          filename: session.filename,
          lineCount: session.lineCount,
          createdAt: session.createdAt,
          shipableSessionId: session.shipableSessionId
        }
      }
    });

  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get session info'
    });
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('contract'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const code = req.file.buffer.toString('utf8');
    const filename = req.file.originalname;

    // Validate the uploaded code
    validateContractCode(code);

    res.json({
      success: true,
      code,
      filename,
      size: req.file.size,
      language: detectContractLanguage(code, filename)
    });

  } catch (error) {
    console.error('Upload error:', error);

    res.status(400).json({
      success: false,
      error: error.message || 'File upload failed'
    });
  }
});

// Supported languages endpoint
app.get('/api/languages', (req, res) => {
  res.json({
    supported: [
      {
        name: 'Solidity',
        extension: '.sol',
        description: 'Ethereum and EVM-compatible smart contracts'
      },
      {
        name: 'Vyper',
        extension: '.vy',
        description: 'Python-like smart contract language'
      },
      {
        name: 'Move',
        extension: '.move',
        description: 'Aptos and Sui blockchain language'
      },
      {
        name: 'Cairo',
        extension: '.cairo',
        description: 'StarkNet smart contract language'
      }
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 5MB.'
      });
    }
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Serve static files (frontend)
const staticPath = path.join(__dirname, '../dist');
console.log('📁 Serving static files from:', staticPath);
app.use(express.static(staticPath));

// Catch-all for React Router (serve index.html for non-API routes)
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      availableEndpoints: [
        'GET /api/health',
        'POST /api/analyze',
        'POST /api/upload',
        'GET /api/languages'
      ]
    });
  }

  // Serve React app for all other routes
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Smart Contract Auditor Backend`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🤖 AI Model: ${process.env.SHIPABLE_MODEL}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`📊 Rate Limiting: Disabled`);
  console.log(`⚡ Ready for contract analysis!`);
});
