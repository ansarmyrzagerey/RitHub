const pool = require('../config/database');

const ArtifactSet = {
  /**
   * Create a new artifact set
   * @param {Object} setData - Artifact set creation data
   * @returns {Promise<Object>} Created artifact set
   */
  async create({ name, description, created_by, artifact_ids }) {
    // Validate artifact_ids is an array with at least 2 artifacts
    if (!Array.isArray(artifact_ids) || artifact_ids.length < 2) {
      throw new Error('Artifact set must contain at least 2 artifacts');
    }

    // Validate artifact_ids contains no more than 3 artifacts
    if (artifact_ids.length > 3) {
      throw new Error('Artifact set can contain a maximum of 3 artifacts');
    }

    // Validate all artifact IDs are unique
    const uniqueIds = [...new Set(artifact_ids)];
    if (uniqueIds.length !== artifact_ids.length) {
      throw new Error('Artifact set cannot contain duplicate artifacts');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Validate all artifacts exist
      const artifactCheckRes = await client.query(
        `SELECT id FROM artifacts WHERE id = ANY($1::int[])`,
        [artifact_ids]
      );

      if (artifactCheckRes.rows.length !== artifact_ids.length) {
        throw new Error('One or more artifacts do not exist');
      }

      // Create artifact set
      const insertRes = await client.query(
        `INSERT INTO artifact_sets (name, description, created_by, artifact_ids)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, description, created_by, artifact_ids, created_at`,
        [name, description || null, created_by, artifact_ids]
      );

      await client.query('COMMIT');
      return insertRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Find all artifact sets created by a specific user
   * @param {number} creatorId - User ID of the creator
   * @returns {Promise<Array>} Array of artifact sets with artifact details
   */
  async findByCreator(creatorId) {
    const res = await pool.query(
      `SELECT 
         ars.id, 
         ars.name, 
         ars.description, 
         ars.created_by, 
         ars.artifact_ids, 
         ars.created_at,
         u.first_name as creator_first_name,
         u.last_name as creator_last_name,
         u.email as creator_email
       FROM artifact_sets ars
       JOIN users u ON ars.created_by = u.id
       WHERE ars.created_by = $1
       ORDER BY ars.created_at DESC`,
      [creatorId]
    );

    // Enrich each artifact set with full artifact details
    const enrichedSets = await Promise.all(
      res.rows.map(async (set) => {
        const artifactsRes = await pool.query(
          `SELECT 
             a.id, 
             a.name, 
             a.type, 
             a.file_path, 
             a.metadata, 
             a.created_at,
             u.first_name as uploader_first_name,
             u.last_name as uploader_last_name
           FROM artifacts a
           JOIN users u ON a.uploaded_by = u.id
           WHERE a.id = ANY($1::int[])
           ORDER BY array_position($1::int[], a.id)`,
          [set.artifact_ids]
        );

        return {
          ...set,
          artifacts: artifactsRes.rows
        };
      })
    );

    return enrichedSets;
  },

  /**
   * Find artifact set by ID with full artifact details
   * @param {number} id - Artifact set ID
   * @returns {Promise<Object|null>} Artifact set with details or null
   */
  async findById(id) {
    const res = await pool.query(
      `SELECT 
         ars.id, 
         ars.name, 
         ars.description, 
         ars.created_by, 
         ars.artifact_ids, 
         ars.created_at,
         u.first_name as creator_first_name,
         u.last_name as creator_last_name,
         u.email as creator_email
       FROM artifact_sets ars
       JOIN users u ON ars.created_by = u.id
       WHERE ars.id = $1`,
      [id]
    );

    if (!res.rows[0]) {
      return null;
    }

    const set = res.rows[0];

    // Get full artifact details
    const artifactsRes = await pool.query(
      `SELECT 
         a.id, 
         a.name, 
         a.type, 
         a.file_path, 
         a.metadata, 
         a.created_at,
         u.first_name as uploader_first_name,
         u.last_name as uploader_last_name
       FROM artifacts a
       JOIN users u ON a.uploaded_by = u.id
       WHERE a.id = ANY($1::int[])
       ORDER BY array_position($1::int[], a.id)`,
      [set.artifact_ids]
    );

    return {
      ...set,
      artifacts: artifactsRes.rows
    };
  },

  /**
   * Delete an artifact set
   * @param {number} id - Artifact set ID
   * @param {number} userId - User ID requesting deletion (for authorization)
   * @returns {Promise<boolean>} True if deleted, false otherwise
   */
  async delete(id, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if artifact set exists and verify ownership
      const setRes = await client.query(
        'SELECT id, created_by FROM artifact_sets WHERE id = $1',
        [id]
      );

      if (!setRes.rows[0]) {
        throw new Error('Artifact set not found');
      }

      if (setRes.rows[0].created_by !== userId) {
        throw new Error('Only the creator can delete this artifact set');
      }

      // Delete the artifact set
      const deleteRes = await client.query(
        'DELETE FROM artifact_sets WHERE id = $1 RETURNING id',
        [id]
      );

      await client.query('COMMIT');
      return deleteRes.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = ArtifactSet;
