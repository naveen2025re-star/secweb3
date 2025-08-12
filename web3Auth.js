import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { pool } from './server/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Plan utilities with dynamic import and fallbacks
let planUtilities = null;

const getPlanUtils = async () => {
  if (!planUtilities) {
    try {
      planUtilities = await import('./server/planUtils.js');
      console.log('✅ Plan utilities loaded successfully');
    } catch (error) {
      console.warn('⚠️ Plan utilities not available:', error.message);
      planUtilities = {
        getUserPlan: async (userId) => ({ 
          plan_code: 'free', 
          plan_name: 'Free', 
          credits_per_scan_limit: 50, 
          files_per_scan_limit: 5,
          credits_balance: 100 
        }),
        checkAndResetMonthlyCredits: async () => false,
        validateScanAgainstPlan: () => ({ isValid: true, errors: [] }),
        computeScanCost: ({ totalBytes = 0, fileCount = 0 }) => Math.max(Math.ceil(totalBytes / 1024), fileCount * 2),
        deductCredits: async (userId, amount) => 50 // Mock remaining balance
      };
    }
  }
  return planUtilities;
};
