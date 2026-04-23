const pool = require('../config/database');
const crypto = require('crypto');
const emailService = require('../services/emailService');

const Study = {
  /**
   * Create a new study (draft by default)
   * @param {Object} studyData - Study creation data
   * @returns {Promise<Object>} Created study
   */
  async create({ title, description, created_by, deadline, participant_capacity, status = 'draft' }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create study
      const studyRes = await client.query(
        `INSERT INTO studies (title, description, created_by, status, deadline, participant_capacity)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                   enrolled_count, enrollment_token, enrollment_token_expires, 
                   cancelled_by, cancelled_at, cancellation_reason, created_at, updated_at`,
        [title, description, created_by, status, deadline, participant_capacity]
      );

      const study = studyRes.rows[0];

      // Log initial state transition
      await client.query(
        `INSERT INTO study_state_transitions (study_id, from_status, to_status, changed_by)
         VALUES ($1, NULL, $2, $3)`,
        [study.id, status, created_by]
      );

      await client.query('COMMIT');
      return study;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Find study by ID with full details
   * @param {number} id - Study ID
   * @returns {Promise<Object|null>} Study with details or null
   */
  async findById(id) {
    const res = await pool.query(
      `SELECT s.*, 
              u.first_name as creator_first_name, 
              u.last_name as creator_last_name,
              u.email as creator_email,
              cu.first_name as cancelled_by_first_name,
              cu.last_name as cancelled_by_last_name
       FROM studies s
       JOIN users u ON s.created_by = u.id
       LEFT JOIN users cu ON s.cancelled_by = cu.id
       WHERE s.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  },

  /**
   * Find all studies created by a specific researcher
   * @param {number} creatorId - User ID of the creator
   * @returns {Promise<Array>} Array of studies
   */
  async findByCreator(creatorId) {
    const res = await pool.query(
      `SELECT s.id, s.title, s.description, s.status, s.deadline, 
              s.participant_capacity, s.enrolled_count, s.created_at, s.updated_at
       FROM studies s
       WHERE s.created_by = $1
       ORDER BY s.created_at DESC`,
      [creatorId]
    );
    return res.rows;
  },

  /**
   * Find all studies with optional filtering by status
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of studies
   */
  async findAll(filters = {}) {
    let query = `
      SELECT s.id, s.title, s.description, s.status, s.deadline, 
             s.participant_capacity, s.enrolled_count, s.created_at, s.updated_at,
             u.first_name as creator_first_name, 
             u.last_name as creator_last_name
      FROM studies s
      JOIN users u ON s.created_by = u.id
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // By default, exclude deleted studies unless specifically requested
    if (!filters.includeDeleted) {
      conditions.push(`s.status != 'deleted'`);
    }

    if (filters.status) {
      conditions.push(`s.status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.created_by) {
      conditions.push(`s.created_by = $${paramIndex++}`);
      values.push(filters.created_by);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.created_at DESC';

    const res = await pool.query(query, values);
    return res.rows;
  },

  /**
   * Update study fields
   * @param {number} id - Study ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated study or null
   */
  async update(id, updateData) {
    const allowed = ['title', 'description', 'deadline', 'participant_capacity', 'status'];
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

    // Add updated_at
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE studies 
      SET ${fields.join(', ')} 
      WHERE id = $${idx} 
      RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                enrolled_count, enrollment_token, enrollment_token_expires, 
                cancelled_by, cancelled_at, cancellation_reason, created_at, updated_at
    `;
    values.push(id);

    const res = await pool.query(query, values);
    return res.rows[0] || null;
  },

  /**
   * Soft delete a study (move to trash bin)
   * @param {number} id - Study ID
   * @param {number} userId - User performing the deletion
   * @returns {Promise<Object|null>} Updated study or null
   */
  async delete(id, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current study status
      const studyRes = await client.query(
        'SELECT id, status FROM studies WHERE id = $1',
        [id]
      );

      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      const study = studyRes.rows[0];

      // Cannot delete already deleted studies
      if (study.status === 'deleted') {
        throw new Error('Study is already deleted');
      }

      // Update study to deleted status
      const updateRes = await client.query(
        `UPDATE studies 
         SET status = 'deleted',
             deleted_at = CURRENT_TIMESTAMP,
             deleted_by = $1,
             previous_status = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                   enrolled_count, enrollment_token, enrollment_token_expires, 
                   cancelled_by, cancelled_at, cancellation_reason, 
                   deleted_at, deleted_by, previous_status, created_at, updated_at`,
        [userId, study.status, id]
      );

      // Log the deletion operation
      await client.query(
        `INSERT INTO study_deletion_log (study_id, operation, performed_by, previous_status, new_status)
         VALUES ($1, 'soft_delete', $2, $3, 'deleted')`,
        [id, userId, study.status]
      );

      // Log state transition
      await client.query(
        `INSERT INTO study_state_transitions (study_id, from_status, to_status, changed_by, reason)
         VALUES ($1, $2, 'deleted', $3, 'Study moved to trash bin')`,
        [id, study.status, userId]
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Restore a study from trash bin
   * @param {number} id - Study ID
   * @param {number} userId - User performing the restoration
   * @returns {Promise<Object|null>} Restored study or null
   */
  async restore(id, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current study
      const studyRes = await client.query(
        'SELECT id, status, previous_status FROM studies WHERE id = $1',
        [id]
      );

      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      const study = studyRes.rows[0];

      // Can only restore deleted studies
      if (study.status !== 'deleted') {
        throw new Error('Study is not deleted');
      }

      if (!study.previous_status) {
        throw new Error('Cannot restore study: previous status not found');
      }

      // Restore study to previous status
      const updateRes = await client.query(
        `UPDATE studies 
         SET status = $1,
             deleted_at = NULL,
             deleted_by = NULL,
             previous_status = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                   enrolled_count, enrollment_token, enrollment_token_expires, 
                   cancelled_by, cancelled_at, cancellation_reason, 
                   deleted_at, deleted_by, previous_status, created_at, updated_at`,
        [study.previous_status, id]
      );

      // Log the restoration operation
      await client.query(
        `INSERT INTO study_deletion_log (study_id, operation, performed_by, previous_status, new_status)
         VALUES ($1, 'restore', $2, 'deleted', $3)`,
        [id, userId, study.previous_status]
      );

      // Log state transition
      await client.query(
        `INSERT INTO study_state_transitions (study_id, from_status, to_status, changed_by, reason)
         VALUES ($1, 'deleted', $2, $3, 'Study restored from trash bin')`,
        [id, study.previous_status, userId]
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Permanently delete a study (hard delete)
   * @param {number} id - Study ID
   * @param {number} userId - User performing the permanent deletion
   * @returns {Promise<boolean>} True if deleted, false otherwise
   */
  async permanentDelete(id, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current study
      const studyRes = await client.query(
        'SELECT id, status, title FROM studies WHERE id = $1',
        [id]
      );

      if (!studyRes.rows[0]) {
        return false;
      }

      const study = studyRes.rows[0];

      // Can only permanently delete studies that are in deleted status
      if (study.status !== 'deleted') {
        throw new Error('Study must be in trash bin before permanent deletion');
      }

      // Log the permanent deletion operation before deleting
      await client.query(
        `INSERT INTO study_deletion_log (study_id, operation, performed_by, previous_status, new_status, reason)
         VALUES ($1, 'permanent_delete', $2, 'deleted', NULL, $3)`,
        [id, userId, `Permanent deletion of study: ${study.title}`]
      );

      // Mark all evaluation data from this study as from deleted study
      await client.query(
        `UPDATE evaluations 
         SET from_cancelled_study = true 
         WHERE task_id IN (
           SELECT id FROM evaluation_tasks WHERE study_id = $1
         )`,
        [id]
      );

      // Delete the study (CASCADE will handle related data)
      const deleteRes = await client.query(
        'DELETE FROM studies WHERE id = $1 RETURNING id',
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
  },

  /**
   * Activate a study (transition from draft to active)
   * @param {number} id - Study ID
   * @param {number} userId - User performing the action
   * @returns {Promise<Object|null>} Updated study or null
   */
  async activate(id, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check current status
      const studyRes = await client.query('SELECT status FROM studies WHERE id = $1', [id]);

      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      const currentStatus = studyRes.rows[0].status;

      if (currentStatus !== 'draft') {
        throw new Error(`Cannot activate study from ${currentStatus} status`);
      }

      // Generate evaluation tasks from study questions
      // Use the same transaction client to ensure consistency
      const TaskGenerationService = require('../services/taskGenerationService');
      try {
        const taskGenResult = await TaskGenerationService.generateTasksFromQuestions(id, { client });
        console.log(`Generated ${taskGenResult.tasksCreated} evaluation tasks for study ${id}`);
      } catch (taskError) {
        // If task generation fails, don't activate the study
        console.error('Task generation error:', taskError);
        throw new Error(`Cannot activate study: ${taskError.message}`);
      }

      // Update status to active
      const updateRes = await client.query(
        `UPDATE studies 
         SET status = 'active', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                   enrolled_count, enrollment_token, enrollment_token_expires, 
                   cancelled_by, cancelled_at, cancellation_reason, created_at, updated_at`,
        [id]
      );

      // Log state transition
      await client.query(
        `INSERT INTO study_state_transitions (study_id, from_status, to_status, changed_by)
         VALUES ($1, $2, $3, $4)`,
        [id, currentStatus, 'active', userId]
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Cancel a study (researcher cancellation)
   * @param {number} id - Study ID
   * @param {number} userId - User performing the action
   * @param {string} reason - Cancellation reason (optional)
   * @returns {Promise<Object|null>} Updated study or null
   */
  async cancel(id, userId, reason = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check current status and ownership
      const studyRes = await client.query(
        'SELECT status, created_by FROM studies WHERE id = $1',
        [id]
      );

      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      const { status: currentStatus, created_by } = studyRes.rows[0];

      // Verify ownership
      if (created_by !== userId) {
        throw new Error('Only study owner can cancel the study');
      }

      // Can only cancel draft or active studies
      if (!['draft', 'active'].includes(currentStatus)) {
        throw new Error(`Cannot cancel study in ${currentStatus} status`);
      }

      // Update status to cancelled
      const updateRes = await client.query(
        `UPDATE studies 
         SET status = 'cancelled', 
             cancelled_by = $1, 
             cancelled_at = CURRENT_TIMESTAMP,
             cancellation_reason = $2,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 
         RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                   enrolled_count, enrollment_token, enrollment_token_expires, 
                   cancelled_by, cancelled_at, cancellation_reason, created_at, updated_at`,
        [userId, reason, id]
      );

      // Log state transition
      await client.query(
        `INSERT INTO study_state_transitions (study_id, from_status, to_status, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, currentStatus, 'cancelled', userId, reason]
      );

      // Mark all evaluation data from this study as from cancelled study
      // This preserves the data and marks it appropriately
      await client.query(
        `UPDATE evaluations 
         SET from_cancelled_study = true 
         WHERE task_id IN (
           SELECT id FROM evaluation_tasks WHERE study_id = $1
         )`,
        [id]
      );

      await client.query('COMMIT');

      const cancelledStudy = updateRes.rows[0];

      // Send cancellation notifications to participants (async, don't wait)
      emailService.sendStudyCancellationNotification(id, cancelledStudy.title, reason)
        .catch(err => console.error('Failed to send cancellation notifications:', err));

      return cancelledStudy;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Admin cancel a study
   * @param {number} id - Study ID
   * @param {number} adminId - Admin user ID
   * @param {string} reason - Cancellation reason (required for admin)
   * @returns {Promise<Object|null>} Updated study or null
   */
  async adminCancel(id, adminId, reason) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check current status
      const studyRes = await client.query('SELECT status FROM studies WHERE id = $1', [id]);

      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      const currentStatus = studyRes.rows[0].status;

      // Can only cancel draft or active studies
      if (!['draft', 'active'].includes(currentStatus)) {
        throw new Error(`Cannot cancel study in ${currentStatus} status`);
      }

      if (!reason) {
        throw new Error('Cancellation reason is required for admin cancellation');
      }

      // Update status to cancelled
      const updateRes = await client.query(
        `UPDATE studies 
         SET status = 'cancelled', 
             cancelled_by = $1, 
             cancelled_at = CURRENT_TIMESTAMP,
             cancellation_reason = $2,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 
         RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                   enrolled_count, enrollment_token, enrollment_token_expires, 
                   cancelled_by, cancelled_at, cancellation_reason, created_at, updated_at`,
        [adminId, reason, id]
      );

      // Log state transition
      await client.query(
        `INSERT INTO study_state_transitions (study_id, from_status, to_status, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, currentStatus, 'cancelled', adminId, reason]
      );

      // Mark all evaluation data from this study as from cancelled study
      // This preserves the data and marks it appropriately
      await client.query(
        `UPDATE evaluations 
         SET from_cancelled_study = true 
         WHERE task_id IN (
           SELECT id FROM evaluation_tasks WHERE study_id = $1
         )`,
        [id]
      );

      await client.query('COMMIT');

      const cancelledStudy = updateRes.rows[0];

      // Get researcher and admin information for notifications
      const researcherRes = await pool.query(
        'SELECT email, first_name, last_name FROM users WHERE id = $1',
        [cancelledStudy.created_by]
      );

      const adminRes = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [adminId]
      );

      if (researcherRes.rows[0] && adminRes.rows[0]) {
        const researcher = researcherRes.rows[0];
        const admin = adminRes.rows[0];
        const adminName = `${admin.first_name} ${admin.last_name}`;

        // Send notification to researcher (async, don't wait)
        emailService.sendAdminCancellationNotification(
          researcher.email,
          researcher.first_name,
          cancelledStudy.title,
          reason,
          adminName
        ).catch(err => console.error('Failed to send admin cancellation notification to researcher:', err));
      }

      // Send cancellation notifications to participants (async, don't wait)
      emailService.sendStudyCancellationNotification(id, cancelledStudy.title, reason)
        .catch(err => console.error('Failed to send cancellation notifications to participants:', err));

      return cancelledStudy;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Complete a study (deadline-based completion)
   * @param {number} id - Study ID
   * @returns {Promise<Object|null>} Updated study or null
   */
  async complete(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check current status
      const studyRes = await client.query('SELECT status FROM studies WHERE id = $1', [id]);

      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      const currentStatus = studyRes.rows[0].status;

      // Can only complete active studies
      if (currentStatus !== 'active') {
        throw new Error(`Cannot complete study in ${currentStatus} status`);
      }

      // Update status to completed
      const updateRes = await client.query(
        `UPDATE studies 
         SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                   enrolled_count, enrollment_token, enrollment_token_expires, 
                   cancelled_by, cancelled_at, cancellation_reason, created_at, updated_at`,
        [id]
      );

      // Log state transition (system action, no user)
      await client.query(
        `INSERT INTO study_state_transitions (study_id, from_status, to_status, changed_by, reason)
         VALUES ($1, $2, $3, NULL, $4)`,
        [id, currentStatus, 'completed', 'Deadline reached']
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Archive a study
   * @param {number} id - Study ID
   * @param {number} userId - User performing the action
   * @returns {Promise<Object|null>} Updated study or null
   */
  async archive(id, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check current status
      const studyRes = await client.query('SELECT status FROM studies WHERE id = $1', [id]);

      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      const currentStatus = studyRes.rows[0].status;

      // Can only archive completed or cancelled studies
      if (!['completed', 'cancelled'].includes(currentStatus)) {
        throw new Error(`Cannot archive study in ${currentStatus} status`);
      }

      // Update status to archived
      const updateRes = await client.query(
        `UPDATE studies 
         SET status = 'archived', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                   enrolled_count, enrollment_token, enrollment_token_expires, 
                   cancelled_by, cancelled_at, cancellation_reason, created_at, updated_at`,
        [id]
      );

      // Log state transition
      await client.query(
        `INSERT INTO study_state_transitions (study_id, from_status, to_status, changed_by)
         VALUES ($1, $2, $3, $4)`,
        [id, currentStatus, 'archived', userId]
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Generate enrollment token for a study
   * @param {number} id - Study ID
   * @returns {Promise<Object>} Study with new enrollment token
   */
  async generateEnrollmentToken(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if study is active and has capacity
      const studyRes = await client.query(
        'SELECT status, participant_capacity, enrolled_count FROM studies WHERE id = $1',
        [id]
      );

      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      const { status } = studyRes.rows[0];

      if (status !== 'active') {
        throw new Error('Can only generate enrollment tokens for active studies');
      }

      // Generate cryptographically secure token
      const token = crypto.randomBytes(32).toString('hex');

      // Set expiration based on study deadline or default to 30 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Update study with new token
      const updateRes = await client.query(
        `UPDATE studies 
         SET enrollment_token = $1, 
             enrollment_token_expires = $2,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 
         RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                   enrolled_count, enrollment_token, enrollment_token_expires, 
                   cancelled_by, cancelled_at, cancellation_reason, created_at, updated_at`,
        [token, expiresAt, id]
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Validate enrollment token
   * @param {string} token - Enrollment token
   * @returns {Promise<Object|null>} Study if valid, null otherwise
   */
  async validateEnrollmentToken(token) {
    const res = await pool.query(
      `SELECT id, title, description, created_by, status, deadline, participant_capacity, 
              enrolled_count, enrollment_token, enrollment_token_expires, created_at
       FROM studies 
       WHERE enrollment_token = $1`,
      [token]
    );

    if (!res.rows[0]) {
      return null;
    }

    const study = res.rows[0];

    // Check if study is active
    if (study.status !== 'active') {
      return null;
    }

    // Check if token is expired
    if (study.enrollment_token_expires && new Date() > new Date(study.enrollment_token_expires)) {
      return null;
    }

    // Check if study has reached capacity
    if (study.participant_capacity && study.enrolled_count >= study.participant_capacity) {
      return null;
    }

    // Check if deadline has passed
    if (study.deadline && new Date() > new Date(study.deadline)) {
      return null;
    }

    return study;
  },

  /**
   * Invalidate enrollment token
   * @param {number} id - Study ID
   * @returns {Promise<Object|null>} Updated study or null
   */
  async invalidateEnrollmentToken(id) {
    const res = await pool.query(
      `UPDATE studies 
       SET enrollment_token = NULL, 
           enrollment_token_expires = NULL,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, title, description, created_by, status, deadline, participant_capacity, 
                 enrolled_count, enrollment_token, enrollment_token_expires, 
                 cancelled_by, cancelled_at, cancellation_reason, created_at, updated_at`,
      [id]
    );

    return res.rows[0] || null;
  },

  /**
   * Enroll a participant in a study with capacity validation
   * @param {number} studyId - Study ID
   * @param {number} participantId - Participant user ID
   * @returns {Promise<Object>} Enrollment record
   */
  async enrollParticipant(studyId, participantId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the study row for update to prevent race conditions
      const studyRes = await client.query(
        `SELECT id, status, participant_capacity, enrolled_count, deadline 
         FROM studies 
         WHERE id = $1 
         FOR UPDATE`,
        [studyId]
      );

      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      const study = studyRes.rows[0];

      // Validate study is active
      if (study.status !== 'active') {
        throw new Error('Study is not active');
      }

      // Validate capacity
      if (study.participant_capacity && study.enrolled_count >= study.participant_capacity) {
        throw new Error('Study has reached maximum capacity');
      }

      // Validate deadline
      if (study.deadline && new Date() > new Date(study.deadline)) {
        throw new Error('Study enrollment deadline has passed');
      }

      // Check if participant is already enrolled
      const existingRes = await client.query(
        'SELECT id FROM study_participants WHERE study_id = $1 AND participant_id = $2',
        [studyId, participantId]
      );

      if (existingRes.rows[0]) {
        throw new Error('Participant is already enrolled in this study');
      }

      // Enroll participant
      const enrollRes = await client.query(
        `INSERT INTO study_participants (study_id, participant_id)
         VALUES ($1, $2)
         RETURNING id, study_id, participant_id, enrolled_at`,
        [studyId, participantId]
      );

      // Increment enrolled count
      await client.query(
        `UPDATE studies 
         SET enrolled_count = enrolled_count + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [studyId]
      );

      await client.query('COMMIT');

      const enrollment = enrollRes.rows[0];

      // Check if we should send capacity notification (90% threshold, once only)
      const newEnrolledCount = study.enrolled_count + 1;
      const shouldNotify = await emailService.shouldSendCapacityNotification(
        studyId,
        newEnrolledCount,
        study.participant_capacity
      );
      
      if (shouldNotify) {
        // Get researcher information
        const researcherRes = await pool.query(
          'SELECT s.title, u.email, u.first_name FROM studies s JOIN users u ON s.created_by = u.id WHERE s.id = $1',
          [studyId]
        );

        if (researcherRes.rows[0]) {
          const { title, email, first_name } = researcherRes.rows[0];

          // Send capacity notification (async, don't wait)
          emailService.sendCapacityApproachingNotification(
            email,
            first_name,
            title,
            newEnrolledCount,
            study.participant_capacity
          ).catch(err => console.error('Failed to send capacity notification:', err));
        }
      }

      return enrollment;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get enrolled participant count for a study
   * @param {number} studyId - Study ID
   * @returns {Promise<number>} Number of enrolled participants
   */
  async getEnrolledCount(studyId) {
    const res = await pool.query(
      'SELECT enrolled_count FROM studies WHERE id = $1',
      [studyId]
    );

    return res.rows[0] ? res.rows[0].enrolled_count : 0;
  },

  /**
   * Check if study has capacity for more participants
   * @param {number} studyId - Study ID
   * @returns {Promise<boolean>} True if has capacity, false otherwise
   */
  async hasCapacity(studyId) {
    const res = await pool.query(
      'SELECT participant_capacity, enrolled_count FROM studies WHERE id = $1',
      [studyId]
    );

    if (!res.rows[0]) {
      return false;
    }

    const { participant_capacity, enrolled_count } = res.rows[0];

    // If no capacity limit set, always has capacity
    if (!participant_capacity) {
      return true;
    }

    return enrolled_count < participant_capacity;
  },

  /**
   * Get study statistics for dashboard
   * @param {number} userId - User ID (optional, for user-specific stats)
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics(userId = null) {
    const client = await pool.connect();
    try {
      let stats = {};

      if (userId) {
        // Get user-specific statistics
        const userStatsRes = await client.query(
          `SELECT 
            COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
            COUNT(*) FILTER (WHERE status = 'active') as active_count,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
            COALESCE(SUM(enrolled_count), 0) as total_participants
           FROM studies
           WHERE created_by = $1`,
          [userId]
        );
        stats = userStatsRes.rows[0];
      } else {
        // Get platform-wide statistics (for admins)
        const platformStatsRes = await client.query(
          `SELECT 
            COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
            COUNT(*) FILTER (WHERE status = 'active') as active_count,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
            COALESCE(SUM(enrolled_count), 0) as total_participants
           FROM studies`
        );
        stats = platformStatsRes.rows[0];
      }

      // Convert string counts to integers
      return {
        draft_count: parseInt(stats.draft_count) || 0,
        active_count: parseInt(stats.active_count) || 0,
        completed_count: parseInt(stats.completed_count) || 0,
        cancelled_count: parseInt(stats.cancelled_count) || 0,
        total_participants: parseInt(stats.total_participants) || 0,
        total_studies: (parseInt(stats.draft_count) || 0) +
          (parseInt(stats.active_count) || 0) +
          (parseInt(stats.completed_count) || 0) +
          (parseInt(stats.cancelled_count) || 0)
      };
    } finally {
      client.release();
    }
  },

  /**
   * Get state transition history for a study
   * @param {number} studyId - Study ID
   * @returns {Promise<Array>} Array of state transitions with user details
   */
  async getStateTransitions(studyId) {
    const res = await pool.query(
      `SELECT 
        st.id,
        st.study_id,
        st.from_status,
        st.to_status,
        st.reason,
        st.created_at,
        st.changed_by,
        u.first_name,
        u.last_name,
        u.email
       FROM study_state_transitions st
       LEFT JOIN users u ON st.changed_by = u.id
       WHERE st.study_id = $1
       ORDER BY st.created_at ASC`,
      [studyId]
    );

    return res.rows.map(row => ({
      id: row.id,
      study_id: row.study_id,
      from_status: row.from_status,
      to_status: row.to_status,
      reason: row.reason,
      created_at: row.created_at,
      changed_by: row.changed_by ? {
        id: row.changed_by,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email
      } : null
    }));
  },

  /**
   * Get evaluation data for a study
   * @param {number} studyId - Study ID
   * @returns {Promise<Object>} Evaluation data summary
   */
  async getEvaluationData(studyId) {
    const res = await pool.query(
      `SELECT 
        COUNT(DISTINCT e.id) as total_evaluations,
        COUNT(DISTINCT e.id) FILTER (WHERE e.from_cancelled_study = true) as cancelled_study_evaluations,
        COUNT(DISTINCT e.participant_id) as unique_participants,
        COUNT(DISTINCT et.id) as total_tasks
       FROM evaluation_tasks et
       LEFT JOIN evaluations e ON et.id = e.task_id
       WHERE et.study_id = $1`,
      [studyId]
    );

    const summary = res.rows[0];

    return {
      total_evaluations: parseInt(summary.total_evaluations) || 0,
      cancelled_study_evaluations: parseInt(summary.cancelled_study_evaluations) || 0,
      unique_participants: parseInt(summary.unique_participants) || 0,
      total_tasks: parseInt(summary.total_tasks) || 0,
      has_evaluation_data: parseInt(summary.total_evaluations) > 0
    };
  },

  /**
   * Check if a study has evaluation data
   * @param {number} studyId - Study ID
   * @returns {Promise<boolean>} True if study has evaluation data
   */
  async hasEvaluationData(studyId) {
    const res = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM evaluation_tasks WHERE study_id = $1
      ) as has_data`,
      [studyId]
    );

    return res.rows[0]?.has_data || false;
  },

  /**
   * Check if participant has access to study questions (quiz/badge requirement)
   * Supports multiple required quizzes - ALL must be passed
   * @param {number} studyId - Study ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Access status with details
   */
  async checkQuizAccess(studyId, userId) {
    // Check if required_quiz_id column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'studies' AND column_name = 'required_quiz_id'
    `);
    const hasRequiredQuizIdColumn = columnCheck.rows.length > 0;

    // Get study info - conditionally include required_quiz_id if column exists
    const studyQuery = await pool.query(
      hasRequiredQuizIdColumn
        ? 'SELECT id, required_quiz_id FROM studies WHERE id = $1'
        : 'SELECT id FROM studies WHERE id = $1',
      [studyId]
    );

    if (studyQuery.rows.length === 0) {
      return {
        canAccess: false,
        reason: 'Study not found'
      };
    }

    const requiredQuizId = studyQuery.rows[0].required_quiz_id;

    // If no quiz required, participant has access
    if (!requiredQuizId) {
      return {
        canAccess: true,
        reason: 'No quiz required',
        requiresQuiz: false
      };
    }

    // Get quiz details and the badge it awards
    const quizQuery = await pool.query(
      `SELECT q.id, q.title, q.description, q.is_published,
              b.id as badge_id, b.name as badge_name, b.description as badge_description
       FROM quizzes q
       LEFT JOIN quiz_awarded_badges qab ON q.id = qab.quiz_id
       LEFT JOIN badges b ON qab.badge_id = b.id
       WHERE q.id = $1`,
      [requiredQuizId]
    );

    // Get all published quizzes assigned to this study (via study_id foreign key)
    const quizzesQuery = await pool.query(
      `SELECT q.id, q.title, q.description, q.is_published, q.is_skippable,
              b.id as badge_id, b.name as badge_name, b.description as badge_description
       FROM quizzes q
       LEFT JOIN quiz_awarded_badges qab ON q.id = qab.quiz_id
       LEFT JOIN badges b ON qab.badge_id = b.id
       WHERE q.study_id = $1 AND q.is_published = true
       ORDER BY q.created_at ASC`,
      [studyId]
    );

    // Combine quizzes from both sources (required_quiz_id and study_id)
    const allQuizzes = [];
    const seenQuizIds = new Set();

    // Add quiz from quizQuery (required_quiz_id) if it exists
    if (quizQuery.rows.length > 0) {
      const quiz = quizQuery.rows[0];
      allQuizzes.push(quiz);
      seenQuizIds.add(quiz.id);
    }

    // Add quizzes linked via study_id
    quizzesQuery.rows.forEach(quiz => {
      if (!seenQuizIds.has(quiz.id)) {
        allQuizzes.push(quiz);
        seenQuizIds.add(quiz.id);
      }
    });

    // If no quizzes required, participant has access
    if (allQuizzes.length === 0) {
      return {
        canAccess: true,
        reason: 'No quiz required',
        requiresQuiz: false,
        quizzes: []
      };
    }

    // Check each quiz - ALL quizzes must be passed
    // Note: is_skippable is ignored - badge-based skipping not implemented yet
    // Every quiz assigned to a study must be passed before accessing study tasks
    const quizStatuses = [];
    let firstNotAttempted = null;
    let firstPending = null;
    let firstFailed = null;
    let allPassed = true;

    for (const quizData of allQuizzes) {
      const quiz = {
        id: quizData.id,
        title: quizData.title,
        description: quizData.description,
        is_published: quizData.is_published,
        is_skippable: quizData.is_skippable
      };

      const requiredBadge = quizData.badge_id ? {
        id: quizData.badge_id,
        name: quizData.badge_name,
        description: quizData.badge_description
      } : null;

      // Check if user has the required badge from ANY source
      let hasBadge = false;
      if (requiredBadge) {
        const badgeQuery = await pool.query(
          `SELECT id, earned_at, earned_from_quiz_id
           FROM user_badges 
           WHERE user_id = $1 AND badge_id = $2`,
          [userId, requiredBadge.id]
        );

        if (badgeQuery.rows.length > 0) {
          hasBadge = true;
        }
      }

      // Check quiz attempt for this specific study
      // First check for study-specific attempt
      let attemptQuery = await pool.query(
        `SELECT id, score, passed, grading_status, submitted_at 
         FROM quiz_attempts 
         WHERE quiz_id = $1 AND user_id = $2 AND study_id = $3
         ORDER BY submitted_at DESC 
         LIMIT 1`,
        [quiz.id, userId, studyId]
      );

      // If no study-specific attempt, check for legacy attempts (without study_id)
      // BUT only if this quiz was originally linked to this study via quizzes.study_id
      // This prevents old attempts from blocking new studies with reused quizzes
      if (attemptQuery.rows.length === 0) {
        const quizOriginalStudy = await pool.query(
          'SELECT study_id FROM quizzes WHERE id = $1',
          [quiz.id]
        );
        const originalStudyId = quizOriginalStudy.rows[0]?.study_id;
        
        // Only use legacy attempt if this is the original study for this quiz
        if (originalStudyId === studyId) {
          attemptQuery = await pool.query(
            `SELECT id, score, passed, grading_status, submitted_at 
             FROM quiz_attempts 
             WHERE quiz_id = $1 AND user_id = $2 AND study_id IS NULL
             ORDER BY submitted_at DESC 
             LIMIT 1`,
            [quiz.id, userId]
          );
        }
      }

      const attempt = attemptQuery.rows.length > 0 ? attemptQuery.rows[0] : null;

      let status = 'not_attempted';
      let passed = false;

      // Priority order:
      // 1. Check if they took and passed the quiz → 'passed'
      // 2. Check if they have the badge (skipped quiz) → 'passed_badge'
      // 3. Otherwise: pending_grading, failed, or not_attempted

      if (attempt && attempt.passed) {
        // They took and passed the quiz
        status = 'passed';
        passed = true;
      } else if (attempt && attempt.grading_status === 'pending_grading') {
        // Quiz pending grading
        status = 'pending_grading';
        allPassed = false;
        if (!firstPending) firstPending = quiz;
      } else if (hasBadge) {
        // They have the badge but didn't pass the quiz - skipped via badge
        status = 'passed_badge';
        passed = true;
      } else if (attempt) {
        // They took the quiz but failed
        status = 'failed';
        allPassed = false;
        if (!firstFailed) firstFailed = quiz;
      } else {
        // Never attempted
        allPassed = false;
        if (!firstNotAttempted) firstNotAttempted = quiz;
      }

      quizStatuses.push({
        quiz,
        badge: requiredBadge,
        status,
        passed,
        hasBadge,
        attempt: attempt ? {
          id: attempt.id,
          score: attempt.score,
          passed: attempt.passed,
          grading_status: attempt.grading_status,
          submitted_at: attempt.submitted_at
        } : null
      });
    }

    // If all quizzes passed, grant access
    if (allPassed) {
      return {
        canAccess: true,
        reason: 'All required quizzes passed',
        requiresQuiz: true,
        quizzes: quizStatuses,
        totalQuizzes: allQuizzes.length,
        passedQuizzes: quizStatuses.filter(q => q.passed).length
      };
    }

    // Determine which quiz to redirect to (priority: not attempted > pending > failed)
    const quizToTake = firstNotAttempted || firstPending || firstFailed;

    // Determine reason
    let reason = 'Quiz not attempted';
    if (firstPending) {
      reason = 'Quiz attempt is pending grading';
    } else if (firstFailed) {
      reason = 'Quiz not passed - no retakes allowed';
    }

    return {
      canAccess: false,
      reason,
      requiresQuiz: true,
      quiz: quizToTake, // For backward compatibility - first quiz that needs attention
      quizzes: quizStatuses,
      totalQuizzes: allQuizzes.length,
      passedQuizzes: quizStatuses.filter(q => q.passed).length,
      failedQuizzes: quizStatuses.filter(q => q.status === 'failed').length,
      pendingQuizzes: quizStatuses.filter(q => q.status === 'pending_grading').length,
      notAttemptedQuizzes: quizStatuses.filter(q => q.status === 'not_attempted').length
    };
  },

  /**
   * Find all deleted studies (trash bin)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of deleted studies
   */
  async findDeleted(filters = {}) {
    let query = `
      SELECT s.id, s.title, s.description, s.status, s.previous_status, s.deadline, 
             s.participant_capacity, s.enrolled_count, s.deleted_at, s.deleted_by,
             s.created_by, s.created_at, s.updated_at,
             u.first_name as creator_first_name, 
             u.last_name as creator_last_name,
             du.first_name as deleted_by_first_name,
             du.last_name as deleted_by_last_name
      FROM studies s
      JOIN users u ON s.created_by = u.id
      LEFT JOIN users du ON s.deleted_by = du.id
      WHERE s.status = 'deleted'
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.created_by) {
      conditions.push(`s.created_by = $${paramIndex++}`);
      values.push(filters.created_by);
    }

    if (filters.deleted_by) {
      conditions.push(`s.deleted_by = $${paramIndex++}`);
      values.push(filters.deleted_by);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.deleted_at DESC';

    const res = await pool.query(query, values);
    return res.rows.map(row => ({
      ...row,
      days_in_trash: Math.floor((new Date() - new Date(row.deleted_at)) / (1000 * 60 * 60 * 24))
    }));
  },

  /**
   * Find studies eligible for permanent deletion (older than specified days)
   * @param {number} retentionDays - Number of days to keep in trash (default: 20)
   * @returns {Promise<Array>} Array of studies to be permanently deleted
   */
  async findExpiredDeleted(retentionDays = 20) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const res = await pool.query(
      `SELECT s.id, s.title, s.deleted_at, s.deleted_by,
              u.first_name as creator_first_name, 
              u.last_name as creator_last_name
       FROM studies s
       JOIN users u ON s.created_by = u.id
       WHERE s.status = 'deleted' AND s.deleted_at < $1
       ORDER BY s.deleted_at ASC`,
      [cutoffDate]
    );

    return res.rows;
  },

  /**
   * Run automatic cleanup of expired deleted studies
   * @param {number} retentionDays - Number of days to keep in trash (default: 20)
   * @returns {Promise<Object>} Cleanup results
   */
  async runCleanup(retentionDays = 20) {
    const expiredStudies = await this.findExpiredDeleted(retentionDays);
    const results = {
      processed: 0,
      deleted: 0,
      errors: []
    };

    for (const study of expiredStudies) {
      results.processed++;
      try {
        // Use system user ID (1) for automatic cleanup, or create a system user
        const systemUserId = 1; // Assuming admin user with ID 1 exists
        await this.permanentDelete(study.id, systemUserId);
        results.deleted++;
        console.log(`Automatically deleted expired study: ${study.title} (ID: ${study.id})`);
      } catch (error) {
        results.errors.push({
          study_id: study.id,
          title: study.title,
          error: error.message
        });
        console.error(`Failed to delete expired study ${study.id}:`, error);
      }
    }

    return results;
  }
};

module.exports = Study;

