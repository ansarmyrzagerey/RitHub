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
  LinearProgress,
  Paper,
  FormControlLabel,
  Switch,
  Autocomplete
} from '@mui/material';
import { Upload, CloudUpload, Close, Analytics } from '@mui/icons-material';
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

const ALLOWED_EXTENSIONS = [
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
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const UploadForm = ({ open, onClose, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [tags, setTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [runAnalysis, setRunAnalysis] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      type: '',
      description: ''
    }
  });

  useEffect(() => {
    if (open) {
      loadAvailableTags();
    }
  }, [open]);

  const loadAvailableTags = async () => {
    try {
      setLoadingTags(true);
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
    } finally {
      setLoadingTags(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      reset();
      setSelectedFile(null);
      setTags([]);
      setRunAnalysis(false);
      onClose();
    }
  };

  const validateFile = (file) => {
    const extension = '.' + file.name.split('.').pop().toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `File type ${extension} is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 50MB limit';
    }

    return null;
  };

  const handleFileSelect = (file) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };



  const onSubmit = async (data) => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', data.title);
      formData.append('type', data.type);
      formData.append('description', data.description || '');
      formData.append('tags', JSON.stringify(tags));

      const token = localStorage.getItem('token');
      const response = await fetch('/api/artifacts/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Artifact uploaded successfully!');

        // Start analysis if requested
        if (runAnalysis) {
          try {
            const analysisResponse = await fetch('/api/analysis/start', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ artifactId: result.artifact.id })
            });

            const analysisResult = await analysisResponse.json();
            if (analysisResult.success) {
              toast.success('Analysis started! Check the artifact details for results.');
            } else {
              toast.error('Analysis failed to start: ' + analysisResult.message);
            }
          } catch (analysisError) {
            console.error('Analysis error:', analysisError);
            toast.error('Failed to start analysis');
          }
        }

        onUploadSuccess(result.artifact);
        handleClose();
      } else {
        toast.error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Upload />
          Upload Artifact
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* File Upload Area */}
            <Paper
              sx={{
                p: 3,
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : 'grey.300',
                backgroundColor: dragOver ? 'action.hover' : 'background.paper',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />

              {selectedFile ? (
                <Box>
                  <CloudUpload sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                  <Typography variant="h6" color="success.main">
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    sx={{ mt: 1 }}
                  >
                    Remove
                  </Button>
                </Box>
              ) : (
                <Box>
                  <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6">
                    Drop your file here or click to browse
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supported formats: {ALLOWED_EXTENSIONS.join(', ')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Maximum size: 50MB
                  </Typography>
                </Box>
              )}
            </Paper>

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
                  disabled={uploading}
                />
              )}
            />

            {/* Type Field */}
            <Controller
              name="type"
              control={control}
              rules={{ required: 'Type is required' }}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.type} disabled={uploading}>
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
              <Autocomplete
                multiple
                options={availableTags}
                value={tags}
                onChange={(event, newValue) => setTags(newValue)}
                loading={loadingTags}
                disabled={uploading}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={index}
                      size="small"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags (optional)"
                    placeholder="Select tags"
                    helperText="Select from existing approved tags"
                  />
                )}
              />
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
                  disabled={uploading}
                />
              )}
            />

            {/* Analysis Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={runAnalysis}
                  onChange={(e) => setRunAnalysis(e.target.checked)}
                  disabled={uploading}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Analytics />
                  <Box>
                    <Typography variant="body2">
                      Run automated analysis
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Generate metrics and insights for this artifact using AI
                    </Typography>
                  </Box>
                </Box>
              }
            />

            {uploading && (
              <Box>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Uploading artifact...
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={uploading || !selectedFile}
            startIcon={<Upload />}
          >
            {uploading ? 'Uploading...' : 'Upload Artifact'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UploadForm;