const pool = require('../config/database');
const criteriaTemplatesData = require('../config/criteriaTemplates.json');

// Valid scale types
const VALID_SCALES = ['likert_5', 'stars_5', 'binary', 'numeric'];

const StudyCriteria = {
  /**
   * Get predefined criteria templates
   * @returns {Object} Templates and scales configuration
   */
  getTemplates() {
    return {
      templates: criteriaTemplatesData.templates,
      scales: criteriaTemplatesData.scales
    };
  },

  /**
   * Validate scale type
   * @param {string} scale - Scale type to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateScale(scale) {
    return VALID_SCALES.includes(scale);
  },

  /**
   * Create a new criterion for a study
   * @param {Object} criteriaData - Criteria creation data
   * @returns {Promise<Object>} Created criterion
   */
  async create({ study_id, name, type, scale, description, display_order }) {
    // Validate scale type
    if (!this.validateScale(scale)) {
      throw new Error(`Invalid scale type: ${scale}. Must be one of: ${VALID_SCALES.join(', ')}`);
    }

    const res = await pool.query(
      `INSERT INTO study_criteria (study_id, name, type, scale, description, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, study_id, name, type, scale, description, display_order, created_at`,
      [study_id, name, type, scale, description, display_order]
    );

    return res.rows[0];
  },

  /**
   * Find all criteria for a specific study
   * @param {number} studyId - Study ID
   * @returns {Promise<Array>} Array of criteria ordered by display_order
   */
  async findByStudyId(studyId) {
    const res = await pool.query(
      `SELECT id, study_id, name, type, scale, description, display_order, created_at
       FROM study_criteria
       WHERE study_id = $1
       ORDER BY display_order ASC`,
      [studyId]
    );

    return res.rows;
  },

  /**
   * Update a criterion
   * @param {number} id - Criterion ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated criterion or null
   */
  async update(id, updateData) {
    // Validate scale type if being updated
    if (updateData.scale !== undefined && !this.validateScale(updateData.scale)) {
      throw new Error(`Invalid scale type: ${updateData.scale}. Must be one of: ${VALID_SCALES.join(', ')}`);
    }

    const allowed = ['name', 'type', 'scale', 'description', 'display_order'];
    const fields = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(updateData[key]);
      }
    }

    if (fields.length === 0) {
      // No fields to update, return current criterion
      const res = await pool.query(
        'SELECT id, study_id, name, type, scale, description, display_order, created_at FROM study_criteria WHERE id = $1',
        [id]
      );
      return res.rows[0] || null;
    }

    const query = `
      UPDATE study_criteria 
      SET ${fields.join(', ')} 
      WHERE id = $${idx} 
      RETURNING id, study_id, name, type, scale, description, display_order, created_at
    `;
    values.push(id);

    const res = await pool.query(query, values);
    return res.rows[0] || null;
  },

  /**
   * Delete a criterion
   * @param {number} id - Criterion ID
   * @returns {Promise<boolean>} True if deleted, false otherwise
   */
  async delete(id) {
    const res = await pool.query(
      'DELETE FROM study_criteria WHERE id = $1 RETURNING id',
      [id]
    );

    return res.rowCount > 0;
  },

  /**
   * Reorder criteria for a study
   * @param {number} studyId - Study ID
   * @param {Array<{id: number, display_order: number}>} orderUpdates - Array of criterion IDs with new display orders
   * @returns {Promise<Array>} Updated criteria
   */
  async reorder(studyId, orderUpdates) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update each criterion's display_order
      for (const update of orderUpdates) {
        await client.query(
          'UPDATE study_criteria SET display_order = $1 WHERE id = $2 AND study_id = $3',
          [update.display_order, update.id, studyId]
        );
      }

      // Fetch and return all criteria in new order
      const res = await client.query(
        `SELECT id, study_id, name, type, scale, description, display_order, created_at
         FROM study_criteria
         WHERE study_id = $1
         ORDER BY display_order ASC`,
        [studyId]
      );

      await client.query('COMMIT');
      return res.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = StudyCriteria;
