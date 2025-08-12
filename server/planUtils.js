import { pool } from './database.js';

// Language complexity multipliers
const LANGUAGE_MULTIPLIERS = {
  '.sol': 1.0,    // Solidity - baseline
  '.vy': 1.2,     // Vyper - slightly more complex
  '.move': 1.5,   // Move - more complex
  '.cairo': 1.8   // Cairo - most complex
};

// Get language multiplier from filename
export const getLanguageMultiplier = (filename) => {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return LANGUAGE_MULTIPLIERS[extension] || 1.0;
};

// Calculate scan cost with complexity multipliers
export const computeScanCost = ({ files = [], totalBytes = 0 }) => {
  if (!Array.isArray(files) || files.length === 0) {
    return Math.ceil((Number(totalBytes) || 0) / 1024);
  }

  let totalCost = 0;
  let totalFileMultiplier = 0;

  for (const file of files) {
    const multiplier = getLanguageMultiplier(file.name || '');
    const fileSize = file.size || Buffer.byteLength(file.content || file.contentBase64 || '', 'utf8');

    // Size-based cost
    const sizeCost = Math.max(1, Math.ceil(fileSize / 1024)) * multiplier;

    // File count cost
    const fileCost = 2 * multiplier;

    totalCost += Math.max(sizeCost, fileCost);
    totalFileMultiplier += multiplier;
  }

  // Ensure minimum cost
  return Math.max(1, Math.ceil(totalCost));
};

// Get all active plans
export const getActivePlans = async () => {
  const result = await pool.query(
    'SELECT * FROM plans WHERE is_active = true ORDER BY price_cents ASC'
  );
  return result.rows;
};

// Get plan by code
export const getPlanByCode = async (code) => {
  const result = await pool.query(
    'SELECT * FROM plans WHERE code = $1 AND is_active = true',
    [code]
  );
  return result.rows[0] || null;
};

// Get user's current plan with details
export const getUserPlan = async (userId) => {
  const result = await pool.query(`
    SELECT u.*, p.code as plan_code, p.name as plan_name, p.description as plan_description,
           p.credits_per_month, p.credits_per_scan_limit, p.files_per_scan_limit,
           p.price_cents, p.features
    FROM users u
    LEFT JOIN plans p ON u.plan_id = p.id
    WHERE u.id = $1
  `, [userId]);

  return result.rows[0] || null;
};

// Check if user needs credit reset (monthly for pro/custom)
export const checkAndResetMonthlyCredits = async (userId) => {
  const user = await getUserPlan(userId);
  if (!user) return false;

  const now = new Date();
  const lastReset = new Date(user.credits_reset_at);
  const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

  // Reset credits if it's been 30+ days and user is on pro/custom plan
  if (daysSinceReset >= 30 && ['pro', 'custom'].includes(user.plan_code)) {
    await pool.query(`
      UPDATE users 
      SET credits_balance = $1, 
          credits_reset_at = CURRENT_TIMESTAMP,
          credits_updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [user.credits_per_month, userId]);

    return true;
  }

  return false;
};

// Validate scan against plan limits
export const validateScanAgainstPlan = (scanCost, fileCount, userPlan) => {
  const errors = [];

  if (scanCost > userPlan.credits_per_scan_limit) {
    errors.push({
      type: 'SCAN_COST_EXCEEDED',
      message: `This scan requires ${scanCost} credits but your ${userPlan.plan_name} plan allows up to ${userPlan.credits_per_scan_limit} credits per scan.`,
      details: { required: scanCost, limit: userPlan.credits_per_scan_limit }
    });
  }

  if (fileCount > userPlan.files_per_scan_limit) {
    errors.push({
      type: 'FILE_COUNT_EXCEEDED', 
      message: `This scan includes ${fileCount} files but your ${userPlan.plan_name} plan allows up to ${userPlan.files_per_scan_limit} files per scan.`,
      details: { provided: fileCount, limit: userPlan.files_per_scan_limit }
    });
  }

  if (userPlan.credits_balance < scanCost) {
    errors.push({
      type: 'INSUFFICIENT_CREDITS',
      message: `You need ${scanCost} credits but only have ${userPlan.credits_balance} remaining.`,
      details: { required: scanCost, available: userPlan.credits_balance }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Create upgrade request
export const createUpgradeRequest = async (userId, requestData) => {
  const {
    requestedPlanCode,
    companyName,
    contactEmail,
    contactPhone,
    useCase,
    expectedMonthlyScans,
    specialRequirements
  } = requestData;

  const result = await pool.query(`
    INSERT INTO upgrade_requests 
    (user_id, requested_plan_code, company_name, contact_email, contact_phone, 
     use_case, expected_monthly_scans, special_requirements)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [userId, requestedPlanCode, companyName, contactEmail, contactPhone, 
      useCase, expectedMonthlyScans, specialRequirements]);

  return result.rows[0];
};

// Get upgrade requests for user
export const getUserUpgradeRequests = async (userId) => {
  const result = await pool.query(`
    SELECT ur.*, p.name as plan_name, p.price_cents
    FROM upgrade_requests ur
    LEFT JOIN plans p ON ur.requested_plan_code = p.code
    WHERE ur.user_id = $1
    ORDER BY ur.created_at DESC
  `, [userId]);

  return result.rows;
};
