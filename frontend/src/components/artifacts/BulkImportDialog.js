import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import {
  CloudUpload,
  Archive,
  Description,
  CheckCircle,
  Error,
  Warning,
  Info
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const BulkImportDialog = ({ open, onClose, onImportSuccess }) => {
  const [tabValue, setTabValue] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [errorPolicy, setErrorPolicy] = useState('continue');
  const [dragOver, setDragOver] = useState(false);

  const handleClose = () => {
    if (!importing) {
      setSelectedFile(null);
      setImportResult(null);
      setTabValue(0);
      onClose();
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const validateFile = (file) => {
    const allowedTypes = ['.zip', '.csv', '.json'];
    const extension = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(extension)) {
      return `File type ${extension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit for bulk imports
      return 'File size exceeds 100MB limit';
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
    setImportResult(null);
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

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to import');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('errorPolicy', errorPolicy);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/artifacts/bulk-import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setImportResult(result);
        if (result.imported > 0) {
          onImportSuccess();
          toast.success(`Successfully imported ${result.imported} artifacts!`);
        }
      } else {
        toast.error(result.message || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'zip') return <Archive />;
    if (ext === 'csv' || ext === 'json') return <Description />;
    return <Description />;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle color="success" />;
      case 'error': return <Error color="error" />;
      case 'warning': return <Warning color="warning" />;
      default: return <Info color="info" />;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Archive />
          Bulk Import Artifacts
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Import Type Tabs */}
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="ZIP Archive" />
            <Tab label="Manifest File" />
          </Tabs>

          {/* ZIP Import Tab */}
          {tabValue === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Upload ZIP Archive
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Upload a ZIP file containing multiple artifacts. Each file in the ZIP will be imported as a separate artifact.
              </Alert>
            </Box>
          )}

          {/* Manifest Import Tab */}
          {tabValue === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Upload Manifest File
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Upload a CSV or JSON manifest file describing artifacts to import. The manifest should include artifact metadata and file paths.
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>CSV Format:</strong> title,type,tags,description,file_path<br />
                <strong>JSON Format:</strong> Array of objects with title, type, tags, description, file_path
              </Typography>
            </Box>
          )}

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
            onClick={() => document.getElementById('bulk-file-input').click()}
          >
            <input
              id="bulk-file-input"
              type="file"
              accept={tabValue === 0 ? '.zip' : '.csv,.json'}
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />

            {selectedFile ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                  {getFileIcon(selectedFile.name)}
                </Box>
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
                  Drop your {tabValue === 0 ? 'ZIP' : 'manifest'} file here or click to browse
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tabValue === 0 ? 'Supported: .zip' : 'Supported: .csv, .json'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Maximum size: 100MB
                </Typography>
              </Box>
            )}
          </Paper>

          {/* Error Policy */}
          <FormControl component="fieldset">
            <FormLabel component="legend">Error Handling Policy</FormLabel>
            <RadioGroup
              value={errorPolicy}
              onChange={(e) => setErrorPolicy(e.target.value)}
              sx={{ mt: 1 }}
            >
              <FormControlLabel
                value="continue"
                control={<Radio />}
                label="Continue on error (skip failed items and import successful ones)"
              />
              <FormControlLabel
                value="abort"
                control={<Radio />}
                label="Abort on first error (rollback all changes if any item fails)"
              />
            </RadioGroup>
          </FormControl>

          {/* Import Progress */}
          {importing && (
            <Box>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                Processing import...
              </Typography>
            </Box>
          )}

          {/* Import Results */}
          {importResult && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Import Results
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Chip
                  label={`${importResult.imported} Imported`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  label={`${importResult.failed} Failed`}
                  color="error"
                  variant="outlined"
                />
                <Chip
                  label={`${importResult.total} Total`}
                  color="info"
                  variant="outlined"
                />
              </Box>

              {importResult.errors && importResult.errors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Errors:
                  </Typography>
                  <List dense>
                    {importResult.errors.slice(0, 5).map((error, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          {getStatusIcon('error')}
                        </ListItemIcon>
                        <ListItemText
                          primary={error.item || `Item ${index + 1}`}
                          secondary={error.message}
                        />
                      </ListItem>
                    ))}
                    {importResult.errors.length > 5 && (
                      <ListItem>
                        <ListItemText
                          primary={`... and ${importResult.errors.length - 5} more errors`}
                          secondary="Download full error report for details"
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={importing}>
          {importResult ? 'Close' : 'Cancel'}
        </Button>
        {!importResult && (
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={importing || !selectedFile}
            startIcon={<Archive />}
          >
            {importing ? 'Importing...' : 'Import Artifacts'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkImportDialog;