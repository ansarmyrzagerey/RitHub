/**
 * Task Generation Service
 * Automatically generates evaluation tasks from study questions
 */

const pool = require('../config/database');
const StudyQuestion = require('../models/studyQuestion');

const TaskGenerationService = {
  /**
   * Generate evaluation tasks from study questions
   * Called when a study is activated
   * @param {number} studyId - Study ID
   * @param {Object} options - Optional parameters
   * @param {Object} options.client - Database client to use (for transaction support)
   * @returns {Promise<Object>} Generation results
   */
  async generateTasksFromQuestions(studyId, options = {}) {
    const useExternalClient = !!options.client;
    const client = options.client || await pool.connect();
    try {
      if (!useExternalClient) {
        await client.query('BEGIN');
      }

      // Get all questions for the study (use transaction client if available)
      const questions = await StudyQuestion.findByStudyId(studyId, { client });

      if (questions.length === 0) {
        throw new Error('No questions found for this study. Please add questions before activating.');
      }

      // Validate all questions have required data
      console.log('=== VALIDATING QUESTIONS ===');
      console.log('Total questions found:', questions.length);
      console.log('Questions to validate:', questions.map(q => ({
        id: q.id,
        title: q.title,
        type: q.question_type,
        artifactCount: q.artifacts?.length || 0,
        criteriaCount: q.criteria?.length || 0,
        artifacts: q.artifacts ? q.artifacts.map(a => ({ id: a.id, artifact_id: a.artifact_id })) : [],
        criteria: q.criteria ? q.criteria.map(c => ({ id: c.id, name: c.name })) : []
      })));
      
      const invalidQuestions = questions.filter(q => {
        // Check if question_type exists
        if (!q.question_type) {
          console.error(`Question "${q.title}" (ID: ${q.id}) is missing question_type. This may indicate a database schema issue.`);
          return true;
        }
        
        // Check if artifacts array exists and is properly initialized
        if (!q.artifacts) {
          console.error(`Question "${q.title}" (ID: ${q.id}): artifacts is undefined`);
          q.artifacts = [];
        }
        if (!Array.isArray(q.artifacts)) {
          console.error(`Question "${q.title}" (ID: ${q.id}): artifacts is not an array:`, typeof q.artifacts);
          q.artifacts = [];
        }
        
        // Check if criteria array exists and is properly initialized
        if (!q.criteria) {
          console.error(`Question "${q.title}" (ID: ${q.id}): criteria is undefined`);
          q.criteria = [];
        }
        if (!Array.isArray(q.criteria)) {
          console.error(`Question "${q.title}" (ID: ${q.id}): criteria is not an array:`, typeof q.criteria);
          q.criteria = [];
        }
        
        const hasArtifacts = q.artifacts && q.artifacts.length > 0;
        const hasCriteria = q.criteria && q.criteria.length > 0;
        
        console.log(`Validating question "${q.title}" (ID: ${q.id}):`, {
          type: q.question_type,
          hasArtifacts,
          artifactCount: q.artifacts?.length || 0,
          hasCriteria,
          criteriaCount: q.criteria?.length || 0,
          artifacts: q.artifacts?.map(a => ({ id: a.id, artifact_id: a.artifact_id, name: a.name })) || [],
          criteria: q.criteria?.map(c => ({ id: c.id, name: c.name })) || []
        });
        
        // For comparison questions, need 2-3 artifacts
        if (q.question_type === 'comparison') {
          const isInvalid = !hasArtifacts || q.artifacts.length < 2 || q.artifacts.length > 3 || !hasCriteria;
          if (isInvalid) {
            console.error(`  Comparison validation FAILED for question "${q.title}":`, {
              hasArtifacts,
              artifactCount: q.artifacts.length,
              artifactCountValid: q.artifacts.length >= 2 && q.artifacts.length <= 3,
              hasCriteria,
              criteriaCount: q.criteria.length
            });
          }
          return isInvalid;
        }
        
        // For rating questions, need exactly 1 artifact
        if (q.question_type === 'rating') {
          const isInvalid = !hasArtifacts || q.artifacts.length !== 1 || !hasCriteria;
          if (isInvalid) {
            console.error(`  Rating validation FAILED for question "${q.title}":`, {
              hasArtifacts,
              artifactCount: q.artifacts.length,
              artifactCountValid: q.artifacts.length === 1,
              hasCriteria,
              criteriaCount: q.criteria.length
            });
          }
          return isInvalid;
        }
        
        console.log(`  Unknown question type: ${q.question_type}`);
        return true;
      });

      if (invalidQuestions.length > 0) {
        console.log('Invalid questions found:', invalidQuestions.map(q => ({
          title: q.title,
          type: q.question_type,
          artifactCount: q.artifacts?.length || 0,
          criteriaCount: q.criteria?.length || 0
        })));
        
        const errors = invalidQuestions.map(q => {
          console.log(`Generating error for question "${q.title}" with type "${q.question_type || 'MISSING'}"`);
          if (!q.question_type) {
            return `Question "${q.title}" (ID: ${q.id}): Missing question_type. Please ensure the database migration has been run to add the question_type column.`;
          }
          return `Question "${q.title}": ${q.question_type === 'comparison' 
            ? 'needs 2-3 artifacts and at least 1 criterion' 
            : 'needs 1 artifact and at least 1 criterion'}`;
        });
        throw new Error(`Invalid questions found:\n${errors.join('\n')}`);
      }

      // Check if tasks already exist for this study
      const existingTasksRes = await client.query(
        'SELECT COUNT(*) as count FROM evaluation_tasks WHERE study_id = $1',
        [studyId]
      );

      if (parseInt(existingTasksRes.rows[0].count) > 0) {
        // Tasks already exist - delete them to regenerate
        await client.query('DELETE FROM evaluation_tasks WHERE study_id = $1', [studyId]);
      }

      const createdTasks = [];

      // Generate tasks for each question
      for (const question of questions) {
        const task = await this._createTaskFromQuestion(client, studyId, question);
        createdTasks.push(task);
      }

      if (!useExternalClient) {
        await client.query('COMMIT');
      }

      return {
        success: true,
        tasksCreated: createdTasks.length,
        tasks: createdTasks
      };
    } catch (error) {
      if (!useExternalClient) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (!useExternalClient) {
        client.release();
      }
    }
  },

  /**
   * Create a single evaluation task from a question
   * @private
   */
  async _createTaskFromQuestion(client, studyId, question) {
    // Prepare artifact IDs
    const artifact1Id = question.artifacts[0]?.artifact_id || null;
    const artifact2Id = question.artifacts[1]?.artifact_id || null;
    const artifact3Id = question.artifacts[2]?.artifact_id || null;

    // Prepare task type based on question type
    const taskType = question.question_type === 'comparison' 
      ? 'artifact_comparison' 
      : 'artifact_rating';

    // Prepare instructions
    const instructions = question.description || question.title;

    // Prepare answer type based on question type
    let answerType;
    let answerOptions;
    
    if (question.question_type === 'comparison') {
      // For comparison questions, participant chooses the best artifact
      answerType = 'choice_required_text';
      
      // Build choice options from artifacts
      // Use position-based labels (Artifact 1, Artifact 2, etc.) to match the artifact_1, artifact_2 values
      const options = question.artifacts.map((artifact, index) => ({
        value: `artifact_${index + 1}`,
        label: `Artifact ${index + 1}` // Always use position-based label, not artifact.name
      }));
      
      // Ensure criteria is an array
      const criteria = Array.isArray(question.criteria) ? question.criteria : [];
      
      // Validate criteria have required fields
      const validCriteria = criteria.filter(c => {
        if (!c || !c.id || !c.name) {
          console.warn(`[TaskGeneration] Skipping invalid criterion:`, c);
          return false;
        }
        return true;
      });
      
      console.log(`[TaskGeneration] Creating comparison task for question "${question.title}":`, {
        questionId: question.id,
        criteriaCount: validCriteria.length,
        criteria: validCriteria.map(c => ({ 
          id: c.id, 
          name: c.name, 
          description: c.description || '(no description)',
          hasDescription: !!c.description
        }))
      });
      
      if (validCriteria.length === 0) {
        console.warn(`[TaskGeneration] WARNING: Question "${question.title}" has no valid criteria!`);
      }
      
      // Store criteria in answer_options - question text will be generated dynamically when task is loaded
      // This ensures the question always reflects the current criteria state without needing migrations
      // The question will be automatically built from criteria in the API route
      answerOptions = {
        question: 'Which artifact is better?', // Placeholder - dynamically replaced with criteria when task is loaded
        options: options,
        textLabel: 'Explain your choice',
        textPlaceholder: 'Explain why you chose this artifact based on the evaluation criteria...',
        criteria: validCriteria.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || '' // Ensure description is always a string
        })),
        questionType: question.question_type,
        questionTitle: question.title
      };
      
      // Log what's being saved to answer_options
      console.log(`[TaskGeneration] Saving answer_options with ${answerOptions.criteria.length} criteria:`, 
        JSON.stringify(answerOptions.criteria.map(c => ({ id: c.id, name: c.name, hasDesc: !!c.description })), null, 2)
      );
    } else {
      // For rating questions, participant rates the artifact on each criterion
      answerType = 'rating';
      
      // Ensure criteria is an array
      const criteria = Array.isArray(question.criteria) ? question.criteria : [];
      
      // Validate criteria have required fields
      const validCriteria = criteria.filter(c => {
        if (!c || !c.id || !c.name) {
          console.warn(`[TaskGeneration] Skipping invalid criterion:`, c);
          return false;
        }
        return true;
      });
      
      console.log(`[TaskGeneration] Creating rating task for question "${question.title}":`, {
        questionId: question.id,
        criteriaCount: validCriteria.length,
        criteria: validCriteria.map(c => ({ 
          id: c.id, 
          name: c.name, 
          description: c.description || '(no description)',
          hasDescription: !!c.description
        }))
      });
      
      if (validCriteria.length === 0) {
        console.warn(`[TaskGeneration] WARNING: Question "${question.title}" has no valid criteria!`);
      }
      
      answerOptions = {
        criteria: validCriteria.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type || 'custom',
          scale: c.scale || 'stars_5',
          description: c.description || '' // Ensure description is always a string
        })),
        questionType: question.question_type,
        questionTitle: question.title
      };
      
      // Log what's being saved to answer_options
      console.log(`[TaskGeneration] Saving answer_options with ${answerOptions.criteria.length} criteria:`, 
        JSON.stringify(answerOptions.criteria.map(c => ({ id: c.id, name: c.name, hasDesc: !!c.description })), null, 2)
      );
    }

    // Insert evaluation task
    const taskRes = await client.query(
      `INSERT INTO evaluation_tasks 
       (study_id, task_type, instructions, artifact1_id, artifact2_id, artifact3_id, answer_type, answer_options)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        studyId,
        taskType,
        instructions,
        artifact1Id,
        artifact2Id,
        artifact3Id,
        answerType,
        JSON.stringify(answerOptions)
      ]
    );

    const taskId = taskRes.rows[0].id;
    
    // Verify criteria were saved correctly
    const verifyRes = await client.query(
      `SELECT answer_options FROM evaluation_tasks WHERE id = $1`,
      [taskId]
    );
    if (verifyRes.rows[0]) {
      const savedOptions = verifyRes.rows[0].answer_options;
      const savedCriteria = savedOptions?.criteria || [];
      console.log(`[TaskGeneration] Verified task ${taskId} has ${savedCriteria.length} criteria saved:`, 
        savedCriteria.map(c => ({ id: c.id, name: c.name, hasDesc: !!c.description }))
      );
      
      // Warn if criteria count doesn't match
      const expectedCount = answerOptions.criteria?.length || 0;
      if (savedCriteria.length !== expectedCount) {
        console.error(`[TaskGeneration] ERROR: Task ${taskId} has ${savedCriteria.length} criteria but expected ${expectedCount}!`);
      }
    }

    // Store criteria mapping for this task (only if criteria exist)
    const criteria = Array.isArray(question.criteria) ? question.criteria : [];
    if (criteria.length > 0) {
      for (const criterion of criteria) {
        try {
          await client.query(
            `INSERT INTO task_criteria (task_id, criterion_id, criterion_name, criterion_type, criterion_scale, criterion_description, display_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              taskId,
              criterion.id,
              criterion.name,
              criterion.type || 'custom',
              criterion.scale || 'stars_5',
              criterion.description || null,
              criterion.display_order || 0
            ]
          );
        } catch (err) {
          // If task_criteria table doesn't exist, just log and continue
          console.warn(`[TaskGeneration] Could not insert into task_criteria (table may not exist):`, err.message);
        }
      }
    }

    return {
      id: taskId,
      questionId: question.id,
      questionTitle: question.title,
      questionType: question.question_type,
      artifactCount: question.artifacts.length,
      criteriaCount: question.criteria.length
    };
  },

  /**
   * Regenerate tasks for a study (useful when questions are updated)
   * @param {number} studyId - Study ID
   * @returns {Promise<Object>} Generation results
   */
  async regenerateTasks(studyId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check study status - only allow for draft studies
      const studyRes = await client.query(
        'SELECT status FROM studies WHERE id = $1',
        [studyId]
      );

      if (!studyRes.rows[0]) {
        throw new Error('Study not found');
      }

      if (studyRes.rows[0].status !== 'draft') {
        throw new Error('Can only regenerate tasks for draft studies');
      }

      // Delete existing tasks
      await client.query('DELETE FROM evaluation_tasks WHERE study_id = $1', [studyId]);

      await client.query('COMMIT');

      // Generate new tasks
      return await this.generateTasksFromQuestions(studyId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get task generation status for a study
   * @param {number} studyId - Study ID
   * @returns {Promise<Object>} Status information
   */
  async getTaskGenerationStatus(studyId) {
    const client = await pool.connect();
    try {
      // Get question count
      const questionsRes = await client.query(
        'SELECT COUNT(*) as count FROM study_questions WHERE study_id = $1',
        [studyId]
      );

      // Get task count
      const tasksRes = await client.query(
        'SELECT COUNT(*) as count FROM evaluation_tasks WHERE study_id = $1',
        [studyId]
      );

      // Get questions with details
      const questions = await StudyQuestion.findByStudyId(studyId);

      const questionStatus = questions.map(q => ({
        id: q.id,
        title: q.title,
        type: q.question_type,
        artifactCount: q.artifacts?.length || 0,
        criteriaCount: q.criteria?.length || 0,
        isValid: this._validateQuestion(q)
      }));

      return {
        questionCount: parseInt(questionsRes.rows[0].count),
        taskCount: parseInt(tasksRes.rows[0].count),
        tasksGenerated: parseInt(tasksRes.rows[0].count) > 0,
        questions: questionStatus,
        allQuestionsValid: questionStatus.every(q => q.isValid)
      };
    } finally {
      client.release();
    }
  },

  /**
   * Validate a question has all required data
   * @private
   */
  _validateQuestion(question) {
    const hasArtifacts = question.artifacts && question.artifacts.length > 0;
    const hasCriteria = question.criteria && question.criteria.length > 0;
    
    if (question.question_type === 'comparison') {
      return hasArtifacts && question.artifacts.length >= 2 && question.artifacts.length <= 3 && hasCriteria;
    }
    
    if (question.question_type === 'rating') {
      return hasArtifacts && question.artifacts.length === 1 && hasCriteria;
    }
    
    return false;
  }
};

module.exports = TaskGenerationService;
