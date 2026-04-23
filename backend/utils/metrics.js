/**
 * Metrics collector for tracking LLM usage and performance
 */
class MetricsCollector {
    constructor() {
        this.metrics = {
            totalRequests: 0,
            totalTokensUsed: 0,
            totalCost: 0,
            averageResponseTime: 0,
            errorCount: 0,
        };
    }

    /**
     * Record a successful request
     * @param {number} tokens - Total tokens used
     * @param {number} responseTime - Response time in milliseconds
     * @param {number} cost - Estimated cost in USD
     */
    recordRequest(tokens, responseTime, cost) {
        this.metrics.totalRequests++;
        this.metrics.totalTokensUsed += tokens;
        this.metrics.totalCost += cost;

        // Update average response time
        this.metrics.averageResponseTime =
            (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) /
            this.metrics.totalRequests;
    }

    /**
     * Record an error
     */
    recordError() {
        this.metrics.errorCount++;
    }

    /**
     * Get current metrics
     * @returns {Object} Current metrics snapshot
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            totalRequests: 0,
            totalTokensUsed: 0,
            totalCost: 0,
            averageResponseTime: 0,
            errorCount: 0,
        };
    }
}

// Export singleton instance
module.exports = new MetricsCollector();
