const pool = require('../config/database');

class Collection {
  /**
   * Create a new collection
   */
  static async create({ name, description, importSource, createdBy }) {
    const query = `
      INSERT INTO artifact_collections (name, description, import_source, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [name, description, importSource, createdBy];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get collection by ID
   */
  static async findById(id) {
    const query = `
      SELECT 
        c.*,
        u.first_name,
        u.last_name,
        u.email
      FROM artifact_collections c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get all collections for a user
   */
  static async findByUserId(userId) {
    const query = `
      SELECT 
        c.*,
        u.first_name,
        u.last_name
      FROM artifact_collections c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.created_by = $1
      ORDER BY c.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get all collections (for admin)
   */
  static async findAll() {
    const query = `
      SELECT 
        c.*,
        u.first_name,
        u.last_name,
        u.email
      FROM artifact_collections c
      LEFT JOIN users u ON c.created_by = u.id
      ORDER BY c.created_at DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Update collection
   */
  static async update(id, { name, description }) {
    const query = `
      UPDATE artifact_collections
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const values = [name, description, id];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete collection with option to delete artifacts
   * @param {number} id - Collection ID
   * @param {boolean} deleteArtifacts - If true, delete all artifacts in collection; if false, set collection_id to NULL
   */
  static async delete(id, deleteArtifacts = false) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (deleteArtifacts) {
        // Delete all artifacts in this collection
        await client.query('DELETE FROM artifacts WHERE collection_id = $1', [id]);
      } else {
        // Just unlink artifacts from collection
        await client.query('UPDATE artifacts SET collection_id = NULL WHERE collection_id = $1', [id]);
      }

      // Delete the collection
      await client.query('DELETE FROM artifact_collections WHERE id = $1', [id]);

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get artifacts in a collection with pagination
   */
  static async getArtifacts(collectionId, limit = 50, offset = 0) {
    const query = `
      SELECT 
        a.*,
        u.first_name,
        u.last_name
      FROM artifacts a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.collection_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [collectionId, limit, offset]);
    return result.rows;
  }

  /**
   * Get total count of artifacts in collection
   */
  static async getArtifactCount(collectionId) {
    const query = 'SELECT COUNT(*) as count FROM artifacts WHERE collection_id = $1';
    const result = await pool.query(query, [collectionId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get collection statistics
   */
  static async getStats(userId = null) {
    let query = `
      SELECT 
        COUNT(*) as total_collections,
        COALESCE(SUM(file_count), 0) as total_files,
        COALESCE(SUM(total_size), 0) as total_size
      FROM artifact_collections
    `;

    let values = [];
    if (userId) {
      query += ' WHERE created_by = $1';
      values = [userId];
    }

    const result = await pool.query(query, values);
    return result.rows[0];
  }
}

module.exports = Collection;
