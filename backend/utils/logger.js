/**
 * Logger utility for consistent logging throughout the application
 */
class Logger {
    /**
     * Log informational message
     * @param {string} message
     * @param {any} [meta]
     */
    static info(message, meta) {
        const timestamp = new Date().toISOString();
        console.log(`[INFO] ${timestamp} - ${message}`, meta ? meta : '');
    }

    /**
     * Log warning message
     * @param {string} message
     * @param {any} [meta]
     */
    static warn(message, meta) {
        const timestamp = new Date().toISOString();
        console.warn(`[WARN] ${timestamp} - ${message}`, meta ? meta : '');
    }

    /**
     * Log error message
     * @param {string} message
     * @param {any} [error]
     */
    static error(message, error) {
        const timestamp = new Date().toISOString();
        console.error(`[ERROR] ${timestamp} - ${message}`, error ? error : '');
    }

    /**
     * Log LLM-specific events
     * @param {'request'|'response'|'error'} event
     * @param {any} data
     */
    static llm(event, data) {
        const timestamp = new Date().toISOString();
        console.log(`[LLM-${event.toUpperCase()}] ${timestamp}`, data);
    }
}

module.exports = Logger;
