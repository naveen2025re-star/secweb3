import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { pool } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Import plan utilities - these will be available after planUtils.js is created
let getUserPlan, checkAndResetMonthlyCredits, validateScanAgainstPlan, computeScanCost;
try {
  const planUtils = await import('./planUtils.js');
  getUserPlan = planUtils.getUserPlan;
  checkAndResetMonthlyCredits = planUtils.checkAndResetMonthlyCredits;
  validateScanAgainstPlan = planUtils.validateScanAgainstPlan;
  computeScanCost = planUtils.computeScanCost;
} catch (error) {
  console.warn('Plan utilities not available yet:', error.message);
  // Fallback functions for backward compatibility
  getUserPlan = async (userId) => ({ 
    plan_code: 'free', 
    plan_name: 'Free', 
    credits_per_scan_limit: 50, 
    files_per_scan_limit: 5,
    credits_balance: 100 
  });
  checkAndResetMonthlyCredits = async () => false;
  validateScanAgainstPlan = () => ({ isValid: true, errors: [] });
  computeScanCost = ({ totalBytes = 0, fileCount = 0 }) => Math.max(Math.ceil(totalBytes / 1024), fileCount * 2);
}
