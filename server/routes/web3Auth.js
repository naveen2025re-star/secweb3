import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { pool } from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SHIPABLE_JWT_TOKEN || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

// Direct implementation to bypass import issues
const generateNonce = () => crypto.randomBytes(32).toString('hex');

const getOrCreateUser = async (walletAddress, ensName = null) => {
  const addr = walletAddress.toLowerCase();

  // Check existing user
  let result = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [addr]);

  if (result.rows.length > 0) {
    const updated = await pool.query(
      'UPDATE users SET ens_name = $1, nonce = $2, updated_at = CURRENT_TIMESTAMP WHERE wallet_address = $3 RETURNING *',
      [ensName, generateNonce(), addr]
    );
    return updated.rows[0];
  }

  // Create new user
  const inserted = await pool.query(
    'INSERT INTO users (wallet_address, ens_name, nonce, credits_balance) VALUES ($1, $2, $3, $4) RETURNING *',
    [addr, ensName, generateNonce(), 100]
  );
  return inserted.rows[0];
};

const getNonce = async (walletAddress) => {
  const user = await getOrCreateUser(walletAddress);
  return user.nonce;
};

const verifySignature = async (walletAddress, signature, message) => {
  const addr = walletAddress.toLowerCase();
  const result = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [addr]);

  if (!result.rows.length) throw new Error('User not found');
  const user = result.rows[0];

  const expectedMessage = `Welcome to SecWeb3! Sign this message to authenticate: ${user.nonce}`;
  const candidates = [expectedMessage, user.nonce, message].filter(Boolean);

  let recovered = null;
  for (const candidate of candidates) {
    try {
      const r = ethers.utils.verifyMessage(candidate, signature);
      if (r && r.toLowerCase() === addr) {
        recovered = r;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!recovered) throw new Error('Signature verification failed');

  // Update user
  await pool.query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP, nonce = $1 WHERE wallet_address = $2',
    [generateNonce(), addr]
  );

  // Create session
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO web3_sessions (user_id, wallet_address, signature, message, nonce, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [user.id, addr, signature, message || expectedMessage, user.nonce, expires]
  );

  const token = jwt.sign(
    { userId: user.id, walletAddress: user.wallet_address, ensName: user.ens_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    user: {
      id: user.id,
      walletAddress: user.wallet_address,
      ensName: user.ens_name,
      creditsBalance: user.credits_balance || 100,
      plan: { code: 'free', name: 'Free', creditsPerScanLimit: 50, filesPerScanLimit: 5 }
    },
    token
  };
};

const authenticateWeb3Token = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const router = express.Router();

// Get nonce for wallet address
router.post('/nonce', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const nonce = await getNonce(walletAddress);

    res.json({
      success: true,
      nonce,
      message: `Welcome to SecWeb3! Sign this message to authenticate: ${nonce}`
    });
  } catch (error) {
    console.error('Nonce generation error:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

// Verify signature and login
router.post('/verify', async (req, res) => {
  try {
    const { walletAddress, signature, message, ensName } = req.body;

    if (!walletAddress || !signature) {
      return res.status(400).json({ 
        error: 'Wallet address and signature are required' 
      });
    }

    // Update ENS name if provided
    if (ensName) {
      await pool.query(
        'UPDATE users SET ens_name = $1 WHERE wallet_address = $2',
        [ensName, walletAddress.toLowerCase()]
      );
    }

    const result = await verifySignature(walletAddress, signature, message);

    res.json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Get user profile (camelCase response)
router.get('/profile', authenticateWeb3Token, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, wallet_address, ens_name, subscription_tier, 
              api_calls_count, api_calls_limit, created_at, last_login_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      user: {
        id: row.id,
        walletAddress: row.wallet_address,
        ensName: row.ens_name,
        subscriptionTier: row.subscription_tier,
        apiCallsCount: row.api_calls_count,
        apiCallsLimit: row.api_calls_limit,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile (display name -> ens_name)
router.put('/profile', authenticateWeb3Token, async (req, res) => {
  try {
    const { displayName } = req.body;

    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const result = await pool.query(
      `UPDATE users 
       SET ens_name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, wallet_address, ens_name, subscription_tier, api_calls_count, api_calls_limit, created_at, last_login_at`,
      [displayName.trim(), req.user.id]
    );

    const row = result.rows[0];
    res.json({
      success: true,
      user: {
        id: row.id,
        walletAddress: row.wallet_address,
        ensName: row.ens_name,
        subscriptionTier: row.subscription_tier,
        apiCallsCount: row.api_calls_count,
        apiCallsLimit: row.api_calls_limit,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Logout (invalidate session)
router.post('/logout', authenticateWeb3Token, async (req, res) => {
  try {
    // Remove active Web3 sessions
    await pool.query(
      'DELETE FROM web3_sessions WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
