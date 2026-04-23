const pool = require('../config/database');

const StudyArtifact = {
  /**
   * Add an artifact to a study
   * @param {number} studyId - Study ID
   * @param {number} artifactId - Artifact ID
   * @param {number} displayOrder - Display order (optional, auto-calculated if not provided)
   * @returns {Promise<Object>} Created study artifact record
   */
  async addToStudy(studyId, artifactId, displayOrder = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Validate study exists
      const studyRes = await client.query('SELECT id, status FROM studies WHERE id = $1', [studyId]);
      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      // Only allow adding artifacts to draft studies
      if (studyRes.rows[0].status !== 'draft') {
        throw new Error('Can only add artifacts to draft studies');
      }

      // Validate artifact exists
      const artifactRes = await client.query('SELECT id, type FROM artifacts WHERE id = $1', [artifactId]);
      if (!artifactRes.rows[0]) {
        throw new Error('Artifact not found');
      }

      // Check if artifact is already in the study
      const existingRes = await client.query(
        'SELECT id FROM study_artifacts WHERE study_id = $1 AND artifact_id = $2',
        [studyId, artifactId]
      );
      if (existingRes.rows[0]) {
        throw new Error('Artifact is already added to this study');
      }

      // Get current artifact count for the study
      const countRes = await client.query(
        'SELECT COUNT(*) as count FROM study_artifacts WHERE study_id = $1',
        [studyId]
      );
      const currentCount = parseInt(countRes.rows[0].count);

      // REMOVED: 3-artifact limit - studies can now have unlimited artifacts
      // if (currentCount >= 3) {
      //   throw new Error('Study can have a maximum of 3 artifacts');
      // }

      // REMOVED: Type compatibility validation - studies can have mixed artifact types
      // Type compatibility is still enforced in the question builder UI
      /*
      if (currentCount > 0 && newArtifactType !== 'collection') {
        const existingArtifactsRes = await client.query(
          `SELECT a.id, a.type, a.metadata 
           FROM artifacts a
           JOIN study_artifacts sa ON a.id = sa.artifact_id
           WHERE sa.study_id = $1 AND a.type != 'collection'`,
          [studyId]
        );

        const existingArtifacts = existingArtifactsRes.rows;
        const newArtifact = artifactRes.rows[0];

        // Validate compatibility
        const isCompatible = this._validateCompatibility(existingArtifacts, newArtifact);
        if (!isCompatible) {
          throw new Error('Artifact is not compatible with existing artifacts in the study');
        }
      }
      */

      // Calculate display order if not provided
      if (displayOrder === null) {
        const maxOrderRes = await client.query(
          'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM study_artifacts WHERE study_id = $1',
          [studyId]
        );
        displayOrder = maxOrderRes.rows[0].next_order;
      }

      // Add artifact to study
      const insertRes = await client.query(
        `INSERT INTO study_artifacts (study_id, artifact_id, display_order)
         VALUES ($1, $2, $3)
         RETURNING id, study_id, artifact_id, display_order, created_at`,
        [studyId, artifactId, displayOrder]
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
   * Remove an artifact from a study
   * @param {number} studyId - Study ID
   * @param {number} artifactId - Artifact ID
   * @returns {Promise<boolean>} True if removed, false otherwise
   */
  async removeFromStudy(studyId, artifactId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Validate study exists and is in draft status
      const studyRes = await client.query('SELECT id, status FROM studies WHERE id = $1', [studyId]);
      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      if (studyRes.rows[0].status !== 'draft') {
        throw new Error('Can only remove artifacts from draft studies');
      }

      // Remove the artifact
      const deleteRes = await client.query(
        'DELETE FROM study_artifacts WHERE study_id = $1 AND artifact_id = $2 RETURNING id',
        [studyId, artifactId]
      );

      if (deleteRes.rowCount === 0) {
        throw new Error('Artifact not found in study');
      }

      // Reorder remaining artifacts to maintain sequential order
      await client.query(
        `UPDATE study_artifacts 
         SET display_order = subquery.new_order
         FROM (
           SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) as new_order
           FROM study_artifacts
           WHERE study_id = $1
         ) as subquery
         WHERE study_artifacts.id = subquery.id`,
        [studyId]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Find all artifacts for a study with full artifact details
   * @param {number} studyId - Study ID
   * @returns {Promise<Array>} Array of artifacts with details
   */
  async findByStudyId(studyId) {
    // Prefer legacy study_artifacts if present; otherwise fall back to question_artifacts
    const countRes = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM study_artifacts WHERE study_id = $1',
      [studyId]
    );

    if ((countRes.rows[0]?.cnt || 0) > 0) {
      const res = await pool.query(
        `SELECT sa.id as study_artifact_id, sa.display_order,
                a.id, a.name, a.type, a.file_path, a.metadata, a.created_at,
                u.first_name, u.last_name, u.email
         FROM study_artifacts sa
         JOIN artifacts a ON sa.artifact_id = a.id
         JOIN users u ON a.uploaded_by = u.id
         WHERE sa.study_id = $1
         ORDER BY sa.display_order`,
        [studyId]
      );
      return res.rows;
    }

    // Fallback: gather artifacts attached to questions in this study
    const qRes = await pool.query(
      `SELECT qa.id as study_artifact_id, qa.display_order,
              a.id, a.name, a.type, a.file_path, a.metadata, a.created_at,
              u.first_name, u.last_name, u.email
       FROM study_questions sq
       JOIN question_artifacts qa ON qa.question_id = sq.id
       JOIN artifacts a ON qa.artifact_id = a.id
       JOIN users u ON a.uploaded_by = u.id
       WHERE sq.study_id = $1
       ORDER BY qa.display_order, a.id`,
      [studyId]
    );
    return qRes.rows;
  },

  /**
   * Reorder artifacts in a study
   * @param {number} studyId - Study ID
   * @param {Array<{artifactId: number, displayOrder: number}>} orderUpdates - Array of artifact IDs with new display orders
   * @returns {Promise<Array>} Updated artifacts
   */
  async reorder(studyId, orderUpdates) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Validate study exists and is in draft status
      const studyRes = await client.query('SELECT id, status FROM studies WHERE id = $1', [studyId]);
      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      if (studyRes.rows[0].status !== 'draft') {
        throw new Error('Can only reorder artifacts in draft studies');
      }

      // Update display order for each artifact
      for (const update of orderUpdates) {
        await client.query(
          `UPDATE study_artifacts 
           SET display_order = $1 
           WHERE study_id = $2 AND artifact_id = $3`,
          [update.displayOrder, studyId, update.artifactId]
        );
      }

      await client.query('COMMIT');

      // Return updated artifacts
      return await this.findByStudyId(studyId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Validate artifact compatibility
   * @private
   * @param {Array} existingArtifacts - Existing artifacts in the study
   * @param {Object} newArtifact - New artifact to add
   * @returns {boolean} True if compatible, false otherwise
   */
  _validateCompatibility(existingArtifacts, newArtifact) {
    if (existingArtifacts.length === 0) {
      return true;
    }

    // Extract artifact types
    const existingTypes = existingArtifacts.map(a => a.type);
    const newType = newArtifact.type;

    // All artifacts should have the same type for meaningful comparison
    const allSameType = existingTypes.every(type => type === existingTypes[0]);
    if (!allSameType) {
      return false;
    }

    // New artifact should match the existing type
    if (newType !== existingTypes[0]) {
      return false;
    }

    // Check language compatibility for source code artifacts
    if (newType === 'source_code') {
      const existingLanguages = existingArtifacts.map(a => {
        try {
          const metadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
          return metadata?.language;
        } catch {
          return null;
        }
      }).filter(lang => lang !== null);

      const newLanguage = (() => {
        try {
          const metadata = typeof newArtifact.metadata === 'string'
            ? JSON.parse(newArtifact.metadata)
            : newArtifact.metadata;
          return metadata?.language;
        } catch {
          return null;
        }
      })();

      // If languages are specified, they should all match
      if (existingLanguages.length > 0 && newLanguage) {
        const allSameLanguage = existingLanguages.every(lang => lang === existingLanguages[0]);
        if (!allSameLanguage) {
          return false;
        }
        if (newLanguage !== existingLanguages[0]) {
          return false;
        }
      }
    }

    return true;
  }
};

module.exports = StudyArtifact;
