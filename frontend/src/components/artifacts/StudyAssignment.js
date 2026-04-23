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
  OutlinedInput,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox
} from '@mui/material';
import { Assignment, School, CheckCircle, Error } from '@mui/icons-material';
import toast from 'react-hot-toast';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const StudyAssignment = ({ open, onClose, artifactId, currentStudies = [], onStudiesUpdated }) => {
  const [availableStudies, setAvailableStudies] = useState([]);
  const [selectedStudyIds, setSelectedStudyIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (open) {
      loadAvailableStudies();
      setSelectedStudyIds(currentStudies.map(study => study.id));
    }
  }, [open, currentStudies]);

  const loadAvailableStudies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/studies?status=draft', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        // Filter to only show studies owned by current user (draft studies only)
        setAvailableStudies(result.studies);
      }
    } catch (error) {
      console.error('Error loading studies:', error);
      toast.error('Failed to load available studies');
    } finally {
      setLoading(false);
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

  const handleSave = async () => {
    try {
      setUpdating(true);
      const token = localStorage.getItem('token');
      
      // Get current study IDs
      const currentStudyIds = currentStudies.map(study => study.id);
      
      // Determine which studies to add and remove
      const studiesToAdd = selectedStudyIds.filter(id => !currentStudyIds.includes(id));
      const studiesToRemove = currentStudyIds.filter(id => !selectedStudyIds.includes(id));
      
      let results = { assigned: [], removed: [], errors: [] };

      // Add to new studies
      if (studiesToAdd.length > 0) {
        const addResponse = await fetch(`/api/artifacts/${artifactId}/studies`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            studyIds: studiesToAdd
          })
        });

        const addResult = await addResponse.json();
        if (addResult.success) {
          results.assigned = addResult.results.assigned;
          results.errors.push(...addResult.results.errors);
        }
      }

      // Remove from studies (individual API calls)
      for (const studyId of studiesToRemove) {
        try {
          const removeResponse = await fetch(`/api/studies/${studyId}/artifacts/${artifactId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (removeResponse.ok) {
            results.removed.push(studyId);
          } else {
            const errorResult = await removeResponse.json();
            results.errors.push({ studyId, message: errorResult.message });
          }
        } catch (error) {
          results.errors.push({ studyId, message: error.message });
        }
      }

      // Show results
      const totalChanges = results.assigned.length + results.removed.length;
      if (totalChanges > 0) {
        toast.success(`Study assignments updated: ${results.assigned.length} added, ${results.removed.length} removed`);
      }

      if (results.errors.length > 0) {
        toast.error(`${results.errors.length} operations failed`);
      }

      // Refresh current studies
      const updatedStudies = await loadCurrentStudies();
      onStudiesUpdated(updatedStudies);
      onClose();

    } catch (error) {
      console.error('Error updating study assignments:', error);
      toast.error('Failed to update study assignments');
    } finally {
      setUpdating(false);
    }
  };

  const loadCurrentStudies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/artifacts/${artifactId}/studies`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        return result.studies;
      }
      return [];
    } catch (error) {
      console.error('Error loading current studies:', error);
      return [];
    }
  };

  const handleClose = () => {
    if (!updating) {
      setSelectedStudyIds([]);
      onClose();
    }
  };

  const getStudyStatusColor = (status) => {
    const colors = {
      draft: 'default',
      active: 'primary',
      completed: 'success',
      cancelled: 'error',
      archived: 'secondary'
    };
    return colors[status] || 'default';
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <School />
          Assign to Studies
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {loading && <LinearProgress />}

          <Alert severity="info">
            Artifacts can only be assigned to draft studies. Once a study is activated, its artifacts cannot be changed.
          </Alert>

          {/* Study Selection */}
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Available Studies ({availableStudies.length})
            </Typography>
            
            {availableStudies.length === 0 ? (
              <Alert severity="warning">
                No draft studies available. Create a new study to assign artifacts.
              </Alert>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {availableStudies.map((study) => (
                  <ListItem
                    key={study.id}
                    button
                    onClick={() => handleStudyToggle(study.id)}
                    disabled={updating}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={selectedStudyIds.includes(study.id)}
                        disabled={updating}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">
                            {study.title}
                          </Typography>
                          <Chip 
                            label={study.status} 
                            size="small" 
                            color={getStudyStatusColor(study.status)}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {study.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Created: {new Date(study.created_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          {/* Current Assignment Preview */}
          {selectedStudyIds.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Selected Studies ({selectedStudyIds.length}):
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selectedStudyIds.map((studyId) => {
                  const study = availableStudies.find(s => s.id === studyId);
                  return study ? (
                    <Chip
                      key={studyId}
                      label={study.title}
                      onDelete={() => handleStudyToggle(studyId)}
                      color="primary"
                      variant="outlined"
                      disabled={updating}
                    />
                  ) : null;
                })}
              </Box>
            </Box>
          )}

          {updating && (
            <Box>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Updating study assignments...
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={updating}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={updating}
          startIcon={<Assignment />}
        >
          {updating ? 'Updating...' : 'Update Assignments'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StudyAssignment;