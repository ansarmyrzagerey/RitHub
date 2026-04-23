const Study = require('../models/study');
const cron = require('node-cron');

class StudyCleanupService {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.nextRun = null;
    this.retentionDays = 20;
    this.cronJob = null;
  }

  /**
   * Start the automatic cleanup service
   * Runs daily at 2:00 AM
   */
  start() {
    if (this.cronJob) {
      console.log('Study cleanup service is already running');
      return;
    }

    // Schedule to run daily at 2:00 AM
    this.cronJob = cron.schedule('0 2 * * *', async () => {
      await this.runCleanup();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    console.log('Study cleanup service started - will run daily at 2:00 AM UTC');
    this.updateNextRunTime();
  }

  /**
   * Stop the automatic cleanup service
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
      console.log('Study cleanup service stopped');
    }
  }

  /**
   * Run the cleanup process
   */
  async runCleanup() {
    if (this.isRunning) {
      console.log('Study cleanup is already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    this.lastRun = new Date();

    try {
      console.log(`Starting automatic study cleanup (retention: ${this.retentionDays} days)`);
      
      const results = await Study.runCleanup(this.retentionDays);
      
      console.log(`Study cleanup completed:`, {
        processed: results.processed,
        deleted: results.deleted,
        errors: results.errors.length
      });

      if (results.errors.length > 0) {
        console.error('Study cleanup errors:', results.errors);
      }

      this.updateNextRunTime();
      return results;

    } catch (error) {
      console.error('Study cleanup service error:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run cleanup manually (for admin interface)
   */
  async runManualCleanup(retentionDays = null) {
    const days = retentionDays || this.retentionDays;
    console.log(`Running manual study cleanup (retention: ${days} days)`);
    
    return await Study.runCleanup(days);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: !!this.cronJob,
      lastRun: this.lastRun,
      nextRun: this.nextRun,
      retentionDays: this.retentionDays
    };
  }

  /**
   * Update the next run time based on cron schedule
   */
  updateNextRunTime() {
    if (this.cronJob) {
      // Calculate next 2:00 AM UTC
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(2, 0, 0, 0);
      this.nextRun = tomorrow;
    } else {
      this.nextRun = null;
    }
  }

  /**
   * Set retention period
   */
  setRetentionDays(days) {
    if (days < 1) {
      throw new Error('Retention days must be at least 1');
    }
    this.retentionDays = days;
    console.log(`Study cleanup retention period set to ${days} days`);
  }

  /**
   * Get studies that will be deleted in the next cleanup
   */
  async getUpcomingDeletions() {
    return await Study.findExpiredDeleted(this.retentionDays);
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    const deletedStudies = await Study.findDeleted();
    const expiredStudies = await Study.findExpiredDeleted(this.retentionDays);
    
    return {
      total_in_trash: deletedStudies.length,
      eligible_for_cleanup: expiredStudies.length,
      retention_days: this.retentionDays,
      service_status: this.getStatus()
    };
  }
}

// Create singleton instance
const studyCleanupService = new StudyCleanupService();

module.exports = studyCleanupService;