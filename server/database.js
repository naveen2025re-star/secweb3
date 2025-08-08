import pg from 'pg';
const { Pool } = pg;

// Create pool only if DATABASE_URL is available
let pool = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    console.log('📦 PostgreSQL pool created successfully');
  } catch (error) {
    console.error('❌ Failed to create PostgreSQL pool:', error.message);
    pool = null;
  }
} else {
  console.log('⚠️ DATABASE_URL not found - running without database features');
}

// Test database connection
export const testConnection = async () => {
  if (!pool) {
    console.log('⚠️ Database pool not available');
    return false;
  }

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connected:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

export { pool };
