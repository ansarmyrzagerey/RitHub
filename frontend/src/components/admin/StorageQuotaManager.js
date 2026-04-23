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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Storage
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const StorageQuotaManager = () => {
  const [quotas, setQuotas] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuota, setEditingQuota] = useState(null);
  const [formData, setFormData] = useState({
    quotaType: 'global',
    targetId: '',
    maxStorageBytes: 10737418240, // 10GB default
    maxArtifacts: 1000
  });

  useEffect(() => {
    loadQuotas();
    loadResearchers();
  }, []);

  const loadQuotas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/storage-quotas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      if (result.success) {
        setQuotas(result.quotas);
      } else {
        toast.error('Failed to load storage quotas');
      }
    } catch (error) {
      console.error('Error loading quotas:', error);
      toast.error('Failed to load storage quotas');
    } finally {
      setLoading(false);
    }
  };

  const loadResearchers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/researchers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      if (result.success) {
        setResearchers(result.researchers);
      }
    } catch (error) {
      console.error('Error loading researchers:', error);
    }
  };

  const handleOpenDialog = (quota = null) => {
    if (quota) {
      setEditingQuota(quota);
      setFormData({
        quotaType: quota.quota_type,
        targetId: quota.target_id || '',
        maxStorageBytes: quota.max_storage_bytes,
        maxArtifacts: quota.max_artifacts || 1000
      });
    } else {
      setEditingQuota(null);
      setFormData({
        quotaType: 'global',
        targetId: '',
        maxStorageBytes: 10737418240,
        maxArtifacts: 1000
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingQuota(null);
  };

  const handleSaveQuota = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = editingQuota 
        ? `/api/admin/storage-quotas/${editingQuota.id}`
        : '/api/admin/storage-quotas';
      
      const method = editingQuota ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quotaType: formData.quotaType,
          targetId: formData.targetId || null,
          maxStorageBytes: formData.maxStorageBytes,
          maxArtifacts: formData.maxArtifacts
        })
      });

      const result = await response.json();
      if (result.success) {
        toast.success(editingQuota ? 'Quota updated successfully' : 'Quota created successfully');
        handleCloseDialog();
        loadQuotas();
      } else {
        toast.error(result.message || 'Failed to save quota');
      }
    } catch (error) {
      console.error('Error saving quota:', error);
      toast.error('Failed to save quota');
    }
  };

  const handleDeleteQuota = async (quotaId) => {
    if (!window.confirm('Are you sure you want to delete this quota?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/storage-quotas/${quotaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Quota deleted successfully');
        loadQuotas();
      } else {
        toast.error(result.message || 'Failed to delete quota');
      }
    } catch (error) {
      console.error('Error deleting quota:', error);
      toast.error('Failed to delete quota');
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTargetName = (quota) => {
    if (quota.quota_type === 'global') return 'All Users';
    if (quota.quota_type === 'user' && quota.target_id) {
      return quota.first_name && quota.last_name 
        ? `${quota.first_name} ${quota.last_name}`
        : `User ${quota.target_id}`;
    }
    return 'Unknown';
  };

  const getUsagePercentage = (quota) => {
    if (!quota.max_storage_bytes) return 0;
    return Math.round((quota.current_usage_bytes / quota.max_storage_bytes) * 100);
  };

  const convertBytesToGB = (bytes) => {
    return Math.round(bytes / (1024 * 1024 * 1024) * 100) / 100;
  };

  const convertGBToBytes = (gb) => {
    return Math.round(gb * 1024 * 1024 * 1024);
  };

  if (loading) {
    return <Typography>Loading storage quotas...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Storage />
          Storage Quotas
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Quota
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Storage Limit</TableCell>
              <TableCell>Current Usage</TableCell>
              <TableCell>Usage %</TableCell>
              <TableCell>Artifact Limit</TableCell>
              <TableCell>Current Count</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quotas.map((quota) => {
              const usagePercentage = getUsagePercentage(quota);
              return (
                <TableRow key={quota.id}>
                  <TableCell>
                    <Chip 
                      label={quota.quota_type} 
                      color={quota.quota_type === 'global' ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{getTargetName(quota)}</TableCell>
                  <TableCell>{formatBytes(quota.max_storage_bytes)}</TableCell>
                  <TableCell>{formatBytes(quota.current_usage_bytes || 0)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min(usagePercentage, 100)}
                        sx={{ width: 60, height: 8 }}
                        color={usagePercentage > 90 ? 'error' : usagePercentage > 70 ? 'warning' : 'primary'}
                      />
                      <Typography variant="body2">
                        {usagePercentage}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{quota.max_artifacts || 'Unlimited'}</TableCell>
                  <TableCell>{quota.current_artifact_count || 0}</TableCell>
                  <TableCell>
                    <Chip 
                      label={quota.is_active ? 'Active' : 'Inactive'} 
                      color={quota.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleOpenDialog(quota)} size="small">
                      <Edit />
                    </IconButton>
                    <IconButton 
                      onClick={() => handleDeleteQuota(quota.id)} 
                      size="small"
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {quotas.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No storage quotas configured. Create quotas to control storage usage per user or globally.
        </Alert>
      )}

      {/* Quota Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingQuota ? 'Edit Storage Quota' : 'Create Storage Quota'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Quota Type</InputLabel>
              <Select
                value={formData.quotaType}
                onChange={(e) => setFormData(prev => ({ ...prev, quotaType: e.target.value, targetId: '' }))}
                label="Quota Type"
                disabled={editingQuota} // Can't change type when editing
              >
                <MenuItem value="global">Global (All Users)</MenuItem>
                <MenuItem value="user">Specific User</MenuItem>
              </Select>
            </FormControl>

            {formData.quotaType === 'user' && (
              <FormControl fullWidth>
                <InputLabel>Target User</InputLabel>
                <Select
                  value={formData.targetId}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetId: e.target.value }))}
                  label="Target User"
                  disabled={editingQuota} // Can't change target when editing
                >
                  {researchers.map((researcher) => (
                    <MenuItem key={researcher.id} value={researcher.id}>
                      {researcher.first_name} {researcher.last_name} ({researcher.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Storage Limit (GB)"
              type="number"
              value={convertBytesToGB(formData.maxStorageBytes)}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                maxStorageBytes: convertGBToBytes(parseFloat(e.target.value) || 0)
              }))}
              fullWidth
              helperText={`${formatBytes(formData.maxStorageBytes)}`}
              inputProps={{ min: 0, step: 0.1 }}
            />

            <TextField
              label="Maximum Artifacts"
              type="number"
              value={formData.maxArtifacts}
              onChange={(e) => setFormData(prev => ({ ...prev, maxArtifacts: parseInt(e.target.value) || null }))}
              fullWidth
              helperText="Leave empty for unlimited artifacts"
              inputProps={{ min: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveQuota} 
            variant="contained"
            disabled={formData.maxStorageBytes <= 0}
          >
            {editingQuota ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StorageQuotaManager;