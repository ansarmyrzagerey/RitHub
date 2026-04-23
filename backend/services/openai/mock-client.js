const config = require('../../config/openai.config');

/**
 * Mock OpenAI Client for development/testing
 * Simulates OpenAI API responses without making real API calls
 */
class MockOpenAIClient {
    constructor() {
        console.log('[MockOpenAIClient] Initialized - Using mock responses (no API costs)');
    }

    /**
     * Generate a completion using mock data
     * @param {import('../../types/openai.types').LLMRequest} request
     * @returns {Promise<import('../../types/openai.types').LLMResponse>}
     */
    async generateCompletion(request) {
        console.log('[MockOpenAIClient] Generating mock response...');
        
        // Simulate API delay
        await this.delay(800 + Math.random() * 400); // 800-1200ms

        const response = {
            content: this.getMockResponse(request.prompt),
            model: request.model || config.defaultModel,
            tokensUsed: {
                prompt: Math.floor(request.prompt.length / 4),
                completion: 200,
                total: Math.floor(request.prompt.length / 4) + 200,
            },
            finishReason: 'stop',
        };

        console.log('[MockOpenAIClient] Mock response generated successfully');
        return response;
    }

    /**
     * Get mock response based on prompt content
     * @private
     */
    getMockResponse(prompt) {
        const lowerPrompt = prompt.toLowerCase();

        // Check for grading prompts first (more specific match)
        if (lowerPrompt.includes('grader') && (lowerPrompt.includes('evaluating') || lowerPrompt.includes('did not provide'))) {
            return JSON.stringify(this.getMockGradingResponse(prompt));
        } else if (lowerPrompt.includes('quiz') || lowerPrompt.includes('question')) {
            return JSON.stringify(this.getMockQuiz());
        } else if (lowerPrompt.includes('generate') && lowerPrompt.includes('artifact')) {
            return JSON.stringify(this.getMockArtifact());
        } else if (lowerPrompt.includes('analyze')) {
            return JSON.stringify(this.getMockAnalysis());
        }

        return 'Mock response generated successfully. This is a simulated OpenAI response for development.';
    }

    /**
     * Generate mock quiz (compatible with quizGenerationService)
     * @private
     */
    getMockQuiz() {
        return {
            questions: [
                {
                    type: 'multiple',
                    title: 'What is the capital of France?',
                    options: ['London', 'Berlin', 'Paris', 'Madrid'],
                    correctAnswer: 'Paris',
                    pointWeight: 1,
                    isAbsolute: false,
                    explanation: 'Paris is the capital and largest city of France.'
                },
                {
                    type: 'multiple',
                    title: 'Which planet is known as the Red Planet?',
                    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
                    correctAnswer: 'Mars',
                    pointWeight: 1,
                    isAbsolute: false,
                    explanation: 'Mars is called the Red Planet due to its reddish appearance caused by iron oxide.'
                },
                {
                    type: 'multiple',
                    title: 'What is 2 + 2?',
                    options: ['3', '4', '5', '6'],
                    correctAnswer: '4',
                    pointWeight: 1,
                    isAbsolute: false,
                    explanation: 'Basic arithmetic: 2 + 2 = 4'
                },
                {
                    type: 'open',
                    title: 'Explain the concept of photosynthesis in your own words.',
                    pointWeight: 2,
                    isAbsolute: false,
                    explanation: 'This is an open-ended question requiring manual grading.'
                },
                {
                    type: 'code',
                    title: 'Write a function that returns the sum of two numbers.',
                    pointWeight: 3,
                    isAbsolute: false,
                    explanation: 'This is a code question requiring manual grading.'
                }
            ]
        };
    }

    /**
     * Generate mock artifact
     * @private
     * @returns {import('../../types/openai.types').Artifact}
     */
    getMockArtifact() {
        return {
            id: `mock-artifact-${Date.now()}`,
            type: 'code',
            content: `function greet(name) {
  return \`Hello, \${name}! This is a mock artifact.\`;
}

module.exports = greet;`,
            metadata: {
                title: 'Sample Code Artifact',
                description: 'A mock code artifact for development',
                tags: ['javascript', 'function', 'mock'],
                createdAt: new Date().toISOString(),
            },
        };
    }

    /**
     * Generate mock analysis
     * @private
     * @returns {import('../../types/openai.types').ArtifactAnalysis}
     */
    getMockAnalysis() {
        return {
            summary: 'This is a well-structured artifact with clear purpose and good organization.',
            strengths: [
                'Clean and readable code',
                'Good naming conventions',
                'Proper structure and organization',
                'Clear separation of concerns',
            ],
            weaknesses: [
                'Missing comprehensive documentation',
                'No error handling implementation',
                'Could benefit from input validation',
            ],
            suggestions: [
                'Add JSDoc comments for better code documentation',
                'Implement try-catch blocks for error handling',
                'Add input validation and type checking',
                'Consider adding unit tests',
            ],
            complexity: 'low',
            quality: 75,
        };
    }

    /**
     * Generate mock grading response for AI-assisted grading
     * @param {string} prompt - The grading prompt to analyze
     * @returns {Object} Mock grading result
     * @private
     */
    getMockGradingResponse(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        
        // Extract max points from prompt (look for "Maximum Points: X")
        const maxPointsMatch = prompt.match(/Maximum Points:\s*(\d+(?:\.\d+)?)/i);
        const maxPoints = maxPointsMatch ? parseFloat(maxPointsMatch[1]) : 1;

        // Check if no answer was provided
        if (lowerPrompt.includes('no answer provided') || lowerPrompt.includes('did not provide an answer')) {
            return {
                suggestedScore: 0,
                maxScore: maxPoints,
                justification: 'No answer was provided by the participant.',
                confidence: 'high'
            };
        }

        // Check if it's a code question
        const isCodeQuestion = lowerPrompt.includes('question type:** code') || 
                               lowerPrompt.includes('code question');

        // Generate a reasonable mock score (60-90% of max points)
        const scorePercentage = 0.6 + Math.random() * 0.3;
        const suggestedScore = Math.round(maxPoints * scorePercentage * 100) / 100;

        // Select confidence based on randomness
        const confidences = ['high', 'medium', 'medium', 'high'];
        const confidence = confidences[Math.floor(Math.random() * confidences.length)];

        // Generate appropriate justification
        let justification;
        if (isCodeQuestion) {
            const codeJustifications = [
                'The code demonstrates good understanding of the problem and provides a working solution with minor improvements possible.',
                'The solution is functional and addresses the main requirements. Code structure could be improved for better readability.',
                'Good implementation with correct logic. Consider adding error handling for edge cases.'
            ];
            justification = codeJustifications[Math.floor(Math.random() * codeJustifications.length)];
        } else {
            const openJustifications = [
                'The response demonstrates understanding of the concept but could include more specific examples.',
                'Good explanation that covers the main points. Additional detail would strengthen the answer.',
                'The answer is relevant and accurate, showing solid comprehension of the topic.'
            ];
            justification = openJustifications[Math.floor(Math.random() * openJustifications.length)];
        }

        return {
            suggestedScore,
            maxScore: maxPoints,
            justification,
            confidence
        };
    }

    /**
     * Simulate network delay
     * @private
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MockOpenAIClient;
