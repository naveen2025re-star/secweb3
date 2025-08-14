import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

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

    const { code, filename, message, selectedFileIds } = req.body || {};
    
    // Accept either 'code', 'message', or 'selectedFileIds'
    const inputContent = code || message || '';

    // Validate request body
    if (!req.body) {
      console.warn('❌ No request body');
      return res.status(400).json({
        success: false,
        error: 'Request body is required'
      });
    }

    // Validate input (accept code/message OR selectedFileIds)
    const hasFileIds = selectedFileIds && Array.isArray(selectedFileIds) && selectedFileIds.length > 0;
    const hasContent = inputContent && typeof inputContent === 'string' && inputContent.trim().length > 0;
    
    if (!hasContent && !hasFileIds) {
      console.warn('❌ Invalid input:', { 
        codeLength: code?.length,
        messageLength: message?.length,
        inputLength: inputContent?.length,
        inputType: typeof inputContent,
        fileIds: selectedFileIds,
        hasFileIds,
        hasContent
      });
      return res.status(400).json({
        success: false,
        error: 'Content or file selection is required.'
      });
    }

    console.log('✅ Content validated, length:', inputContent.length);

    // Determine if this is contract analysis or just chat
    const isContractAnalysis = code && code.length > 50; // Contract analysis if 'code' field with substantial content
    const scanCost = isContractAnalysis ? Math.max(5, Math.ceil(inputContent.length / 1024) + 5) : 0; // No cost for chat

    console.log('💳 Content type determination:', {
      isContractAnalysis,
      hasCodeField: !!code,
      contentLength: inputContent.length,
      scanCost,
      userBalance: currentUser.credits_balance,
      scanLimit: currentUser.credits_per_scan_limit
    });

    // Only check credits for contract analysis, not for chat
    if (isContractAnalysis) {
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
    } else {
      console.log('💬 Chat message - no credit check required');
    }

    // Only deduct credits for contract analysis, not for chat
    let deductResult;
    if (isContractAnalysis) {
      console.log('🔄 Attempting to deduct credits for contract analysis...');
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
    } else {
      console.log('💬 Chat message - skipping credit deduction');
    }

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
        code: inputContent, // Store the actual content (code or message)
        filename,
        language: detectContractLanguage(inputContent, filename),
        lineCount: inputContent.split('\n').length,
        shipableSessionId: sessionData.data.id,
        createdAt: new Date().toISOString(),
        userId: decodedUser.userId,
        scanCost,
        creditsDeducted: scanCost,
        isContractAnalysis // Store whether this is analysis or chat
      });

      console.log('✅ Session stored for streaming:', sessionKey);

      // Success - return session key and updated credit info
      return res.json({
        success: true,
        sessionKey: sessionKey,
        creditInfo: {
          creditsDeducted: scanCost,
          creditsRemaining: isContractAnalysis ? (deductResult?.rows[0]?.credits_balance || currentUser.credits_balance - scanCost) : currentUser.credits_balance
        },
        metadata: {
          language: detectContractLanguage(inputContent, filename),
          filename: filename || null,
          scanCost,
          isContractAnalysis,
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

// Test Shipable API connectivity
app.get('/api/test-shipable', async (req, res) => {
  try {
    console.log('🧪 Testing Shipable API connectivity...');

    if (!SHIPABLE_JWT_TOKEN) {
      return res.json({
        success: false,
        error: 'Shipable JWT token not configured',
        configured: false
      });
    }

    const testResponse = await fetch(`${SHIPABLE_API_BASE}/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SHIPABLE_JWT_TOKEN}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ source: "test" }),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (testResponse.ok) {
      const data = await testResponse.json();
      return res.json({
        success: true,
        message: 'Shipable API is accessible',
        sessionCreated: !!data.data?.key,
        configured: true
      });
    } else {
      const errorText = await testResponse.text();
      return res.json({
        success: false,
        error: `Shipable API error: ${testResponse.status}`,
        details: errorText,
        configured: true
      });
    }
  } catch (error) {
    console.error('🧪 Shipable API test failed:', error);
    return res.json({
      success: false,
      error: error.message,
      configured: !!SHIPABLE_JWT_TOKEN
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
  const startTime = Date.now();
  console.log('🎯 Stream endpoint hit:', {
    sessionKey: req.params.sessionKey,
    hasMessage: !!req.body?.message,
    hasCode: !!req.body?.code,
    timestamp: new Date().toISOString()
  });

  try {
    const { sessionKey } = req.params;
    const { message, code } = req.body;

    if (!sessionKey) {
      console.warn('❌ No session key provided');
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

    // Validate Shipable API configuration
    if (!SHIPABLE_JWT_TOKEN) {
      console.error('❌ Shipable JWT token not configured for streaming');
      return res.status(503).json({
        success: false,
        error: 'Analysis service not properly configured'
      });
    }

    if (!SHIPABLE_API_BASE) {
      console.error('❌ Shipable API base URL not configured');
      return res.status(503).json({
        success: false,
        error: 'Analysis service not properly configured'
      });
    }

    console.log('✅ Starting analysis stream for session:', sessionKey);
    console.log('📊 Session details:', {
      language: sessionData.language,
      scanCost: sessionData.scanCost,
      creditsDeducted: sessionData.creditsDeducted,
      shipableApiBase: SHIPABLE_API_BASE,
      hasToken: !!SHIPABLE_JWT_TOKEN
    });

    // Set up SSE headers and send immediate response to prevent 502
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Cache-Control',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    });

    // Send immediate acknowledgment to prevent 502 timeout
    res.write(`data: ${JSON.stringify({ body: '🚀 **Starting Analysis**\n\nInitializing...' })}\n\n`);

    // Add keep-alive mechanism
    const keepAlive = setInterval(() => {
      if (!res.destroyed) {
        res.write(': keepalive\n\n');
      }
    }, 10000); // Send keep-alive every 10 seconds

    // Cleanup function
    const cleanup = () => {
      clearInterval(keepAlive);
      if (!res.destroyed) {
        try {
          res.end();
        } catch (e) {
          console.warn('Error ending response:', e.message);
        }
      }
    };

    // Handle client disconnect
    req.on('close', () => {
      console.log('🔌 Client disconnected from stream');
      cleanup();
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

    // Call Shipable AI streaming endpoint with correct multipart/form-data format
    const payload = {
      sessionKey: sessionKey,
      messages: [
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      token: SHIPABLE_JWT_TOKEN,  // Include token in the payload
      stream: true
    };

    console.log('📦 Streaming payload prepared:');
    console.log('   Session key:', sessionKey);
    console.log('   Messages count:', payload.messages.length);
    console.log('   Message content length:', analysisPrompt.length);
    console.log('   Stream enabled:', payload.stream);
    console.log('   Using JWT token:', SHIPABLE_JWT_TOKEN ? `${SHIPABLE_JWT_TOKEN.substring(0, 20)}...` : 'MISSING');

    // Use proper FormData API for correct multipart/form-data formatting
    const { FormData } = await import('formdata-node');
    const formData = new FormData();
    formData.append('request', JSON.stringify(payload));

    console.log('🔄 Calling Shipable API:', `${SHIPABLE_API_BASE}/chat/open-playground`);
    console.log('📦 Using FormData API for multipart/form-data');
    console.log('📦 Complete payload object:', JSON.stringify(payload, null, 2));

    let response;
    try {
      response = await fetch(`${SHIPABLE_API_BASE}/chat/open-playground`, {
        method: 'POST',
        headers: {
          // Don't set Content-Type - FormData sets it automatically with correct boundary
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        body: formData
      });
    } catch (fetchError) {

      console.error('❌ Shipable API fetch error:', fetchError);
      throw new Error(`Failed to connect to analysis service: ${fetchError.message}`);
    }

    console.log('📡 Shipable API response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Shipable API error response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText
      });

      // Send error message to client and implement fallback
      res.write(`data: ${JSON.stringify({ 
        body: `❌ **Analysis Service Error**\n\nReceived ${response.status} error from AI service.\n\n**Fallback Analysis:**\n\nYour contract appears to be a ${sessionData.language} smart contract. Here are some general security considerations:\n\n- **Access Control**: Ensure proper role-based access controls\n- **Input Validation**: Validate all external inputs\n- **Reentrancy Protection**: Use appropriate guards for state changes\n- **Integer Overflow**: Check for arithmetic vulnerabilities\n\nFor detailed analysis, please try again or contact support.`
      })}\n\n`);

      cleanup();
      res.write('data: [DONE]\n\n');
      return;
    }

    if (!response.body) {
      console.error('❌ No response body from Shipable API');
      throw new Error('No response body from Shipable API');
    }

    console.log('✅ Starting to stream response...');
    const streamStartTime = Date.now();

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          const streamDuration = Date.now() - streamStartTime;
          console.log('✅ Streaming completed:', {
            duration: `${streamDuration}ms`,
            chunks: chunkCount,
            totalBytes: `${totalBytes} bytes`
          });
          break;
        }

        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        totalBytes += chunk.length;

        if (chunkCount % 10 === 0) {
          console.log(`📊 Streaming progress: ${chunkCount} chunks, ${totalBytes} bytes`);
        }

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
                console.warn('⚠️ Error parsing streaming data:', parseError.message, 'Data preview:', data.substring(0, 100));
                // If parsing fails, try to forward the raw data
                if (data && data.length > 0) {
                  res.write(`data: ${JSON.stringify({ body: data })}\n\n`);
                }
              }
            } else if (data === '[DONE]') {
              console.log('🏁 Received [DONE] signal');
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }
          }
        }
      }
    } catch (streamError) {
      console.error('❌ Streaming read error:', {
        error: streamError.message,
        stack: streamError.stack,
        chunks: chunkCount,
        bytes: totalBytes
      });
      throw streamError;
    }

    // Send completion signal
    if (!res.destroyed) {
      res.write('data: [DONE]\n\n');
      cleanup();
    }

    // Mark session as completed
    const completedSession = sessions.get(sessionKey);
    if (completedSession) {
      completedSession.completed = true;
      completedSession.completedAt = new Date().toISOString();
      console.log('✅ Session completed successfully:', sessionKey);
    }

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('❌ Streaming endpoint error:', {
      sessionKey: req.params.sessionKey,
      error: error.message,
      stack: error.stack,
      duration: `${totalDuration}ms`,
      shipableConfigured: !!SHIPABLE_JWT_TOKEN,
      timestamp: new Date().toISOString()
    });

    // Try to refund credits if streaming fails after session creation
    const failedSession = sessions.get(sessionKey);
    if (failedSession && failedSession.userId && failedSession.scanCost && !failedSession.completed) {
      console.log('🔄 Attempting to refund credits due to streaming failure...');
      try {
        // Use same column check logic as in analyze endpoint
        const tableCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'credits_updated_at'
        `);

        const hasUpdatedAtColumn = tableCheck.rows.length > 0;

        let refundResult;
        if (hasUpdatedAtColumn) {
          refundResult = await pool.query(`
            UPDATE users 
            SET credits_balance = credits_balance + $1,
                credits_updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING credits_balance
          `, [failedSession.scanCost, failedSession.userId]);
        } else {
          refundResult = await pool.query(`
            UPDATE users 
            SET credits_balance = credits_balance + $1
            WHERE id = $2
            RETURNING credits_balance
          `, [failedSession.scanCost, failedSession.userId]);
        }

        if (refundResult.rows.length > 0) {
          console.log('✅ Credits refunded for streaming failure. New balance:', refundResult.rows[0].credits_balance);
        }
      } catch (refundError) {
        console.error('❌ Failed to refund credits for streaming failure:', refundError);
      }
    }

    if (!res.headersSent) {
      // Headers not sent yet, we can send JSON error
      res.status(502).json({
        success: false,
        error: 'Analysis streaming failed. Credits have been refunded.',
        details: error.message,
        refunded: !!failedSession
      });
    } else if (!res.destroyed) {
      // Headers already sent, send SSE error message
      res.write(`data: ${JSON.stringify({ 
        body: `❌ **Analysis Failed**\n\n${error.message}\n\nCredits have been refunded. Please try again.`
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      cleanup();
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

// Main analyze endpoint supporting both direct code and file selection
app.post('/api/analyze', async (req, res) => {
  try {
    const { message, code, selectedFileIds } = req.body;
    
    // Authenticate user
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    const decodedUser = jwt.verify(token, JWT_TOKEN);
    
    let analysisCode = code;
    let combinedFilename = 'contract.sol';
    
    // If file selection mode, retrieve and combine file contents
    if (selectedFileIds && selectedFileIds.length > 0) {
      const fileContents = [];
      const filenames = [];
      
      for (const fileId of selectedFileIds) {
        const fileResult = await pool.query(`
          SELECT file_content, filename, original_name, language
          FROM contract_files 
          WHERE id = $1 AND user_id = $2 AND is_active = true
        `, [fileId, decodedUser.userId]);
        
        if (fileResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: `File not found: ${fileId}`
          });
        }
        
        const file = fileResult.rows[0];
        fileContents.push(`// === ${file.original_name} ===\n${file.file_content}\n`);
        filenames.push(file.original_name);
        
        // Update scan count
        await pool.query(`
          UPDATE contract_files 
          SET scan_count = scan_count + 1, last_scanned = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [fileId]);
      }
      
      analysisCode = fileContents.join('\n');
      combinedFilename = filenames.length > 1 
        ? `${filenames.length}_contracts_combined` 
        : filenames[0];
    }
    
    if (!analysisCode && !message) {
      return res.status(400).json({
        success: false,
        error: 'No code or file content provided for analysis'
      });
    }

    // Validate the contract code if provided
    if (analysisCode) {
      try {
        validateContractCode(analysisCode);
      } catch (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError.message
        });
      }
    }

    // Detect language from combined code
    const language = analysisCode ? detectContractLanguage(analysisCode, combinedFilename) : 'unknown';
    const lineCount = analysisCode ? analysisCode.split('\n').length : 0;

    // Generate session key
    const sessionKey = crypto.randomBytes(16).toString('hex');
    
    // Check user credits and tier
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [decodedUser.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];
    const tier = user.subscription_tier || 'free';
    
    // Calculate scan cost
    const scanCost = calculateScanCost(lineCount, tier);
    
    // Check credits
    const currentBalance = user.credits_balance || 0;
    if (currentBalance < scanCost) {
      return res.json({
        success: false,
        creditError: true,
        error: `Insufficient credits. Need ${scanCost} credits, but you have ${currentBalance} credits.`,
        scanCost,
        availableCredits: currentBalance,
        requiresUpgrade: true
      });
    }

    // Deduct credits
    try {
      const tableCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'credits_updated_at'
      `);
      
      const hasUpdatedAtColumn = tableCheck.rows.length > 0;
      
      let updateResult;
      if (hasUpdatedAtColumn) {
        updateResult = await pool.query(`
          UPDATE users 
          SET credits_balance = credits_balance - $1,
              api_calls_count = api_calls_count + 1,
              credits_updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND credits_balance >= $1
          RETURNING credits_balance
        `, [scanCost, decodedUser.userId]);
      } else {
        updateResult = await pool.query(`
          UPDATE users 
          SET credits_balance = credits_balance - $1,
              api_calls_count = api_calls_count + 1
          WHERE id = $2 AND credits_balance >= $1
          RETURNING credits_balance
        `, [scanCost, decodedUser.userId]);
      }
      
      if (updateResult.rows.length === 0) {
        return res.json({
          success: false,
          creditError: true,
          error: 'Insufficient credits for this analysis',
          scanCost,
          availableCredits: currentBalance
        });
      }
    } catch (creditError) {
      console.error('Credit deduction error:', creditError);
      return res.status(500).json({
        success: false,
        error: 'Failed to process payment'
      });
    }

    // Store session for streaming
    sessions.set(sessionKey, {
      userId: decodedUser.userId,
      code: analysisCode,
      filename: combinedFilename,
      language,
      lineCount,
      scanCost,
      creditsDeducted: scanCost,
      selectedFileIds: selectedFileIds || [],
      createdAt: new Date().toISOString()
    });

    console.log('✅ Analysis session created:', {
      sessionKey,
      userId: decodedUser.userId,
      language,
      lineCount,
      scanCost,
      filesSelected: selectedFileIds?.length || 0
    });

    res.json({
      success: true,
      sessionKey,
      language,
      lineCount,
      scanCost,
      creditInfo: {
        creditsDeducted: scanCost,
        creditsRemaining: updateResult.rows[0].credits_balance
      },
      filesAnalyzed: selectedFileIds?.length || 0
    });

  } catch (error) {
    console.error('Analyze endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Analysis failed'
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

// Multi-file upload endpoint
app.post('/api/files/upload', upload.array('contracts', 10), async (req, res) => {
  try {
    console.log('📤 POST /api/files/upload - Request received');
    
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('❌ No token in authorization header');
      return res.status(401).json({ success: false, error: 'Invalid token format' });
    }

    let decodedUser;
    try {
      // Try multiple JWT secrets for compatibility
      const possibleSecrets = [
        JWT_TOKEN,
        process.env.JWT_SECRET,
        process.env.SHIPABLE_JWT_TOKEN,
        process.env.VITE_SHIPABLE_JWT_TOKEN,
        'your-secret-key'
      ].filter(Boolean);

      let verified = false;
      for (const secret of possibleSecrets) {
        try {
          decodedUser = jwt.verify(token, secret);
          console.log('✅ JWT verified successfully with secret');
          verified = true;
          break;
        } catch (secretError) {
          console.log(`❌ JWT verification failed with secret: ${secretError.message}`);
          continue;
        }
      }

      if (!verified) {
        console.log('❌ All JWT verification attempts failed');
        return res.status(401).json({ success: false, error: 'Invalid token' });
      }
    } catch (jwtError) {
      console.error('❌ JWT verification error:', jwtError.message);
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    
    if (!req.files || req.files.length === 0) {
      console.log('❌ No files in request');
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    console.log(`📁 Processing ${req.files.length} files for user ${decodedUser.userId}`);

    const uploadedFiles = [];
    const errors = [];

    for (const file of req.files) {
      try {
        console.log(`📄 Processing file: ${file.originalname} (${file.size} bytes)`);
        const code = file.buffer.toString('utf8');
        const filename = file.originalname;
        const language = detectContractLanguage(code, filename);
        const checksum = crypto.createHash('sha256').update(code).digest('hex');
        
        console.log(`🔍 File details: language=${language}, checksum=${checksum.substring(0, 8)}...`);
        
        // Check for duplicates
        const existingFile = await pool.query(
          'SELECT id FROM contract_files WHERE user_id = $1 AND checksum = $2 AND is_active = true',
          [decodedUser.userId, checksum]
        );

        if (existingFile.rows.length > 0) {
          console.log(`⚠️ Duplicate file detected: ${filename}`);
          errors.push(`File ${filename} already exists`);
          continue;
        }

        // Validate the contract code
        console.log(`✅ Validating contract code for ${filename}`);
        validateContractCode(code);

        // Insert file into database
        console.log(`💾 Inserting ${filename} into database...`);
        const result = await pool.query(`
          INSERT INTO contract_files (
            user_id, filename, original_name, file_content, file_size, 
            language, file_type, checksum
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, filename, original_name, file_size, language, upload_date
        `, [
          decodedUser.userId,
          filename,
          filename,
          code,
          file.size,
          language,
          path.extname(filename).toLowerCase().slice(1),
          checksum
        ]);

        console.log(`✅ File inserted successfully: ID ${result.rows[0].id}`);
        uploadedFiles.push(result.rows[0]);
      } catch (fileError) {
        console.error(`❌ Error processing file ${file.originalname}:`, fileError.message);
        errors.push(`${file.originalname}: ${fileError.message}`);
      }
    }

    console.log(`📤 Upload complete: ${uploadedFiles.length} successful, ${errors.length} errors`);
    
    res.json({
      success: true,
      uploadedFiles,
      errors,
      message: `${uploadedFiles.length} files uploaded successfully`
    });

  } catch (error) {
    console.error('Multi-file upload error:', error);
    res.status(500).json({
      success: false,
      error: 'File upload failed'
    });
  }
});

// Get user's contract files
app.get('/api/files', async (req, res) => {
  try {
    console.log('📂 GET /api/files - Request received');
    
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('❌ No token in authorization header');
      return res.status(401).json({ success: false, error: 'Invalid token format' });
    }

    let decodedUser;
    try {
      // Try multiple JWT secrets for compatibility
      const possibleSecrets = [
        JWT_TOKEN,
        process.env.JWT_SECRET,
        process.env.SHIPABLE_JWT_TOKEN,
        process.env.VITE_SHIPABLE_JWT_TOKEN,
        'your-secret-key' // fallback for development
      ].filter(Boolean);
      
      let verificationError;
      for (const secret of possibleSecrets) {
        try {
          decodedUser = jwt.verify(token, secret);
          console.log('✅ Token verified for user:', decodedUser.userId, 'using secret:', secret.substring(0, 10) + '...');
          break;
        } catch (err) {
          verificationError = err;
          continue;
        }
      }
      
      if (!decodedUser) {
        console.log('❌ JWT verification failed with all secrets:', verificationError.message);
        console.log('Available environment variables:', Object.keys(process.env).filter(key => 
          key.includes('JWT') || key.includes('TOKEN') || key.includes('SECRET')
        ));
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid token',
          debug: process.env.NODE_ENV !== 'production' ? verificationError.message : undefined
        });
      }
      
    } catch (jwtError) {
      console.log('❌ JWT verification error:', jwtError.message);
      return res.status(401).json({ success: false, error: 'Token verification failed' });
    }

    // Check if contract_files table exists
    try {
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'contract_files'
        );
      `);
      
      if (!tableExists.rows[0].exists) {
        console.log('❌ contract_files table does not exist');
        return res.json({
          success: true,
          files: [], // Return empty array if table doesn't exist yet
          message: 'No files uploaded yet'
        });
      }
      
      console.log('✅ contract_files table exists');
    } catch (tableError) {
      console.error('❌ Error checking table existence:', tableError);
      return res.status(500).json({
        success: false,
        error: 'Database table check failed'
      });
    }

    // Query user files
    try {
      const files = await pool.query(`
        SELECT 
          id, filename, original_name, file_size, language, 
          upload_date, last_scanned, scan_count, tags, description
        FROM contract_files 
        WHERE user_id = $1 AND is_active = true 
        ORDER BY upload_date DESC
      `, [decodedUser.userId]);

      console.log(`✅ Retrieved ${files.rows.length} files for user ${decodedUser.userId}`);
      
      res.json({
        success: true,
        files: files.rows
      });

    } catch (queryError) {
      console.error('❌ Database query error:', queryError);
      res.status(500).json({
        success: false,
        error: 'Database query failed: ' + queryError.message
      });
    }

  } catch (error) {
    console.error('❌ Get files endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve files: ' + error.message
    });
  }
});

// Get specific file content for scanning
app.get('/api/files/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    const decodedUser = jwt.verify(token, JWT_TOKEN);
    const fileId = req.params.id;

    const file = await pool.query(`
      SELECT file_content, filename, language, original_name
      FROM contract_files 
      WHERE id = $1 AND user_id = $2 AND is_active = true
    `, [fileId, decodedUser.userId]);

    if (file.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    res.json({
      success: true,
      file: file.rows[0]
    });

  } catch (error) {
    console.error('Get file content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve file content'
    });
  }
});

// Delete contract file
app.delete('/api/files/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    const decodedUser = jwt.verify(token, JWT_TOKEN);
    const fileId = req.params.id;

    const result = await pool.query(`
      UPDATE contract_files 
      SET is_active = false 
      WHERE id = $1 AND user_id = $2
    `, [fileId, decodedUser.userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file'
    });
  }
});

// Update file metadata
app.patch('/api/files/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    const decodedUser = jwt.verify(token, JWT_TOKEN);
    const fileId = req.params.id;
    const { tags, description } = req.body;

    const result = await pool.query(`
      UPDATE contract_files 
      SET tags = $1, description = $2
      WHERE id = $3 AND user_id = $4 AND is_active = true
      RETURNING id, filename, tags, description
    `, [tags || [], description || '', fileId, decodedUser.userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    res.json({
      success: true,
      file: result.rows[0]
    });

  } catch (error) {
    console.error('Update file metadata error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update file metadata'
    });
  }
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
        'GET /api/languages',
        'POST /api/files/upload',
        'GET /api/files',
        'GET /api/files/:id',
        'DELETE /api/files/:id',
        'PATCH /api/files/:id'
      ]
    });
  }

  // Serve React app for all other routes
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Start server with database initialization
app.listen(PORT, async () => {
  console.log(`🚀 Smart Contract Auditor Backend`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🤖 AI Model: ${process.env.SHIPABLE_MODEL}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`📊 Rate Limiting: Disabled`);
  
  // Initialize database tables
  try {
    console.log('🔄 Initializing database tables...');
    await createTables();
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database tables:', error);
    console.error('Server will continue but file upload features may not work');
  }
  
  console.log(`⚡ Ready for contract analysis!`);
});
