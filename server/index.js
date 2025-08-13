import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Check if critical dependencies are available
console.log('🔍 Checking dependencies...');
try {
  await import('pg');
  console.log('✅ pg package found');
} catch (error) {
  console.error('❌ pg package missing:', error.message);
  process.exit(1);
}

try {
  await import('jsonwebtoken');
  console.log('✅ jsonwebtoken package found');
} catch (error) {
  console.error('❌ jsonwebtoken package missing:', error.message);
  process.exit(1);
}

try {
  await import('ethers');
  console.log('✅ ethers package found');
} catch (error) {
  console.error('❌ ethers package missing:', error.message);
  process.exit(1);
}

// Import database and auth modules
import {pool, testConnection} from './database.js';
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

// Check for different possible JWT token variable names from Railway
const JWT_TOKEN = process.env.SHIPABLE_JWT_TOKEN || process.env.VITE_SHIPABLE_JWT_TOKEN || process.env.JWT_SECRET;

// Ensure JWT_SECRET is available for auth middleware
if (!process.env.JWT_SECRET && JWT_TOKEN) {
  process.env.JWT_SECRET = JWT_TOKEN;
  console.log('🔐 Set JWT_SECRET from SHIPABLE_JWT_TOKEN for auth compatibility');
}

// Validate required environment variables
if (!JWT_TOKEN) {
  console.error('❌ JWT Token is required but not found in environment variables');
  console.error('   Available environment variable keys:', Object.keys(process.env).filter(key => 
    key.includes('TOKEN') || key.includes('JWT') || key.includes('SHIPABLE')
  ));
  console.error('   Looking for: SHIPABLE_JWT_TOKEN, VITE_SHIPABLE_JWT_TOKEN, or JWT_SECRET');

  // In production, warn but don't exit to allow Railway to handle restart
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  Continuing without JWT token - some features may not work');
  } else {
    process.exit(1);
  }
}

// Shipable AI configuration
const SHIPABLE_API_BASE = process.env.SHIPABLE_BASE_URL || 'https://api.shipable.ai/v2';
const SHIPABLE_JWT_TOKEN = JWT_TOKEN;

// In-memory session storage (use Redis in production)
const sessions = new Map();

// Clean up old sessions every hour to prevent memory leaks
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  let cleanedCount = 0;

  for (const [sessionKey, sessionData] of sessions.entries()) {
    const sessionTime = new Date(sessionData.createdAt).getTime();
    if (sessionTime < oneHourAgo) {
      sessions.delete(sessionKey);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} old sessions. Active sessions: ${sessions.size}`);
  }
}, 60 * 60 * 1000); // Run every hour

// Log initialization status (masking token for security)
console.log('🔍 SHIPABLE_JWT_TOKEN found:', !!SHIPABLE_JWT_TOKEN);
if (SHIPABLE_JWT_TOKEN) {
  console.log(`🔑 Shipable JWT Token: ${SHIPABLE_JWT_TOKEN.substring(0, 20)}...`);
  console.log('✅ Shipable AI integration enabled');
} else {
  console.log('🔑 Shipable JWT Token: Not provided');
  console.warn('⚠️  Analysis will fail without proper Shipable API configuration');
}
console.log(`🌐 Shipable API: ${SHIPABLE_API_BASE}`);

// No custom system prompt - using Shipable AI's built-in smart contract auditor prompt

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    'https://secweb3-production.up.railway.app',
    'http://localhost:5173'
  ].filter(Boolean),
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

    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is required');
      process.exit(1);
    }

    console.log('🔄 Testing database connection...');
    const isConnected = await testConnection();

    if (isConnected) {
      console.log('🔄 Running database migrations...');
      await createTables();

      // Run plans system migration
      try {
        const createPlansSystem = await import('./migrations/002_create_plans_system.js');
        await createPlansSystem.default();
      } catch (error) {
        console.warn('⚠️ Plans system migration skipped:', error.message);
      }

      // Verify required tables exist
      console.log('🔄 Verifying database schema...');
      try {
        const tableCheck = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('users', 'plans', 'conversations')
        `);

        const existingTables = tableCheck.rows.map(r => r.table_name);
        console.log('📊 Existing tables:', existingTables);

        // Check users table columns
        const userColumnsCheck = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'users'
        `);

        console.log('👤 Users table columns:', userColumnsCheck.rows.map(r => `${r.column_name} (${r.data_type})`));

        // Ensure credits_balance exists
        const hasCreditsBalance = userColumnsCheck.rows.some(r => r.column_name === 'credits_balance');
        if (!hasCreditsBalance) {
          console.log('🔄 Adding missing credits_balance column...');
          await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_balance INTEGER DEFAULT 100');
        }

        console.log('✅ Database schema verified');
      } catch (schemaError) {
        console.warn('⚠️ Schema verification failed:', schemaError.message);
        // Continue anyway - tables might exist with different schema
      }

      console.log('✅ Database initialized successfully');
    } else {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
};

// Initialize database when server starts
await initializeDatabase();

// Add Web3 authentication routes
app.use('/api/auth', web3AuthRoutes);
console.log('✅ Web3 authentication routes enabled');

// Add conversation routes
import conversationRoutes from './routes/conversations.js';
app.use('/api/conversations', conversationRoutes);
console.log('✅ Conversation routes enabled');

// Add plan routes directly to avoid import issues
app.get('/api/plans/current', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const authToken = authHeader.split(' ')[1];
    const jwtModule = await import('jsonwebtoken');
    const decodedToken = jwtModule.default.verify(authToken, process.env.JWT_SECRET || process.env.SHIPABLE_JWT_TOKEN || 'your-secret-key');

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decodedToken.userId]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = result.rows[0];

    res.json({
      plan: {
        code: 'free',
        name: 'Free',
        description: 'Basic plan',
        creditsPerMonth: 100,
        creditsPerScanLimit: 50,
        filesPerScanLimit: 5,
        priceUsd: 0,
        features: ['Basic security analysis', '5 files per scan', 'Community support']
      },
      creditsBalance: user.credits_balance || 100,
      planStartedAt: new Date().toISOString(),
      creditsResetAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Plan current error:', error);
    res.status(500).json({ error: 'Failed to get current plan' });
  }
});

app.post('/api/plans/estimate-cost', async (req, res) => {
  try {
    const { files = [] } = req.body;
    let cost = 0;

    for (const file of files) {
      const size = file.size || (file.content ? file.content.length : 0);
      cost += Math.max(1, Math.ceil(size / 1024));
    }

    res.json({
      estimatedCost: Math.max(1, cost),
      fileCount: files.length
    });
  } catch (error) {
    console.error('Estimate cost error:', error);
    res.json({ estimatedCost: 5, fileCount: 1 });
  }
});

console.log('✅ Basic plan routes enabled directly');

// Contract analysis endpoint with credit deduction
app.post('/api/analyze', async (req, res) => {
  try {
    console.log('🔄 /api/analyze endpoint hit');

    // Test database connection first
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connection verified');
    } catch (connError) {
      console.error('❌ Database connection failed:', connError.message);
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable. Please try again in a moment.'
      });
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      console.warn('❌ No authorization header');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
      console.warn('❌ No token in authorization header');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication token missing' 
      });
    }

    let decodedUser;
    try {
      const jwtLib = await import('jsonwebtoken');
      decodedUser = jwtLib.default.verify(accessToken, process.env.JWT_SECRET || process.env.SHIPABLE_JWT_TOKEN || 'your-secret-key');
    } catch (jwtError) {
      console.warn('❌ JWT verification failed:', jwtError.message);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid authentication token' 
      });
    }

    // Get user and plan info with error handling
    let userResult;
    try {
      console.log('🔍 Fetching user data for ID:', decodedUser.userId);

      // First check if user exists
      const userCheck = await pool.query('SELECT id, credits_balance FROM users WHERE id = $1', [decodedUser.userId]);

      if (!userCheck.rows.length) {
        console.warn('❌ User not found in database:', decodedUser.userId);
        return res.status(401).json({
          success: false,
          error: 'User not found. Please sign in again.'
        });
      }

      console.log('✅ User found, fetching full plan data...');

      userResult = await pool.query(`
        SELECT u.*, 
               COALESCE(p.credits_per_month, 100) as credits_per_month,
               COALESCE(p.credits_per_scan_limit, 50) as credits_per_scan_limit,
               COALESCE(p.files_per_scan_limit, 5) as files_per_scan_limit,
               COALESCE(p.name, 'Free') as plan_name
        FROM users u
        LEFT JOIN plans p ON u.plan_id = p.id
        WHERE u.id = $1
      `, [decodedUser.userId]);
    } catch (dbError) {
      console.error('❌ Database error in analyze:', {
        error: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        stack: dbError.stack
      });
      return res.status(503).json({
        success: false,
        error: `Database error: ${dbError.message}. Please try again.`
      });
    }

    if (!userResult.rows.length) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found. Please sign in again.' 
      });
    }

    const currentUser = userResult.rows[0];
    console.log('✅ User found:', currentUser.id);

    const { code, filename } = req.body || {};

    // Validate request body
    if (!req.body) {
      console.warn('❌ No request body');
      return res.status(400).json({
        success: false,
        error: 'Request body is required'
      });
    }

    // Validate contract code
    if (!code || typeof code !== 'string' || code.trim().length < 10) {
      console.warn('❌ Invalid contract code:', { 
        codeLength: code?.length, 
        codeType: typeof code 
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid contract code provided. Code must be at least 10 characters.'
      });
    }

    console.log('✅ Contract code validated, length:', code.length);

    // Calculate scan cost (simplified: 1 credit per KB + base cost of 5)
    const codeSizeKB = Math.ceil(code.length / 1024);
    const scanCost = Math.max(5, codeSizeKB + 5);

    console.log('💳 Credit calculation:', {
      codeSizeKB,
      scanCost,
      userBalance: currentUser.credits_balance,
      scanLimit: currentUser.credits_per_scan_limit
    });

    // Check plan limits
    if (scanCost > currentUser.credits_per_scan_limit) {
      console.warn('❌ Scan cost exceeds limit:', scanCost, 'vs', currentUser.credits_per_scan_limit);
      return res.status(403).json({
        success: false,
        error: `This scan requires ${scanCost} credits but your ${currentUser.plan_name} plan allows maximum ${currentUser.credits_per_scan_limit} credits per scan`,
        scanCost,
        availableCredits: currentUser.credits_balance,
        planName: currentUser.plan_name,
        creditError: true
      });
    }

    if (currentUser.credits_balance < scanCost) {
      console.warn('❌ Insufficient credits:', currentUser.credits_balance, 'needed:', scanCost);
      return res.status(402).json({
        success: false,
        error: `Insufficient credits. You need ${scanCost} credits but only have ${currentUser.credits_balance}`,
        scanCost,
        availableCredits: currentUser.credits_balance,
        planName: currentUser.plan_name,
        creditError: true
      });
    }

    console.log('🔄 Attempting to deduct credits...');

    // Deduct credits BEFORE calling Shipable API
    let deductResult;
    try {
      console.log('💳 Attempting credit deduction:', {
        userId: decodedUser.userId,
        scanCost,
        currentBalance: currentUser.credits_balance
      });

      // Check if users table has required columns
      const tableCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name IN ('credits_balance', 'credits_updated_at')
      `);

      console.log('📊 Available columns:', tableCheck.rows.map(r => r.column_name));

      // Use simpler query if credits_updated_at doesn't exist
      const hasUpdatedAtColumn = tableCheck.rows.some(r => r.column_name === 'credits_updated_at');

      if (hasUpdatedAtColumn) {
        deductResult = await pool.query(`
          UPDATE users 
          SET credits_balance = credits_balance - $1,
              credits_updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND credits_balance >= $1
          RETURNING credits_balance
        `, [scanCost, decodedUser.userId]);
      } else {
        console.log('⚠️ Using simple credit deduction (no updated_at column)');
        deductResult = await pool.query(`
          UPDATE users 
          SET credits_balance = credits_balance - $1
          WHERE id = $2 AND credits_balance >= $1
          RETURNING credits_balance
        `, [scanCost, decodedUser.userId]);
      }

      console.log('✅ Credit deduction query executed. Affected rows:', deductResult.rowCount);

    } catch (deductError) {
      console.error('❌ Credit deduction database error:', {
        message: deductError.message,
        code: deductError.code,
        detail: deductError.detail,
        query: deductError.query,
        parameters: [scanCost, decodedUser.userId]
      });

      return res.status(503).json({
        success: false,
        error: `Credit deduction failed: ${deductError.message}. Please contact support.`
      });
    }

    if (!deductResult.rows.length || deductResult.rowCount === 0) {
      console.warn('❌ Credit deduction failed - no rows affected:', {
        rowCount: deductResult.rowCount,
        rows: deductResult.rows.length,
        userId: decodedUser.userId,
        scanCost,
        currentBalance: currentUser.credits_balance
      });

      return res.status(402).json({
        success: false,
        error: `Insufficient credits or concurrent modification. You need ${scanCost} credits but may have ${currentUser.credits_balance}. Please refresh and try again.`,
        scanCost,
        availableCredits: currentUser.credits_balance,
        creditError: true
      });
    }

    const newBalance = deductResult.rows[0].credits_balance;
    console.log('✅ Credits successfully deducted. New balance:', newBalance);

    // Validate Shipable API configuration
    if (!SHIPABLE_JWT_TOKEN) {
      console.error('❌ SHIPABLE_JWT_TOKEN not configured');
      // Refund credits since we can't process the analysis
      await pool.query(`
        UPDATE users 
        SET credits_balance = credits_balance + $1,
            credits_updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [scanCost, decoded.userId]);

      return res.status(503).json({
        success: false,
        error: 'Analysis service not configured. Credits have been refunded.',
        refunded: true
      });
    }

    // Now call Shipable API to create session
    console.log('🔄 Calling Shipable API...');
    console.log('🔄 API Base:', SHIPABLE_API_BASE);
    console.log('🔄 Token present:', !!SHIPABLE_JWT_TOKEN);

    try {
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

      console.log('🔄 Shipable API response status:', sessionResponse.status);

      if (!sessionResponse.ok) {
        // Refund credits on API failure
        console.log('🔄 Refunding credits due to API failure...');
        try {
          await pool.query(`
            UPDATE users 
            SET credits_balance = credits_balance + $1,
                credits_updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [scanCost, decodedUser.userId]);
          console.log('✅ Credits refunded successfully');
        } catch (refundError) {
          console.error('❌ Failed to refund credits:', refundError);
        }

        const errorText = await sessionResponse.text();
        console.error('❌ Shipable session creation failed:', errorText);

        return res.status(503).json({
          success: false,
          error: 'Analysis service temporarily unavailable. Credits have been refunded.',
          refunded: true
        });
      }

      const sessionData = await sessionResponse.json();

      if (!sessionData || sessionData.statusCode !== 201 || !sessionData.data?.key) {
        // Refund credits on invalid response
        await pool.query(`
          UPDATE users 
          SET credits_balance = credits_balance + $1,
              credits_updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [scanCost, decoded.userId]);

        return res.status(503).json({
          success: false,
          error: 'Invalid response from analysis service. Credits have been refunded.',
          refunded: true
        });
      }

      // Store session info for streaming endpoint
      const sessionKey = sessionData.data.key;
      sessions.set(sessionKey, {
        code,
        filename,
        language: detectContractLanguage(code, filename),
        lineCount: code.split('\n').length,
        shipableSessionId: sessionData.data.id,
        createdAt: new Date().toISOString(),
        userId: decodedUser.userId,
        scanCost,
        creditsDeducted: scanCost
      });

      console.log('✅ Session stored for streaming:', sessionKey);

      // Success - return session key and updated credit info
      return res.json({
        success: true,
        sessionKey: sessionKey,
        creditInfo: {
          creditsDeducted: scanCost,
          creditsRemaining: newBalance
        },
        metadata: {
          language: detectContractLanguage(code, filename),
          filename: filename || null,
          scanCost,
          timestamp: new Date().toISOString(),
          shipableSessionId: sessionData.data.id
        }
      });

    } catch (apiError) {
      // Refund credits on API error
      console.log('🔄 Attempting to refund credits due to API error...');
      try {
        const refundResult = await pool.query(`
          UPDATE users 
          SET credits_balance = credits_balance + $1,
              credits_updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING credits_balance
        `, [scanCost, decoded.userId]);

        if (refundResult.rows.length > 0) {
          console.log('✅ Credits refunded successfully. New balance:', refundResult.rows[0].credits_balance);
        }
      } catch (refundError) {
        console.error('❌ Failed to refund credits:', refundError);
        // Continue with the error response but mention refund issue
      }

      console.error('❌ Shipable API error:', apiError);

      return res.status(503).json({
        success: false,
        error: 'Analysis service error. Credits have been refunded.',
        refunded: true,
        originalError: apiError.message
      });
    }

  } catch (error) {
    console.error('❌ Analyze endpoint error:', error);
    console.error('Error stack:', error.stack);

    // Return more specific error information for debugging
    return res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' 
        ? `Server error: ${error.message}` 
        : 'Internal server error. Please try again.'
    });
  }
});

// Add a simple test endpoint to verify server is working
app.get('/api/test', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (dbError) {
    dbStatus = `error: ${dbError.message}`;
  }

  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: dbStatus,
    shipableConfigured: !!SHIPABLE_JWT_TOKEN,
    useMockAnalysis: !SHIPABLE_JWT_TOKEN || process.env.USE_MOCK_ANALYSIS === 'true'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      web3Auth: !!process.env.JWT_SECRET,
      database: !!process.env.DATABASE_URL,
      shipableIntegration: !!process.env.SHIPABLE_JWT_TOKEN
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      NODE_ENV: process.env.NODE_ENV
    }
  });
});

// Debug endpoint to test JWT authentication
app.get('/api/debug/auth', async (req, res) => {
  try {
    console.log('🔍 Debug auth endpoint hit');
    console.log('Headers:', req.headers);

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.json({ status: 'no_auth_header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.json({ status: 'no_token' });
    }

    // Try to import and use the auth middleware
    const authModule = await import('./auth/web3Auth.js');
    console.log('✅ Auth module loaded successfully');

    // Verify the token manually
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('✅ Token decoded:', decoded);

    res.json({ 
      status: 'success',
      decoded,
      jwtSecret: process.env.JWT_SECRET ? 'present' : 'missing'
    });
  } catch (error) {
    console.error('❌ Debug auth failed:', error);
    res.json({ 
      status: 'error', 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Check session status and verify credits were properly deducted
app.get('/api/analyze/session/:sessionKey/status', async (req, res) => {
  try {
    const { sessionKey } = req.params;
    const sessionData = sessions.get(sessionKey);

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Get current user credit balance if authenticated
    let currentBalance = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && sessionData.userId) {
      try {
        const token = authHeader.split(' ')[1];
        if (token) {
          const jwt = await import('jsonwebtoken');
          const decoded = jwt.default.verify(token, process.env.JWT_SECRET || process.env.SHIPABLE_JWT_TOKEN || 'your-secret-key');

          if (decoded.userId === sessionData.userId) {
            const userResult = await pool.query('SELECT credits_balance FROM users WHERE id = $1', [sessionData.userId]);
            if (userResult.rows.length > 0) {
              currentBalance = userResult.rows[0].credits_balance;
            }
          }
        }
      } catch (authError) {
        console.warn('Auth verification failed in session status:', authError.message);
      }
    }

    res.json({
      success: true,
      session: {
        sessionKey,
        language: sessionData.language,
        filename: sessionData.filename,
        scanCost: sessionData.scanCost,
        creditsDeducted: sessionData.creditsDeducted,
        completed: sessionData.completed || false,
        createdAt: sessionData.createdAt,
        completedAt: sessionData.completedAt || null
      },
      currentBalance
    });

  } catch (error) {
    console.error('Session status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session status'
    });
  }
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

// Remove the duplicate endpoint - using the credit-integrated one above

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
    const { message, code } = req.body;

    if (!sessionKey) {
      return res.status(400).json({
        success: false,
        error: 'Session key is required'
      });
    }

    // Validate authentication for streaming
    const streamAuthHeader = req.headers['authorization'];
    if (streamAuthHeader) {
      try {
        const streamToken = streamAuthHeader.split(' ')[1];
        if (streamToken) {
          const streamJwt = await import('jsonwebtoken');
          const streamDecoded = streamJwt.default.verify(streamToken, process.env.JWT_SECRET || process.env.SHIPABLE_JWT_TOKEN || 'your-secret-key');
          console.log('✅ Streaming request authenticated for user:', streamDecoded.userId);
        }
      } catch (authError) {
        console.warn('⚠️ Streaming authentication failed:', authError.message);
        // Continue anyway since session validation is primary check
      }
    }

    const sessionData = sessions.get(sessionKey);

    if (!sessionData) {
      console.error('❌ Session not found:', sessionKey);
      console.error('Available sessions:', Array.from(sessions.keys()));
      return res.status(404).json({
        success: false,
        error: 'Session not found or expired. Please start a new analysis.'
      });
    }

    console.log('✅ Starting analysis stream for session:', sessionKey);
    console.log('📊 Session details:', {
      language: sessionData.language,
      scanCost: sessionData.scanCost,
      creditsDeducted: sessionData.creditsDeducted
    });

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

    // Use provided message and code, or fall back to session data
    const analysisCode = code || sessionData.code;
    const analysisMessage = message || `Analyze this smart contract for security vulnerabilities`;

    // Create analysis prompt
    const analysisPrompt = analysisCode ? 
      `${analysisMessage}\n\nContract Code:\n${analysisCode}` :
      analysisMessage;

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
                  // Forward the data in the format expected by frontend
                  res.write(`data: ${JSON.stringify({ body: parsed.body })}\n\n`);
                }
              } catch (parseError) {
                console.error('Error parsing streaming data:', parseError, 'Data:', data);
                // If parsing fails, try to forward the raw data
                if (data) {
                  res.write(`data: ${JSON.stringify({ body: data })}\n\n`);
                }
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

    // Mark session as completed
    const completedSession = sessions.get(sessionKey);
    if (completedSession) {
      completedSession.completed = true;
      completedSession.completedAt = new Date().toISOString();
      console.log('✅ Session completed successfully:', sessionKey);
    }

  } catch (error) {
    console.error('❌ Streaming error:', error);
    console.error('Error stack:', error.stack);

    // Try to refund credits if streaming fails after session creation
    const failedSession = sessions.get(sessionKey);
    if (failedSession && failedSession.userId && failedSession.scanCost && !failedSession.completed) {
      console.log('🔄 Attempting to refund credits due to streaming failure...');
      try {
        const refundResult = await pool.query(`
          UPDATE users 
          SET credits_balance = credits_balance + $1,
              credits_updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING credits_balance
        `, [failedSession.scanCost, failedSession.userId]);

        if (refundResult.rows.length > 0) {
          console.log('✅ Credits refunded for streaming failure. New balance:', refundResult.rows[0].credits_balance);
        }
      } catch (refundError) {
        console.error('❌ Failed to refund credits for streaming failure:', refundError);
      }
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Analysis streaming failed. Credits have been refunded if applicable.'
      });
    } else {
      res.write(`data: ${JSON.stringify({ 
        error: 'Analysis streaming failed. Please try again.' 
      })}\n\n`);
      res.end();
    }

    // Clean up failed session
    if (failedSession) {
      sessions.delete(sessionKey);
      console.log('🗑️ Cleaned up failed session:', sessionKey);
    }
  }
});

// Get session messages from Shipable API
app.get('/api/sessions/:sessionKey', async (req, res) => {
  try {
    const { sessionKey } = req.params;
        const sessionInfo = sessions.get(sessionKey);

        if (!sessionInfo) {
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
