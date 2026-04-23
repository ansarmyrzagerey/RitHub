import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Grid,
  Card,
  CardContent,
  Checkbox,
  Typography,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Button,
  InputAdornment,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Search,
  Visibility,
  Code,
  Description,
  BugReport,
  Architecture,
  Assignment,
  FilterList,
  LocalOffer,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { artifactService } from '../../services/artifactService';

const ArtifactLibraryBrowser = ({
  selectedArtifacts = [],
  onSelectionChange,
  questionType = 'comparison',
  studyId,
  onPreview
}) => {
  const [artifacts, setArtifacts] = useState([]);
  const [filteredArtifacts, setFilteredArtifacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const maxSelection = questionType === 'rating' ? 1 : 3;
  const minSelection = questionType === 'rating' ? 1 : 2;

  useEffect(() => {
    loadArtifacts();
    loadTags();
  }, [studyId]); // Reload when studyId changes

  useEffect(() => {
    filterArtifacts();
  }, [artifacts, searchQuery, typeFilter, tagFilter]);

  const loadArtifacts = async () => {
    try {
      setLoading(true);

      // Only load artifacts if studyId is provided
      // This ensures users must save study as draft and assign artifacts first
      if (studyId) {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/studies/${studyId}/artifacts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const artifactsList = data.success ? data.artifacts : [];
        setArtifacts(artifactsList);
      } else {
        // No studyId means study is not saved yet
        // Don't load any artifacts - user must save as draft first
        setArtifacts([]);
      }
    } catch (error) {
      console.error('Failed to load artifacts:', error);
      setArtifacts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tags', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setAvailableTags(result.tags);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const filterArtifacts = () => {
    if (!Array.isArray(artifacts)) {
      setFilteredArtifacts([]);
      return;
    }

    let filtered = [...artifacts];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(artifact =>
        artifact.name.toLowerCase().includes(query) ||
        (artifact.metadata?.description || '').toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(artifact => artifact.type === typeFilter);
    }

    // Apply tag filter
    if (tagFilter.length > 0) {
      filtered = filtered.filter(artifact => {
        const artifactTags = (artifact.tags || []).map(tag =>
          typeof tag === 'string' ? tag : tag.name
        );
        return tagFilter.some(filterTag => artifactTags.includes(filterTag));
      });
    }

    setFilteredArtifacts(filtered);
  };

  const checkCompatibility = (artifact) => {
    if (selectedArtifacts.length === 0) {
      return { compatible: true, message: 'First artifact' };
    }

    // For rating questions, only one artifact allowed
    if (questionType === 'rating') {
      return { compatible: false, message: 'Rating questions can only have 1 artifact' };
    }

    // Check type compatibility
    const firstType = selectedArtifacts[0].type;
    if (artifact.type !== firstType) {
      return {
        compatible: false,
        message: `Type mismatch: expected ${firstType}, got ${artifact.type}`
      };
    }

    // Check language compatibility for source code
    if (artifact.type === 'source_code') {
      const firstLanguage = selectedArtifacts[0].metadata?.language;
      const artifactLanguage = artifact.metadata?.language;

      if (firstLanguage && artifactLanguage && firstLanguage !== artifactLanguage) {
        return {
          compatible: false,
          message: `Language mismatch: expected ${firstLanguage}, got ${artifactLanguage}`
        };
      }
    }

    return { compatible: true, message: 'Compatible' };
  };

  const handleArtifactToggle = (artifact) => {
    const isSelected = selectedArtifacts.some(a => a.id === artifact.id);

    if (isSelected) {
      onSelectionChange(selectedArtifacts.filter(a => a.id !== artifact.id));
    } else {
      const compatibility = checkCompatibility(artifact);
      if (!compatibility.compatible) {
        return; // Don't allow incompatible selection
      }

      if (selectedArtifacts.length >= maxSelection) {
        return; // Don't allow selection beyond max
      }

      onSelectionChange([...selectedArtifacts, artifact]);
    }
  };

  const getArtifactIcon = (type) => {
    switch (type) {
      case 'source_code':
        return <Code color="primary" />;
      case 'test_case':
        return <BugReport color="secondary" />;
      case 'uml_diagram':
        return <Architecture color="success" />;
      case 'requirements':
        return <Description color="info" />;
      case 'documentation':
        return <Assignment color="warning" />;
      default:
        return <Description />;
    }
  };

  const isSelected = (artifact) => selectedArtifacts.some(a => a.id === artifact.id);

  const artifactTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'source_code', label: 'Source Code' },
    { value: 'test_case', label: 'Test Cases' },
    { value: 'uml_diagram', label: 'UML Diagrams' },
    { value: 'requirements', label: 'Requirements' },
    { value: 'documentation', label: 'Documentation' },
  ];

  return (
    <Box>
      {/* Selection Status */}
      <Alert
        severity={selectedArtifacts.length >= minSelection ? "success" : "info"}
        sx={{ mb: 3 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2">
            {questionType === 'rating'
              ? `Select 1 artifact to rate`
              : `Select ${minSelection}-${maxSelection} artifacts to compare (${selectedArtifacts.length} selected)`
            }
          </Typography>
          {selectedArtifacts.length > 0 && (
            <Button
              size="small"
              onClick={() => onSelectionChange([])}
            >
              Clear Selection
            </Button>
          )}
        </Box>
      </Alert>

      {/* Search and Filter Controls */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              label="Type"
              startAdornment={
                <InputAdornment position="start">
                  <FilterList />
                </InputAdornment>
              }
            >
              {artifactTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Tags</InputLabel>
            <Select
              multiple
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              label="Tags"
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {availableTags.map((tag) => (
                <MenuItem key={tag.id} value={tag.name}>
                  {tag.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Artifacts Grid */}
      {loading ? (
        <Typography>Loading artifacts...</Typography>
      ) : filteredArtifacts.length === 0 ? (
        <Alert severity="warning">
          {!studyId
            ? "Please save this study as a draft and assign artifacts before selecting them for questions."
            : "No artifacts are assigned to this study. Please assign artifacts before selecting them for questions."}
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {filteredArtifacts.map((artifact) => {
            const selected = isSelected(artifact);
            const compatibility = checkCompatibility(artifact);
            const canSelect = (selectedArtifacts.length < maxSelection || selected) && compatibility.compatible;

            return (
              <Grid item xs={12} sm={6} md={4} key={artifact.id}>
                <Card
                  sx={{
                    border: 2,
                    borderColor: selected ? 'primary.main' : 'divider',
                    opacity: !canSelect && !selected ? 0.6 : 1,
                    cursor: canSelect || selected ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: canSelect || selected ? 4 : 1,
                    },
                  }}
                  onClick={() => (canSelect || selected) && handleArtifactToggle(artifact)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'start', gap: 1 }}>
                      <Checkbox
                        checked={selected}
                        disabled={!canSelect && !selected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => handleArtifactToggle(artifact)}
                      />
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          {getArtifactIcon(artifact.type)}
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {artifact.name}
                          </Typography>
                          {selected && (
                            <CheckCircle color="primary" fontSize="small" />
                          )}
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          {artifact.metadata?.description || 'No description'}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                          <Chip
                            label={artifact.type.replace('_', ' ')}
                            size="small"
                            variant="outlined"
                          />
                          {artifact.metadata?.language && (
                            <Chip
                              label={artifact.metadata.language}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {artifact.file_size && (
                            <Chip
                              label={`${(artifact.file_size / 1024).toFixed(1)} KB`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>

                        {artifact.tags && artifact.tags.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                            {artifact.tags.slice(0, 3).map((tag, idx) => (
                              <Chip
                                key={idx}
                                icon={<LocalOffer sx={{ fontSize: 12 }} />}
                                label={typeof tag === 'string' ? tag : tag.name}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            ))}
                            {artifact.tags.length > 3 && (
                              <Chip
                                label={`+${artifact.tags.length - 3}`}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        )}

                        {!compatibility.compatible && !selected && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                            <Warning color="warning" fontSize="small" />
                            <Typography variant="caption" color="warning.main">
                              {compatibility.message}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      <Tooltip title="Preview">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreview(artifact);
                          }}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default ArtifactLibraryBrowser;
