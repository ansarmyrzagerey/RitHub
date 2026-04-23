import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  LinearProgress,
  Chip
} from '@mui/material';
import { Download, FileDownload } from '@mui/icons-material';
import toast from 'react-hot-toast';

const ExportDialog = ({ open, onClose, selectedArtifacts }) => {
  const [format, setFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (selectedArtifacts.length === 0) {
      toast.error('No artifacts selected for export');
      return;
    }

    setExporting(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/artifacts/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artifactIds: selectedArtifacts.map(a => a.id),
          format: format
        })
      });

      if (response.ok) {
        // Get filename from response headers
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition 
          ? contentDisposition.split('filename=')[1].replace(/"/g, '')
          : `artifacts_export.${format}`;

        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(`Exported ${selectedArtifacts.length} artifacts successfully!`);
        onClose();
      } else {
        const result = await response.json();
        toast.error(result.message || 'Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleFormatChange = (event) => {
    setFormat(event.target.value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Download />
          Export Artifacts
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Selected artifacts info */}
          <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Selected Artifacts ({selectedArtifacts.length})
            </Typography>
            {selectedArtifacts.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 120, overflowY: 'auto' }}>
                {selectedArtifacts.map((artifact) => (
                  <Chip 
                    key={artifact.id} 
                    label={artifact.name} 
                    size="small" 
                    variant="outlined"
                  />
                ))}
              </Box>
            ) : (
              <Alert severity="warning">No artifacts selected</Alert>
            )}
          </Box>

          {/* Format selection */}
          <FormControl component="fieldset">
            <FormLabel component="legend">Export Format</FormLabel>
            <RadioGroup
              value={format}
              onChange={handleFormatChange}
              sx={{ mt: 1 }}
            >
              <FormControlLabel 
                value="csv" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      CSV (Comma Separated Values)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Compatible with Excel, Google Sheets, and most data analysis tools
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel 
                value="xlsx" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      XLSX (Excel Spreadsheet)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Native Excel format with better formatting support
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          {/* Export info */}
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Export includes:</strong> ID, Title, Type, Tags, Description, Upload Date, 
              Uploaded By, File Size, and Original Filename
            </Typography>
          </Alert>

          {selectedArtifacts.length > 100 && (
            <Alert severity="warning">
              Large exports may take a few moments to complete.
            </Alert>
          )}

          {exporting && (
            <Box>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                Preparing export...
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={exporting}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={exporting || selectedArtifacts.length === 0}
          startIcon={<FileDownload />}
        >
          {exporting ? 'Exporting...' : `Export ${selectedArtifacts.length} Artifacts`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog;