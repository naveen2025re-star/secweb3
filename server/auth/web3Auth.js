import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { pool } from '../database.js';

// JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Lazy-load plan utilities with safe fallbacks
let planUtilsPromise = null;
const getPlanUtils = async () => {
  if (!planUtilsPromise) {
    planUtilsPromise = (async () => {
      try {
        const mod = await import('../planUtils.js');
        return mod;
      } catch (e) {
        console.warn('Plan utils unavailable, using fallbacks:', e.message);
        return {
          getUserPlan: async (userId) => {
            const { rows } = await pool.query(
              `SELECT u.*, 'free' AS plan_code, 'Free' AS plan_name,
                      100 AS credits_per_month, 50 AS credits_per_scan_limit, 5 AS files_per_scan_limit
               FROM users u WHERE id = $1`,
              [userId]
            );
            return rows[0] || null;
          }
        };
      }
    })();
  }
  return planUtilsPromise;
};

// Nonce
export const generateNonce = () => crypto.randomBytes(32).toString('hex');

// Create or get user
export const getOrCreateUser = async (walletAddress, ensName = null) => {
  const addr = walletAddress.toLowerCase();

  // Look up user
  const existing = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [addr]);
  if (existing.rows.length > 0) {
    const updated = await pool.query(
      `UPDATE users
       SET ens_name = $1, nonce = $2, updated_at = CURRENT_TIMESTAMP
       WHERE wallet_address = $3
       RETURNING *`,
      [ensName, generateNonce(), addr]
    );
    return updated.rows[0];
  }

  // Create new user; try to attach free plan if exists
  let planId = null;
  try {
    const freePlan = await pool.query('SELECT id, credits_per_month FROM plans WHERE code = $1', ['free']);
    if (freePlan.rows.length) {
      planId = freePlan.rows[0].id;
      const startingCredits = freePlan.rows[0].credits_per_month || 100;
      const inserted = await pool.query(
        `INSERT INTO users (wallet_address, ens_name, nonce, plan_id, credits_balance, plan_started_at, credits_reset_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [addr, ensName, generateNonce(), planId, startingCredits]
      );
      return inserted.rows[0];
    }
  } catch (e) {
    // continue to fallback
  }

  // Fallback without plan
  const inserted = await pool.query(
    `INSERT INTO users (wallet_address, ens_name, nonce, credits_balance)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [addr, ensName, generateNonce(), 100]
  );
  return inserted.rows[0];
};

export const getNonce = async (walletAddress) => {
  const user = await getOrCreateUser(walletAddress);
  return user.nonce;
};

// Verify signature and login
export const verifySignature = async (walletAddress, signature, message) => {
  const addr = walletAddress.toLowerCase();

  const { rows } = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [addr]);
  if (!rows.length) throw new Error('User not found');
  const user = rows[0];

  const expectedMessage = `Welcome to SecWeb3! Sign this message to authenticate: ${user.nonce}`;
  const normalize = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
  const candidates = new Set([
    expectedMessage,
    normalize(expectedMessage),
    user.nonce,
    normalize(user.nonce)
  ]);
  if (message) {
    candidates.add(message);
    candidates.add(normalize(message));
  }

  let recovered = null;
  for (const cand of candidates) {
    try {
      const r = ethers.utils.verifyMessage(cand, signature);
      if (r && r.toLowerCase() === addr) {
        recovered = r;
        break;
      }
    } catch {
      // try next
    }
  }
  if (!recovered) throw new Error('Signature verification failed');

  await pool.query(
    `UPDATE users SET last_login_at = CURRENT_TIMESTAMP, nonce = $1 WHERE wallet_address = $2`,
    [generateNonce(), addr]
  );

  // Create session (24h)
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO web3_sessions (user_id, wallet_address, signature, message, nonce, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user.id, addr, signature, message || expectedMessage, user.nonce, expires]
  );

  // Attach plan info
  let planInfo;
  try {
    const utils = await getPlanUtils();
    planInfo = await utils.getUserPlan(user.id);
  } catch {
    planInfo = { plan_code: 'free', plan_name: 'Free', credits_per_month: 100, credits_per_scan_limit: 50, files_per_scan_limit: 5, features: [] };
  }

  const token = jwt.sign(
    {
      userId: user.id,
      walletAddress: user.wallet_address,
      ensName: user.ens_name,
      planCode: planInfo.plan_code,
      creditsBalance: user.credits_balance || 100
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    user: {
      id: user.id,
      walletAddress: user.wallet_address,
      ensName: user.ens_name,
      plan: {
        code: planInfo.plan_code,
        name: planInfo.plan_name,
        creditsPerMonth: planInfo.credits_per_month,
        creditsPerScanLimit: planInfo.credits_per_scan_limit,
        filesPerScanLimit: planInfo.files_per_scan_limit,
        features: planInfo.features
      },
      creditsBalance: user.credits_balance || 100
    },
    token
  };
};

// JWT middleware
export const authenticateWeb3Token = async (req, res, next) => {
  try {
    const hdr = req.headers['authorization'];
    const token = hdr && hdr.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    const decoded = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT id, wallet_address, ens_name, credits_balance
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (!rows.length) return res.status(401).json({ error: 'Invalid token' });

    req.user = rows[0];
    next();
  } catch (e) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Simple API call limiter (existing behavior)
export const checkWeb3ApiLimit = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Optional: adapt to your schema if api_calls_* columns exist
    try {
      await pool.query('UPDATE users SET api_calls_count = COALESCE(api_calls_count, 0) + 1 WHERE id = $1', [user.id]);
    } catch {
      // Column may not exist; ignore
    }
    next();
  } catch (e) {
    console.error('API limit check error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};
