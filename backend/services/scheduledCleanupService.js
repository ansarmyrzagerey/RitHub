const retentionService = require('./retentionService');

class ScheduledCleanupService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
  }

  // Start the scheduled cleanup service
  start(intervalHours = 24) {
    if (this.isRunning) {
      console.log('Scheduled cleanup service is already running');
      return;
    }

    console.log(`Starting scheduled cleanup service (runs every ${intervalHours} hours)`);
    this.isRunning = true;

    // Run immediately on start
    this.runCleanup();

    // Schedule recurring cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, intervalHours * 60 * 60 * 1000); // Convert hours to milliseconds
  }

  // Stop the scheduled cleanup service
  stop() {
    if (!this.isRunning) {
      console.log('Scheduled cleanup service is not running');
      return;
    }

    console.log('Stopping scheduled cleanup service');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Run the cleanup process
  async runCleanup() {
    try {
      console.log('Starting scheduled retention cleanup...');
      const startTime = new Date();

      const result = await retentionService.runRetentionCleanup();

      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000);

      console.log(`Retention cleanup completed in ${duration}s:`, {
        processed: result.processedCount,
        deleted: result.deletedCount,
        errors: result.errorCount,
        jobId: result.jobId
      });

      // Log any errors
      if (result.errors && result.errors.length > 0) {
        console.error('Cleanup errors:', result.errors);
      }

    } catch (error) {
      console.error('Error during scheduled cleanup:', error);
    }
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId !== null,
      nextRun: this.intervalId ? 'Scheduled' : 'Not scheduled'
    };
  }
}

// Export singleton instance
module.exports = new ScheduledCleanupService();