import { pool } from '../database.js';

const createTables = async () => {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL not found - skipping table creation');
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Users table with Web3 wallet addresses
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address VARCHAR(42) UNIQUE NOT NULL,
        ens_name VARCHAR(255),
        nonce VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        subscription_tier VARCHAR(50) DEFAULT 'free',
        api_calls_count INTEGER DEFAULT 0,
        api_calls_limit INTEGER DEFAULT 100
      )
    `);

    // Conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_archived BOOLEAN DEFAULT false
      )
    `);

    // Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Analysis sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS analysis_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        shipable_session_key VARCHAR(255),
        shipable_session_id VARCHAR(255),
        contract_code TEXT,
        filename VARCHAR(255),
        language VARCHAR(50),
        line_count INTEGER,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    // Web3 session tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS web3_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        wallet_address VARCHAR(42) NOT NULL,
        signature VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        nonce VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Contract files table for multi-file upload and management
    await client.query(`
      CREATE TABLE IF NOT EXISTS contract_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_content TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        language VARCHAR(50),
        file_type VARCHAR(10) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_scanned TIMESTAMP,
        scan_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        tags TEXT[],
        description TEXT
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_web3_sessions_wallet_address ON web3_sessions(wallet_address)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_contract_files_user_id ON contract_files(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_contract_files_checksum ON contract_files(checksum)');

    await client.query('COMMIT');
    console.log('✅ Database tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default createTables;
