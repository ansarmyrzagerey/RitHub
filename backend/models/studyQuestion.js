const pool = require('../config/database');

const StudyQuestion = {
  /**
   * Create a new study question
   * @param {Object} questionData - Question data
   * @returns {Promise<Object>} Created question
   */
  async create({ study_id, title, description, question_type = 'comparison', display_order }) {
    // Validate question type
    const validTypes = ['comparison', 'rating'];
    if (!validTypes.includes(question_type)) {
      throw new Error(`Invalid question type. Must be one of: ${validTypes.join(', ')}`);
    }

    const res = await pool.query(
      `INSERT INTO study_questions (study_id, title, description, question_type, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, study_id, title, description, question_type, display_order, created_at, updated_at`,
      [study_id, title, description || null, question_type, display_order]
    );
    return res.rows[0];
  },

  /**
   * Find all questions for a study
   * @param {number} studyId - Study ID
   * @param {Object} options - Optional parameters
   * @param {Object} options.client - Database client to use (for transaction support)
   * @returns {Promise<Array>} Array of questions with artifacts and criteria
   */
  async findByStudyId(studyId, options = {}) {
    const client = options.client || pool;
    const queryMethod = options.client ? client.query.bind(client) : pool.query.bind(pool);

    const questionsRes = await queryMethod(
      `SELECT id, study_id, title, description, question_type, display_order, created_at, updated_at
       FROM study_questions
       WHERE study_id = $1
       ORDER BY display_order ASC`,
      [studyId]
    );

    const questions = questionsRes.rows;

    // Fetch artifacts and criteria for each question
    for (const question of questions) {
      // Get artifacts
      const artifactsRes = await queryMethod(
        `SELECT qa.id, qa.artifact_id, qa.display_order,
                a.name, a.type, a.file_path, a.content, a.metadata
         FROM question_artifacts qa
         JOIN artifacts a ON qa.artifact_id = a.id
         WHERE qa.question_id = $1
         ORDER BY qa.display_order ASC`,
        [question.id]
      );
      question.artifacts = artifactsRes.rows;

      // Get criteria
      const criteriaRes = await queryMethod(
        `SELECT id, question_id, name, type, scale, description, display_order, created_at
         FROM question_criteria
         WHERE question_id = $1
         ORDER BY display_order ASC`,
        [question.id]
      );
      question.criteria = criteriaRes.rows;
    }

    return questions;
  },

  /**
   * Find question by title and study ID
   * @param {number} studyId - Study ID
   * @param {string} title - Question title
   * @returns {Promise<Object|null>} Question if found
   */
  async findByTitleAndStudyId(studyId, title) {
    const res = await pool.query(
      `SELECT id, study_id, title, description, question_type, display_order, created_at, updated_at
       FROM study_questions
       WHERE study_id = $1 AND title = $2`,
      [studyId, title]
    );
    return res.rows[0] || null;
  },

  /**
   * Find question by ID with full details
   * @param {number} id - Question ID
   * @returns {Promise<Object|null>} Question with artifacts and criteria
   */
  async findById(id) {
    const res = await pool.query(
      `SELECT id, study_id, title, description, question_type, display_order, created_at, updated_at
       FROM study_questions
       WHERE id = $1`,
      [id]
    );

    if (!res.rows[0]) {
      return null;
    }

    const question = res.rows[0];

    // Get artifacts
    const artifactsRes = await pool.query(
      `SELECT qa.id, qa.artifact_id, qa.display_order,
              a.name, a.type, a.file_path, a.content, a.metadata
       FROM question_artifacts qa
       JOIN artifacts a ON qa.artifact_id = a.id
       WHERE qa.question_id = $1
       ORDER BY qa.display_order ASC`,
      [id]
    );
    question.artifacts = artifactsRes.rows;

    // Get criteria
    const criteriaRes = await pool.query(
      `SELECT id, question_id, name, type, scale, description, display_order, created_at
       FROM question_criteria
       WHERE question_id = $1
       ORDER BY display_order ASC`,
      [id]
    );
    question.criteria = criteriaRes.rows;

    return question;
  },

  /**
   * Update a question
   * @param {number} id - Question ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated question
   */
  async update(id, updateData) {
    const allowed = ['title', 'description', 'question_type', 'display_order'];

    // Validate question type if provided
    if (updateData.question_type) {
      const validTypes = ['comparison', 'rating'];
      if (!validTypes.includes(updateData.question_type)) {
        throw new Error(`Invalid question type. Must be one of: ${validTypes.join(', ')}`);
      }
    }
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
      return await this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE study_questions 
      SET ${fields.join(', ')} 
      WHERE id = $${idx} 
      RETURNING id, study_id, title, description, question_type, display_order, created_at, updated_at
    `;
    values.push(id);

    const res = await pool.query(query, values);
    return res.rows[0] || null;
  },

  /**
   * Delete a question
   * @param {number} id - Question ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    const res = await pool.query(
      'DELETE FROM study_questions WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rowCount > 0;
  },

  /**
   * Add artifact to question
   * @param {number} questionId - Question ID
   * @param {number} artifactId - Artifact ID
   * @param {number} displayOrder - Display order
   * @returns {Promise<Object>} Created question artifact
   */
  async addArtifact(questionId, artifactId, displayOrder) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get question type
      const questionRes = await client.query(
        'SELECT question_type FROM study_questions WHERE id = $1',
        [questionId]
      );

      if (!questionRes.rows[0]) {
        throw new Error('Question not found');
      }

      const questionType = questionRes.rows[0].question_type;

      // Check if artifact is already added
      const existingRes = await client.query(
        'SELECT id FROM question_artifacts WHERE question_id = $1 AND artifact_id = $2',
        [questionId, artifactId]
      );

      if (existingRes.rows[0]) {
        throw new Error('Artifact already added to this question');
      }

      // Check artifact count based on question type
      const countRes = await client.query(
        'SELECT COUNT(*) as count FROM question_artifacts WHERE question_id = $1',
        [questionId]
      );

      const currentCount = parseInt(countRes.rows[0].count);

      if (questionType === 'rating' && currentCount >= 1) {
        throw new Error('Rating questions can only have 1 artifact');
      }

      if (questionType === 'comparison' && currentCount >= 3) {
        throw new Error('Comparison questions can have a maximum of 3 artifacts');
      }

      // Validate artifact compatibility for comparison questions
      if (questionType === 'comparison' && currentCount > 0) {
        const existingArtifactsRes = await client.query(
          `SELECT a.id, a.type, a.metadata 
           FROM artifacts a
           JOIN question_artifacts qa ON a.id = qa.artifact_id
           WHERE qa.question_id = $1`,
          [questionId]
        );

        const newArtifactRes = await client.query(
          'SELECT id, type, metadata FROM artifacts WHERE id = $1',
          [artifactId]
        );

        if (!newArtifactRes.rows[0]) {
          throw new Error('Artifact not found');
        }

        const isCompatible = this._validateArtifactCompatibility(
          existingArtifactsRes.rows,
          newArtifactRes.rows[0]
        );

        if (!isCompatible) {
          throw new Error('Artifact is not compatible with existing artifacts (must have same type and language)');
        }
      }

      const res = await client.query(
        `INSERT INTO question_artifacts (question_id, artifact_id, display_order)
         VALUES ($1, $2, $3)
         RETURNING id, question_id, artifact_id, display_order, created_at`,
        [questionId, artifactId, displayOrder]
      );

      await client.query('COMMIT');
      return res.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Validate artifact compatibility for comparison questions
   * @private
   * @param {Array} existingArtifacts - Existing artifacts in the question
   * @param {Object} newArtifact - New artifact to add
   * @returns {boolean} True if compatible, false otherwise
   */
  _validateArtifactCompatibility(existingArtifacts, newArtifact) {
    if (existingArtifacts.length === 0) {
      return true;
    }

    // Extract artifact types
    const existingTypes = existingArtifacts.map(a => a.type);
    const newType = newArtifact.type;

    // All artifacts should have the same type
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
  },

  /**
   * Remove artifact from question
   * @param {number} questionId - Question ID
   * @param {number} artifactId - Artifact ID
   * @returns {Promise<boolean>} True if removed
   */
  async removeArtifact(questionId, artifactId) {
    const res = await pool.query(
      'DELETE FROM question_artifacts WHERE question_id = $1 AND artifact_id = $2 RETURNING id',
      [questionId, artifactId]
    );
    return res.rowCount > 0;
  },

  /**
   * Find criterion by name and question ID
   * @param {number} questionId - Question ID
   * @param {string} name - Criterion name
   * @returns {Promise<Object|null>} Criterion if found
   */
  async findCriterionByNameAndQuestionId(questionId, name) {
    const res = await pool.query(
      `SELECT id, question_id, name, type, scale, description, display_order, created_at
       FROM question_criteria
       WHERE question_id = $1 AND name = $2`,
      [questionId, name]
    );
    return res.rows[0] || null;
  },

  /**
   * Add criterion to question
   * @param {Object} criterionData - Criterion data
   * @returns {Promise<Object>} Created criterion
   */
  async addCriterion({ question_id, name, type, scale, description, display_order }) {
    const validScales = ['likert_5', 'stars_5', 'binary', 'numeric'];
    if (!validScales.includes(scale)) {
      throw new Error(`Invalid scale. Must be one of: ${validScales.join(', ')}`);
    }

    const res = await pool.query(
      `INSERT INTO question_criteria (question_id, name, type, scale, description, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, question_id, name, type, scale, description, display_order, created_at`,
      [question_id, name, type, scale, description || null, display_order]
    );

    return res.rows[0];
  },

  /**
   * Update criterion
   * @param {number} id - Criterion ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated criterion
   */
  async updateCriterion(id, updateData) {
    const allowed = ['name', 'type', 'scale', 'description', 'display_order'];
    const fields = [];
    const values = [];
    let idx = 1;

    // Validate scale if provided
    if (updateData.scale) {
      const validScales = ['likert_5', 'stars_5', 'binary', 'numeric'];
      if (!validScales.includes(updateData.scale)) {
        throw new Error(`Invalid scale. Must be one of: ${validScales.join(', ')}`);
      }
    }

    for (const key of allowed) {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(updateData[key]);
      }
    }

    if (fields.length === 0) {
      const res = await pool.query(
        'SELECT * FROM question_criteria WHERE id = $1',
        [id]
      );
      return res.rows[0] || null;
    }

    const query = `
      UPDATE question_criteria 
      SET ${fields.join(', ')} 
      WHERE id = $${idx} 
      RETURNING id, question_id, name, type, scale, description, display_order, created_at
    `;
    values.push(id);

    const res = await pool.query(query, values);
    return res.rows[0] || null;
  },

  /**
   * Remove criterion from question
   * @param {number} id - Criterion ID
   * @returns {Promise<boolean>} True if removed
   */
  async removeCriterion(id) {
    const res = await pool.query(
      'DELETE FROM question_criteria WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rowCount > 0;
  },

  /**
   * Get predefined criteria templates
   * @returns {Object} Templates and scales
   */
  getTemplates() {
    return {
      templates: [
        {
          name: 'Readability',
          type: 'predefined',
          description: 'How easy is it to read and understand the artifact?',
          suggested_scale: 'likert_5'
        },
        {
          name: 'Correctness',
          type: 'predefined',
          description: 'How correct and accurate is the artifact?',
          suggested_scale: 'likert_5'
        },
        {
          name: 'Completeness',
          type: 'predefined',
          description: 'How complete is the artifact?',
          suggested_scale: 'likert_5'
        },
        {
          name: 'Efficiency',
          type: 'predefined',
          description: 'How efficient is the artifact?',
          suggested_scale: 'likert_5'
        },
        {
          name: 'Maintainability',
          type: 'predefined',
          description: 'How easy is it to maintain the artifact?',
          suggested_scale: 'likert_5'
        },
        {
          name: 'Design Quality',
          type: 'predefined',
          description: 'How good is the overall design?',
          suggested_scale: 'likert_5'
        }
      ],
      scales: [
        {
          value: 'likert_5',
          label: '5-point Likert Scale',
          description: 'Strongly Disagree to Strongly Agree (1-5)',
          options: [
            { value: 1, label: 'Strongly Disagree' },
            { value: 2, label: 'Disagree' },
            { value: 3, label: 'Neutral' },
            { value: 4, label: 'Agree' },
            { value: 5, label: 'Strongly Agree' }
          ]
        },
        {
          value: 'stars_5',
          label: '5-star Rating',
          description: 'Rate from 1 to 5 stars',
          options: [
            { value: 1, label: '1 star' },
            { value: 2, label: '2 stars' },
            { value: 3, label: '3 stars' },
            { value: 4, label: '4 stars' },
            { value: 5, label: '5 stars' }
          ]
        },
        {
          value: 'binary',
          label: 'Binary (Yes/No)',
          description: 'Simple yes or no response',
          options: [
            { value: 0, label: 'No' },
            { value: 1, label: 'Yes' }
          ]
        },
        {
          value: 'numeric',
          label: 'Numeric (0-100)',
          description: 'Numeric value from 0 to 100',
          options: []
        }
      ]
    };
  }
};

module.exports = StudyQuestion;
