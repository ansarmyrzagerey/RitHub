import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Chip,
  Alert,
  Divider,
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const ArtifactSetManager = ({ 
  selectedArtifacts = [], 
  onLoadSet,
  open,
  onClose 
}) => {
  const [artifactSets, setArtifactSets] = useState([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [setName, setSetName] = useState('');
  const [setDescription, setSetDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadArtifactSets();
    }
  }, [open]);

  const loadArtifactSets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/artifact-sets', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setArtifactSets(data.artifactSets);
      }
    } catch (error) {
      console.error('Failed to load artifact sets:', error);
      toast.error('Failed to load artifact sets');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSet = async () => {
    if (!setName.trim()) {
      toast.error('Please enter a name for the artifact set');
      return;
    }

    if (selectedArtifacts.length < 2 || selectedArtifacts.length > 3) {
      toast.error('Artifact set must contain 2-3 artifacts');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/artifact-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: setName.trim(),
          description: setDescription.trim(),
          artifact_ids: selectedArtifacts.map(a => a.id)
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Artifact set saved successfully');
        setSetName('');
        setSetDescription('');
        setSaveDialogOpen(false);
        loadArtifactSets();
      } else {
        toast.error(data.message || 'Failed to save artifact set');
      }
    } catch (error) {
      console.error('Failed to save artifact set:', error);
      toast.error('Failed to save artifact set');
    }
  };

  const handleDeleteSet = async (setId) => {
    if (!window.confirm('Are you sure you want to delete this artifact set?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/artifact-sets/${setId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Artifact set deleted successfully');
        loadArtifactSets();
      } else {
        toast.error(data.message || 'Failed to delete artifact set');
      }
    } catch (error) {
      console.error('Failed to delete artifact set:', error);
      toast.error('Failed to delete artifact set');
    }
  };

  const handleLoadSet = (artifactSet) => {
    onLoadSet(artifactSet.artifacts);
    toast.success(`Loaded artifact set: ${artifactSet.name}`);
    onClose();
  };

  const canSaveCurrentSelection = selectedArtifacts.length >= 2 && selectedArtifacts.length <= 3;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderIcon />
            <Typography variant="h6">Artifact Sets</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {/* Save Current Selection */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Current Selection
            </Typography>
            {selectedArtifacts.length > 0 ? (
              <Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {selectedArtifacts.map((artifact) => (
                    <Chip
                      key={artifact.id}
                      label={artifact.name}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={!canSaveCurrentSelection}
                  fullWidth
                >
                  Save as New Set
                </Button>
                {!canSaveCurrentSelection && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Select 2-3 artifacts to save as a set
                  </Typography>
                )}
              </Box>
            ) : (
              <Alert severity="info">
                No artifacts selected. Select 2-3 artifacts to save as a set.
              </Alert>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Saved Sets */}
          <Typography variant="subtitle2" gutterBottom>
            Saved Artifact Sets ({artifactSets.length})
          </Typography>
          
          {loading ? (
            <Typography variant="body2" color="text.secondary">
              Loading...
            </Typography>
          ) : artifactSets.length === 0 ? (
            <Alert severity="info">
              No saved artifact sets. Save your current selection to reuse it later.
            </Alert>
          ) : (
            <List>
              {artifactSets.map((set) => (
                <ListItem
                  key={set.id}
                  button
                  onClick={() => handleLoadSet(set)}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ListItemText
                    primary={set.name}
                    secondary={
                      <Box>
                        {set.description && (
                          <Typography variant="caption" display="block">
                            {set.description}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                          {set.artifacts.map((artifact) => (
                            <Chip
                              key={artifact.id}
                              label={artifact.name}
                              size="small"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          ))}
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSet(set.id);
                      }}
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Save Set Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Artifact Set</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Set Name"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="e.g., Java Sorting Algorithms"
            sx={{ mb: 2, mt: 1 }}
            required
          />
          <TextField
            fullWidth
            label="Description (Optional)"
            value={setDescription}
            onChange={(e) => setSetDescription(e.target.value)}
            placeholder="Brief description of this artifact set"
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          <Typography variant="caption" color="text.secondary">
            This set will include {selectedArtifacts.length} artifacts:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {selectedArtifacts.map((artifact) => (
              <Chip
                key={artifact.id}
                label={artifact.name}
                size="small"
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveSet} variant="contained" startIcon={<SaveIcon />}>
            Save Set
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ArtifactSetManager;
