import express from 'express';
import { authenticateWeb3Token } from './web3Auth.js';
import { 
  getActivePlans, 
  getPlanByCode, 
  getUserPlan,
  createUpgradeRequest,
  getUserUpgradeRequests,
  computeScanCost 
} from './planUtils.js';

const router = express.Router();

// Get all available plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await getActivePlans();
    res.json({ plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Get user's current plan
router.get('/plans/current', authenticateWeb3Token, async (req, res) => {
  try {
    const userPlan = await getUserPlan(req.user.id);
    if (!userPlan) {
      return res.status(404).json({ error: 'User plan not found' });
    }

    res.json({
      plan: {
        code: userPlan.plan_code,
        name: userPlan.plan_name,
        description: userPlan.plan_description,
        creditsPerMonth: userPlan.credits_per_month,
        creditsPerScanLimit: userPlan.credits_per_scan_limit,
        filesPerScanLimit: userPlan.files_per_scan_limit,
        priceUsd: userPlan.price_cents / 100,
        features: userPlan.features
      },
      creditsBalance: userPlan.credits_balance,
      planStartedAt: userPlan.plan_started_at,
      creditsResetAt: userPlan.credits_reset_at
    });
  } catch (error) {
    console.error('Get current plan error:', error);
    res.status(500).json({ error: 'Failed to fetch current plan' });
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
        name: file.name,
        size: file.size || Buffer.byteLength(file.content || '', 'utf8'),
        language: file.name?.split('.').pop(),
        estimatedCost: computeScanCost({ files: [file] })
      }))
    });
  } catch (error) {
    console.error('Cost estimation error:', error);
    res.status(500).json({ error: 'Failed to estimate cost' });
  }
});

// Submit upgrade request
router.post('/plans/upgrade-request', authenticateWeb3Token, async (req, res) => {
  try {
    const {
      requestedPlanCode,
      companyName,
      contactEmail,
      contactPhone,
      useCase,
      expectedMonthlyScans,
      specialRequirements
    } = req.body;

    // Validate required fields
    if (!requestedPlanCode || !contactEmail) {
      return res.status(400).json({ 
        error: 'Requested plan and contact email are required' 
      });
    }

    // Validate plan exists
    const plan = await getPlanByCode(requestedPlanCode);
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan code' });
    }

    // Only allow upgrade requests for pro and custom plans
    if (!['pro', 'custom'].includes(requestedPlanCode)) {
      return res.status(400).json({ 
        error: 'Upgrade requests are only available for Pro and Custom plans' 
      });
    }

    const upgradeRequest = await createUpgradeRequest(req.user.id, {
      requestedPlanCode,
      companyName,
      contactEmail,
      contactPhone,
      useCase,
      expectedMonthlyScans: parseInt(expectedMonthlyScans) || null,
      specialRequirements
    });

    res.json({ 
      message: 'Upgrade request submitted successfully. We will contact you within 24 hours.',
      requestId: upgradeRequest.id 
    });
  } catch (error) {
    console.error('Upgrade request error:', error);
    res.status(500).json({ error: 'Failed to submit upgrade request' });
  }
});

// Get user's upgrade requests
router.get('/plans/upgrade-requests', authenticateWeb3Token, async (req, res) => {
  try {
    const requests = await getUserUpgradeRequests(req.user.id);
    res.json({ requests });
  } catch (error) {
    console.error('Get upgrade requests error:', error);
    res.status(500).json({ error: 'Failed to fetch upgrade requests' });
  }
});

export default router;
