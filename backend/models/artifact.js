const pool = require('../config/database');

const Artifact = {
    async create({ name, type, file_path, file_data, file_size, mime_type, content, metadata, uploaded_by, collection_id = null }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Calculate checksum if file_data is provided
            let checksum = null;
            if (file_data) {
                const crypto = require('crypto');
                checksum = crypto.createHash('sha256').update(file_data).digest('hex');
            }

            // Create artifact
            const artifactRes = await client.query(
                `INSERT INTO artifacts(name, type, file_path, file_data, file_size, mime_type, checksum, content, metadata, uploaded_by, collection_id)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING id, name, type, file_path, file_size, mime_type, storage_type, metadata, uploaded_by, collection_id, created_at`,
                [name, type, file_path, file_data, file_size, mime_type, checksum, content, JSON.stringify(metadata), uploaded_by, collection_id]
            );

            const artifact = artifactRes.rows[0];

            // Create initial metadata version
            await client.query(
                `INSERT INTO artifact_metadata_versions(artifact_id, version_number, name, type, metadata, edited_by)
VALUES($1, 1, $2, $3, $4, $5)`,
                [artifact.id, name, type, JSON.stringify(metadata), uploaded_by]
            );

            await client.query('COMMIT');
            return artifact;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async createFromBuffer({ name, type, fileBuffer, fileName, mimeType, content, metadata, uploaded_by }) {
        return this.create({
            name,
            type,
            file_path: null,
            file_data: fileBuffer,
            file_size: fileBuffer.length,
            mime_type: mimeType,
            content,
            metadata,
            uploaded_by
        });
    },

    async findById(id) {
        const res = await pool.query('SELECT * FROM artifacts WHERE id = $1', [id]);
        return res.rows[0];
    },

    async findByIdWithoutFileData(id) {
        const res = await pool.query(`
            SELECT id, name, type, file_path, file_size, mime_type, checksum,
    storage_type, content, metadata, uploaded_by, created_at 
            FROM artifacts WHERE id = $1
    `, [id]);
        return res.rows[0];
    },

    async getFileData(id) {
        const res = await pool.query('SELECT file_data, mime_type, file_size FROM artifacts WHERE id = $1', [id]);
        return res.rows[0];
    },

    async findByIdWithDetails(id) {
        const res = await pool.query(`
            SELECT a.*, u.first_name, u.last_name, u.email
            FROM artifacts a 
            JOIN users u ON a.uploaded_by = u.id 
            WHERE a.id = $1
    `, [id]);
        return res.rows[0];
    },

    async findByUserId(userId, includeDeleted = false) {
        // Check if is_deleted column exists
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'artifacts' AND column_name = 'is_deleted'
    `);
        const hasIsDeletedColumn = columnCheck.rows.length > 0;

        // Build SELECT clause based on column existence
        const selectColumns = hasIsDeletedColumn
            ? `a.id, a.name, a.type, a.file_path, a.file_size, a.mime_type, a.storage_type,
    a.metadata, a.uploaded_by, a.created_at, a.is_deleted, a.deleted_at, a.collection_id,
    LEFT(a.content, 200) as content_preview, u.first_name, u.last_name`
            : `a.id, a.name, a.type, a.file_path, a.file_size, a.mime_type, a.storage_type,
    a.metadata, a.uploaded_by, a.created_at, a.collection_id,
    LEFT(a.content, 200) as content_preview, u.first_name, u.last_name`;

        const deletedCondition = (hasIsDeletedColumn && !includeDeleted) ? 'AND a.is_deleted = false' : '';
        const res = await pool.query(
            `SELECT ${selectColumns}
             FROM artifacts a 
             JOIN users u ON a.uploaded_by = u.id 
             WHERE a.uploaded_by = $1 ${deletedCondition} ORDER BY a.created_at DESC`,
            [userId]
        );
        return res.rows;
    },

    async findAll() {
        const res = await pool.query(
            'SELECT a.id, a.name, a.type, a.file_path, a.metadata, a.created_at, u.first_name, u.last_name FROM artifacts a JOIN users u ON a.uploaded_by = u.id ORDER BY a.created_at DESC'
        );
        return res.rows;
    },

    async update(id, updateData, editedBy) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const allowed = ['name', 'type', 'metadata'];
            const fields = [];
            const values = [];
            let idx = 1;

            for (const key of allowed) {
                if (updateData[key] !== undefined) {
                    if (key === 'metadata') {
                        fields.push(`${key} = $${idx++} `);
                        values.push(JSON.stringify(updateData[key]));
                    } else {
                        fields.push(`${key} = $${idx++} `);
                        values.push(updateData[key]);
                    }
                }
            }

            if (fields.length === 0) return await this.findById(id);

            // Update the artifact
            const query = `UPDATE artifacts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, type, file_path, metadata, uploaded_by, created_at`;
            values.push(id);
            const artifactRes = await client.query(query, values);
            const artifact = artifactRes.rows[0];

            // Get next version number
            const versionRes = await client.query(
                'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM artifact_metadata_versions WHERE artifact_id = $1',
                [id]
            );
            const nextVersion = versionRes.rows[0].next_version;

            // Create new metadata version
            await client.query(
                `INSERT INTO artifact_metadata_versions(artifact_id, version_number, name, type, metadata, edited_by)
VALUES($1, $2, $3, $4, $5, $6)`,
                [id, nextVersion, artifact.name, artifact.type, artifact.metadata, editedBy]
            );

            await client.query('COMMIT');
            return artifact;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getVersionHistory(artifactId) {
        const res = await pool.query(`
            SELECT v.*, u.first_name, u.last_name, u.email
            FROM artifact_metadata_versions v
            JOIN users u ON v.edited_by = u.id
            WHERE v.artifact_id = $1
            ORDER BY v.version_number DESC
        `, [artifactId]);
        return res.rows;
    },

    async revertToVersion(artifactId, versionNumber, editedBy) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get the version data
            const versionRes = await client.query(
                'SELECT name, type, metadata FROM artifact_metadata_versions WHERE artifact_id = $1 AND version_number = $2',
                [artifactId, versionNumber]
            );

            if (versionRes.rows.length === 0) {
                throw new Error('Version not found');
            }

            const versionData = versionRes.rows[0];

            // Update the artifact
            const artifactRes = await client.query(
                'UPDATE artifacts SET name = $1, type = $2, metadata = $3 WHERE id = $4 RETURNING *',
                [versionData.name, versionData.type, versionData.metadata, artifactId]
            );

            // Get next version number
            const nextVersionRes = await client.query(
                'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM artifact_metadata_versions WHERE artifact_id = $1',
                [artifactId]
            );
            const nextVersion = nextVersionRes.rows[0].next_version;

            // Create new version entry for the revert
            await client.query(
                `INSERT INTO artifact_metadata_versions(artifact_id, version_number, name, type, metadata, edited_by)
VALUES($1, $2, $3, $4, $5, $6)`,
                [artifactId, nextVersion, versionData.name, versionData.type, versionData.metadata, editedBy]
            );

            await client.query('COMMIT');
            return artifactRes.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getMetrics(artifactId) {
        const res = await pool.query(
            'SELECT * FROM artifact_metrics WHERE artifact_id = $1 ORDER BY calculated_at DESC',
            [artifactId]
        );
        return res.rows;
    },

    async addMetric(artifactId, metricType, metricValue, metricData = {}) {
        const res = await pool.query(
            `INSERT INTO artifact_metrics(artifact_id, metric_type, metric_value, metric_data)
VALUES($1, $2, $3, $4) RETURNING * `,
            [artifactId, metricType, metricValue, JSON.stringify(metricData)]
        );
        return res.rows[0];
    },

    async getArtifactsForExport(artifactIds, userId, userRole) {
        let query = `
            SELECT a.id, a.name, a.type, a.metadata, a.created_at, u.first_name, u.last_name
            FROM artifacts a 
            JOIN users u ON a.uploaded_by = u.id 
            WHERE a.id = ANY($1)
    `;

        const params = [artifactIds];

        // If not admin or reviewer, only show user's own artifacts
        if (!['admin', 'reviewer'].includes(userRole)) {
            query += ' AND a.uploaded_by = $2';
            params.push(userId);
        }

        query += ' ORDER BY a.created_at DESC';

        const res = await pool.query(query, params);
        return res.rows;
    },

    async findWithFilters(filters = {}, userId = null, userRole = null) {
        // Check if is_deleted column exists
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'artifacts' AND column_name = 'is_deleted'
    `);
        const hasIsDeletedColumn = columnCheck.rows.length > 0;

        // Build SELECT clause based on column existence
        const selectColumns = hasIsDeletedColumn
            ? `SELECT DISTINCT a.id, a.name, a.type, a.file_path, a.file_size, a.mime_type,
    a.storage_type, a.metadata, a.uploaded_by, a.created_at, a.is_deleted, a.deleted_at, a.collection_id,
    LEFT(a.content, 200) as content_preview, u.first_name, u.last_name`
            : `SELECT DISTINCT a.id, a.name, a.type, a.file_path, a.file_size, a.mime_type,
    a.storage_type, a.metadata, a.uploaded_by, a.created_at, a.collection_id,
    LEFT(a.content, 200) as content_preview, u.first_name, u.last_name`;

        let query = `
            ${selectColumns}
            FROM artifacts a 
            JOIN users u ON a.uploaded_by = u.id
    `;

        const joins = [];
        const conditions = [];
        const params = [];
        let paramCount = 0;

        // Add tag filter (only if tags table exists)
        if (filters.tags && filters.tags.length > 0) {
            try {
                // Check if tags table exists
                const tagsTableCheck = await pool.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_name = 'tags'
    `);
                if (tagsTableCheck.rows.length > 0) {
                    joins.push('JOIN artifact_tags at ON a.id = at.artifact_id');
                    joins.push('JOIN tags t ON at.tag_id = t.id');
                    conditions.push(`t.name = ANY($${++paramCount})`);
                    params.push(filters.tags);
                }
            } catch (error) {
                console.warn('Tags table not available, skipping tag filter:', error.message);
            }
        }

        // Add study filter
        if (filters.studyId) {
            joins.push('JOIN study_artifacts sa ON a.id = sa.artifact_id');
            conditions.push(`sa.study_id = $${++paramCount} `);
            params.push(filters.studyId);
        }

        // Add type filter
        if (filters.type) {
            conditions.push(`a.type = $${++paramCount} `);
            params.push(filters.type);
        }

        // Add search filter
        if (filters.search) {
            conditions.push(`(a.name ILIKE $${++paramCount} OR a.metadata:: text ILIKE $${++paramCount})`);
            params.push(`% ${filters.search}% `, ` % ${filters.search}% `);
            paramCount++;
        }

        // Add date filter
        if (filters.dateRange) {
            const now = new Date();
            let startDate;

            switch (filters.dateRange) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
            }

            if (startDate) {
                conditions.push(`a.created_at >= $${++paramCount} `);
                params.push(startDate);
            }
        }

        // Add researcher filter
        if (filters.researcherId) {
            conditions.push(`a.uploaded_by = $${++paramCount} `);
            params.push(filters.researcherId);
        }

        // Add user filter for non-admin/reviewer users (unless overridden by researcher filter)
        if (userId && !['admin', 'reviewer'].includes(userRole) && !filters.researcherId) {
            conditions.push(`a.uploaded_by = $${++paramCount} `);
            params.push(userId);
        }

        // Apply joins
        if (joins.length > 0) {
            query += ' ' + joins.join(' ');
        }

        // Add soft deletion filter (only if column exists)
        if (hasIsDeletedColumn && !filters.includeDeleted) {
            conditions.push('a.is_deleted = false');
        }

        // Apply conditions
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY a.created_at DESC';

        const res = await pool.query(query, params);
        return res.rows;
    },

    async getStudiesForArtifact(artifactId) {
        const res = await pool.query(`
            SELECT s.id, s.title, s.status, sa.display_order, sa.created_at as assigned_at
            FROM studies s
            JOIN study_artifacts sa ON s.id = sa.study_id
            WHERE sa.artifact_id = $1
            ORDER BY sa.created_at DESC
        `, [artifactId]);
        return res.rows;
    },

    async assignToStudies(artifactId, studyIds, userId) {
        const StudyArtifact = require('./studyArtifact');
        const results = {
            assigned: [],
            failed: [],
            errors: []
        };

        for (const studyId of studyIds) {
            try {
                const studyArtifact = await StudyArtifact.addToStudy(studyId, artifactId);
                results.assigned.push({ studyId, studyArtifact });
            } catch (error) {
                results.failed.push(studyId);
                results.errors.push({
                    studyId,
                    message: error.message
                });
            }
        }

        return results;
    },

    async removeFromStudies(artifactId, studyIds) {
        const StudyArtifact = require('./studyArtifact');
        const results = {
            removed: [],
            failed: [],
            errors: []
        };

        for (const studyId of studyIds) {
            try {
                await StudyArtifact.removeFromStudy(studyId, artifactId);
                results.removed.push(studyId);
            } catch (error) {
                results.failed.push(studyId);
                results.errors.push({
                    studyId,
                    message: error.message
                });
            }
        }

        return results;
    },

    async delete(id) {
        const res = await pool.query('DELETE FROM artifacts WHERE id = $1 RETURNING id', [id]);
        return res.rowCount > 0;
    },

    async migrateFileToDatabase(id) {
        const fs = require('fs');
        const path = require('path');
        const crypto = require('crypto');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get artifact with file path
            const artifactRes = await client.query(
                'SELECT id, file_path, metadata FROM artifacts WHERE id = $1 AND file_path IS NOT NULL AND file_data IS NULL',
                [id]
            );

            if (artifactRes.rows.length === 0) {
                throw new Error('Artifact not found or already migrated');
            }

            const artifact = artifactRes.rows[0];
            const filePath = artifact.file_path;

            if (!fs.existsSync(filePath)) {
                throw new Error('File not found on filesystem');
            }

            // Read file data
            const fileBuffer = fs.readFileSync(filePath);
            const fileSize = fileBuffer.length;
            const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            // Determine MIME type from file extension or metadata
            const metadata = typeof artifact.metadata === 'string' ?
                JSON.parse(artifact.metadata) : artifact.metadata;
            const mimeType = metadata?.mimeType || 'application/octet-stream';

            // Update artifact with file data
            await client.query(
                `UPDATE artifacts 
                 SET file_data = $1, file_size = $2, mime_type = $3, checksum = $4, file_path = NULL
                 WHERE id = $5`,
                [fileBuffer, fileSize, mimeType, checksum, id]
            );

            await client.query('COMMIT');

            // Delete the file from filesystem after successful migration
            fs.unlinkSync(filePath);

            return { success: true, migratedSize: fileSize };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async migrateAllFilesToDatabase() {
        const res = await pool.query(
            'SELECT id FROM artifacts WHERE file_path IS NOT NULL AND file_data IS NULL'
        );

        const results = {
            total: res.rows.length,
            migrated: 0,
            failed: 0,
            errors: []
        };

        for (const row of res.rows) {
            try {
                await this.migrateFileToDatabase(row.id);
                results.migrated++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    artifactId: row.id,
                    error: error.message
                });
            }
        }

        return results;
    }
};

module.exports = Artifact;