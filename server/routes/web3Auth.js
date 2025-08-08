import express from 'express';
import { getNonce, verifySignature, authenticateWeb3Token } from '../web3Auth.js';
import { pool } from '../database.js';

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

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ 
        error: 'Wallet address, signature, and message are required' 
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

// Get user profile
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

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
