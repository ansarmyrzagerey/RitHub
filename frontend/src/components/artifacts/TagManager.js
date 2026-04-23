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
  TextField,
  Autocomplete,
  Alert,
  LinearProgress,
  IconButton
} from '@mui/material';
import { LocalOffer, Add, Close } from '@mui/icons-material';
import toast from 'react-hot-toast';

const TagManager = ({ open, onClose, artifactId, currentTags = [], onTagsUpdated }) => {
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (open) {
      loadAvailableTags();
      setSelectedTags(currentTags.map(tag => tag.name || tag));
    }
  }, [open, currentTags]);

  const loadAvailableTags = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tags', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setAvailableTags(result.tags.map(tag => tag.name));
      }
    } catch (error) {
      console.error('Error loading tags:', error);
      toast.error('Failed to load available tags');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          description: null
        })
      });

      const result = await response.json();
      if (result.success) {
        toast.success(result.message);

        // If auto-approved, add to available tags and select it
        if (result.tag.status === 'approved') {
          setAvailableTags(prev => [...prev, result.tag.name]);
          setSelectedTags(prev => [...prev, result.tag.name]);
        }

        setNewTagName('');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error('Failed to create tag');
    }
  };

  const handleSave = async () => {
    try {
      setUpdating(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/artifacts/${artifactId}/tags`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tags: selectedTags
        })
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Tags updated successfully');
        onTagsUpdated(result.tags);
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error updating tags:', error);
      toast.error('Failed to update tags');
    } finally {
      setUpdating(false);
    }
  };

  const handleClose = () => {
    if (!updating) {
      setSelectedTags([]);
      setNewTagName('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalOffer />
          Manage Tags
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {loading && <LinearProgress />}

          {/* Tag Selection */}
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Select Tags
            </Typography>
            <Autocomplete
              multiple
              options={availableTags}
              value={selectedTags}
              onChange={(event, newValue) => setSelectedTags(newValue)}
              loading={loading}
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
                  placeholder="Select tags"
                  helperText="Select from existing approved tags"
                />
              )}
              disabled={updating}
            />
          </Box>

          {/* Create New Tag */}
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Create New Tag
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                label="New Tag Name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateTag();
                  }
                }}
                fullWidth
                disabled={updating}
                helperText="New tags may require admin approval"
              />
              <Button
                variant="outlined"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || updating}
                startIcon={<Add />}
                sx={{ minWidth: 120, height: 56 }}
              >
                Create
              </Button>
            </Box>
          </Box>

          {/* Current Selection Preview */}
          {selectedTags.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Selected Tags ({selectedTags.length}):
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selectedTags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={() => {
                      setSelectedTags(prev => prev.filter((_, i) => i !== index));
                    }}
                    color="primary"
                    variant="outlined"
                    disabled={updating}
                  />
                ))}
              </Box>
            </Box>
          )}

          {updating && (
            <Box>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Updating tags...
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
          startIcon={<LocalOffer />}
        >
          {updating ? 'Updating...' : 'Update Tags'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TagManager;