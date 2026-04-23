const pool = require('../config/database');
const crypto = require('crypto');

/**
 * Middleware to authenticate requests using API keys
 * Used for external tool integration (US 2.9)
 */
const apiKeyAuth = async (req, res, next) => {
    try {
        const apiKey = req.header('X-API-Key');

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key is required. Provide it in the X-API-Key header.'
            });
        }

        // Hash the provided API key
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        // Look up the API key in the database
        const result = await pool.query(
            `SELECT id, key_hash, name, description, created_by, is_active, 
              last_used_at, rate_limit_count, rate_limit_reset_at, revoked_at
       FROM api_keys 
       WHERE key_hash = $1`,
            [keyHash]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key'
            });
        }

        const apiKeyRecord = result.rows[0];

        // Check if the key is active
        if (!apiKeyRecord.is_active || apiKeyRecord.revoked_at) {
            return res.status(401).json({
                success: false,
                error: 'API key has been revoked'
            });
        }

        // Update last used timestamp
        await pool.query(
            'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
            [apiKeyRecord.id]
        );

        // Attach API key info to request for use in rate limiting and logging
        req.apiKey = {
            id: apiKeyRecord.id,
            name: apiKeyRecord.name,
            createdBy: apiKeyRecord.created_by
        };

        next();
    } catch (error) {
        console.error('API key authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during authentication'
        });
    }
};

module.exports = apiKeyAuth;
