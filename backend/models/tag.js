const pool = require('../config/database');

const Tag = {
  /**
   * Create a new tag
   * @param {Object} tagData - Tag data
   * @param {string} tagData.name - Tag name
   * @param {string} tagData.description - Tag description (optional)
   * @param {number} tagData.created_by - User ID who created the tag
   * @param {boolean} autoApprove - Whether to auto-approve the tag (for admins)
   * @returns {Promise<Object>} Created tag
   */
  async create({ name, description, created_by }, autoApprove = false) {
    const status = autoApprove ? 'approved' : 'pending';
    const approved_at = autoApprove ? new Date() : null;
    const approved_by = autoApprove ? created_by : null;

    const res = await pool.query(
      `INSERT INTO tags (name, description, status, created_by, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name.toLowerCase().trim(), description, status, created_by, approved_by, approved_at]
    );
    return res.rows[0];
  },

  /**
   * Find tag by name
   * @param {string} name - Tag name
   * @returns {Promise<Object|null>} Tag or null if not found
   */
  async findByName(name) {
    try {
      // Check if tags table exists
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'tags'
      `);
      
      if (tableCheck.rows.length === 0) {
        // Tags table doesn't exist, return null
        return null;
      }
      
      const res = await pool.query(
        'SELECT * FROM tags WHERE name = $1',
        [name.toLowerCase().trim()]
      );
      return res.rows[0] || null;
    } catch (error) {
      console.error('Error in Tag.findByName:', error.message);
      // Return null if table doesn't exist or query fails
      return null;
    }
  },

  /**
   * Find tag by ID
   * @param {number} id - Tag ID
   * @returns {Promise<Object|null>} Tag or null if not found
   */
  async findById(id) {
    try {
      // Check if tags table exists
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'tags'
      `);
      
      if (tableCheck.rows.length === 0) {
        // Tags table doesn't exist, return null
        return null;
      }
      
      const res = await pool.query('SELECT * FROM tags WHERE id = $1', [id]);
      return res.rows[0] || null;
    } catch (error) {
      console.error('Error in Tag.findById:', error.message);
      // Return null if table doesn't exist or query fails
      return null;
    }
  },

  /**
   * Get all approved tags
   * @returns {Promise<Array>} Array of approved tags
   */
  async getApproved() {
    try {
      // Check if tags table exists
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'tags'
      `);
      
      if (tableCheck.rows.length === 0) {
        // Tags table doesn't exist, return empty array
        return [];
      }
      
      const res = await pool.query(
        'SELECT * FROM tags WHERE status = $1 ORDER BY name',
        ['approved']
      );
      return res.rows;
    } catch (error) {
      console.error('Error in Tag.getApproved:', error.message);
      // Return empty array if table doesn't exist or query fails
      return [];
    }
  },

  /**
   * Get all tags with optional filtering
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Filter by status
   * @param {string} filters.search - Search in name and description
   * @returns {Promise<Array>} Array of tags
   */
  async findAll(filters = {}) {
    try {
      // Check if tags table exists
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'tags'
      `);
      
      if (tableCheck.rows.length === 0) {
        // Tags table doesn't exist, return empty array
        return [];
      }
      
      let query = 'SELECT t.*, u.first_name, u.last_name FROM tags t LEFT JOIN users u ON t.created_by = u.id';
      const conditions = [];
      const values = [];
      let paramCount = 0;

      if (filters.status) {
        conditions.push(`t.status = $${++paramCount}`);
        values.push(filters.status);
      }

      if (filters.search) {
        conditions.push(`(t.name ILIKE $${++paramCount} OR t.description ILIKE $${++paramCount})`);
        values.push(`%${filters.search}%`, `%${filters.search}%`);
        paramCount++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY t.name';

      const res = await pool.query(query, values);
      return res.rows;
    } catch (error) {
      console.error('Error in Tag.findAll:', error.message);
      // Return empty array if table doesn't exist or query fails
      return [];
    }
  },

  /**
   * Get pending tags for admin approval
   * @returns {Promise<Array>} Array of pending tags
   */
  async getPending() {
    try {
      // Check if tags table exists
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'tags'
      `);
      
      if (tableCheck.rows.length === 0) {
        // Tags table doesn't exist, return empty array
        return [];
      }
      
      const res = await pool.query(
        `SELECT t.*, u.first_name, u.last_name 
         FROM tags t 
         JOIN users u ON t.created_by = u.id 
         WHERE t.status = 'pending' 
         ORDER BY t.created_at DESC`
      );
      return res.rows;
    } catch (error) {
      console.error('Error in Tag.getPending:', error.message);
      // Return empty array if table doesn't exist or query fails
      return [];
    }
  },

  /**
   * Approve a tag
   * @param {number} tagId - Tag ID
   * @param {number} approvedBy - User ID who approved the tag
   * @returns {Promise<Object>} Updated tag
   */
  async approve(tagId, approvedBy) {
    const res = await pool.query(
      `UPDATE tags 
       SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [approvedBy, tagId]
    );
    return res.rows[0];
  },

  /**
   * Reject a tag
   * @param {number} tagId - Tag ID
   * @param {number} rejectedBy - User ID who rejected the tag
   * @returns {Promise<Object>} Updated tag
   */
  async reject(tagId, rejectedBy) {
    const res = await pool.query(
      `UPDATE tags 
       SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [rejectedBy, tagId]
    );
    return res.rows[0];
  },

  /**
   * Delete a tag (only if not used by any artifacts)
   * @param {number} tagId - Tag ID
   * @returns {Promise<boolean>} True if deleted, false otherwise
   */
  async delete(tagId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if tag is used by any artifacts
      const usageRes = await client.query(
        'SELECT COUNT(*) as count FROM artifact_tags WHERE tag_id = $1',
        [tagId]
      );

      if (parseInt(usageRes.rows[0].count) > 0) {
        throw new Error('Cannot delete tag that is used by artifacts');
      }

      // Delete the tag
      const deleteRes = await client.query(
        'DELETE FROM tags WHERE id = $1 RETURNING id',
        [tagId]
      );

      await client.query('COMMIT');
      return deleteRes.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get or create tags from names array
   * @param {Array<string>} tagNames - Array of tag names
   * @param {number} userId - User ID for creating new tags
   * @param {boolean} autoApprove - Whether to auto-approve new tags
   * @returns {Promise<Array>} Array of tag objects
   */
  async getOrCreateTags(tagNames, userId, autoApprove = false) {
    const tags = [];
    
    for (const name of tagNames) {
      const trimmedName = name.toLowerCase().trim();
      if (!trimmedName) continue;

      // Try to find existing tag
      let tag = await this.findByName(trimmedName);
      
      if (!tag) {
        // Create new tag
        tag = await this.create({
          name: trimmedName,
          description: null,
          created_by: userId
        }, autoApprove);
      }

      // Only include approved tags in results
      if (tag.status === 'approved') {
        tags.push(tag);
      }
    }

    return tags;
  },

  /**
   * Get tags for an artifact
   * @param {number} artifactId - Artifact ID
   * @returns {Promise<Array>} Array of tags
   */
  async getArtifactTags(artifactId) {
    try {
      const res = await pool.query(
        `SELECT t.* FROM tags t
         JOIN artifact_tags at ON t.id = at.tag_id
         WHERE at.artifact_id = $1 AND t.status = 'approved'
         ORDER BY t.name`,
        [artifactId]
      );
      return res.rows;
    } catch (error) {
      console.error('Error fetching artifact tags:', error);
      // Return empty array instead of throwing to prevent breaking the request
      // This allows the application to continue even if tags table doesn't exist or has issues
      return [];
    }
  },

  /**
   * Set tags for an artifact (replaces existing tags)
   * @param {number} artifactId - Artifact ID
   * @param {Array<number>} tagIds - Array of tag IDs
   * @returns {Promise<Array>} Array of assigned tags
   */
  async setArtifactTags(artifactId, tagIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove existing tags
      await client.query(
        'DELETE FROM artifact_tags WHERE artifact_id = $1',
        [artifactId]
      );

      // Add new tags
      for (const tagId of tagIds) {
        await client.query(
          'INSERT INTO artifact_tags (artifact_id, tag_id) VALUES ($1, $2)',
          [artifactId, tagId]
        );
      }

      await client.query('COMMIT');

      // Return the assigned tags
      return await this.getArtifactTags(artifactId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = Tag;