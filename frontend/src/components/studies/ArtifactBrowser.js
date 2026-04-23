import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  Card,
  CardContent,
  CardActions,
  Checkbox,
  Typography,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  GridView,
  ViewList,
  Search,
  Visibility,
  Code,
  Description,
  Image as ImageIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { artifactService } from '../../services/artifactService';

const ArtifactBrowser = ({ selectedArtifacts, onSelectionChange, maxSelection = 3, studyId }) => {
  const [artifacts, setArtifacts] = useState([]);
  const [filteredArtifacts, setFilteredArtifacts] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [previewArtifact, setPreviewArtifact] = useState(null);
  const [loading, setLoading] = useState(true);

  // Collection selection state
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionArtifacts, setCollectionArtifacts] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  useEffect(() => {
    loadArtifacts();
  }, []);

  useEffect(() => {
    filterArtifacts();
  }, [artifacts, searchQuery, typeFilter]);

  const loadArtifacts = async () => {
    try {
      setLoading(true);
      // Load regular artifacts (NOT from collections)
      const data = await artifactService.getArtifacts({ includeCollections: false });
      const artifactsList = Array.isArray(data) ? data : (data.artifacts || []);
      setArtifacts(artifactsList);
    } catch (error) {
      console.error('Failed to load artifacts:', error);
      setArtifacts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    try {
      setLoadingCollections(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/collections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setCollections(data.collections || []);
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  const loadCollectionArtifacts = async (collectionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/collections/${collectionId}/artifacts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setCollectionArtifacts(data.artifacts || []);
      }
    } catch (error) {
      console.error('Failed to load collection artifacts:', error);
      setCollectionArtifacts([]);
    }
  };

  const handleOpenCollectionDialog = () => {
    setCollectionDialogOpen(true);
    loadCollections();
  };

  const handleSelectCollection = (collection) => {
    setSelectedCollection(collection);
    loadCollectionArtifacts(collection.id);
  };

  const handleSelectCollectionArtifact = (artifact) => {
    const isSelected = selectedArtifacts.some((a) => a.id === artifact.id);

    if (isSelected) {
      onSelectionChange(selectedArtifacts.filter((a) => a.id !== artifact.id));
    } else {
      if (selectedArtifacts.length >= maxSelection) {
        return;
      }
      onSelectionChange([...selectedArtifacts, artifact]);
    }
  };

  const filterArtifacts = () => {
    if (!Array.isArray(artifacts)) {
      setFilteredArtifacts([]);
      return;
    }

    let filtered = [...artifacts];

    if (searchQuery) {
      filtered = filtered.filter(
        (artifact) =>
          artifact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          artifact.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((artifact) => artifact.type === typeFilter);
    }

    setFilteredArtifacts(filtered);
  };

  const handleArtifactToggle = (artifact) => {
    const isSelected = selectedArtifacts.some((a) => a.id === artifact.id);

    if (isSelected) {
      onSelectionChange(selectedArtifacts.filter((a) => a.id !== artifact.id));
    } else {
      if (selectedArtifacts.length >= maxSelection) {
        return;
      }
      onSelectionChange([...selectedArtifacts, artifact]);
    }
  };

  const handlePreview = async (artifact) => {
    try {
      const details = await artifactService.getArtifactDetails(artifact.id);
      setPreviewArtifact(details);
    } catch (error) {
      console.error('Failed to load artifact details:', error);
    }
  };

  const getArtifactIcon = (type) => {
    switch (type) {
      case 'source_code':
        return <Code />;
      case 'document':
        return <Description />;
      case 'image':
        return <ImageIcon />;
      default:
        return <Description />;
    }
  };

  const checkCompatibility = (artifact) => {
    if (selectedArtifacts.length === 0) return { compatible: true, message: '' };

    const types = selectedArtifacts.map((a) => a.type);
    if (!types.includes(artifact.type)) {
      return {
        compatible: false,
        message: 'Different artifact type - may not be comparable',
      };
    }

    return { compatible: true, message: 'Compatible with selected artifacts' };
  };

  const isSelected = (artifact) => selectedArtifacts.some((a) => a.id === artifact.id);

  const artifactTypes = ['all', 'source_code', 'document', 'image', 'diagram'];

  return (
    <Box>
      {/* Search and Filter Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search artifacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
          size="small"
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            label="Type"
          >
            {artifactTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type === 'all' ? 'All Types' : type.replace('_', ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          startIcon={<FolderIcon />}
          onClick={handleOpenCollectionDialog}
          size="small"
        >
          Select from Collection
        </Button>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => newMode && setViewMode(newMode)}
          size="small"
        >
          <ToggleButton value="grid">
            <GridView />
          </ToggleButton>
          <ToggleButton value="list">
            <ViewList />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Artifacts Display */}
      {loading ? (
        <Typography>Loading artifacts...</Typography>
      ) : filteredArtifacts.length === 0 ? (
        <Alert severity="info">No artifacts found. Try adjusting your search or filters.</Alert>
      ) : (
        <Grid container spacing={2}>
          {filteredArtifacts.map((artifact) => {
            const selected = isSelected(artifact);
            const compatibility = checkCompatibility(artifact);
            const canSelect = selectedArtifacts.length < maxSelection || selected;

            return (
              <Grid item xs={12} sm={viewMode === 'grid' ? 6 : 12} md={viewMode === 'grid' ? 4 : 12} key={artifact.id}>
                <Card
                  sx={{
                    border: selected ? 2 : 1,
                    borderColor: selected ? 'primary.main' : 'divider',
                    opacity: !canSelect && !selected ? 0.5 : 1,
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'start', gap: 1 }}>
                      <Checkbox
                        checked={selected}
                        onChange={() => handleArtifactToggle(artifact)}
                        disabled={!canSelect && !selected}
                      />
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          {getArtifactIcon(artifact.type)}
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {artifact.name}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {artifact.description || 'No description'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip label={artifact.type} size="small" />
                          {artifact.language && <Chip label={artifact.language} size="small" />}
                          {artifact.size && (
                            <Chip label={`${(artifact.size / 1024).toFixed(1)} KB`} size="small" />
                          )}
                          {/* Show if artifact is assigned to this study */}
                          {studyId && artifact.studies && artifact.studies.some(s => s.id === parseInt(studyId)) && (
                            <Chip
                              label="✓ Assigned to Study"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          )}
                        </Box>
                        {!compatibility.compatible && (
                          <Alert severity="warning" sx={{ mt: 1 }}>
                            {compatibility.message}
                          </Alert>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <IconButton size="small" onClick={() => handlePreview(artifact)}>
                      <Visibility />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Collection Selection Dialog */}
      <Dialog
        open={collectionDialogOpen}
        onClose={() => {
          setCollectionDialogOpen(false);
          setSelectedCollection(null);
          setCollectionArtifacts([]);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderIcon />
            Select Artifacts from Collection
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, minHeight: 400 }}>
            {/* Collections List */}
            <Box sx={{ width: '40%', borderRight: 1, borderColor: 'divider', pr: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Collections ({collections.length})
              </Typography>
              {loadingCollections ? (
                <Typography variant="body2" color="text.secondary">Loading...</Typography>
              ) : collections.length === 0 ? (
                <Alert severity="info">No collections available</Alert>
              ) : (
                <List>
                  {collections.map((collection) => (
                    <ListItem key={collection.id} disablePadding>
                      <ListItemButton
                        selected={selectedCollection?.id === collection.id}
                        onClick={() => handleSelectCollection(collection)}
                      >
                        <ListItemText
                          primary={collection.name}
                          secondary={collection.description}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            {/* Collection Artifacts */}
            <Box sx={{ width: '60%' }}>
              {selectedCollection ? (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    Artifacts in "{selectedCollection.name}" ({collectionArtifacts.length})
                  </Typography>
                  {collectionArtifacts.length === 0 ? (
                    <Alert severity="info">No artifacts in this collection</Alert>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {collectionArtifacts.map((artifact) => {
                        const selected = isSelected(artifact);
                        const canSelect = selectedArtifacts.length < maxSelection || selected;

                        return (
                          <Card
                            key={artifact.id}
                            sx={{
                              border: selected ? 2 : 1,
                              borderColor: selected ? 'primary.main' : 'divider',
                            }}
                          >
                            <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Checkbox
                                  checked={selected}
                                  onChange={() => handleSelectCollectionArtifact(artifact)}
                                  disabled={!canSelect && !selected}
                                  size="small"
                                />
                                <Box sx={{ flexGrow: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {artifact.name}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                    <Chip label={artifact.type} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                                    {/* Show if artifact is assigned to this study */}
                                    {studyId && artifact.studies && artifact.studies.some(s => s.id === parseInt(studyId)) && (
                                      <Chip
                                        label="✓ In Study"
                                        size="small"
                                        color="success"
                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                      />
                                    )}
                                  </Box>
                                </Box>
                              </Box>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Box>
                  )}
                </>
              ) : (
                <Alert severity="info">Select a collection to view its artifacts</Alert>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCollectionDialogOpen(false);
            setSelectedCollection(null);
            setCollectionArtifacts([]);
          }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={!!previewArtifact}
        onClose={() => setPreviewArtifact(null)}
        maxWidth="md"
        fullWidth
      >
        {previewArtifact && (
          <>
            <DialogTitle>{previewArtifact.name}</DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {previewArtifact.description}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip label={previewArtifact.type} />
                {previewArtifact.language && <Chip label={previewArtifact.language} />}
              </Box>
              {previewArtifact.content && (
                <Box
                  sx={{
                    bgcolor: 'grey.100',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {previewArtifact.content}
                  </pre>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPreviewArtifact(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ArtifactBrowser;
