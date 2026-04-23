import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  InputAdornment,
  Autocomplete,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton
} from '@mui/material';
import {
  Code,
  Upload,
  Description,
  BugReport,
  Architecture,
  Assignment,
  Download,
  SelectAll,
  ClearAll,
  Archive,
  Search,
  FilterList,
  LocalOffer,
  School,
  Schedule,
  Person,
  AutoAwesome,
  Folder,
  Add,
  ContentCopy,
  Image
} from '@mui/icons-material';
import toast from 'react-hot-toast';

import UploadForm from '../components/artifacts/UploadForm';
import GenerateArtifactDialog from '../components/artifacts/GenerateArtifactDialog';
import ArtifactList from '../components/artifacts/ArtifactList';
import EditForm from '../components/artifacts/EditForm';
import ArtifactDetails from '../components/artifacts/ArtifactDetails';
import ExportDialog from '../components/artifacts/ExportDialog';
import BulkImportDialog from '../components/artifacts/BulkImportDialog';
import TagManager from '../components/artifacts/TagManager';
import StudyAssignment from '../components/artifacts/StudyAssignment';
import BulkActionsDialog from '../components/artifacts/BulkActionsDialog';
import Pagination from '../components/common/Pagination';
import CollectionsDialog from '../components/artifacts/CollectionsDialog';
import { artifactService } from '../services/artifactService';

