const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

class RetentionService {
  
  // Retention Policy Management
  async createRetentionPolicy({ policyName, policyType, targetId, targetArtifactType, retentionDays, autoDelete, createdBy }) {
    const result = await pool.query(
      `INSERT INTO retention_policies (policy_name, policy_type, target_id, target_artifact_type, retention_days, auto_delete, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [policyName, policyType, targetId, targetArtifactType, retentionDays, autoDelete, createdBy]
    );
    return result.rows[0];
  }

  async getRetentionPolicies(activeOnly = true) {
    const query = activeOnly 
      ? `SELECT rp.*, u.first_name, u.last_name 
         FROM retention_policies rp 
         LEFT JOIN users u ON rp.target_id = u.id AND rp.policy_type = 'user'
         WHERE rp.is_active = true 
         ORDER BY rp.policy_type, rp.created_at`
      : `SELECT rp.*, u.first_name, u.last_name 
         FROM retention_policies rp 
         LEFT JOIN users u ON rp.target_id = u.id AND rp.policy_type = 'user'
         ORDER BY rp.policy_type, rp.created_at`;
    
    const result = await pool.query(query);
    return result.rows;
  }

  async getRetentionPolicyForArtifact(artifactId) {
    // Get artifact details first
    const artifactResult = await pool.query(
      'SELECT uploaded_by, type FROM artifacts WHERE id = $1',
      [artifactId]
    );
    
    if (artifactResult.rows.length === 0) {
      return null;
    }
    
    const artifact = artifactResult.rows[0];
    
    // Check for user-specific policy first
    let result = await pool.query(
      'SELECT * FROM retention_policies WHERE policy_type = $1 AND target_id = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      ['user', artifact.uploaded_by]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Check for artifact type-specific policy
    result = await pool.query(
      'SELECT * FROM retention_policies WHERE policy_type = $1 AND target_artifact_type = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      ['artifact_type', artifact.type]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Fall back to global policy
    result = await pool.query(
      'SELECT * FROM retention_policies WHERE policy_type = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      ['global']
    );
    
    return result.rows[0] || null;
  }

  async updateRetentionPolicy(policyId, updates) {
    const allowedFields = ['policy_name', 'retention_days', 'auto_delete', 'is_active'];
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(policyId);

    const query = `UPDATE retention_policies SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  }

  async deleteRetentionPolicy(policyId) {
    const result = await pool.query('DELETE FROM retention_policies WHERE id = $1 RETURNING id', [policyId]);
    return result.rowCount > 0;
  }

  // Soft Deletion Operations
  async softDeleteArtifact(artifactId, deletedBy, reason = 'Manual deletion') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get the artifact data
      const artifactResult = await client.query('SELECT * FROM artifacts WHERE id = $1 AND is_deleted = false', [artifactId]);
      if (artifactResult.rows.length === 0) {
        throw new Error('Artifact not found or already deleted');
      }

      const artifact = artifactResult.rows[0];

      // Get applicable retention policy
      const policy = await this.getRetentionPolicyForArtifact(artifactId);
      const retentionDays = policy ? policy.retention_days : 90; // Default 90 days
      const scheduledPurgeAt = new Date();
      scheduledPurgeAt.setDate(scheduledPurgeAt.getDate() + retentionDays);

      // Create deleted artifact record
      const deletedArtifactResult = await client.query(
        `INSERT INTO deleted_artifacts (
          original_artifact_id, artifact_data, file_data, file_path, 
          deleted_by, deletion_reason, scheduled_purge_at, retention_policy_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          artifactId,
          JSON.stringify(artifact),
          artifact.file_data,
          artifact.file_path,
          deletedBy,
          reason,
          scheduledPurgeAt,
          policy ? policy.id : null
        ]
      );

      const deletedArtifactId = deletedArtifactResult.rows[0].id;

      // Mark original artifact as deleted
      await client.query(
        'UPDATE artifacts SET is_deleted = true, deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
        [deletedBy, artifactId]
      );

      // Log the operation
      await client.query(
        `INSERT INTO retention_audit_log (operation, artifact_id, deleted_artifact_id, user_id, policy_id, operation_data)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'soft_delete',
          artifactId,
          deletedArtifactId,
          deletedBy,
          policy ? policy.id : null,
          JSON.stringify({ reason, scheduled_purge_at: scheduledPurgeAt })
        ]
      );

