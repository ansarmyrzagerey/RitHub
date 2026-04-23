require('dotenv').config();

const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY || '',
  defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4.1-nano',
  fallbackModel: process.env.OPENAI_FALLBACK_MODEL || 'gpt-4.1-nano',
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '400'),
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  thresholdLines: parseInt(process.env.OPENAI_THRESHOLD_LINES || '500'),
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = openaiConfig;
