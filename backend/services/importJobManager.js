/**
 * Import Job Manager
 * Manages bulk import jobs with progress tracking
 */

class ImportJob {
    constructor(id, userId, filename, totalItems) {
        this.id = id;
        this.userId = userId;
        this.filename = filename;
        this.totalItems = totalItems;
        this.completed = 0;
        this.failed = 0;
        this.status = 'pending'; // pending, running, completed, cancelled, error
        this.errors = [];
        this.cancelled = false;
        this.startTime = Date.now();
        this.endTime = null;
        this.collectionId = null;
    }

    updateProgress(completed, failed, errors = []) {
        this.completed = completed;
        this.failed = failed;
        if (errors.length > 0) {
            this.errors.push(...errors);
        }
        this.percentage = Math.round((completed / this.totalItems) * 100);
    }

    cancel() {
        this.cancelled = true;
        this.status = 'cancelled';
        this.endTime = Date.now();
    }

    complete(collectionId) {
        this.status = 'completed';
        this.endTime = Date.now();
        this.collectionId = collectionId;
    }

    setError(message) {
        this.status = 'error';
        this.errors.push({ item: 'System', message });
        this.endTime = Date.now();
    }

    getProgress() {
        return {
            id: this.id,
            filename: this.filename,
            completed: this.completed,
            total: this.totalItems,
            failed: this.failed,
            percentage: this.percentage || 0,
            status: this.status,
            errors: this.errors,
            elapsedTime: this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime
        };
    }
}

class ImportJobManager {
    constructor() {
        this.jobs = new Map();

        // Cleanup old jobs after 1 hour
        setInterval(() => {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            for (const [id, job] of this.jobs.entries()) {
                if (job.endTime && job.endTime < oneHourAgo) {
                    this.jobs.delete(id);
                }
            }
        }, 10 * 60 * 1000); // Check every 10 minutes
    }

    createJob(userId, filename, totalItems) {
        const id = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const job = new ImportJob(id, userId, filename, totalItems);
        this.jobs.set(id, job);
        return job;
    }

    getJob(id) {
        return this.jobs.get(id);
    }

    deleteJob(id) {
        this.jobs.delete(id);
    }
}

// Singleton instance
const importJobManager = new ImportJobManager();

module.exports = importJobManager;
