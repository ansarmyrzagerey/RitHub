import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { Download, Description, TableChart, PictureAsPdf } from '@mui/icons-material';
import researcherService from '../../services/researcherService';

export default function ExportDialog({ open, onClose, studies = [] }) {
  const [studyId, setStudyId] = useState(studies && studies[0] ? studies[0].id : null);
  const [format, setFormat] = useState('xlsx');
  const [loading, setLoading] = useState(false);

  // Update studyId when studies change
  useEffect(() => {
    if (studies && studies.length > 0 && !studyId) {
      setStudyId(studies[0].id);
    }
  }, [studies, studyId]);

  const doExport = async () => {
    if (!studyId) return;
    
    setLoading(true);
    try {
      const resp = await researcherService.exportStudy({ studyId, format });
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
      a.download = `study_${studyId}_export.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      console.error('Export failed', e);
      alert('Export failed: ' + (e?.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const getFormatDescription = () => {
    switch (format) {
      case 'csv':
        return 'Plain text format with comma-separated values. Compatible with Excel, Google Sheets, and data analysis tools. Includes all data sections.';
      case 'xlsx':
        return 'Microsoft Excel format with multiple sheets: Overview, Artifacts, Task Analytics, and Evaluations. Best for detailed analysis and charts.';
      case 'pdf':
        return 'Formatted PDF report with study overview, artifacts, and task analytics summary. Ideal for presentations and sharing.';
      default:
        return '';
    }
  };

  const getFormatIcon = () => {
    switch (format) {
      case 'csv':
        return <Description sx={{ fontSize: 40, color: '#4caf50' }} />;
      case 'xlsx':
        return <TableChart sx={{ fontSize: 40, color: '#2e7d32' }} />;
      case 'pdf':
        return <PictureAsPdf sx={{ fontSize: 40, color: '#d32f2f' }} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Download />
        Export Study Analytics
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3, mt: 1 }}>
          <FormControl fullWidth variant="outlined">
            <InputLabel>Select Study</InputLabel>
            <Select
              value={studyId || ''}
              onChange={(e) => setStudyId(Number(e.target.value))}
              label="Select Study"
            >
              {studies.length === 0 ? (
                <MenuItem value="">No studies available</MenuItem>
              ) : (
                studies.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.title || `Study ${s.id}`}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControl fullWidth variant="outlined">
            <InputLabel>Export Format</InputLabel>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              label="Export Format"
            >
              <MenuItem value="xlsx">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TableChart sx={{ color: '#2e7d32' }} />
                  XLSX (Excel)
                </Box>
              </MenuItem>
              <MenuItem value="csv">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Description sx={{ color: '#4caf50' }} />
                  CSV (Comma-Separated Values)
                </Box>
              </MenuItem>
              <MenuItem value="pdf">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PictureAsPdf sx={{ color: '#d32f2f' }} />
                  PDF (Report)
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ textAlign: 'center', mb: 2 }}>
          {getFormatIcon()}
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {getFormatDescription()}
          </Typography>
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <strong>Export includes:</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
          <li>Study overview & participant statistics</li>
          <li>Artifacts used in the study</li>
          <li>Task-by-task analytics (ratings, annotations, choice distributions)</li>
          <li>Complete evaluation list with all responses</li>
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={doExport}
          disabled={loading || !studyId}
          variant="contained"
          startIcon={<Download />}
        >
          {loading ? 'Exporting...' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
