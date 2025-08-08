import express from 'express';
import { authenticateWeb3Token } from '../web3Auth.js';
import { pool } from '../database.js';

const router = express.Router();

// Get user conversations
router.get('/', authenticateWeb3Token, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(m.id) as message_count
       FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE c.user_id = $1 AND c.is_archived = false
       GROUP BY c.id
       ORDER BY c.updated_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json({
      success: true,
      conversations: result.rows
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Create new conversation
router.post('/', authenticateWeb3Token, async (req, res) => {
  try {
    const { title, messages = [] } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Conversation title is required' });
    }

    // Create conversation
    const convResult = await pool.query(
      `INSERT INTO conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING *`,
      [req.user.id, title]
    );

    const conversation = convResult.rows[0];

    // Add messages if provided
    if (messages.length > 0) {
      for (const message of messages) {
        await pool.query(
          `INSERT INTO messages (conversation_id, role, content, metadata)
           VALUES ($1, $2, $3, $4)`,
          [conversation.id, message.role, message.content, message.metadata || {}]
        );
      }
    }

    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get conversation with messages
router.get('/:id', authenticateWeb3Token, async (req, res) => {
  try {
    const { id } = req.params;

    // Get conversation
    const convResult = await pool.query(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get messages
    const messagesResult = await pool.query(
      `SELECT * FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      conversation: {
        ...convResult.rows[0],
        messages: messagesResult.rows
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Add message to conversation
router.post('/:id/messages', authenticateWeb3Token, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, content, metadata = {} } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }

    // Verify conversation ownership
    const convResult = await pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Add message
    const messageResult = await pool.query(
      `INSERT INTO messages (conversation_id, role, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, role, content, metadata]
    );

    // Update conversation timestamp
    await pool.query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: messageResult.rows[0]
    });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Delete conversation
router.delete('/:id', authenticateWeb3Token, async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete (archive) the conversation
    const result = await pool.query(
      `UPDATE conversations 
       SET is_archived = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      success: true,
      message: 'Conversation archived successfully'
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
