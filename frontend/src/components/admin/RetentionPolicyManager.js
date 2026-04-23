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
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Schedule,
  AutoDelete
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const ARTIFACT_TYPES = [
  'source_code', 'test_case', 'uml_diagram', 'requirements', 'documentation'
];

const RetentionPolicyManager = () => {
  const [policies, setPolicies] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [formData, setFormData] = useState({
    policyName: '',
    policyType: 'global',
    targetId: '',
    targetArtifactType: '',
    retentionDays: 90,
    autoDelete: true
  });

  useEffect(() => {
    loadPolicies();
    loadResearchers();
  }, []);

  const loadPolicies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/retention-policies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      if (result.success) {
        setPolicies(result.policies);
      } else {
        toast.error('Failed to load retention policies');
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      toast.error('Failed to load retention policies');
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

  const handleOpenDialog = (policy = null) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        policyName: policy.policy_name,
        policyType: policy.policy_type,
        targetId: policy.target_id || '',
        targetArtifactType: policy.target_artifact_type || '',
        retentionDays: policy.retention_days,
        autoDelete: policy.auto_delete
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        policyName: '',
        policyType: 'global',
        targetId: '',
        targetArtifactType: '',
        retentionDays: 90,
        autoDelete: true
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPolicy(null);
  };

  const handleSavePolicy = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = editingPolicy 
        ? `/api/admin/retention-policies/${editingPolicy.id}`
        : '/api/admin/retention-policies';
      
      const method = editingPolicy ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          policyName: formData.policyName,
          policyType: formData.policyType,
          targetId: formData.targetId || null,
          targetArtifactType: formData.targetArtifactType || null,
          retentionDays: formData.retentionDays,
          autoDelete: formData.autoDelete
        })
      });

      const result = await response.json();
      if (result.success) {
        toast.success(editingPolicy ? 'Policy updated successfully' : 'Policy created successfully');
        handleCloseDialog();
        loadPolicies();
      } else {
        toast.error(result.message || 'Failed to save policy');
      }
    } catch (error) {
      console.error('Error saving policy:', error);
      toast.error('Failed to save policy');
    }
  };

  const handleDeletePolicy = async (policyId) => {
    if (!window.confirm('Are you sure you want to delete this retention policy?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/retention-policies/${policyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Policy deleted successfully');
        loadPolicies();
      } else {
        toast.error(result.message || 'Failed to delete policy');
      }
    } catch (error) {
      console.error('Error deleting policy:', error);
      toast.error('Failed to delete policy');
    }
  };

  const formatRetentionPeriod = (days) => {
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''}`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''}`;
    if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''}`;
    return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''}`;
  };

  const getTargetName = (policy) => {
    if (policy.policy_type === 'global') return 'All Users';
    if (policy.policy_type === 'user' && policy.target_id) {
      return policy.first_name && policy.last_name 
        ? `${policy.first_name} ${policy.last_name}`
        : `User ${policy.target_id}`;
    }
    if (policy.policy_type === 'artifact_type') {
      return policy.target_artifact_type?.replace('_', ' ').toUpperCase() || 'Unknown Type';
    }
    return 'Unknown';
  };

  if (loading) {
    return <Typography>Loading retention policies...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule />
          Retention Policies
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Policy
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Policy Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Retention Period</TableCell>
              <TableCell>Auto Delete</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policies.map((policy) => (
              <TableRow key={policy.id}>
                <TableCell>{policy.policy_name}</TableCell>
                <TableCell>
                  <Chip 
                    label={policy.policy_type} 
                    color={policy.policy_type === 'global' ? 'primary' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{getTargetName(policy)}</TableCell>
                <TableCell>{formatRetentionPeriod(policy.retention_days)}</TableCell>
                <TableCell>
                  <Chip 
                    icon={<AutoDelete />}
                    label={policy.auto_delete ? 'Yes' : 'No'} 
                    color={policy.auto_delete ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={policy.is_active ? 'Active' : 'Inactive'} 
                    color={policy.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpenDialog(policy)} size="small">
                    <Edit />
                  </IconButton>
                  <IconButton 
                    onClick={() => handleDeletePolicy(policy.id)} 
                    size="small"
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {policies.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No retention policies configured. Create a policy to automatically manage artifact lifecycle.
        </Alert>
      )}

      {/* Policy Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPolicy ? 'Edit Retention Policy' : 'Create Retention Policy'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <TextField
              label="Policy Name"
              value={formData.policyName}
              onChange={(e) => setFormData(prev => ({ ...prev, policyName: e.target.value }))}
              fullWidth
              required
            />

            <FormControl fullWidth>
              <InputLabel>Policy Type</InputLabel>
              <Select
                value={formData.policyType}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  policyType: e.target.value, 
                  targetId: '', 
                  targetArtifactType: '' 
                }))}
                label="Policy Type"
              >
                <MenuItem value="global">Global (All Artifacts)</MenuItem>
                <MenuItem value="user">Specific User</MenuItem>
                <MenuItem value="artifact_type">Artifact Type</MenuItem>
              </Select>
            </FormControl>

            {formData.policyType === 'user' && (
              <FormControl fullWidth>
                <InputLabel>Target User</InputLabel>
                <Select
                  value={formData.targetId}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetId: e.target.value }))}
                  label="Target User"
                >
                  {researchers.map((researcher) => (
                    <MenuItem key={researcher.id} value={researcher.id}>
                      {researcher.first_name} {researcher.last_name} ({researcher.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {formData.policyType === 'artifact_type' && (
              <FormControl fullWidth>
                <InputLabel>Artifact Type</InputLabel>
                <Select
                  value={formData.targetArtifactType}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetArtifactType: e.target.value }))}
                  label="Artifact Type"
                >
                  {ARTIFACT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Retention Period (days)"
              type="number"
              value={formData.retentionDays}
              onChange={(e) => setFormData(prev => ({ ...prev, retentionDays: parseInt(e.target.value) || 90 }))}
              fullWidth
              helperText={`Artifacts will be kept for ${formatRetentionPeriod(formData.retentionDays)} after deletion`}
              inputProps={{ min: 1, max: 3650 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.autoDelete}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoDelete: e.target.checked }))}
                />
              }
              label="Automatically delete after retention period"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSavePolicy} 
            variant="contained"
            disabled={!formData.policyName || formData.retentionDays < 1}
          >
            {editingPolicy ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RetentionPolicyManager;