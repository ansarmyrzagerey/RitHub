import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Checkbox,
  Button
} from '@mui/material';
import {
  Code,
  BugReport,
  Architecture,
  Description,
  Assignment,
  MoreVert,
  Edit,
  Delete,
  Download,
  Visibility,
  LocalOffer,
  School,
  Search,
  ClearAll,
  ContentCopy
} from '@mui/icons-material';

const getArtifactIcon = (type) => {
  const iconMap = {
    source_code: <Code />,
    test_case: <BugReport />,
    uml_diagram: <Architecture />,
    requirements: <Description />,
    documentation: <Assignment />,
    bug_report: <BugReport />,
    code_clone: <ContentCopy />
  };
  return iconMap[type] || <Description />;
};

const getArtifactColor = (type) => {
  const colorMap = {
    source_code: 'primary',
    test_case: 'secondary',
    uml_diagram: 'success',
    requirements: 'info',
    documentation: 'warning',
    bug_report: 'error',
    code_clone: 'secondary'
  };
  return colorMap[type] || 'default';
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ArtifactCard = ({ artifact, onEdit, onDelete, onView, onManageTags, onAssignStudies, selected, onSelect }) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    onEdit(artifact);
  };

  const handleDelete = () => {
    handleMenuClose();
    onDelete(artifact);
  };

  const handleManageTags = () => {
    handleMenuClose();
    onManageTags(artifact);
  };

  const handleAssignStudies = () => {
    handleMenuClose();
    onAssignStudies(artifact);
  };

  const metadata = artifact.metadata || {};
  const legacyTags = metadata.tags || []; // Legacy tags from metadata
  const tags = artifact.tags || legacyTags; // New tags from database or fallback to legacy
  const studies = artifact.studies || [];

  return (
    <Card sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      border: selected ? 2 : 1,
      borderColor: selected ? 'primary.main' : 'divider'
    }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <Checkbox
              checked={selected}
              onChange={(e) => onSelect(artifact, e.target.checked)}
              size="small"
            />
            <Box sx={{ color: `${getArtifactColor(artifact.type)}.main` }}>
              {getArtifactIcon(artifact.type)}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
              {artifact.name}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreVert />
          </IconButton>
        </Box>

        <Chip
          label={artifact.type.replace('_', ' ').toUpperCase()}
          color={getArtifactColor(artifact.type)}
          size="small"
          sx={{ mb: 2 }}
        />

        {metadata.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {metadata.description}
          </Typography>
        )}

        {tags.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Tags:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {tags.map((tag, index) => (
                <Chip
                  key={index}
                  label={typeof tag === 'string' ? tag : tag.name}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}

        {studies.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Studies:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {studies.map((study, index) => (
                <Chip
                  key={index}
                  label={study.title}
                  size="small"
                  variant="filled"
                  color="primary"
                />
              ))}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {new Date(artifact.created_at).toLocaleDateString()}
            </Typography>
            {metadata.size && (
              <Typography variant="body2" color="text.secondary">
                {formatFileSize(metadata.size)}
              </Typography>
            )}
          </Box>

          {/* Quick Preview Icon */}
          {artifact.content_preview && (
            <Tooltip
              title={
                <Box sx={{ maxWidth: 400 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Content Preview:
                  </Typography>
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
                    {artifact.content_preview}
                    {artifact.content_preview && artifact.content_preview.length >= 200 ? '...' : ''}
                  </Typography>
                </Box>
              }
              arrow
              placement="top"
            >
              <IconButton size="small" color="primary">
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </CardContent>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={() => { handleMenuClose(); onView(artifact); }}>
          <Visibility sx={{ mr: 1 }} fontSize="small" />
          View Details
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          Edit Metadata
        </MenuItem>
        <MenuItem onClick={handleManageTags}>
          <LocalOffer sx={{ mr: 1 }} fontSize="small" />
          Manage Tags
        </MenuItem>
        <MenuItem onClick={handleAssignStudies}>
          <School sx={{ mr: 1 }} fontSize="small" />
          Assign to Studies
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>
    </Card>
  );
};

const ArtifactList = ({ artifacts, loading, onEdit, onDelete, onView, onManageTags, onAssignStudies, selectedArtifacts, onSelectArtifact, hasFilters, onClearFilters }) => {
  if (loading) {
    return (
      <Grid container spacing={3}>
        {[...Array(6)].map((_, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <Card sx={{ height: 200 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Box sx={{ width: 24, height: 24, bgcolor: 'grey.300', borderRadius: 1 }} />
                  <Box sx={{ width: '60%', height: 20, bgcolor: 'grey.300', borderRadius: 1 }} />
                </Box>
                <Box sx={{ width: 80, height: 24, bgcolor: 'grey.300', borderRadius: 1, mb: 2 }} />
                <Box sx={{ width: '100%', height: 40, bgcolor: 'grey.300', borderRadius: 1, mb: 2 }} />
                <Box sx={{ width: '40%', height: 16, bgcolor: 'grey.300', borderRadius: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (artifacts.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          {hasFilters ? (
            <>
              <Search sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                No Artifacts Found
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
                No artifacts match your current search criteria. Try adjusting your filters or search terms.
              </Typography>
              <Button
                variant="outlined"
                onClick={onClearFilters}
                startIcon={<ClearAll />}
              >
                Clear All Filters
              </Button>
            </>
          ) : (
            <>
              <Code sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                No Artifacts Yet
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto' }}>
                Upload your first artifact to start building your collection. You can upload source code, test cases,
                UML diagrams, requirements documents, and more for use in your studies.
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={3}>
      {artifacts.map((artifact) => (
        <Grid item xs={12} md={6} lg={4} key={artifact.id}>
          <ArtifactCard
            artifact={artifact}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            onManageTags={onManageTags}
            onAssignStudies={onAssignStudies}
            selected={selectedArtifacts.some(selected => selected.id === artifact.id)}
            onSelect={onSelectArtifact}
          />
        </Grid>
      ))}
    </Grid>
  );
};

export default ArtifactList;