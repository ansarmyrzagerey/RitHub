const pool = require('../config/database');

const QuizQuestion = {
    async create({ quizId, type, title, options, correctAnswer, isAbsolute, pointWeight, orderIndex }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if parent quiz is published
            const quizCheck = await client.query('SELECT is_published FROM quizzes WHERE id = $1', [quizId]);
            if (quizCheck.rows.length === 0) {
                throw new Error('Quiz not found');
            }
            if (quizCheck.rows[0].is_published) {
                throw new Error('Cannot add questions to published quiz');
            }

            const res = await client.query(
                `INSERT INTO quiz_questions (quiz_id, type, title, options, correct_answer, is_absolute, point_weight, order_index)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id, quiz_id, type, title, options, correct_answer, is_absolute, point_weight, order_index, created_at`,
                [quizId, type, title, JSON.stringify(options), correctAnswer, isAbsolute, pointWeight, orderIndex]
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

    async findById(id) {
        const res = await pool.query('SELECT * FROM quiz_questions WHERE id = $1', [id]);
        return res.rows[0];
    },

    async findByQuizId(quizId) {
        const res = await pool.query(
            'SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY order_index ASC',
            [quizId]
        );
        return res.rows;
    },

    async update(id, updateData) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if parent quiz is published
            const quizCheck = await client.query(`
                SELECT q.is_published 
                FROM quizzes q
                JOIN quiz_questions qq ON q.id = qq.quiz_id
                WHERE qq.id = $1
            `, [id]);

            if (quizCheck.rows.length === 0) {
                throw new Error('Question not found');
            }
            if (quizCheck.rows[0].is_published) {
                throw new Error('Cannot update questions in published quiz');
            }

            const allowed = ['type', 'title', 'options', 'correct_answer', 'is_absolute', 'point_weight', 'order_index'];
            const fields = [];
            const values = [];
            let idx = 1;

            for (const key of allowed) {
                if (updateData[key] !== undefined) {
                    if (key === 'options') {
                        fields.push(`${key} = $${idx++}`);
                        values.push(JSON.stringify(updateData[key]));
                    } else {
                        fields.push(`${key} = $${idx++}`);
                        values.push(updateData[key]);
                    }
                }
            }

            if (fields.length === 0) {
                await client.query('COMMIT');
                return await this.findById(id);
            }

            const query = `UPDATE quiz_questions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
            values.push(id);
            const res = await client.query(query, values);

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

            // Check if parent quiz is published
            const quizCheck = await client.query(`
                SELECT q.is_published 
                FROM quizzes q
                JOIN quiz_questions qq ON q.id = qq.quiz_id
                WHERE qq.id = $1
            `, [id]);

            if (quizCheck.rows.length === 0) {
                throw new Error('Question not found');
            }
            if (quizCheck.rows[0].is_published) {
                throw new Error('Cannot delete questions from published quiz');
            }

            const res = await client.query('DELETE FROM quiz_questions WHERE id = $1 RETURNING id', [id]);

            await client.query('COMMIT');
            return res.rowCount > 0;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = QuizQuestion;
