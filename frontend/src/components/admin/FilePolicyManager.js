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
  Policy
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const COMMON_FILE_TYPES = [
  // Programming Languages
  '.java', '.py', '.js', '.jsx', '.ts', '.tsx', '.c', '.cpp', '.cc', '.h', '.hpp',
  '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.kts', '.scala', '.r',
  '.m', '.mm', '.pl', '.sh', '.bash', '.ps1', '.lua', '.dart', '.groovy', '.sql',
  // Web Technologies
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
  // Data & Config
  '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.env', '.csv',
  // Documentation
  '.md', '.txt', '.pdf', '.rtf', '.tex',
  // Diagrams & Images
  '.uml', '.drawio', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
  // Code-related
  '.diff', '.patch', '.log'
];

const FilePolicyManager = () => {
  const [policies, setPolicies] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [formData, setFormData] = useState({
    policyName: '',
    policyType: 'global',
    targetId: '',
    allowedFileTypes: [],
    maxFileSize: 52428800 // 50MB default
  });

  useEffect(() => {
    loadPolicies();
    loadResearchers();
  }, []);

  const loadPolicies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/file-policies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        setPolicies(result.policies);
      } else {
        toast.error('Failed to load file policies');
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      toast.error('Failed to load file policies');
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
        allowedFileTypes: policy.allowed_file_types || [],
        maxFileSize: policy.max_file_size
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        policyName: '',
        policyType: 'global',
        targetId: '',
        allowedFileTypes: [],
        maxFileSize: 52428800
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
        ? `/api/admin/file-policies/${editingPolicy.id}`
        : '/api/admin/file-policies';

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
          allowedFileTypes: formData.allowedFileTypes,
          maxFileSize: formData.maxFileSize
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
    if (!window.confirm('Are you sure you want to delete this policy?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/file-policies/${policyId}`, {
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

  const handleToggleFileType = (fileType) => {
    setFormData(prev => ({
      ...prev,
      allowedFileTypes: prev.allowedFileTypes.includes(fileType)
        ? prev.allowedFileTypes.filter(type => type !== fileType)
        : [...prev.allowedFileTypes, fileType]
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTargetName = (policy) => {
    if (policy.policy_type === 'global') return 'All Users';
    if (policy.policy_type === 'user' && policy.target_id) {
      const researcher = researchers.find(r => r.id === policy.target_id);
      return researcher ? `${researcher.first_name} ${researcher.last_name}` : `User ${policy.target_id}`;
    }
    return 'Unknown';
  };

  if (loading) {
    return <Typography>Loading file policies...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Policy />
          File Type Policies
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
              <TableCell>Allowed File Types</TableCell>
              <TableCell>Max File Size</TableCell>
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
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {policy.allowed_file_types?.slice(0, 3).map((type) => (
                      <Chip key={type} label={type} size="small" variant="outlined" />
                    ))}
                    {policy.allowed_file_types?.length > 3 && (
                      <Chip
                        label={`+${policy.allowed_file_types.length - 3} more`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>{formatFileSize(policy.max_file_size)}</TableCell>
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
          No file policies configured. Create a policy to control allowed file types and sizes.
        </Alert>
      )}

      {/* Policy Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPolicy ? 'Edit File Policy' : 'Create File Policy'}
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
                onChange={(e) => setFormData(prev => ({ ...prev, policyType: e.target.value, targetId: '' }))}
                label="Policy Type"
              >
                <MenuItem value="global">Global (All Users)</MenuItem>
                <MenuItem value="user">Specific User</MenuItem>
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

            <TextField
              label="Max File Size (bytes)"
              type="number"
              value={formData.maxFileSize}
              onChange={(e) => setFormData(prev => ({ ...prev, maxFileSize: parseInt(e.target.value) }))}
              fullWidth
              helperText={`Current: ${formatFileSize(formData.maxFileSize)}`}
            />

            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Allowed File Types
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {COMMON_FILE_TYPES.map((fileType) => (
                  <FormControlLabel
                    key={fileType}
                    control={
                      <Switch
                        checked={formData.allowedFileTypes.includes(fileType)}
                        onChange={() => handleToggleFileType(fileType)}
                        size="small"
                      />
                    }
                    label={fileType}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSavePolicy}
            variant="contained"
            disabled={!formData.policyName || formData.allowedFileTypes.length === 0}
          >
            {editingPolicy ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FilePolicyManager;