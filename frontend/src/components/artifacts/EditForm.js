import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress
} from '@mui/material';
import { Edit, Close } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';

const ARTIFACT_TYPES = [
  { value: 'source_code', label: 'Source Code' },
  { value: 'test_case', label: 'Test Case' },
  { value: 'uml_diagram', label: 'UML Diagram' },
  { value: 'requirements', label: 'Requirements' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'code_clone', label: 'Code Clone' },
  { value: 'ui_snapshot', label: 'UI Snapshot' }
];

const EditForm = ({ open, onClose, artifact, onEditSuccess }) => {
  const [updating, setUpdating] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      type: '',
      description: ''
    }
  });

  useEffect(() => {
    if (artifact && open) {
      const metadata = artifact.metadata || {};
      setValue('title', artifact.name || '');
      setValue('type', artifact.type || '');
      setValue('description', metadata.description || '');
      setTags(metadata.tags || []);
    }
  }, [artifact, open, setValue]);

  const handleClose = () => {
    if (!updating) {
      reset();
      setTags([]);
      setTagInput('');
      onClose();
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const onSubmit = async (data) => {
    setUpdating(true);

    try {
      const updateData = {
        title: data.title,
        type: data.type,
        description: data.description,
        tags: tags
      };

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/artifacts/${artifact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Artifact updated successfully!');
        onEditSuccess(result.artifact);
        handleClose();
      } else {
        toast.error(result.message || 'Update failed');
      }
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Update failed. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  if (!artifact) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Edit />
          Edit Artifact
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* Title Field */}
            <Controller
              name="title"
              control={control}
              rules={{ required: 'Title is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Title *"
                  fullWidth
                  error={!!errors.title}
                  helperText={errors.title?.message}
                  disabled={updating}
                />
              )}
            />

            {/* Type Field */}
            <Controller
              name="type"
              control={control}
              rules={{ required: 'Type is required' }}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.type} disabled={updating}>
                  <InputLabel>Type *</InputLabel>
                  <Select {...field} label="Type *">
                    {ARTIFACT_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.type && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                      {errors.type.message}
                    </Typography>
                  )}
                </FormControl>
              )}
            />

            {/* Tags Field */}
            <Box>
              <TextField
                label="Tags (optional)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagInputKeyPress}
                fullWidth
                disabled={updating}
                helperText="Press Enter to add a tag"
                InputProps={{
                  endAdornment: (
                    <Button size="small" onClick={addTag} disabled={!tagInput.trim()}>
                      Add
                    </Button>
                  )
                }}
              />
              {tags.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {tags.map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      onDelete={() => removeTag(tag)}
                      size="small"
                      disabled={updating}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {/* Description Field */}
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Description (optional)"
                  multiline
                  rows={3}
                  fullWidth
                  disabled={updating}
                />
              )}
            />

            {updating && (
              <Box>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Updating artifact...
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
            type="submit"
            variant="contained"
            disabled={updating}
            startIcon={<Edit />}
          >
            {updating ? 'Updating...' : 'Update Artifact'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EditForm;