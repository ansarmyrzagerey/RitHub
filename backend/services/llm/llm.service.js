const config = require('../../config/openai.config');
const OpenAIClientFactory = require('../openai/client-factory');
const Logger = require('../../utils/logger');
const metricsCollector = require('../../utils/metrics');

/**
 * LLM Service with intelligent conditional model selection
 */
class LLMService {
    constructor() {
        this.client = OpenAIClientFactory.createClient();
    }

    /**
     * Choose the appropriate model based on task type and artifact metadata
     * @param {string} task - Task type: 'quiz-generation', 'artifact-generation', or 'artifact-analysis'
     * @param {Object} [artifactMeta] - Optional artifact metadata
     * @param {number} [artifactMeta.lines] - Number of lines in artifact
     * @returns {string} Model name to use
     */
    chooseModel(task, artifactMeta = {}) {
        // Quiz generation uses default (faster, cheaper) model
        if (task === 'quiz-generation') {
            return config.defaultModel;
        }

        // Artifact generation uses default model
        if (task === 'artifact-generation') {
            return config.defaultModel;
        }

        // Artifact analysis - use fallback for large files, default for small
        if (task === 'artifact-analysis') {
            if ((artifactMeta?.lines || 0) > config.thresholdLines) {
                Logger.info(`Large artifact detected (${artifactMeta.lines} lines), using fallback model`);
                return config.fallbackModel;
            }
            // Small artifacts use cheaper model
            return config.defaultModel;
        }

        // Default to the more efficient model
        return config.defaultModel;
    }

    /**
     * Generate completion with intelligent model selection
     * @param {string} prompt - The prompt text
     * @param {string} task - Task type for model selection
     * @param {Object} [options] - Optional parameters
     * @param {Object} [options.artifactMeta] - Artifact metadata for model selection
     * @param {number} [options.maxTokens] - Maximum tokens
     * @param {number} [options.temperature] - Temperature setting
     * @returns {Promise<import('../../types/openai.types').LLMResponse>}
     */
    async generate(prompt, task, options = {}) {
        // Choose appropriate model based on task
        const model = this.chooseModel(task, options.artifactMeta);

        const request = {
            prompt,
            model,
            maxTokens: options.maxTokens || config.maxTokens,
            temperature: options.temperature || config.temperature,
        };

        const startTime = Date.now();

        try {
            Logger.llm('request', {
                task,
                model: request.model,
                promptLength: request.prompt.length,
                maxTokens: request.maxTokens,
            });

            console.log(`🎯 [LLM] Task: ${task} | Model: ${request.model}`);
            const response = await this.client.generateCompletion(request);

            const responseTime = Date.now() - startTime;
            const cost = await this.estimateCost(response.tokensUsed.prompt, response.tokensUsed.completion, model);

            metricsCollector.recordRequest(response.tokensUsed.total, responseTime, cost);

            Logger.llm('response', {
                task,
                model: response.model,
                tokens: response.tokensUsed,
                responseTime: `${responseTime}ms`,
                cost: `$${cost.toFixed(4)}`,
            });

            return response;
        } catch (error) {
            metricsCollector.recordError();
            Logger.error(`❌ [LLM] Generation failed for task: ${task}`);
            Logger.llm('error', error);

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`LLM generation failed: ${errorMessage}`);
        }
    }

    /**
     * Estimate token count for text
     * @param {string} text
     * @returns {Promise<number>} Estimated token count
     */
    async estimateTokens(text) {
        // Rough estimation: ~4 characters per token for English text
        return Math.ceil(text.length / 4);
    }

    /**
     * Estimate cost for token usage based on model
     * @param {number} promptTokens
     * @param {number} completionTokens
     * @param {string} model
     * @returns {Promise<number>} Estimated cost in USD
     */
    async estimateCost(promptTokens, completionTokens, model) {
        // Pricing varies by model (these are example prices - update with actual pricing)
        let promptCostPer1K, completionCostPer1K;

        if (model.includes('nano')) {
            // gpt-4o-nano (cheaper, faster)
            promptCostPer1K = 0.00005;    // Example: $0.05 per 1M tokens
            completionCostPer1K = 0.0002; // Example: $0.20 per 1M tokens
        } else if (model.includes('mini')) {
            // gpt-4o-mini (more capable)
            promptCostPer1K = 0.00015;    // Example: $0.15 per 1M tokens
            completionCostPer1K = 0.0006; // Example: $0.60 per 1M tokens
        } else {
            // Default pricing
            promptCostPer1K = 0.00015;
            completionCostPer1K = 0.0006;
        }

        const promptCost = (promptTokens / 1000) * promptCostPer1K;
        const completionCost = (completionTokens / 1000) * completionCostPer1K;

        return promptCost + completionCost;
    }
}

module.exports = LLMService;
