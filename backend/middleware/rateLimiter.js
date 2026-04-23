const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for external tool API (US 2.9)
 * 100 requests per hour per API key
 */
const externalApiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 requests per hour
    message: {
        success: false,
        error: 'Too many requests from this API key. Maximum 100 requests per hour allowed.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
        // Use API key ID as the rate limit key
        return req.apiKey ? `api_key_${req.apiKey.id}` : req.ip;
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Maximum 100 requests per hour allowed.',
            retryAfter: res.getHeader('Retry-After')
        });
    }
});

/**
 * Rate limiter for analysis API (US 2.5)
 * 20 requests per hour per user
 */
const analysisApiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 requests per hour
    message: {
        success: false,
        error: 'Too many analysis requests. Maximum 20 analysis requests per hour allowed.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID as the rate limit key
        return req.user ? `user_${req.user.id}` : req.ip;
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Maximum 20 analysis requests per hour allowed.',
            retryAfter: res.getHeader('Retry-After')
        });
    }
});

/**
 * Rate limiter for AI artifact generation
 * 10 generations per hour per researcher (to control API costs)
 */
const artifactGenerationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 generations per hour
    message: {
        success: false,
        error: 'Generation limit reached. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user ? `artifact_gen_${req.user.id}` : req.ip;
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'You have reached the generation limit. Please try again in an hour.',
            retryAfter: res.getHeader('Retry-After')
        });
    }
});

module.exports = {
    externalApiLimiter,
    analysisApiLimiter,
    artifactGenerationLimiter
};
