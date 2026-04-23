const pool = require('../config/database');

class PolicyService {
  
  // File Policy Management
  async createFilePolicy({ policyName, policyType, targetId, allowedFileTypes, maxFileSize, createdBy }) {
    const result = await pool.query(
      `INSERT INTO admin_file_policies (policy_name, policy_type, target_id, allowed_file_types, max_file_size, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [policyName, policyType, targetId, allowedFileTypes, maxFileSize, createdBy]
    );
    return result.rows[0];
  }

  async getFilePolicies(activeOnly = true) {
    const query = activeOnly 
      ? 'SELECT * FROM admin_file_policies WHERE is_active = true ORDER BY policy_type, created_at'
      : 'SELECT * FROM admin_file_policies ORDER BY policy_type, created_at';
    
    const result = await pool.query(query);
    return result.rows;
  }

  async getFilePolicyForUser(userId) {
    // Check for user-specific policy first
    let result = await pool.query(
      'SELECT * FROM admin_file_policies WHERE policy_type = $1 AND target_id = $2 AND is_active = true',
      ['user', userId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Fall back to global policy
    result = await pool.query(
      'SELECT * FROM admin_file_policies WHERE policy_type = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      ['global']
    );
    
    return result.rows[0] || null;
  }

  async updateFilePolicy(policyId, updates) {
    const allowedFields = ['policy_name', 'allowed_file_types', 'max_file_size', 'is_active'];
    // Map camelCase to snake_case for frontend compatibility
    const fieldMapping = {
      'policyName': 'policy_name',
      'allowedFileTypes': 'allowed_file_types',
      'maxFileSize': 'max_file_size',
      'isActive': 'is_active'
    };
    
    const fields = [];
    const values = [];
    let idx = 1;

    console.log('updateFilePolicy - Received updates:', JSON.stringify(updates));
    console.log('updateFilePolicy - Updates keys:', Object.keys(updates));

    for (const [key, value] of Object.entries(updates)) {
      // Convert camelCase to snake_case if needed
      const dbFieldName = fieldMapping[key] || key;
      
      // Only process fields that are in the allowed list
      if (!allowedFields.includes(dbFieldName)) {
        console.log(`Skipping field ${key} (${dbFieldName}) - not in allowed fields`);
        continue;
      }

      // Skip null or undefined values (but allow empty strings, 0, false, empty arrays)
      if (value === null || value === undefined) {
        console.log(`Skipping ${key} because value is null/undefined`);
        continue;
      }

      console.log(`Processing field: ${key} -> ${dbFieldName}, value:`, value, `type:`, typeof value);
      
      fields.push(`${dbFieldName} = $${idx++}`);
      values.push(value);
      console.log(`Added field ${dbFieldName} to update list`);
    }

    console.log('Final fields to update:', fields);
    console.log('Final values:', values);

    if (fields.length === 0) {
      throw new Error('No valid fields to update. Allowed fields: ' + allowedFields.join(', ') + '. Received: ' + Object.keys(updates).join(', '));
    }

    fields.push(`updated_at = NOW()`);
    values.push(policyId);

    const query = `UPDATE admin_file_policies SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  }

  async deleteFilePolicy(policyId) {
    const result = await pool.query('DELETE FROM admin_file_policies WHERE id = $1 RETURNING id', [policyId]);
    return result.rowCount > 0;
  }

  // Storage Quota Management
  async createStorageQuota({ quotaType, targetId, maxStorageBytes, maxArtifacts, createdBy }) {
    const result = await pool.query(
      `INSERT INTO storage_quotas (quota_type, target_id, max_storage_bytes, max_artifacts, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [quotaType, targetId, maxStorageBytes, maxArtifacts, createdBy]
    );
    return result.rows[0];
  }

  async getStorageQuotas(activeOnly = true) {
    const query = activeOnly 
      ? `SELECT sq.*, u.first_name, u.last_name, u.email 
         FROM storage_quotas sq 
         LEFT JOIN users u ON sq.target_id = u.id AND sq.quota_type = 'user'
         WHERE sq.is_active = true 
         ORDER BY sq.quota_type, sq.created_at`
      : `SELECT sq.*, u.first_name, u.last_name, u.email 
         FROM storage_quotas sq 
         LEFT JOIN users u ON sq.target_id = u.id AND sq.quota_type = 'user'
         ORDER BY sq.quota_type, sq.created_at`;
    
    const result = await pool.query(query);
    return result.rows;
  }

  async getStorageQuotaForUser(userId) {
    // Check for user-specific quota first
    let result = await pool.query(
      'SELECT * FROM storage_quotas WHERE quota_type = $1 AND target_id = $2 AND is_active = true',
      ['user', userId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Fall back to global quota
    result = await pool.query(
      'SELECT * FROM storage_quotas WHERE quota_type = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      ['global']
    );
    
    return result.rows[0] || null;
  }

  async updateStorageQuota(quotaId, updates) {
    const allowedFields = ['max_storage_bytes', 'max_artifacts', 'is_active'];
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
    values.push(quotaId);

    const query = `UPDATE storage_quotas SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  }

  async deleteStorageQuota(quotaId) {
    const result = await pool.query('DELETE FROM storage_quotas WHERE id = $1 RETURNING id', [quotaId]);
    return result.rowCount > 0;
  }

  // Usage Tracking
  async updateStorageUsage(userId, sizeChange, artifactId = null, action = 'upload') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current usage
      const currentUsage = await this.getCurrentStorageUsage(userId);
      const newUsage = Math.max(0, currentUsage + sizeChange);

      // Update user-specific quota if exists
      await client.query(
        `UPDATE storage_quotas 
         SET current_usage_bytes = $1, 
             current_artifact_count = current_artifact_count + $2,
             updated_at = NOW()
         WHERE quota_type = 'user' AND target_id = $3`,
        [newUsage, action === 'upload' ? 1 : (action === 'delete' ? -1 : 0), userId]
      );

      // Log the usage change
      await client.query(
        `INSERT INTO storage_usage_history (user_id, artifact_id, action, size_change, total_usage_after)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, artifactId, action, sizeChange, newUsage]
      );

      await client.query('COMMIT');
      return newUsage;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCurrentStorageUsage(userId) {
    // Calculate current usage from artifacts table
    const result = await pool.query(
      `SELECT COALESCE(SUM(file_size), 0) as total_usage 
       FROM artifacts 
       WHERE uploaded_by = $1`,
      [userId]
    );
    return parseInt(result.rows[0].total_usage) || 0;
  }

  async getUserStorageStats(userId) {
    const quota = await this.getStorageQuotaForUser(userId);
    const currentUsage = await this.getCurrentStorageUsage(userId);
    
    const artifactCount = await pool.query(
      'SELECT COUNT(*) as count FROM artifacts WHERE uploaded_by = $1',
      [userId]
    );

    return {
      quota: quota,
      currentUsage: currentUsage,
      currentArtifactCount: parseInt(artifactCount.rows[0].count),
      usagePercentage: quota ? Math.round((currentUsage / quota.max_storage_bytes) * 100) : 0,
      remainingBytes: quota ? Math.max(0, quota.max_storage_bytes - currentUsage) : null,
      remainingArtifacts: quota && quota.max_artifacts ? Math.max(0, quota.max_artifacts - parseInt(artifactCount.rows[0].count)) : null
    };
  }

  // Policy Validation
  async validateFileUpload(userId, fileName, fileSize, fileType) {
    const violations = [];
    
    // Get applicable file policy
    const filePolicy = await this.getFilePolicyForUser(userId);
    if (filePolicy) {
      // Check file type
      if (!filePolicy.allowed_file_types.includes(fileType.toLowerCase())) {
        violations.push({
          type: 'file_type',
          message: `File type ${fileType} is not allowed. Allowed types: ${filePolicy.allowed_file_types.join(', ')}`,
          policy: filePolicy
        });
      }

      // Check file size
      if (fileSize > filePolicy.max_file_size) {
        violations.push({
          type: 'file_size',
          message: `File size ${this.formatBytes(fileSize)} exceeds maximum allowed size of ${this.formatBytes(filePolicy.max_file_size)}`,
          policy: filePolicy
        });
      }
    }

    // Get applicable storage quota
    const quota = await this.getStorageQuotaForUser(userId);
    if (quota) {
      const currentUsage = await this.getCurrentStorageUsage(userId);
      
      // Check storage quota
      if (currentUsage + fileSize > quota.max_storage_bytes) {
        violations.push({
          type: 'storage_quota',
          message: `Upload would exceed storage quota. Current: ${this.formatBytes(currentUsage)}, Quota: ${this.formatBytes(quota.max_storage_bytes)}`,
          quota: quota
        });
      }

      // Check artifact count
      if (quota.max_artifacts) {
        const artifactCount = await pool.query(
          'SELECT COUNT(*) as count FROM artifacts WHERE uploaded_by = $1',
          [userId]
        );
        
        if (parseInt(artifactCount.rows[0].count) >= quota.max_artifacts) {
          violations.push({
            type: 'artifact_count',
            message: `Maximum number of artifacts (${quota.max_artifacts}) reached`,
            quota: quota
          });
        }
      }
    }

    return violations;
  }

  async logPolicyViolation(userId, violationType, attemptedAction, fileName, fileSize, fileType, errorMessage) {
    await pool.query(
      `INSERT INTO policy_violations (user_id, violation_type, attempted_action, file_name, file_size, file_type, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, violationType, attemptedAction, fileName, fileSize, fileType, errorMessage]
    );
  }

  // Storage Analytics
  async getStorageAnalytics() {
    const totalUsage = await pool.query(
      'SELECT COALESCE(SUM(file_size), 0) as total FROM artifacts'
    );

    const userUsage = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email,
             COALESCE(SUM(a.file_size), 0) as usage,
             COUNT(a.id) as artifact_count
      FROM users u
      LEFT JOIN artifacts a ON u.id = a.uploaded_by
      WHERE u.role = 'researcher'
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY usage DESC
    `);

    const recentViolations = await pool.query(`
      SELECT pv.*, u.first_name, u.last_name, u.email
      FROM policy_violations pv
      JOIN users u ON pv.user_id = u.id
      ORDER BY pv.created_at DESC
      LIMIT 50
    `);

    return {
      totalUsage: parseInt(totalUsage.rows[0].total),
      userUsage: userUsage.rows,
      recentViolations: recentViolations.rows
    };
  }

  // Utility functions
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = new PolicyService();