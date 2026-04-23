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
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  Visibility,
  Close,
  History,
  Assessment,
  Restore,
  Download,
  Person,
  Schedule,
  Description
} from '@mui/icons-material';
import toast from 'react-hot-toast';

// MetricsTab Component
const MetricsTab = ({ artifact, canEdit, onMetricsUpdate }) => {
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisJobId, setAnalysisJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);

  // Poll for job status if we have a job ID
  useEffect(() => {
    let interval;
    if (analysisJobId && jobStatus !== 'completed' && jobStatus !== 'failed') {
      interval = setInterval(async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/analysis/status/${analysisJobId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await response.json();

          if (result.success) {
            setJobStatus(result.job.status);
            if (result.job.status === 'completed') {
              toast.success('Analysis completed!');
              onMetricsUpdate(); // Refresh the artifact data
              setAnalysisJobId(null);
              setAnalysisLoading(false);
            } else if (result.job.status === 'failed') {
              toast.error('Analysis failed: ' + (result.job.errorMessage || 'Unknown error'));
              setAnalysisJobId(null);
              setAnalysisLoading(false);
            }
          }
        } catch (error) {
          console.error('Error checking job status:', error);
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [analysisJobId, jobStatus, onMetricsUpdate]);

  const startAnalysis = async () => {
    try {
      setAnalysisLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ artifactId: artifact.id })
      });

      const result = await response.json();
      if (result.success) {
        setAnalysisJobId(result.jobId);
        setJobStatus(result.status);
        toast.success('Analysis started! Results will appear shortly.');
      } else {
        toast.error(result.message || 'Failed to start analysis');
        setAnalysisLoading(false);
      }
    } catch (error) {
      console.error('Error starting analysis:', error);
      toast.error('Failed to start analysis');
      setAnalysisLoading(false);
    }
  };

  const formatMetricValue = (metric) => {
    if (metric.metric_type === 'file_size') {
      return formatFileSize(metric.metric_value);
    } else if (metric.metric_type === 'artifact_age') {
      return `${metric.metric_value} days`;
    } else if (metric.metric_type === 'lines_of_code') {
      const data = typeof metric.metric_data === 'string' ?
        JSON.parse(metric.metric_data) : metric.metric_data;
      return `${metric.metric_value} (${data?.nonEmpty || 0} non-empty, ${data?.comments || 0} comments)`;
    } else if (['ai_complexity', 'ai_quality_score', 'requirements_clarity'].includes(metric.metric_type)) {
      return `${metric.metric_value}/10`;
    }
    return metric.metric_value;
  };

  const getMetricDetails = (metric) => {
    const data = typeof metric.metric_data === 'string' ?
      JSON.parse(metric.metric_data) : metric.metric_data;

    if (metric.metric_type === 'ai_quality_score' && data) {
      return (
        <Box sx={{ mt: 1 }}>
          {data.maintainability && (
            <Typography variant="caption" display="block">
              Maintainability: {data.maintainability}/10
            </Typography>
          )}
          {data.issues && data.issues.length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="error">Issues:</Typography>
              {data.issues.map((issue, idx) => (
                <Typography key={idx} variant="caption" display="block" sx={{ ml: 1 }}>
                  • {issue}
                </Typography>
              ))}
            </Box>
          )}
          {data.suggestions && data.suggestions.length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="primary">Suggestions:</Typography>
              {data.suggestions.map((suggestion, idx) => (
                <Typography key={idx} variant="caption" display="block" sx={{ ml: 1 }}>
                  • {suggestion}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      );
    }

    if (metric.metric_type === 'requirements_clarity' && data) {
      return (
        <Box sx={{ mt: 1 }}>
          {data.completeness && (
            <Typography variant="caption" display="block">
              Completeness: {data.completeness}/10
            </Typography>
          )}
          {data.functional_count && (
            <Typography variant="caption" display="block">
              Functional Requirements: ~{data.functional_count}
            </Typography>
          )}
          {data.non_functional_count && (
            <Typography variant="caption" display="block">
              Non-functional Requirements: ~{data.non_functional_count}
            </Typography>
          )}
        </Box>
      );
    }

    return null;
  };

  return (
    <Box>
      {/* Analysis Controls */}
      {canEdit && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assessment />
                Automated Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Generate AI-powered metrics and insights for this artifact
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={startAnalysis}
              disabled={analysisLoading}
              startIcon={analysisLoading ? <CircularProgress size={16} /> : <Assessment />}
            >
              {analysisLoading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </Box>

          {analysisLoading && jobStatus && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Status: {jobStatus.charAt(0).toUpperCase() + jobStatus.slice(1)}
              </Typography>
              {jobStatus === 'processing' && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress />
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Metrics Display */}
      {artifact.metrics && artifact.metrics.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Metric Type</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Details</TableCell>
                <TableCell>Calculated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {artifact.metrics.map((metric, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {metric.metric_type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Typography>
                      {metric.metric_type?.startsWith('ai_') && (
                        <Chip label="AI Generated" size="small" color="secondary" sx={{ mt: 0.5 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {formatMetricValue(metric)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getMetricDetails(metric)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(metric.calculated_at).toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert
          severity="info"
          action={
            canEdit && (
              <Button
                color="inherit"
                size="small"
                onClick={startAnalysis}
                disabled={analysisLoading}
              >
                Run Analysis
              </Button>
            )
          }
        >
          No metrics available for this artifact. {canEdit && 'Click "Run Analysis" to generate insights.'}
        </Alert>
      )}
    </Box>
  );
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ArtifactDetails = ({ open, onClose, artifactId, canEdit = false }) => {
  const [loading, setLoading] = useState(false);
  const [artifact, setArtifact] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [reverting, setReverting] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (open && artifactId) {
      loadArtifactDetails();
    }

    // Cleanup blob URLs when closing
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [open, artifactId]);

  // Load image with authentication
  useEffect(() => {
    const loadImage = async () => {
      if (!artifact) return;

      const metadata = artifact.metadata || {};
      const mimeType = artifact.mime_type || metadata.mimeType || '';
      const storageType = artifact.storage_type;

      const isImage = mimeType.startsWith('image/') ||
        ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].some(ext =>
          artifact.name?.toLowerCase().endsWith(ext) ||
          metadata.originalName?.toLowerCase().endsWith(ext)
        );

      if (isImage && (storageType === 'database' || storageType === 'filesystem')) {
        setImageLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/artifacts/${artifact.id}/download`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setImageUrl(url);
          } else {
            console.error('Failed to load image:', response.status);
          }
        } catch (error) {
          console.error('Error loading image:', error);
        } finally {
          setImageLoading(false);
        }
      }
    };

    loadImage();
  }, [artifact]);

  // Load PDF with authentication
  useEffect(() => {
    const loadPdf = async () => {
      if (!artifact) return;

      const metadata = artifact.metadata || {};
      const mimeType = artifact.mime_type || metadata.mimeType || '';
      const storageType = artifact.storage_type;

      const isPDF = mimeType === 'application/pdf' ||
        artifact.name?.toLowerCase().endsWith('.pdf') ||
        metadata.originalName?.toLowerCase().endsWith('.pdf');

      if (isPDF && (storageType === 'database' || storageType === 'filesystem')) {
        setPdfLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/artifacts/${artifact.id}/download`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
          } else {
            console.error('Failed to load PDF:', response.status);
          }
        } catch (error) {
          console.error('Error loading PDF:', error);
        } finally {
          setPdfLoading(false);
        }
      }
    };

    loadPdf();
  }, [artifact]);

  const loadArtifactDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/artifacts/${artifactId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setArtifact(result.artifact);
      } else {
        toast.error(result.message || 'Failed to load artifact details');
        onClose();
      }
    } catch (error) {
      console.error('Error loading artifact details:', error);
      toast.error('Failed to load artifact details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleRevertToVersion = async (versionNumber) => {
    if (!canEdit) {
      toast.error('You do not have permission to edit this artifact');
      return;
    }

    try {
      setReverting(versionNumber);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/artifacts/${artifactId}/revert/${versionNumber}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Reverted to version ${versionNumber}`);
        loadArtifactDetails(); // Reload to show new version
      } else {
        toast.error(result.message || 'Failed to revert');
      }
    } catch (error) {
      console.error('Error reverting artifact:', error);
      toast.error('Failed to revert artifact');
    } finally {
      setReverting(null);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleDownload = async (artifactId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/artifacts/${artifactId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Get filename from response headers or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1].replace(/"/g, '')
          : `${artifact.name}.bin`;

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

        toast.success('File downloaded successfully!');
      } else {
        const result = await response.json();
        toast.error(result.message || 'Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed. Please try again.');
    }
  };

  if (!artifact && !loading) return null;

  const metadata = artifact?.metadata || {};
  const tags = metadata.tags || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Visibility />
            Artifact Details
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {/* Basic Info */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                {artifact.name}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={artifact.type?.replace('_', ' ').toUpperCase()}
                  color="primary"
                />
                {tags.map((tag, index) => (
                  <Chip key={index} label={tag} variant="outlined" size="small" />
                ))}
              </Box>

              {metadata.description && (
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  {metadata.description}
                </Typography>
              )}

              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Person fontSize="small" color="action" />
                  <Typography variant="body2">
                    {artifact.first_name} {artifact.last_name}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Schedule fontSize="small" color="action" />
                  <Typography variant="body2">
                    {new Date(artifact.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
                {metadata.size && (
                  <Typography variant="body2" color="text.secondary">
                    Size: {formatFileSize(metadata.size)}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab
                  label="Content Preview"
                  icon={<Description />}
                  iconPosition="start"
                />
                <Tab
                  label={`Version History (${artifact.versions?.length || 0})`}
                  icon={<History />}
                  iconPosition="start"
                />
                <Tab
                  label={`Metrics (${artifact.metrics?.length || 0})`}
                  icon={<Assessment />}
                  iconPosition="start"
                />
              </Tabs>
            </Box>


            {/* Content Preview Tab */}
            {tabValue === 0 && (
              <Box>
                {(() => {
                  const metadata = artifact.metadata || {};
                  const mimeType = artifact.mime_type || metadata.mimeType || '';
                  const storageType = artifact.storage_type;

                  // Determine if it's an image
                  const isImage = mimeType.startsWith('image/') ||
                    ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].some(ext =>
                      artifact.name?.toLowerCase().endsWith(ext) ||
                      metadata.originalName?.toLowerCase().endsWith(ext)
                    );

                  // Determine if it's a PDF
                  const isPDF = mimeType === 'application/pdf' ||
                    artifact.name?.toLowerCase().endsWith('.pdf') ||
                    metadata.originalName?.toLowerCase().endsWith('.pdf');

                  // Image Preview
                  if (isImage && (storageType === 'database' || storageType === 'filesystem')) {
                    return (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6">
                            Image Preview
                          </Typography>
                          <Chip
                            label={artifact.type?.replace('_', ' ')}
                            size="small"
                            color="primary"
                          />
                        </Box>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            bgcolor: 'grey.100',
                            borderRadius: 1,
                            p: 2,
                            minHeight: 200
                          }}
                        >
                          {imageLoading ? (
                            <CircularProgress />
                          ) : imageUrl ? (
                            <Box
                              component="img"
                              src={imageUrl}
                              alt={artifact.name}
                              sx={{
                                maxWidth: '100%',
                                maxHeight: 600,
                                height: 'auto',
                                borderRadius: 1,
                                boxShadow: 2
                              }}
                            />
                          ) : (
                            <Typography color="error">Failed to load image</Typography>
                          )}
                        </Box>
                        {metadata.size && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            File size: {formatFileSize(metadata.size)}
                          </Typography>
                        )}
                      </Paper>
                    );
                  }

                  // PDF Inline Viewer
                  if (isPDF && (storageType === 'database' || storageType === 'filesystem')) {
                    return (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6">
                            PDF Document
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip
                              label={artifact.type?.replace('_', ' ')}
                              size="small"
                              color="primary"
                            />
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<Download />}
                              onClick={() => handleDownload(artifact.id)}
                            >
                              Download
                            </Button>
                          </Box>
                        </Box>
                        <Box
                          sx={{
                            width: '100%',
                            height: 600,
                            border: 1,
                            borderColor: 'grey.300',
                            borderRadius: 1,
                            overflow: 'hidden',
                            bgcolor: 'grey.100',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}
                        >
                          {pdfLoading ? (
                            <CircularProgress />
                          ) : pdfUrl ? (
                            <iframe
                              src={pdfUrl}
                              style={{
                                width: '100%',
                                height: '100%',
                                border: 'none'
                              }}
                              title={artifact.name}
                            />
                          ) : (
                            <Typography color="error">Failed to load PDF</Typography>
                          )}
                        </Box>
                        {metadata.size && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            File size: {formatFileSize(metadata.size)}
                          </Typography>
                        )}
                      </Paper>
                    );
                  }

                  // Text Content Preview (including UML diagrams)
                  if (artifact.content) {
                    // Check if it's a UML diagram with a rendered image
                    const isUMLDiagram = artifact.type === 'uml_diagram';

                    // Get image URL from metadata OR generate it from content
                    let umlImageUrl = metadata.renderedImage;

                    // If no image URL in metadata but it's a UML diagram, generate it from content
                    if (isUMLDiagram && !umlImageUrl && artifact.content) {
                      try {
                        const plantumlEncoder = require('plantuml-encoder');
                        const encoded = plantumlEncoder.encode(artifact.content);
                        umlImageUrl = `http://www.plantuml.com/plantuml/png/${encoded}`;
                      } catch (error) {
                        console.error('Error encoding PlantUML:', error);
                      }
                    }

                    return (
                      <Paper variant="outlined" sx={{ p: 2, maxHeight: 500, overflow: 'auto' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6">
                            {isUMLDiagram ? 'UML Diagram' : 'File Content'}
                          </Typography>
                          <Chip
                            label={artifact.type?.replace('_', ' ')}
                            size="small"
                            color="primary"
                          />
                        </Box>

                        {/* UML Image Preview */}
                        {isUMLDiagram && umlImageUrl && (
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                              Rendered Diagram:
                            </Typography>
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                bgcolor: 'white',
                                borderRadius: 1,
                                p: 2,
                                border: 1,
                                borderColor: 'grey.300'
                              }}
                            >
                              <Box
                                component="img"
                                src={umlImageUrl}
                                alt="UML Diagram"
                                sx={{
                                  maxWidth: '100%',
                                  height: 'auto',
                                  border: '1px solid #ddd',
                                  borderRadius: 1
                                }}
                                onError={(e) => {
                                  console.error('Error loading UML image');
                                  e.target.style.display = 'none';
                                }}
                              />
                            </Box>
                          </Box>
                        )}

                        {/* PlantUML Source Code / Text Content */}
                        <Box>
                          {isUMLDiagram && umlImageUrl && (
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                              PlantUML Source Code:
                            </Typography>
                          )}
                          <Box
                            component="pre"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.875rem',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              margin: 0,
                              backgroundColor: 'grey.50',
                              p: 2,
                              borderRadius: 1,
                              border: 1,
                              borderColor: 'grey.200'
                            }}
                          >
                            {artifact.content}
                          </Box>
                        </Box>
                      </Paper>
                    );
                  }

                  // No Preview Available
                  return (
                    <Alert severity="info">
                      <Typography variant="body2">
                        Content preview is not available for this artifact. This may be because:
                      </Typography>
                      <Box component="ul" sx={{ mt: 1, mb: 0 }}>
                        <li>The file is a binary format without preview support</li>
                        <li>The file was uploaded before content extraction was implemented</li>
                        <li>The file content was not stored during upload</li>
                      </Box>
                      {(storageType === 'database' || storageType === 'filesystem') && (
                        <Box sx={{ mt: 2 }}>
                          <Button
                            variant="outlined"
                            startIcon={<Download />}
                            onClick={() => handleDownload(artifact.id)}
                            size="small"
                          >
                            Download File
                          </Button>
                        </Box>
                      )}
                    </Alert>
                  );
                })()}
              </Box>
            )}

            {/* Version History Tab */}
            {tabValue === 1 && (
              <Box>
                {artifact.versions && artifact.versions.length > 0 ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Version</TableCell>
                          <TableCell>Title</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Edited By</TableCell>
                          <TableCell>Date</TableCell>
                          {canEdit && <TableCell>Actions</TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {artifact.versions.map((version) => (
                          <TableRow key={version.version_number}>
                            <TableCell>
                              <Chip
                                label={`v${version.version_number}`}
                                size="small"
                                color={version.version_number === artifact.versions[0].version_number ? 'primary' : 'default'}
                              />
                            </TableCell>
                            <TableCell>{version.name}</TableCell>
                            <TableCell>{version.type?.replace('_', ' ')}</TableCell>
                            <TableCell>
                              {version.first_name} {version.last_name}
                            </TableCell>
                            <TableCell>
                              {new Date(version.created_at).toLocaleString()}
                            </TableCell>
                            {canEdit && (
                              <TableCell>
                                {version.version_number !== artifact.versions[0].version_number && (
                                  <Tooltip title="Revert to this version">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleRevertToVersion(version.version_number)}
                                      disabled={reverting === version.version_number}
                                    >
                                      {reverting === version.version_number ? (
                                        <CircularProgress size={16} />
                                      ) : (
                                        <Restore />
                                      )}
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">No version history available</Alert>
                )}
              </Box>
            )}

            {/* Metrics Tab */}
            {tabValue === 2 && (
              <MetricsTab
                artifact={artifact}
                canEdit={canEdit}
                onMetricsUpdate={loadArtifactDetails}
              />
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
        {artifact && (
          <Button
            startIcon={<Download />}
            variant="outlined"
            onClick={() => handleDownload(artifact.id)}
          >
            Download File
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ArtifactDetails;