      await client.query('COMMIT');
      return { deletedArtifactId, scheduledPurgeAt };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async restoreArtifact(deletedArtifactId, restoredBy) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get the deleted artifact
      const deletedResult = await client.query(
        'SELECT * FROM deleted_artifacts WHERE id = $1 AND is_restored = false',
        [deletedArtifactId]
      );

      if (deletedResult.rows.length === 0) {
        throw new Error('Deleted artifact not found or already restored');
      }

      const deletedArtifact = deletedResult.rows[0];
      const originalData = deletedArtifact.artifact_data;

      // Restore the original artifact
      await client.query(
        'UPDATE artifacts SET is_deleted = false, deleted_at = NULL, deleted_by = NULL WHERE id = $1',
        [deletedArtifact.original_artifact_id]
      );

      // Mark deleted artifact as restored
      await client.query(
        'UPDATE deleted_artifacts SET is_restored = true, restored_by = $1, restored_at = NOW() WHERE id = $2',
        [restoredBy, deletedArtifactId]
      );

      // Log the operation
      await client.query(
        `INSERT INTO retention_audit_log (operation, artifact_id, deleted_artifact_id, user_id, operation_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'restore',
          deletedArtifact.original_artifact_id,
          deletedArtifactId,
          restoredBy,
          JSON.stringify({ restored_at: new Date() })
        ]
      );

      await client.query('COMMIT');
      return deletedArtifact.original_artifact_id;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Permanent Deletion (Cleanup)
  async permanentlyDeleteArtifact(deletedArtifactId, deletedBy = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get the deleted artifact
      const deletedResult = await client.query(
        'SELECT * FROM deleted_artifacts WHERE id = $1',
        [deletedArtifactId]
      );

      if (deletedResult.rows.length === 0) {
        throw new Error('Deleted artifact not found');
      }

      const deletedArtifact = deletedResult.rows[0];

      // Delete file from filesystem if it exists
      if (deletedArtifact.file_path && fs.existsSync(deletedArtifact.file_path)) {
        try {
          fs.unlinkSync(deletedArtifact.file_path);
        } catch (fileError) {
          console.error('Error deleting file:', fileError);
          // Continue with database cleanup even if file deletion fails
        }
      }

      // Remove from original artifacts table
      await client.query('DELETE FROM artifacts WHERE id = $1', [deletedArtifact.original_artifact_id]);

      // Log the permanent deletion
      await client.query(
        `INSERT INTO retention_audit_log (operation, artifact_id, deleted_artifact_id, user_id, operation_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'permanent_delete',
          deletedArtifact.original_artifact_id,
          deletedArtifactId,
          deletedBy,
          JSON.stringify({ 
            permanently_deleted_at: new Date(),
            file_path: deletedArtifact.file_path,
            file_size: deletedArtifact.artifact_data?.file_size || 0
          })
        ]
      );

      // Remove from deleted_artifacts table
      await client.query('DELETE FROM deleted_artifacts WHERE id = $1', [deletedArtifactId]);

