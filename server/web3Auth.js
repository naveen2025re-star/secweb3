import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { pool } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate a random nonce for signature verification
export const generateNonce = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Create or get user by wallet address
export const getOrCreateUser = async (walletAddress, ensName = null) => {
  try {
    // Check if user exists
    let result = await pool.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [walletAddress.toLowerCase()]
    );

    if (result.rows.length > 0) {
      // Update existing user
      const updateResult = await pool.query(
        `UPDATE users 
         SET ens_name = $1, nonce = $2, updated_at = CURRENT_TIMESTAMP
         WHERE wallet_address = $3
         RETURNING *`,
        [ensName, generateNonce(), walletAddress.toLowerCase()]
      );
      return updateResult.rows[0];
    } else {
      // Create new user
      const insertResult = await pool.query(
        `INSERT INTO users (wallet_address, ens_name, nonce) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [walletAddress.toLowerCase(), ensName, generateNonce()]
      );
      return insertResult.rows[0];
    }
  } catch (error) {
    throw error;
  }
};

// Get nonce for wallet address
export const getNonce = async (walletAddress) => {
  try {
    const user = await getOrCreateUser(walletAddress);
    return user.nonce;
  } catch (error) {
    throw error;
  }
};

// Verify signature and authenticate user
export const verifySignature = async (walletAddress, signature, message) => {
  try {
    // Get user and verify nonce
    const result = await pool.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [walletAddress.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];

    // Build a set of possible message variants to account for minor front-end differences
    const expectedMessage = `Welcome to SecWeb3! Sign this message to authenticate: ${user.nonce}`;
    const normalize = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
    const candidates = new Set([
      expectedMessage,
      normalize(expectedMessage),
      user.nonce, // some wallets sign only the nonce
      normalize(user.nonce)
    ]);

    if (message) {
      candidates.add(message);
      candidates.add(normalize(message));
    }

    // Try to recover the address using any of the candidate messages
    let recoveredAddress = null;
    for (const candidate of candidates) {
      try {
        const addr = ethers.utils.verifyMessage(candidate, signature);
        if (addr && addr.toLowerCase() === walletAddress.toLowerCase()) {
          recoveredAddress = addr;
          break;
        }
      } catch (e) {
        // ignore and try the next candidate
      }
    }

    if (!recoveredAddress) {
      throw new Error('Signature verification failed');
    }

    // Update user's last login and generate new nonce
    await pool.query(
      `UPDATE users 
       SET last_login_at = CURRENT_TIMESTAMP, nonce = $1
       WHERE wallet_address = $2`,
      [generateNonce(), walletAddress.toLowerCase()]
    );

    // Create Web3 session
    const sessionExpiry = new Date();
    sessionExpiry.setHours(sessionExpiry.getHours() + 24); // 24 hours

    await pool.query(
      `INSERT INTO web3_sessions (user_id, wallet_address, signature, message, nonce, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, walletAddress.toLowerCase(), signature, message || expectedMessage, user.nonce, sessionExpiry]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        walletAddress: user.wallet_address,
        ensName: user.ens_name 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        ensName: user.ens_name,
        subscriptionTier: user.subscription_tier,
        apiCallsCount: user.api_calls_count,
        apiCallsLimit: user.api_calls_limit
      },
      token
    };
  } catch (error) {
    throw error;
  }
};

// JWT middleware for Web3 auth
export const authenticateWeb3Token = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from database
    const result = await pool.query(
      `SELECT id, wallet_address, ens_name, subscription_tier, 
              api_calls_count, api_calls_limit 
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Rate limiting for Web3 users
export const checkWeb3ApiLimit = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.api_calls_count >= user.api_calls_limit) {
      return res.status(429).json({
        error: 'API limit exceeded',
        limit: user.api_calls_limit,
        used: user.api_calls_count,
        message: 'Upgrade your subscription for more API calls'
      });
    }

    // Increment API call count
    await pool.query(
      'UPDATE users SET api_calls_count = api_calls_count + 1 WHERE id = $1',
      [user.id]
    );

    next();
  } catch (error) {
    console.error('API limit check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
