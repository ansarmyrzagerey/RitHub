const OpenAI = require('openai');
const config = require('../../config/openai.config');

/**
 * Real OpenAI Client
 * Makes actual API calls to OpenAI
 */
class RealOpenAIClient {
    constructor(apiKey) {
        this.client = new OpenAI({
            apiKey: apiKey || config.apiKey,
        });
    }

    /**
     * Generate a completion using OpenAI API
     * @param {import('../../types/openai.types').LLMRequest} request
     * @returns {Promise<import('../../types/openai.types').LLMResponse>}
     */
    async generateCompletion(request) {
        try {
            const response = await this.client.chat.completions.create({
                model: request.model || config.defaultModel,
                messages: [
                    {
                        role: 'user',
                        content: request.prompt,
                    },
                ],
                max_tokens: request.maxTokens || config.maxTokens,
                temperature: request.temperature || config.temperature,
            });

            const choice = response.choices[0];

            return {
                content: choice.message.content || '',
                model: response.model,
                tokensUsed: {
                    prompt: response.usage?.prompt_tokens || 0,
                    completion: response.usage?.completion_tokens || 0,
                    total: response.usage?.total_tokens || 0,
                },
                finishReason: choice.finish_reason || 'unknown',
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`OpenAI API Error: ${errorMessage}`);
        }
    }
}

module.exports = RealOpenAIClient;