      await client.query('COMMIT');
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Automated Cleanup Operations
  async runRetentionCleanup() {
    const client = await pool.connect();
    try {
      // Create cleanup job record
      const jobResult = await client.query(
        `INSERT INTO cleanup_jobs (job_type, status, started_at) 
         VALUES ('retention_cleanup', 'running', NOW()) RETURNING id`
      );
      const jobId = jobResult.rows[0].id;

      let processedCount = 0;
      let deletedCount = 0;
      let errorCount = 0;
      const errors = [];

      try {
        // Find artifacts that are past their retention period
        const expiredResult = await client.query(`
          SELECT da.id, da.original_artifact_id, da.scheduled_purge_at
          FROM deleted_artifacts da
          WHERE da.scheduled_purge_at <= NOW() 
            AND da.is_restored = false
          ORDER BY da.scheduled_purge_at
        `);

        processedCount = expiredResult.rows.length;

        for (const expiredArtifact of expiredResult.rows) {
          try {
            await this.permanentlyDeleteArtifact(expiredArtifact.id);
            deletedCount++;
          } catch (error) {
            errorCount++;
            errors.push({
              deletedArtifactId: expiredArtifact.id,
              originalArtifactId: expiredArtifact.original_artifact_id,
              error: error.message
            });
            console.error(`Error permanently deleting artifact ${expiredArtifact.id}:`, error);
          }
        }

        // Update job status
        await client.query(
          `UPDATE cleanup_jobs 
           SET status = 'completed', completed_at = NOW(), processed_count = $1, 
               deleted_count = $2, error_count = $3, error_details = $4
           WHERE id = $5`,
          [processedCount, deletedCount, errorCount, JSON.stringify(errors), jobId]
        );

        return {
          jobId,
          processedCount,
          deletedCount,
          errorCount,
          errors
        };

      } catch (error) {
        // Update job status to failed
        await client.query(
          `UPDATE cleanup_jobs 
           SET status = 'failed', completed_at = NOW(), processed_count = $1, 
               deleted_count = $2, error_count = $3, error_details = $4
           WHERE id = $5`,
          [processedCount, deletedCount, errorCount + 1, JSON.stringify([...errors, { error: error.message }]), jobId]
        );
        throw error;
      }

    } finally {
      client.release();
    }
  }

  // Query Operations
  async getDeletedArtifacts(options = {}) {
    const { userId, includeRestored = false, limit = 100, offset = 0 } = options;
    
    let query = `
      SELECT da.*, u1.first_name as deleted_by_first_name, u1.last_name as deleted_by_last_name,
             u2.first_name as restored_by_first_name, u2.last_name as restored_by_last_name,
             rp.policy_name, rp.retention_days
      FROM deleted_artifacts da
      LEFT JOIN users u1 ON da.deleted_by = u1.id
      LEFT JOIN users u2 ON da.restored_by = u2.id
      LEFT JOIN retention_policies rp ON da.retention_policy_id = rp.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    if (userId) {
      query += ` AND (da.artifact_data->>'uploaded_by')::integer = $${++paramCount}`;
      params.push(userId);
    }

    if (!includeRestored) {
      query += ` AND da.is_restored = false`;
    }

    query += ` ORDER BY da.deleted_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getRetentionStats() {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_deleted,
        COUNT(*) FILTER (WHERE is_restored = false) as pending_deletion,
        COUNT(*) FILTER (WHERE is_restored = true) as restored,
        COUNT(*) FILTER (WHERE scheduled_purge_at <= NOW() AND is_restored = false) as ready_for_purge,
        AVG(EXTRACT(days FROM (scheduled_purge_at - deleted_at))) as avg_retention_days
      FROM deleted_artifacts
    `);

    const recentJobs = await pool.query(`
      SELECT * FROM cleanup_jobs 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    return {
      ...stats.rows[0],
      recentJobs: recentJobs.rows
    };
  }

  async getAuditLog(options = {}) {
    const { artifactId, operation, limit = 50, offset = 0 } = options;
    
    let query = `
      SELECT ral.*, u.first_name, u.last_name, rp.policy_name
      FROM retention_audit_log ral
      LEFT JOIN users u ON ral.user_id = u.id
      LEFT JOIN retention_policies rp ON ral.policy_id = rp.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    if (artifactId) {
      query += ` AND ral.artifact_id = $${++paramCount}`;
      params.push(artifactId);
    }

    if (operation) {
      query += ` AND ral.operation = $${++paramCount}`;
      params.push(operation);
    }

    query += ` ORDER BY ral.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Utility functions
  formatRetentionPeriod(days) {
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''}`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''}`;
    if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''}`;
    return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''}`;
  }

  getDaysUntilPurge(scheduledPurgeAt) {
    const now = new Date();
    const purgeDate = new Date(scheduledPurgeAt);
    const diffTime = purgeDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}

module.exports = new RetentionService();