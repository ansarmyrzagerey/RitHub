const OpenAIClientFactory = require('./openai/client-factory');
const config = require('../config/openai.config');

/**
 * Quiz Generation Service
 * Handles AI-assisted quiz generation using OpenAI
 */
class QuizGenerationService {
    constructor() {
        this.client = OpenAIClientFactory.createClient();
        console.log(`[QuizGenerationService] Initialized with model: ${config.defaultModel}, maxTokens: ${config.maxTokens}`);
    }

    /**
     * Generate quiz questions using AI
     * @param {Object} params - Generation parameters
     * @param {string} params.title - Quiz title
     * @param {string} params.description - Quiz description
     * @param {string} params.topic - Main topic/subject
     * @param {string} params.difficulty - Difficulty level (easy, medium, hard)
     * @param {number} params.numberOfQuestions - Number of questions to generate
     * @param {string[]} params.questionTypes - Types of questions (multiple, open, code)
     * @param {string} params.context - Additional context or requirements
     * @returns {Promise<Object>} Generated quiz data
     */
    async generateQuiz(params) {
        const {
            title,
            description,
            topic,
            difficulty = 'medium',
            numberOfQuestions = 5,
            questionTypes = ['multiple'],
            context = ''
        } = params;

        console.log(`[QuizGenerationService] Generating quiz - Topic: ${topic}, Questions: ${numberOfQuestions}, Types: ${questionTypes.join(', ')}`);

        const prompt = this.buildQuizPrompt({
            title,
            description,
            topic,
            difficulty,
            numberOfQuestions,
            questionTypes,
            context
        });

        try {
            console.log(`[QuizGenerationService] Calling OpenAI API...`);
            const response = await this.client.generateCompletion({
                prompt,
                model: config.defaultModel,
                maxTokens: config.maxTokens,
                temperature: config.temperature
            });

            console.log(`[QuizGenerationService] API Response received - Model: ${response.model}, Tokens: ${JSON.stringify(response.tokensUsed)}`);

            const quizData = this.parseQuizResponse(response.content);
            console.log(`[QuizGenerationService] Successfully parsed ${quizData.questions.length} questions`);

            return {
                success: true,
                quiz: quizData,
                metadata: {
                    model: response.model,
                    tokensUsed: response.tokensUsed
                }
            };
        } catch (error) {
            console.error('[QuizGenerationService] Quiz generation error:', error);
            throw new Error(`Failed to generate quiz: ${error.message}`);
        }
    }

    /**
     * Build the prompt for quiz generation
     * @private
     */
    buildQuizPrompt(params) {
        const { title, description, topic, difficulty, numberOfQuestions, questionTypes, context } = params;

        const questionTypeInstructions = this.getQuestionTypeInstructions(questionTypes);

        return `You are an expert quiz creator. Generate a quiz with the following specifications:

**Quiz Details:**
- Title: ${title}
- Description: ${description}
- Topic: ${topic}
- Difficulty: ${difficulty}
- Number of Questions: ${numberOfQuestions}
- Question Types: ${questionTypes.join(', ')}
${context ? `- Additional Context: ${context}` : ''}

**Instructions:**
1. Create ${numberOfQuestions} high-quality questions that test understanding of ${topic}
2. Questions should be at ${difficulty} difficulty level
3. ${questionTypeInstructions}
4. Ensure questions are clear, unambiguous, and educational
5. For multiple choice questions, provide 4 options with one correct answer
6. Include brief explanations for correct answers when applicable

**Output Format:**
Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks, just raw JSON):
{
  "questions": [
    {
      "type": "multiple" | "open" | "code",
      "title": "Question text here",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "Option text for correct answer (only for multiple choice)",
      "pointWeight": 1,
      "isAbsolute": false,
      "explanation": "Brief explanation of the answer"
    }
  ]
}

Generate the quiz now:`;
    }

    /**
     * Get instructions for question types
     * @private
     */
    getQuestionTypeInstructions(questionTypes) {
        const instructions = [];
        
        if (questionTypes.includes('multiple')) {
            instructions.push('Multiple choice questions should have 4 options with exactly one correct answer');
        }
        if (questionTypes.includes('open')) {
            instructions.push('Open-ended questions should encourage detailed, thoughtful responses');
        }
        if (questionTypes.includes('code')) {
            instructions.push('Code questions should test practical programming skills with clear requirements');
        }

        return instructions.join('. ');
    }

    /**
     * Parse the AI response into structured quiz data
     * @private
     */
    parseQuizResponse(content) {
        try {
            // Remove markdown code blocks if present
            let cleanContent = content.trim();
            if (cleanContent.startsWith('```json')) {
                cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (cleanContent.startsWith('```')) {
                cleanContent = cleanContent.replace(/```\n?/g, '');
            }
            // Extract likely JSON substring between first '{' and last '}'
            const firstBrace = cleanContent.indexOf('{');
            const lastBrace = cleanContent.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                cleanContent = cleanContent.slice(firstBrace, lastBrace + 1);
            }

            // Basic parse when advanced parser is commented out
            let parsed;
            try {
                parsed = JSON.parse(cleanContent);
            } catch (e) {
                console.error('Error parsing quiz response:', e);
                console.error('Raw content:', content);
                throw new Error(`Failed to parse AI response: ${e.message}`);
            }

            // Validate and normalize the structure
            if (!parsed || !parsed.questions || !Array.isArray(parsed.questions)) {
                throw new Error('Invalid response structure: missing questions array');
            }

            // Normalize each question
            const normalizedQuestions = parsed.questions.map((q, index) => {
                // Validate required fields
                if (!q.type || !q.title) {
                    throw new Error(`Question ${index + 1} is missing required fields`);
                }

                // Normalize the question
                const normalized = {
                    type: q.type,
                    title: q.title,
                    pointWeight: q.pointWeight || 1,
                    isAbsolute: q.isAbsolute || false,
                    orderIndex: index
                };

                // Handle multiple choice questions
                if (q.type === 'multiple') {
                    if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
                        throw new Error(`Question ${index + 1}: Multiple choice questions need at least 2 options`);
                    }
                    if (!q.correctAnswer) {
                        throw new Error(`Question ${index + 1}: Multiple choice questions need a correct answer`);
                    }

                    normalized.options = q.options;
                    // Find the index of the correct answer
                    const correctIndex = q.options.findIndex(opt => opt === q.correctAnswer);
                    if (correctIndex === -1) {
                        // If exact match not found, use the first option as fallback
                        normalized.correctAnswer = q.options[0];
                    } else {
                        normalized.correctAnswer = q.correctAnswer;
                    }
                } else {
                    // Open-ended and code questions don't have options or correct answers
                    normalized.options = null;
                    normalized.correctAnswer = null;
                }

                // Add explanation if provided
                if (q.explanation) {
                    normalized.explanation = q.explanation;
                }

                return normalized;
            });

            return {
                questions: normalizedQuestions
            };
        } catch (error) {
            console.error('Error parsing quiz response:', error);
            console.error('Raw content:', content);
            throw new Error(`Failed to parse AI response: ${error.message}`);
        }
    }
}

module.exports = new QuizGenerationService();
