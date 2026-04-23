import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Divider,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Close as CloseIcon,
  Code,
  Description,
  CalendarToday,
  Storage,
  Person,
  Language,
} from '@mui/icons-material';
import { artifactService } from '../../services/artifactService';

const ArtifactPreviewDialog = ({ open, onClose, artifacts = [] }) => {
  const [artifactDetails, setArtifactDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    if (open && artifacts.length > 0) {
      loadArtifactDetails();
    }
  }, [open, artifacts]);

  const loadArtifactDetails = async () => {
    try {
      setLoading(true);
      const details = await Promise.all(
        artifacts.map(async (artifact) => {
          try {
            const response = await artifactService.getArtifactDetails(artifact.id);
            return response.success ? response.artifact : artifact;
          } catch (error) {
            console.error(`Failed to load details for artifact ${artifact.id}:`, error);
            return artifact;
          }
        })
      );
      setArtifactDetails(details);
    } catch (error) {
      console.error('Failed to load artifact details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const MetadataRow = ({ icon, label, value }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      {icon}
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
        {label}:
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );

  const ArtifactMetadata = ({ artifact }) => {
    const metadata = artifact.metadata || {};
    
    return (
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Metadata
        </Typography>
        <MetadataRow
          icon={<Description fontSize="small" />}
          label="Type"
          value={artifact.type?.replace('_', ' ') || 'N/A'}
        />
        <MetadataRow
          icon={<Storage fontSize="small" />}
          label="Size"
          value={formatSize(artifact.file_size || metadata.size)}
        />
        <MetadataRow
          icon={<CalendarToday fontSize="small" />}
          label="Created"
          value={formatDate(artifact.created_at)}
        />
        {metadata.language && (
          <MetadataRow
            icon={<Language fontSize="small" />}
            label="Language"
            value={metadata.language}
          />
        )}
        {metadata.originalName && (
          <MetadataRow
            icon={<Description fontSize="small" />}
            label="File"
            value={metadata.originalName}
          />
        )}
        {artifact.first_name && artifact.last_name && (
          <MetadataRow
            icon={<Person fontSize="small" />}
            label="Uploaded by"
            value={`${artifact.first_name} ${artifact.last_name}`}
          />
        )}
        {metadata.description && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Description:
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {metadata.description}
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  const ArtifactContent = ({ artifact }) => {
    const content = artifact.content || artifact.content_preview;
    
    if (!content) {
      return (
        <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">
            No preview available for this artifact
          </Typography>
        </Box>
      );
    }

    return (
      <Box
        sx={{
          bgcolor: 'grey.900',
          color: 'grey.100',
          p: 2,
          borderRadius: 1,
          maxHeight: 400,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
        }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {content}
        </pre>
      </Box>
    );
  };

  if (artifacts.length === 0) {
    return null;
  }

  // Single artifact view
  if (artifacts.length === 1) {
    const artifact = artifactDetails[0] || artifacts[0];
    
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">{artifact.name}</Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <ArtifactMetadata artifact={artifact} />
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Content Preview
            </Typography>
            <ArtifactContent artifact={artifact} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Side-by-side comparison view for multiple artifacts
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Artifact Comparison ({artifacts.length} artifacts)
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {/* Tab view for mobile */}
        <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
          <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)} variant="fullWidth">
            {artifacts.map((artifact, index) => (
              <Tab key={artifact.id} label={artifact.name} />
            ))}
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {artifactDetails[selectedTab] && (
              <>
                <ArtifactMetadata artifact={artifactDetails[selectedTab]} />
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                    Content Preview
                  </Typography>
                  <ArtifactContent artifact={artifactDetails[selectedTab]} />
                </Box>
              </>
            )}
          </Box>
        </Box>

        {/* Side-by-side view for desktop */}
        <Grid container spacing={2} sx={{ display: { xs: 'none', md: 'flex' } }}>
          {artifactDetails.map((artifact, index) => (
            <Grid item xs={12} md={12 / artifacts.length} key={artifact.id}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  {artifact.name}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <ArtifactMetadata artifact={artifact} />
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                    Content Preview
                  </Typography>
                  <ArtifactContent artifact={artifact} />
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {loading && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Loading artifact details...
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ArtifactPreviewDialog;