const Artifacts = () => {
  const [tabValue, setTabValue] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [studyAssignmentOpen, setStudyAssignmentOpen] = useState(false);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [collectionsDialogOpen, setCollectionsDialogOpen] = useState(false);
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [artifactToDelete, setArtifactToDelete] = useState(null);
  const [artifactToEdit, setArtifactToEdit] = useState(null);
  const [artifactToView, setArtifactToView] = useState(null);
  const [artifactForTags, setArtifactForTags] = useState(null);
  const [artifactForStudies, setArtifactForStudies] = useState(null);
  const [selectedArtifacts, setSelectedArtifacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState([]);
  const [studyFilter, setStudyFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [availableStudies, setAvailableStudies] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const loadArtifacts = async () => {
    try {
      setLoading(true);
      const response = await artifactService.getArtifacts();
      if (response.success) {
        setArtifacts(response.artifacts);
      } else {
        toast.error('Failed to load artifacts');
      }
    } catch (error) {
      console.error('Error loading artifacts:', error);
      toast.error('Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArtifacts();
    loadAvailableTags();
    loadAvailableStudies();
  }, []);

  const loadAvailableTags = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tags', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setAvailableTags(result.tags);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadAvailableStudies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/studies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setAvailableStudies(result.studies);
      }
    } catch (error) {
      console.error('Error loading studies:', error);
    }
  };



  const handleUploadSuccess = (newArtifact) => {
    setArtifacts(prev => [newArtifact, ...prev]);
  };

  const handleBulkImportSuccess = () => {
    loadArtifacts(); // Reload all artifacts after bulk import
  };

  const handleEdit = (artifact) => {
    setArtifactToEdit(artifact);
    setEditDialogOpen(true);
  };

  const handleView = (artifact) => {
    setArtifactToView(artifact);
    setDetailsDialogOpen(true);
  };

  const handleManageTags = (artifact) => {
    setArtifactForTags(artifact);
    setTagManagerOpen(true);
  };

  const handleAssignStudies = (artifact) => {
    setArtifactForStudies(artifact);
    setStudyAssignmentOpen(true);
  };

  const handleTagsUpdated = (updatedTags) => {
    // Update the artifact in the list with new tags
    setArtifacts(prev => prev.map(a =>
      a.id === artifactForTags.id
        ? { ...a, tags: updatedTags }
        : a
    ));
  };

  const handleStudiesUpdated = (updatedStudies) => {
    // Update the artifact in the list with new studies
    setArtifacts(prev => prev.map(a =>
      a.id === artifactForStudies.id
        ? { ...a, studies: updatedStudies }
        : a
    ));
  };

  const handleBulkActionsComplete = () => {
    // Reload artifacts after bulk actions
    loadArtifacts();
    setSelectedArtifacts([]);
  };

  const handleEditSuccess = (updatedArtifact) => {
    setArtifacts(prev => prev.map(a => a.id === updatedArtifact.id ? updatedArtifact : a));
  };

  const handleSelectArtifact = (artifact, selected) => {
    if (selected) {
      setSelectedArtifacts(prev => [...prev, artifact]);
    } else {
      setSelectedArtifacts(prev => prev.filter(a => a.id !== artifact.id));
    }
  };

  const handleSelectAll = () => {
    setSelectedArtifacts([...filteredArtifacts]);
  };

  const handleClearSelection = () => {
    setSelectedArtifacts([]);
  };

  const handleDelete = (artifact) => {
    setArtifactToDelete(artifact);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!artifactToDelete) return;

    try {
      const response = await artifactService.deleteArtifact(artifactToDelete.id);
      if (response.success) {
        setArtifacts(prev => prev.filter(a => a.id !== artifactToDelete.id));
        toast.success('Artifact deleted successfully');
      } else {
        toast.error(response.message || 'Failed to delete artifact');
      }
    } catch (error) {
      console.error('Error deleting artifact:', error);
      toast.error('Failed to delete artifact');
    } finally {
      setDeleteDialogOpen(false);
      setArtifactToDelete(null);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      setCreatingTag(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          description: newTagDescription.trim() || null
        })
      });

      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        setNewTagName('');
        setNewTagDescription('');
        setCreateTagDialogOpen(false);
        // Reload tags
        loadAvailableTags();
      } else {
        toast.error(result.message || 'Failed to create tag');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error('Failed to create tag');
    } finally {
      setCreatingTag(false);
    }
  };

  // Calculate artifact type counts
  const getArtifactCounts = () => {
    const counts = {
      source_code: 0,
      test_case: 0,
      uml_diagram: 0,
      requirements: 0,
      documentation: 0,
      bug_report: 0,
      code_clone: 0,
      ui_snapshot: 0
    };

    artifacts.forEach(artifact => {
      if (counts.hasOwnProperty(artifact.type)) {
        counts[artifact.type]++;
      }
    });

    return counts;
  };

  const counts = getArtifactCounts();
  const artifactTypes = [
    { icon: <Code />, name: 'Source Code', count: counts.source_code, color: 'primary', type: 'source_code' },
    { icon: <BugReport />, name: 'Test Cases', count: counts.test_case, color: 'secondary', type: 'test_case' },
    { icon: <Architecture />, name: 'UML Diagrams', count: counts.uml_diagram, color: 'success', type: 'uml_diagram' },
    { icon: <Description />, name: 'Requirements', count: counts.requirements, color: 'info', type: 'requirements' },
    { icon: <Assignment />, name: 'Documentation', count: counts.documentation, color: 'warning', type: 'documentation' },
    { icon: <BugReport />, name: 'Bug Reports', count: counts.bug_report, color: 'error', type: 'bug_report' },
    { icon: <ContentCopy />, name: 'Code Clones', count: counts.code_clone, color: 'secondary', type: 'code_clone' },
    { icon: <Image />, name: 'UI Snapshots', count: counts.ui_snapshot, color: 'info', type: 'ui_snapshot' },
  ];

  // Filter artifacts based on selected tab, search, and tags
  const getFilteredArtifacts = () => {
    let filtered = artifacts;

    // Filter by type (tab)
    if (tabValue !== 0) {
      const selectedType = artifactTypes[tabValue - 1]?.type;
      filtered = filtered.filter(artifact => artifact.type === selectedType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(artifact =>
        artifact.name.toLowerCase().includes(query) ||
        (artifact.metadata?.description || '').toLowerCase().includes(query) ||
        (artifact.tags || []).some(tag =>
          (typeof tag === 'string' ? tag : tag.name).toLowerCase().includes(query)
        )
      );
    }

    // Filter by tags
    if (tagFilter.length > 0) {
      filtered = filtered.filter(artifact => {
        const artifactTags = (artifact.tags || []).map(tag =>
          typeof tag === 'string' ? tag : tag.name
        );
        return tagFilter.some(filterTag => artifactTags.includes(filterTag));
      });
    }

    // Filter by study
    if (studyFilter) {
      filtered = filtered.filter(artifact => {
        const artifactStudies = artifact.studies || [];
        return artifactStudies.some(study => study.id === parseInt(studyFilter));
      });
    }

    // Filter by date range
    if (dateFilter) {
      const now = new Date();
      let startDate;

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = null;
      }

      if (startDate) {
        filtered = filtered.filter(artifact =>
          new Date(artifact.created_at) >= startDate
        );
      }
    }



    return filtered;
  };

  const filteredArtifacts = getFilteredArtifacts();

  // Calculate paginated artifacts
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedArtifacts = filteredArtifacts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, tagFilter, studyFilter, dateFilter, tabValue]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Code color="primary" />
          Artifacts
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedArtifacts.length > 0 && (
            <>
              <Button
                variant="outlined"
                startIcon={<Assignment />}
                onClick={() => setBulkActionsOpen(true)}
              >
                Bulk Actions ({selectedArtifacts.length})
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={() => setExportDialogOpen(true)}
              >
                Export ({selectedArtifacts.length})
              </Button>
            </>
          )}
          <Button
            variant="outlined"
            startIcon={<Folder />}
            onClick={() => setCollectionsDialogOpen(true)}
            sx={{
              borderColor: 'secondary.main',
              color: 'secondary.main'
            }}
          >
            View Collections
          </Button>
          <Button
            variant="outlined"
            startIcon={<Archive />}
            onClick={() => setBulkImportDialogOpen(true)}
          >
            Bulk Import
          </Button>
          <Button
            variant="outlined"
            startIcon={<AutoAwesome />}
            onClick={() => setGenerateDialogOpen(true)}
            sx={{
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                borderColor: 'primary.dark',
                backgroundColor: 'primary.50'
              }
            }}
          >
            Generate with AI
          </Button>
          <Button
            variant="contained"
            startIcon={<Upload />}
            sx={{ minWidth: 140 }}
            onClick={() => setUploadDialogOpen(true)}
          >
            Upload Artifact
          </Button>
        </Box>
      </Box>

      {/* Artifact Type Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {artifactTypes.map((type, index) => (
          <Grid item xs={12} sm={6} md={2.4} key={index}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Box sx={{ color: `${type.color}.main`, mb: 1 }}>
                {React.cloneElement(type.icon, { sx: { fontSize: 40 } })}
              </Box>
              <Typography variant="h4" color={`${type.color}.main`} sx={{ fontWeight: 600 }}>
                {type.count}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {type.name}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Search and Filter Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          {/* Search Box */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search artifacts by name, description, or tags..."
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

          {/* Create Tag Button */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setCreateTagDialogOpen(true)}
                sx={{
                  height: '56px',
                  borderColor: 'success.main',
                  color: 'success.main',
                  '&:hover': {
                    borderColor: 'success.dark',
                    backgroundColor: 'success.50'
                  }
                }}
              >
                Create Tag
              </Button>
            </Box>
          </Grid>

          {/* Study Filter */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Study</InputLabel>
              <Select
                value={studyFilter}
                onChange={(e) => setStudyFilter(e.target.value)}
                label="Study"
                displayEmpty
                renderValue={(selected) => {
                  if (!selected) {
                    return <Box sx={{ display: 'flex', alignItems: 'center' }}>All Studies</Box>;
                  }
                  const study = availableStudies.find(s => s.id === selected);
                  return study ? study.title : 'All Studies';
                }}
                startAdornment={
                  <InputAdornment position="start">
                    <School />
                  </InputAdornment>
                }
              >
                <MenuItem value="">All Studies</MenuItem>
                {availableStudies.map((study) => (
                  <MenuItem key={study.id} value={study.id}>
                    {study.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Date Filter */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Upload Date</InputLabel>
              <Select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                label="Upload Date"
                displayEmpty
                renderValue={(selected) => {
                  if (!selected) {
                    return <Box sx={{ display: 'flex', alignItems: 'center' }}>All Time</Box>;
                  }
                  const labels = {
                    today: 'Today',
                    week: 'This Week',
                    month: 'This Month',
                    year: 'This Year'
                  };
                  return labels[selected] || 'All Time';
                }}
                startAdornment={
                  <InputAdornment position="start">
                    <Schedule />
                  </InputAdornment>
                }
              >
                <MenuItem value="">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="month">This Month</MenuItem>
                <MenuItem value="year">This Year</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Tag Filter */}
          <Grid item xs={12} md={4}>
            <Autocomplete
              multiple
              options={availableTags.map(tag => tag.name)}
              value={tagFilter}
              onChange={(event, newValue) => setTagFilter(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    color="primary"
                    {...getTagProps({ index })}
                    key={index}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={tagFilter.length === 0 ? "Filter by tags..." : ""}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <LocalOffer />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>


        </Grid>

        {/* Filter Status and Clear Button */}
        {(searchQuery || tagFilter.length > 0 || studyFilter || dateFilter) && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredArtifacts.length} of {artifacts.length} artifacts
            </Typography>
            <Button
              size="small"
              onClick={() => {
                setSearchQuery('');
                setTagFilter([]);
                setStudyFilter('');
                setDateFilter('');
              }}
            >
              Clear All Filters
            </Button>
          </Box>
        )}
      </Paper>

      {/* Selection controls */}
      {filteredArtifacts.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<SelectAll />}
              onClick={handleSelectAll}
              disabled={selectedArtifacts.length === filteredArtifacts.length}
            >
              Select All
            </Button>
            <Button
              size="small"
              startIcon={<ClearAll />}
              onClick={handleClearSelection}
              disabled={selectedArtifacts.length === 0}
            >
              Clear Selection
            </Button>
          </Box>
          {selectedArtifacts.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {selectedArtifacts.length} of {filteredArtifacts.length} selected
            </Typography>
          )}
        </Box>
      )}

      {/* Tabs for different views */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`All Artifacts (${artifacts.length})`} />
          <Tab label={`Source Code (${counts.source_code})`} />
          <Tab label={`Test Cases (${counts.test_case})`} />
          <Tab label={`UML Diagrams (${counts.uml_diagram})`} />
          <Tab label={`Requirements (${counts.requirements})`} />
          <Tab label={`Documentation (${counts.documentation})`} />
          <Tab label={`Bug Reports (${counts.bug_report})`} />
          <Tab label={`Code Clones (${counts.code_clone})`} />
          <Tab label={`UI Snapshots (${counts.ui_snapshot})`} />
        </Tabs>
      </Paper>

      {/* Artifact List */}
      <ArtifactList
        artifacts={paginatedArtifacts}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onManageTags={handleManageTags}
        onAssignStudies={handleAssignStudies}
        selectedArtifacts={selectedArtifacts}
        onSelectArtifact={handleSelectArtifact}
        hasFilters={searchQuery || tagFilter.length > 0 || studyFilter || dateFilter}
        onClearFilters={() => {
          setSearchQuery('');
          setTagFilter([]);
          setStudyFilter('');
          setDateFilter('');
        }}
      />

      {/* Pagination Controls */}
      {!loading && filteredArtifacts.length > 0 && (
        <Pagination
          totalItems={filteredArtifacts.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      )}

      {/* Upload Dialog */}
      <UploadForm
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Generate Artifact Dialog */}
      <GenerateArtifactDialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        onGenerateSuccess={handleUploadSuccess}
      />

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={bulkImportDialogOpen}
        onClose={() => setBulkImportDialogOpen(false)}
        onImportSuccess={handleBulkImportSuccess}
      />

      {/* Edit Dialog */}
      <EditForm
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        artifact={artifactToEdit}
        onEditSuccess={handleEditSuccess}
      />

      {/* Details Dialog */}
      <ArtifactDetails
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        artifactId={artifactToView?.id}
        canEdit={true} // TODO: Check user permissions
      />

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        selectedArtifacts={selectedArtifacts}
      />

      {/* Tag Manager Dialog */}
      <TagManager
        open={tagManagerOpen}
        onClose={() => setTagManagerOpen(false)}
        artifactId={artifactForTags?.id}
        currentTags={artifactForTags?.tags || []}
        onTagsUpdated={handleTagsUpdated}
      />

      {/* Study Assignment Dialog */}
      <StudyAssignment
        open={studyAssignmentOpen}
        onClose={() => setStudyAssignmentOpen(false)}
        artifactId={artifactForStudies?.id}
        currentStudies={artifactForStudies?.studies || []}
        onStudiesUpdated={handleStudiesUpdated}
      />

      {/* Bulk Actions Dialog */}
      <BulkActionsDialog
        open={bulkActionsOpen}
        onClose={() => setBulkActionsOpen(false)}
        selectedArtifacts={selectedArtifacts}
        onActionComplete={handleBulkActionsComplete}
      />

      {/* Create Tag Dialog */}
      <Dialog open={createTagDialogOpen} onClose={() => !creatingTag && setCreateTagDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalOffer />
            Create New Tag
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Tag Name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              required
              fullWidth
              disabled={creatingTag}
              placeholder="e.g., SOLID, Bug, UI"
            />
            <TextField
              label="Description (optional)"
              value={newTagDescription}
              onChange={(e) => setNewTagDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              disabled={creatingTag}
              placeholder="Brief description of when to use this tag..."
            />
            <Typography variant="caption" color="text.secondary">
              💡 <strong>Note:</strong> Your tag request will be submitted to administrators for approval.
              Once approved by an admin, the tag will become available for everyone to use.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTagDialogOpen(false)} disabled={creatingTag}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateTag}
            variant="contained"
            disabled={creatingTag || !newTagName.trim()}
          >
            {creatingTag ? 'Creating...' : 'Create Tag'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Collections Dialog */}
      <CollectionsDialog
        open={collectionsDialogOpen}
        onClose={() => setCollectionsDialogOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Artifact</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{artifactToDelete?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Artifacts;