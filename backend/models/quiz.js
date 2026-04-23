const pool = require('../config/database');

const Quiz = {
    async create({ studyId, title, description, isAIGenerated, isSkippable, isPassable, isGivingBadges, passingScore, createdBy, requiredBadges = [], awardedBadges = [] }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const quizRes = await client.query(
                `INSERT INTO quizzes (study_id, title, description, is_ai_generated, is_skippable, is_passable, is_giving_badges, is_published, passing_score, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                 RETURNING id, study_id, title, description, is_ai_generated, is_skippable, is_passable, is_giving_badges, is_published, passing_score, created_by, created_at`,
                [studyId, title, description, isAIGenerated, isSkippable, isPassable, isGivingBadges, false, passingScore, createdBy]
            );

            const quiz = quizRes.rows[0];

            // Insert required badges
            if (requiredBadges.length > 0) {
                const requiredValues = requiredBadges.map((_, idx) =>
                    `($1, $${idx + 2})`
                ).join(', ');
                await client.query(
                    `INSERT INTO quiz_required_badges (quiz_id, badge_id) VALUES ${requiredValues}`,
                    [quiz.id, ...requiredBadges]
                );
            }

            // Insert awarded badges
            if (awardedBadges.length > 0) {
                const awardedValues = awardedBadges.map((_, idx) =>
                    `($1, $${idx + 2})`
                ).join(', ');
                await client.query(
                    `INSERT INTO quiz_awarded_badges (quiz_id, badge_id) VALUES ${awardedValues}`,
                    [quiz.id, ...awardedBadges]
                );
            }

            // If quiz is created with a studyId, set it as required_quiz_id
            // This ensures that quizzes added to a study during creation are marked as required
            if (studyId) {
                await client.query(
                    'UPDATE studies SET required_quiz_id = $1 WHERE id = $2',
                    [quiz.id, studyId]
                );
            }

            await client.query('COMMIT');
            return quiz;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async findById(id) {
        const res = await pool.query('SELECT * FROM quizzes WHERE id = $1', [id]);
        return res.rows[0];
    },

    /**
     * Get the count of studies a quiz is assigned to
     * @param {number} quizId - Quiz ID
     * @returns {Promise<number>} Number of studies the quiz is assigned to
     */
    async getAssignedStudiesCount(quizId) {
        const res = await pool.query(
            'SELECT COUNT(*) as count FROM study_quizzes WHERE quiz_id = $1',
            [quizId]
        );
        return parseInt(res.rows[0].count);
    },

    /**
     * Get all studies a quiz is assigned to
     * @param {number} quizId - Quiz ID
     * @returns {Promise<Array>} Array of study objects
     */
    async getAssignedStudies(quizId) {
        const res = await pool.query(
            `SELECT s.id, s.title, s.status, sq.assigned_at
             FROM studies s
             JOIN study_quizzes sq ON s.id = sq.study_id
             WHERE sq.quiz_id = $1
             ORDER BY sq.assigned_at DESC`,
            [quizId]
        );
        return res.rows;
    },

    /**
     * Check if a quiz is assigned to any study
     * @param {number} quizId - Quiz ID
     * @returns {Promise<boolean>} True if assigned to at least one study
     */
    async isAssignedToAnyStudy(quizId) {
        const count = await this.getAssignedStudiesCount(quizId);
        return count > 0;
    },

    async update(id, updateData, requiredBadges, awardedBadges) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if quiz exists and is published
            const publishCheck = await client.query('SELECT is_published, study_id FROM quizzes WHERE id = $1', [id]);
            if (publishCheck.rows.length === 0) {
                throw new Error('Quiz not found');
            }
            if (publishCheck.rows[0].is_published) {
                throw new Error('Cannot update published quiz');
            }

            // Check if quiz is assigned to ANY study via junction table
            const assignmentCheck = await client.query(
                'SELECT COUNT(*) as count FROM study_quizzes WHERE quiz_id = $1',
                [id]
            );
            const assignedCount = parseInt(assignmentCheck.rows[0].count);

            if (assignedCount > 0 || publishCheck.rows[0].study_id !== null) {
                throw new Error('Cannot update quiz that is connected to a study');
            }

            const allowed = ['title', 'description', 'is_ai_generated', 'is_skippable', 'is_passable', 'is_giving_badges', 'passing_score'];
            const fields = [];
            const values = [];
            let idx = 1;

            for (const key of allowed) {
                if (updateData[key] !== undefined) {
                    fields.push(`${key} = $${idx++}`);
                    values.push(updateData[key]);
                }
            }

            if (fields.length === 0 && requiredBadges === undefined && awardedBadges === undefined) {
                await client.query('COMMIT');
                return await this.findById(id);
            }

            // Update quiz if there are field changes
            if (fields.length > 0) {
                const query = `UPDATE quizzes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
                values.push(id);
                await client.query(query, values);
            }

            // Update required badges if provided
            if (requiredBadges !== undefined) {
                await client.query('DELETE FROM quiz_required_badges WHERE quiz_id = $1', [id]);
                if (requiredBadges.length > 0) {
                    const requiredValues = requiredBadges.map((_, idx) =>
                        `($1, $${idx + 2})`
                    ).join(', ');
                    await client.query(
                        `INSERT INTO quiz_required_badges (quiz_id, badge_id) VALUES ${requiredValues}`,
                        [id, ...requiredBadges]
                    );
                }
            }

            // Update awarded badges if provided
            if (awardedBadges !== undefined) {
                await client.query('DELETE FROM quiz_awarded_badges WHERE quiz_id = $1', [id]);
                if (awardedBadges.length > 0) {
                    const awardedValues = awardedBadges.map((_, idx) =>
                        `($1, $${idx + 2})`
                    ).join(', ');
                    await client.query(
                        `INSERT INTO quiz_awarded_badges (quiz_id, badge_id) VALUES ${awardedValues}`,
                        [id, ...awardedBadges]
                    );
                }
            }

            await client.query('COMMIT');
            return await this.findById(id);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async publish(id) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const res = await client.query(
                'UPDATE quizzes SET is_published = true WHERE id = $1 AND is_published = false RETURNING *',
                [id]
            );

            if (res.rows.length === 0) {
                throw new Error('Quiz not found or already published');
            }

            await client.query('COMMIT');
            return res.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async delete(id) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if quiz exists
            const quizCheck = await client.query('SELECT id, study_id, title FROM quizzes WHERE id = $1', [id]);
            if (quizCheck.rows.length === 0) {
                throw new Error('Quiz not found');
            }

            const quiz = quizCheck.rows[0];
            console.log(`[Quiz Delete] Attempting to delete quiz ${id} (title: "${quiz.title}")`);

            // Check if quiz is assigned to ANY study via junction table
            const assignmentCheck = await client.query(
                'SELECT COUNT(*) as count FROM study_quizzes WHERE quiz_id = $1',
                [id]
            );
            const assignedCount = parseInt(assignmentCheck.rows[0].count);

            if (assignedCount > 0) {
                console.log(`[Quiz Delete] Cannot delete quiz ${id} - it is assigned to ${assignedCount} study/studies`);
                throw new Error('Cannot delete quiz that is connected to a study');
            }

            // Also check legacy study_id column for backward compatibility
            if (quiz.study_id !== null) {
                console.log(`[Quiz Delete] Cannot delete quiz ${id} - it has legacy study_id ${quiz.study_id}`);
                throw new Error('Cannot delete quiz that is connected to a study');
            }

            const res = await client.query('DELETE FROM quizzes WHERE id = $1 RETURNING id', [id]);

            await client.query('COMMIT');
            console.log(`[Quiz Delete] Successfully deleted quiz ${id}`);
            return res.rowCount > 0;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`[Quiz Delete] Error deleting quiz ${id}:`, error.message);
            throw error;
        } finally {
            client.release();
        }
    },

    async checkUserEligibility(quizId, userId) {
        const res = await pool.query(`
            SELECT 
                q.is_passable,
                COALESCE(
                    (SELECT COUNT(*) FROM quiz_required_badges WHERE quiz_id = $1), 
                    0
                ) as required_count,
                COALESCE(
                    (SELECT COUNT(*) 
                     FROM quiz_required_badges qrb
                     JOIN user_badges ub ON qrb.badge_id = ub.badge_id
                     WHERE qrb.quiz_id = $1 AND ub.user_id = $2),
                    0
                ) as user_has_count
            FROM quizzes q
            WHERE q.id = $1
        `, [quizId, userId]);

        const result = res.rows[0];
        if (!result) return { eligible: false, reason: 'Quiz not found' };

        if (!result.is_passable) return { eligible: true };

        const eligible = result.required_count === result.user_has_count;
        return {
            eligible,
            reason: eligible ? null : `Missing ${result.required_count - result.user_has_count} required badge(s)`
        };
    },

    async awardBadges(quizId, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get quiz info
            const quizRes = await client.query(
                'SELECT is_giving_badges FROM quizzes WHERE id = $1',
                [quizId]
            );

            if (quizRes.rows.length === 0 || !quizRes.rows[0].is_giving_badges) {
                await client.query('COMMIT');
                return [];
            }

            // Get badges to award that user doesn't already have
            const badgesToAward = await client.query(`
                SELECT qab.badge_id
                FROM quiz_awarded_badges qab
                WHERE qab.quiz_id = $1
                AND NOT EXISTS (
                    SELECT 1 FROM user_badges ub 
                    WHERE ub.user_id = $2 AND ub.badge_id = qab.badge_id
                )
            `, [quizId, userId]);

            const awardedBadges = [];
            for (const row of badgesToAward.rows) {
                try {
                    // Try with earned_from_quiz_id column
                    const result = await client.query(
                        `INSERT INTO user_badges (user_id, badge_id, earned_from_quiz_id)
                         VALUES ($1, $2, $3) RETURNING *`,
                        [userId, row.badge_id, quizId]
                    );
                    awardedBadges.push(result.rows[0]);
                } catch (insertError) {
                    // If column doesn't exist, try without it
                    if (insertError.message.includes('earned_from_quiz_id') || insertError.code === '42703') {
                        const result = await client.query(
                            `INSERT INTO user_badges (user_id, badge_id)
                             VALUES ($1, $2) RETURNING *`,
                            [userId, row.badge_id]
                        );
                        awardedBadges.push(result.rows[0]);
                    } else {
                        throw insertError;
                    }
                }
            }

            await client.query('COMMIT');
            return awardedBadges;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getUserBadges(userId) {
        const res = await pool.query(`
            SELECT ub.*, b.name, b.description
            FROM user_badges ub
            JOIN badges b ON ub.badge_id = b.id
            WHERE ub.user_id = $1
            ORDER BY ub.earned_at DESC
        `, [userId]);
        return res.rows;
    }
};

module.exports = Quiz;
