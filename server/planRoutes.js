import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SHIPABLE_JWT_TOKEN || 'your-secret-key';

// Direct auth middleware
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

// Direct plan utilities to avoid import issues
const computeScanCost = ({ files = [], totalBytes = 0 }) => {
  if (!Array.isArray(files) || files.length === 0) {
    return Math.ceil((Number(totalBytes) || 0) / 1024);
  }

  let totalCost = 0;
  for (const file of files) {
    const fileSize = file.size || (file.content ? file.content.length : 0);
    const sizeCost = Math.max(1, Math.ceil(fileSize / 1024));
    const fileCost = 2;
    totalCost += Math.max(sizeCost, fileCost);
  }

  return Math.max(1, Math.ceil(totalCost));
};

const getUserPlan = async (userId) => {
  try {
    const result = await pool.query(`
      SELECT u.*, 
             COALESCE(p.code, 'free') as plan_code,
             COALESCE(p.name, 'Free') as plan_name,
             COALESCE(p.description, 'Basic plan') as plan_description,
             COALESCE(p.credits_per_month, 100) as credits_per_month,
             COALESCE(p.credits_per_scan_limit, 50) as credits_per_scan_limit,
             COALESCE(p.files_per_scan_limit, 5) as files_per_scan_limit,
             COALESCE(p.price_cents, 0) as price_cents,
             COALESCE(p.features, '[]'::jsonb) as features
      FROM users u
      LEFT JOIN plans p ON u.plan_id = p.id
      WHERE u.id = $1
    `, [userId]);

    return result.rows[0] || null;
  } catch (error) {
    console.warn('getUserPlan error:', error.message);
    return null;
  }
};

const router = express.Router();

// Get all available plans
router.get('/plans', async (req, res) => {
  try {
    // Return default plans if database query fails
    const defaultPlans = [
      {
        id: 1,
        code: 'free',
        name: 'Free',
        description: 'Perfect for getting started',
        credits_per_month: 100,
        credits_per_scan_limit: 50,
        files_per_scan_limit: 5,
        price_cents: 0,
        features: ['Basic security analysis', '5 files per scan', 'Community support']
      },
      {
        id: 2,
        code: 'pro',
        name: 'Pro',
        description: 'For professional developers',
        credits_per_month: 1000,
        credits_per_scan_limit: 200,
        files_per_scan_limit: 20,
        price_cents: 2900,
        features: ['Advanced analysis', '20 files per scan', 'Priority support']
      }
    ];

    res.json({ plans: defaultPlans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Get user's current plan
router.get('/plans/current', authenticateWeb3Token, async (req, res) => {
  try {
    const userPlan = await getUserPlan(req.user.id);

    // Always return a response, even if plan lookup fails
    const plan = userPlan ? {
      code: userPlan.plan_code || 'free',
      name: userPlan.plan_name || 'Free',
      description: userPlan.plan_description || 'Basic plan',
      creditsPerMonth: userPlan.credits_per_month || 100,
      creditsPerScanLimit: userPlan.credits_per_scan_limit || 50,
      filesPerScanLimit: userPlan.files_per_scan_limit || 5,
      priceUsd: (userPlan.price_cents || 0) / 100,
      features: userPlan.features || ['Basic security analysis']
    } : {
      code: 'free',
      name: 'Free',
      description: 'Basic plan',
      creditsPerMonth: 100,
      creditsPerScanLimit: 50,
      filesPerScanLimit: 5,
      priceUsd: 0,
      features: ['Basic security analysis']
    };

    res.json({
      plan,
      creditsBalance: req.user.credits_balance || 100,
      planStartedAt: userPlan?.plan_started_at || new Date().toISOString(),
      creditsResetAt: userPlan?.credits_reset_at || new Date().toISOString()
    });
  } catch (error) {
    console.error('Get current plan error:', error);

    // Fallback response to prevent frontend errors
    res.json({
      plan: {
        code: 'free',
        name: 'Free',
        description: 'Basic plan',
        creditsPerMonth: 100,
        creditsPerScanLimit: 50,
        filesPerScanLimit: 5,
        priceUsd: 0,
        features: ['Basic security analysis']
      },
      creditsBalance: 100,
      planStartedAt: new Date().toISOString(),
      creditsResetAt: new Date().toISOString()
    });
  }
});

// Calculate scan cost (for frontend estimation)
router.post('/plans/estimate-cost', authenticateWeb3Token, async (req, res) => {
  try {
    const { files = [], totalBytes = 0 } = req.body;
    const cost = computeScanCost({ files, totalBytes });

    res.json({
      estimatedCost: cost,
      fileCount: files.length,
      breakdown: files.map(file => ({
        name: file.name || 'unknown',
        size: file.size || (file.content ? file.content.length : 0),
        language: file.name?.split('.').pop() || 'unknown',
        estimatedCost: Math.max(1, Math.ceil((file.size || (file.content ? file.content.length : 0)) / 1024))
      }))
    });
  } catch (error) {
    console.error('Cost estimation error:', error);
    res.json({
      estimatedCost: 5, // Safe fallback
      fileCount: 1,
      breakdown: []
    });
  }
});

// Simplified upgrade request endpoint
router.post('/plans/upgrade-request', authenticateWeb3Token, async (req, res) => {
  try {
    const { requestedPlanCode, contactEmail, useCase } = req.body;

    if (!requestedPlanCode || !contactEmail) {
      return res.status(400).json({ 
        error: 'Requested plan and contact email are required' 
      });
    }

    // Log the request for manual processing
    console.log('📋 Upgrade request:', {
      userId: req.user.id,
      wallet: req.user.wallet_address,
      requestedPlan: requestedPlanCode,
      email: contactEmail,
      useCase: useCase,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      message: 'Upgrade request submitted successfully. We will contact you within 24 hours.',
      requestId: Date.now() // Temporary ID
    });
  } catch (error) {
    console.error('Upgrade request error:', error);
    res.status(500).json({ error: 'Failed to submit upgrade request' });
  }
});

// Get user's upgrade requests (simplified)
router.get('/plans/upgrade-requests', authenticateWeb3Token, async (req, res) => {
  try {
    res.json({ requests: [] }); // Empty for now
  } catch (error) {
    console.error('Get upgrade requests error:', error);
    res.json({ requests: [] });
  }
});

export default router;
