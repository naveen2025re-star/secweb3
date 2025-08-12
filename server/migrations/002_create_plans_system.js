import { pool } from '../database.js';

const createPlansSystem = async () => {
  try {
    console.log('🔄 Creating plans system tables...');

    // Create plans table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        credits_per_month INTEGER NOT NULL DEFAULT 0,
        credits_per_scan_limit INTEGER NOT NULL DEFAULT 0,
        files_per_scan_limit INTEGER NOT NULL DEFAULT 0,
        price_cents INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        features JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default plans
    await pool.query(`
      INSERT INTO plans (code, name, description, credits_per_month, credits_per_scan_limit, files_per_scan_limit, price_cents, features) 
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8),
        ($9, $10, $11, $12, $13, $14, $15, $16),
        ($17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        credits_per_month = EXCLUDED.credits_per_month,
        credits_per_scan_limit = EXCLUDED.credits_per_scan_limit,
        files_per_scan_limit = EXCLUDED.files_per_scan_limit,
        price_cents = EXCLUDED.price_cents,
        features = EXCLUDED.features,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'free', 'Free', 'Perfect for getting started with basic contract analysis', 
      100, 50, 5, 0, JSON.stringify(["Basic security analysis", "5 files per scan", "Community support"]),
      'pro', 'Pro', 'For professional developers and teams',
      1000, 200, 20, 2900, JSON.stringify(["Advanced security analysis", "20 files per scan", "Priority support", "Detailed reports", "Monthly credits refresh"]),
      'custom', 'Custom', 'Enterprise solution with custom limits',
      5000, 1000, 100, 0, JSON.stringify(["Custom credit allocation", "100+ files per scan", "API access", "White-label options", "Dedicated support", "Custom integrations"])
    ]);

    // Update users table to reference plans
    await pool.query(`
      ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES plans(id),
        ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    // Set existing users to free plan
    await pool.query(`
      UPDATE users 
      SET plan_id = (SELECT id FROM plans WHERE code = 'free'),
          plan_started_at = CURRENT_TIMESTAMP,
          credits_reset_at = CURRENT_TIMESTAMP
      WHERE plan_id IS NULL
    `);

    // Create upgrade requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upgrade_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        requested_plan_code TEXT NOT NULL,
        company_name TEXT,
        contact_email TEXT NOT NULL,
        contact_phone TEXT,
        use_case TEXT,
        expected_monthly_scans INTEGER,
        special_requirements TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        reviewed_by INTEGER REFERENCES users(id)
      )
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_upgrade_requests_user_status 
      ON upgrade_requests(user_id, status)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status 
      ON upgrade_requests(status)
    `);

    console.log('✅ Plans system tables created successfully');
  } catch (error) {
    console.error('❌ Failed to create plans system:', error);
    throw error;
  }
};

export default createPlansSystem;
