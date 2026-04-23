import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  LinearProgress,
  Tooltip,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Restore,
  DeleteForever,
  Schedule,
  Warning,
  PlayArrow
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const DeletedArtifactsManager = () => {
  const [deletedArtifacts, setDeletedArtifacts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [includeRestored, setIncludeRestored] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);

  useEffect(() => {
    loadDeletedArtifacts();
    loadStats();
  }, [includeRestored]);

  const loadDeletedArtifacts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/deleted-artifacts?includeRestored=${includeRestored}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      if (result.success) {
        setDeletedArtifacts(result.deletedArtifacts);
      } else {
        toast.error('Failed to load deleted artifacts');
      }
    } catch (error) {
      console.error('Error loading deleted artifacts:', error);
      toast.error('Failed to load deleted artifacts');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/retention-stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleRestore = async (deletedArtifactId) => {
    if (!window.confirm('Are you sure you want to restore this artifact?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/deleted-artifacts/${deletedArtifactId}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Artifact restored successfully');
        loadDeletedArtifacts();
        loadStats();
      } else {
        toast.error(result.message || 'Failed to restore artifact');
      }
    } catch (error) {
      console.error('Error restoring artifact:', error);
      toast.error('Failed to restore artifact');
    }
  };

  const handlePermanentDelete = async (deletedArtifactId) => {
    if (!window.confirm('Are you sure you want to permanently delete this artifact? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/deleted-artifacts/${deletedArtifactId}/permanent`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Artifact permanently deleted');
        loadDeletedArtifacts();
        loadStats();
      } else {
        toast.error(result.message || 'Failed to permanently delete artifact');
      }
    } catch (error) {
      console.error('Error permanently deleting artifact:', error);
      toast.error('Failed to permanently delete artifact');
    }
  };

  const handleRunCleanup = async () => {
    if (!window.confirm('Run retention cleanup now? This will permanently delete all expired artifacts.')) {
      return;
    }

    setCleanupRunning(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/cleanup/run-retention', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Cleanup completed: ${result.result.deletedCount} artifacts permanently deleted`);
        loadDeletedArtifacts();
        loadStats();
      } else {
        toast.error(result.message || 'Failed to run cleanup');
      }
    } catch (error) {
      console.error('Error running cleanup:', error);
      toast.error('Failed to run cleanup');
    } finally {
      setCleanupRunning(false);
    }
  };

  const getDaysUntilPurge = (scheduledPurgeAt) => {
    const now = new Date();
    const purgeDate = new Date(scheduledPurgeAt);
    const diffTime = purgeDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return <Typography>Loading deleted artifacts...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule />
          Deleted Artifacts Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={includeRestored}
                onChange={(e) => setIncludeRestored(e.target.checked)}
              />
            }
            label="Include Restored"
          />
          <Button
            variant="contained"
            startIcon={cleanupRunning ? <LinearProgress size={16} /> : <PlayArrow />}
            onClick={handleRunCleanup}
            disabled={cleanupRunning}
            color="warning"
          >
            {cleanupRunning ? 'Running...' : 'Run Cleanup Now'}
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="h6">{stats.total_deleted || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Total Deleted</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="h6">{stats.pending_deletion || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Pending Deletion</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="h6">{stats.ready_for_purge || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Ready for Purge</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="h6">{stats.restored || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Restored</Typography>
          </Paper>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Artifact Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Deleted By</TableCell>
              <TableCell>Deleted At</TableCell>
              <TableCell>Days Until Purge</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {deletedArtifacts.map((artifact) => {
              const artifactData = artifact.artifact_data;
              const daysUntilPurge = getDaysUntilPurge(artifact.scheduled_purge_at);
              const isExpired = daysUntilPurge === 0;
              
              return (
                <TableRow key={artifact.id}>
                  <TableCell>{artifactData.name}</TableCell>
                  <TableCell>
                    <Chip 
                      label={artifactData.type?.replace('_', ' ')} 
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatFileSize(artifactData.file_size)}</TableCell>
                  <TableCell>
                    {artifact.deleted_by_first_name} {artifact.deleted_by_last_name}
                  </TableCell>
                  <TableCell>
                    {new Date(artifact.deleted_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isExpired && <Warning color="error" fontSize="small" />}
                      <Typography 
                        variant="body2" 
                        color={isExpired ? 'error' : daysUntilPurge < 7 ? 'warning.main' : 'text.primary'}
                      >
                        {isExpired ? 'Expired' : `${daysUntilPurge} days`}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {artifact.is_restored ? (
                      <Chip label="Restored" color="success" size="small" />
                    ) : (
                      <Chip 
                        label={isExpired ? 'Ready for Purge' : 'Pending'} 
                        color={isExpired ? 'error' : 'warning'} 
                        size="small" 
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {!artifact.is_restored && (
                      <>
                        <Tooltip title="Restore artifact">
                          <IconButton 
                            onClick={() => handleRestore(artifact.id)} 
                            size="small"
                            color="primary"
                          >
                            <Restore />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Permanently delete">
                          <IconButton 
                            onClick={() => handlePermanentDelete(artifact.id)} 
                            size="small"
                            color="error"
                          >
                            <DeleteForever />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {artifact.is_restored && (
                      <Typography variant="body2" color="text.secondary">
                        Restored by {artifact.restored_by_first_name} {artifact.restored_by_last_name}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {deletedArtifacts.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No deleted artifacts found. Artifacts will appear here when users delete them.
        </Alert>
      )}

      {stats && stats.ready_for_purge > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            {stats.ready_for_purge} artifact{stats.ready_for_purge !== 1 ? 's are' : ' is'} ready for permanent deletion. 
            Run cleanup to free up storage space.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default DeletedArtifactsManager;