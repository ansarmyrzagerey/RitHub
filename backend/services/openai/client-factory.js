const config = require('../../config/openai.config');
const MockOpenAIClient = require('./mock-client');
const RealOpenAIClient = require('./real-client');

/**
 * OpenAI Client Factory
 * Creates appropriate client based on environment
 */
class OpenAIClientFactory {
    /**
     * Create OpenAI client (mock or real based on environment)
     * @returns {MockOpenAIClient|RealOpenAIClient}
     */
    static createClient() {
        // Use mock client only when API key is missing or a placeholder
        const useMock =
            !config.apiKey ||
            config.apiKey === 'mock_key_for_development' ||
            config.apiKey === 'your-openai-api-key-here' ||
            config.apiKey === 'sk-your-real-api-key-here' ||
            config.apiKey === 'sk-REPLACE-WITH-YOUR-ACTUAL-KEY' ||
            !config.apiKey.startsWith('sk-');
        
        console.log(`[OpenAI Factory] API Key length: ${config.apiKey?.length || 0}, starts with sk-: ${config.apiKey?.startsWith('sk-')}`);

        if (useMock) {
            console.log('🔧 [OpenAI] Using Mock Client (Development Mode)');
            console.log(`   Default Model: ${config.defaultModel} | Fallback Model: ${config.fallbackModel}`);
            return new MockOpenAIClient();
        }

        console.log('🚀 [OpenAI] Using Real OpenAI Client');
        console.log(`   Default Model: ${config.defaultModel} | Fallback Model: ${config.fallbackModel}`);
        return new RealOpenAIClient(config.apiKey);
    }
}

module.exports = OpenAIClientFactory;
