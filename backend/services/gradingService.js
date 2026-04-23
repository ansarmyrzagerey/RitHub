const OpenAIClientFactory = require('./openai/client-factory');
const config = require('../config/openai.config');

/**
 * Grading Service
 * Handles AI-assisted grading for open-ended and code questions
 */
class GradingService {
    constructor() {
        this.client = OpenAIClientFactory.createClient();
        console.log(`[GradingService] Initialized with model: ${config.defaultModel}`);
    }

    /**
     * Grade multiple questions using AI
     * @param {Object} params - Grading parameters
     * @param {Array} params.questions - Questions to grade (open/code types only)
     * @param {Object} params.answers - Participant answers keyed by question ID
     * @returns {Promise<Object>} Grading results with scores and justifications
     */
    async gradeAnswers(params) {
        const { questions, answers } = params;

        console.log(`[GradingService] Grading ${questions.length} questions`);

        const grades = {};

        for (const question of questions) {
            const questionId = question.id;
            const answer = answers[questionId] || '';

            console.log(`[GradingService] Grading question ${questionId} (${question.question_type})`);

            const prompt = this.buildGradingPrompt(question, answer);

            try {
                const response = await this.client.generateCompletion({
                    prompt,
                    model: config.defaultModel,
                    maxTokens: config.maxTokens,
                    temperature: 0.3 // Lower temperature for more consistent grading
                });

                const gradeResult = this.parseGradingResponse(response.content, question.point_weight);
                grades[questionId] = gradeResult;

                console.log(`[GradingService] Question ${questionId} graded: ${gradeResult.suggestedScore}/${gradeResult.maxScore}`);
            } catch (error) {
                console.error(`[GradingService] Error grading question ${questionId}:`, error);
                // Provide a fallback grade on error
                grades[questionId] = {
                    suggestedScore: 0,
                    maxScore: question.point_weight || 1,
                    justification: 'Unable to grade automatically. Please review manually.',
                    confidence: 'low'
                };
            }
        }

        return {
            success: true,
            grades,
            metadata: {
                model: config.defaultModel,
                questionsGraded: questions.length
            }
        };
    }


    /**
     * Build the prompt for grading a single question
     * @param {Object} question - The question object
     * @param {string} answer - The participant's answer
     * @returns {string} The grading prompt
     * @private
     */
    buildGradingPrompt(question, answer) {
        const questionType = question.question_type === 'code' ? 'code' : 'open-ended';
        const maxPoints = question.point_weight || 1;

        // Handle empty answers
        if (!answer || answer.trim() === '') {
            return `You are an expert grader. The participant did not provide an answer for this ${questionType} question.

**Question:** ${question.title}
**Maximum Points:** ${maxPoints}
**Participant's Answer:** [No answer provided]

Since no answer was provided, assign a score of 0.

**Output Format:**
Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks, just raw JSON):
{
    "suggestedScore": 0,
    "maxScore": ${maxPoints},
    "justification": "No answer was provided by the participant.",
    "confidence": "high"
}`;
        }

        // Build grading criteria based on question type
        let gradingCriteria;
        if (questionType === 'code') {
            gradingCriteria = `
- Correctness: Does the code solve the problem correctly?
- Code Quality: Is the code well-structured and readable?
- Completeness: Does the solution address all requirements?`;
        } else {
            gradingCriteria = `
- Relevance: Does the answer address the question?
- Completeness: Is the answer thorough and comprehensive?
- Accuracy: Is the information provided correct?`;
        }

        return `You are an expert grader evaluating a ${questionType} question response.

**Question:** ${question.title}
**Question Type:** ${questionType}
**Maximum Points:** ${maxPoints}

**Participant's Answer:**
${answer}

**Grading Criteria:**${gradingCriteria}

**Instructions:**
1. Evaluate the answer based on the criteria above
2. Assign a score from 0 to ${maxPoints} (can use decimals like 1.5)
3. Provide a brief justification (1-3 sentences) explaining the score
4. Indicate your confidence level (high, medium, or low)

**Output Format:**
Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks, just raw JSON):
{
    "suggestedScore": <number between 0 and ${maxPoints}>,
    "maxScore": ${maxPoints},
    "justification": "<1-3 sentence explanation>",
    "confidence": "high" | "medium" | "low"
}`;
    }

    /**
     * Parse AI grading response into structured data
     * @param {string} content - The AI response content
     * @param {number} maxPoints - Maximum points for the question
     * @returns {Object} Parsed grade result
     * @private
     */
    parseGradingResponse(content, maxPoints) {
        try {
            // Remove markdown code blocks if present
            let cleanContent = content.trim();
            if (cleanContent.startsWith('```json')) {
                cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (cleanContent.startsWith('```')) {
                cleanContent = cleanContent.replace(/```\n?/g, '');
            }

            const parsed = JSON.parse(cleanContent);

            // Validate and normalize the response
            const suggestedScore = Math.min(
                Math.max(0, parseFloat(parsed.suggestedScore) || 0),
                maxPoints
            );

            const validConfidences = ['high', 'medium', 'low'];
            const confidence = validConfidences.includes(parsed.confidence) 
                ? parsed.confidence 
                : 'medium';

            return {
                suggestedScore: Math.round(suggestedScore * 100) / 100, // Round to 2 decimal places
                maxScore: maxPoints,
                justification: parsed.justification || 'No justification provided.',
                confidence
            };
        } catch (error) {
            console.error('[GradingService] Error parsing grading response:', error);
            console.error('[GradingService] Raw content:', content);
            
            // Return a fallback response
            return {
                suggestedScore: 0,
                maxScore: maxPoints,
                justification: 'Unable to parse AI response. Please review manually.',
                confidence: 'low'
            };
        }
    }
}

module.exports = new GradingService();
