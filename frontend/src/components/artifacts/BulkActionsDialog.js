import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Autocomplete,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Tabs,
  Tab
} from '@mui/material';
import { 
  Assignment, 
  LocalOffer, 
  School, 
  CheckCircle, 
  Error,
  RemoveCircle
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const BulkActionsDialog = ({ open, onClose, selectedArtifacts, onActionComplete }) => {
  const [tabValue, setTabValue] = useState(0);
  const [availableTags, setAvailableTags] = useState([]);
  const [availableStudies, setAvailableStudies] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedStudyIds, setSelectedStudyIds] = useState([]);
  const [action, setAction] = useState('assign-tags');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Load tags and studies in parallel
      const [tagsResponse, studiesResponse] = await Promise.all([
        fetch('/api/tags', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/studies?status=draft', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [tagsResult, studiesResult] = await Promise.all([
        tagsResponse.json(),
        studiesResponse.json()
      ]);

      if (tagsResult.success) {
        setAvailableTags(tagsResult.tags.map(tag => tag.name));
      }

      if (studiesResult.success) {
        setAvailableStudies(studiesResult.studies);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    // Reset selections when switching tabs
    setSelectedTags([]);
    setSelectedStudyIds([]);
    
    // Set appropriate action
    if (newValue === 0) {
      setAction('assign-tags');
    } else if (newValue === 1) {
      setAction('assign-studies');
    } else if (newValue === 2) {
      setAction('remove-studies');
    }
  };

  const handleStudyToggle = (studyId) => {
    setSelectedStudyIds(prev => {
      if (prev.includes(studyId)) {
        return prev.filter(id => id !== studyId);
      } else {
        return [...prev, studyId];
      }
    });
  };

  const handleExecute = async () => {
    if (selectedArtifacts.length === 0) {
      toast.error('No artifacts selected');
      return;
    }

    let payload = {
      artifactIds: selectedArtifacts.map(a => a.id),
      action
    };

    if (action === 'assign-tags') {
      if (selectedTags.length === 0) {
        toast.error('Please select at least one tag');
        return;
      }
      payload.tags = selectedTags;
    } else if (action === 'assign-studies' || action === 'remove-studies') {
      if (selectedStudyIds.length === 0) {
        toast.error('Please select at least one study');
        return;
      }
      payload.studyIds = selectedStudyIds;
    }

    try {
      setProcessing(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/artifacts/bulk-assign', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        onActionComplete();
        handleClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error executing bulk action:', error);
      toast.error('Failed to execute bulk action');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setSelectedTags([]);
      setSelectedStudyIds([]);
      setTabValue(0);
      setAction('assign-tags');
      onClose();
    }
  };

  const getActionLabel = () => {
    switch (action) {
      case 'assign-tags': return 'Assign Tags';
      case 'assign-studies': return 'Assign to Studies';
      case 'remove-studies': return 'Remove from Studies';
      default: return 'Execute Action';
    }
  };

  const getActionIcon = () => {
    switch (action) {
      case 'assign-tags': return <LocalOffer />;
      case 'assign-studies': return <School />;
      case 'remove-studies': return <RemoveCircle />;
      default: return <Assignment />;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Assignment />
          Bulk Actions ({selectedArtifacts.length} artifacts)
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {loading && <LinearProgress />}

          {/* Selected Artifacts Preview */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Selected Artifacts ({selectedArtifacts.length}):
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 100, overflowY: 'auto' }}>
              {selectedArtifacts.map((artifact) => (
                <Chip 
                  key={artifact.id} 
                  label={artifact.name} 
                  size="small" 
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>

          {/* Action Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Assign Tags" icon={<LocalOffer />} iconPosition="start" />
              <Tab label="Assign to Studies" icon={<School />} iconPosition="start" />
              <Tab label="Remove from Studies" icon={<RemoveCircle />} iconPosition="start" />
            </Tabs>
          </Box>

          {/* Assign Tags Tab */}
          {tabValue === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Assign Tags to All Selected Artifacts
              </Typography>
              <Autocomplete
                multiple
                options={availableTags}
                value={selectedTags}
                onChange={(event, newValue) => setSelectedTags(newValue)}
                freeSolo
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={index}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    placeholder="Select or type tags"
                    helperText="These tags will be added to all selected artifacts"
                  />
                )}
                disabled={processing}
              />
            </Box>
          )}

          {/* Assign to Studies Tab */}
          {tabValue === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Assign All Selected Artifacts to Studies
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Artifacts can only be assigned to draft studies. Some assignments may fail if studies are full or incompatible.
              </Alert>
              
              {availableStudies.length === 0 ? (
                <Alert severity="warning">
                  No draft studies available. Create a new study to assign artifacts.
                </Alert>
              ) : (
                <List sx={{ maxHeight: 250, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  {availableStudies.map((study) => (
                    <ListItem
                      key={study.id}
                      button
                      onClick={() => handleStudyToggle(study.id)}
                      disabled={processing}
                    >
                      <ListItemIcon>
                        <Checkbox
                          checked={selectedStudyIds.includes(study.id)}
                          disabled={processing}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={study.title}
                        secondary={study.description}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {/* Remove from Studies Tab */}
          {tabValue === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Remove All Selected Artifacts from Studies
              </Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This will remove the selected artifacts from the chosen studies. Only draft studies can be modified.
              </Alert>
              
              {availableStudies.length === 0 ? (
                <Alert severity="info">
                  No draft studies available.
                </Alert>
              ) : (
                <List sx={{ maxHeight: 250, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  {availableStudies.map((study) => (
                    <ListItem
                      key={study.id}
                      button
                      onClick={() => handleStudyToggle(study.id)}
                      disabled={processing}
                    >
                      <ListItemIcon>
                        <Checkbox
                          checked={selectedStudyIds.includes(study.id)}
                          disabled={processing}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={study.title}
                        secondary={study.description}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {processing && (
            <Box>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Processing bulk action...
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          disabled={processing || 
            (action === 'assign-tags' && selectedTags.length === 0) ||
            ((action === 'assign-studies' || action === 'remove-studies') && selectedStudyIds.length === 0)
          }
          startIcon={getActionIcon()}
        >
          {processing ? 'Processing...' : getActionLabel()}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkActionsDialog;