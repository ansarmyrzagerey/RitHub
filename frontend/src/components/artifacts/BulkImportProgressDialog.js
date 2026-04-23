import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    LinearProgress,
    Typography,
    Box,
    Alert
} from '@mui/material';
import toast from 'react-hot-toast';

const BulkImportProgressDialog = ({ jobId, filename, totalItems, onClose, onComplete }) => {
    const [progress, setProgress] = useState({
        completed: 0,
        total: totalItems || 0,
        failed: 0,
        percentage: 0,
        status: 'pending',
        errors: []
    });
    const [eventSource, setEventSource] = useState(null);

    useEffect(() => {
        if (!jobId) return;

        // Create SSE connection with token in query (EventSource doesn't support headers)
        const token = localStorage.getItem('token');
        const es = new EventSource(`/api/artifacts/bulk-import/${jobId}/progress?token=${token}`);

        es.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setProgress(data);

            // Handle completion
            if (data.status === 'completed') {
                toast.success(`Import completed! ${data.completed} items imported`);
                es.close();
                setTimeout(() => {
                    onComplete && onComplete();
                    onClose();
                }, 2000);
            } else if (data.status === 'cancelled') {
                toast.info('Import cancelled');
                es.close();
                setTimeout(() => onClose(), 1000);
            } else if (data.status === 'error') {
                toast.error('Import failed: ' + (data.errors[0]?.message || 'Unknown error'));
                es.close();
            }
        };

        es.onerror = (error) => {
            console.error('SSE error:', error);
            es.close();
        };

        setEventSource(es);

        // Cleanup on unmount
        return () => {
            es.close();
        };
    }, [jobId]);

    const handleCancel = async () => {
        if (!jobId) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/artifacts/bulk-import/${jobId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (result.success) {
                toast.success('Cancelling import...');
            }
        } catch (error) {
            console.error('Error cancelling import:', error);
            toast.error('Failed to cancel import');
        }
    };

    const formatTime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };

    return (
        <Dialog open={true} maxWidth="sm" fullWidth disableEscapeKeyDown>
            <DialogTitle>
                Importing {filename}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ py: 2 }}>
                    {/* Progress Bar */}
                    <LinearProgress
                        variant="determinate"
                        value={progress.percentage}
                        sx={{ height: 10, borderRadius: 1, mb: 2 }}
                    />

                    {/* Progress Text */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1">
                            {progress.completed} / {progress.total} items
                        </Typography>
                        <Typography variant="body1" color="primary" fontWeight="bold">
                            {progress.percentage}%
                        </Typography>
                    </Box>

                    {/* Status */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Status: {progress.status}
                        {progress.elapsedTime && ` • Elapsed: ${formatTime(progress.elapsedTime)}`}
                    </Typography>

                    {/* Failed Count */}
                    {progress.failed > 0 && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {progress.failed} item{progress.failed > 1 ? 's' : ''} failed
                        </Alert>
                    )}

                    {/* Current Action */}
                    {progress.status === 'running' && (
                        <Typography variant="caption" color="text.secondary">
                            Processing imports...
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={handleCancel}
                    color="error"
                    disabled={progress.status !== 'running' && progress.status !== 'pending'}
                >
                    Cancel Import
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default BulkImportProgressDialog;
