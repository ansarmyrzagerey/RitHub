import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemButton,
    Paper,
    Chip,
    IconButton,
    CircularProgress,
    Divider,
    Radio,
    RadioGroup,
    FormControlLabel,
    FormControl,
    Tooltip
} from '@mui/material';
import { Close, Folder, Description, ArrowBack, Delete, SelectAll, ClearAll, Assignment, Download } from '@mui/icons-material';
import Pagination from '../common/Pagination';
import ArtifactDetails from './ArtifactDetails';
import ArtifactList from './ArtifactList';
import EditForm from './EditForm';
import TagManager from './TagManager';
import StudyAssignment from './StudyAssignment';
import BulkActionsDialog from './BulkActionsDialog';
import ExportDialog from './ExportDialog';
import toast from 'react-hot-toast';

const CollectionsDialog = ({ open, onClose, onSelectArtifacts }) => {
    const [collections, setCollections] = useState([]);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [collectionArtifacts, setCollectionArtifacts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [totalArtifacts, setTotalArtifacts] = useState(0);
    const [viewingArtifactId, setViewingArtifactId] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [collectionToDelete, setCollectionToDelete] = useState(null);
    const [selectedArtifacts, setSelectedArtifacts] = useState([]);
    const [artifactToEdit, setArtifactToEdit] = useState(null);
    const [artifactToDelete, setArtifactToDelete] = useState(null);
    const [artifactForTags, setArtifactForTags] = useState(null);
    const [artifactForStudies, setArtifactForStudies] = useState(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [artifactDeleteDialogOpen, setArtifactDeleteDialogOpen] = useState(false);
    const [tagManagerOpen, setTagManagerOpen] = useState(false);
    const [studyAssignmentOpen, setStudyAssignmentOpen] = useState(false);
    const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [deleteOption, setDeleteOption] = useState('keep'); // 'keep' or 'delete'

    useEffect(() => {
        if (open) {
            loadCollections();
        }
    }, [open]);

    const loadCollections = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/collections', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (result.success) {
                setCollections(result.collections);
            } else {
                toast.error('Failed to load collections');
            }
        } catch (error) {
            console.error('Error loading collections:', error);
            toast.error('Failed to load collections');
        } finally {
            setLoading(false);
        }
    };

    const loadCollectionArtifacts = async (collectionId, page = 1) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `/api/collections/${collectionId}/artifacts?page=${page}&limit=${itemsPerPage}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const result = await response.json();
            if (result.success) {
                setCollectionArtifacts(result.artifacts);
                setTotalArtifacts(result.pagination.total);
            } else {
                toast.error('Failed to load artifacts');
            }
        } catch (error) {
            console.error('Error loading collection artifacts:', error);
            toast.error('Failed to load artifacts');
        } finally {
            setLoading(false);
        }
    };

    const handleCollectionClick = (collection) => {
        setSelectedCollection(collection);
        setCurrentPage(1);
        loadCollectionArtifacts(collection.id, 1);
    };

    const handleBackToCollections = () => {
        setSelectedCollection(null);
        setCollectionArtifacts([]);
        setCurrentPage(1);
        setSelectedArtifacts([]); // Clear selection when going back
    };

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        loadCollectionArtifacts(selectedCollection.id, newPage);
    };

    const handleItemsPerPageChange = (newItemsPerPage) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);
        loadCollectionArtifacts(selectedCollection.id, 1);
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const handleDeleteClick = (collection, event) => {
        event.stopPropagation(); // Prevent collection from being opened
        setCollectionToDelete(collection);
        setDeleteOption('keep');
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `/api/collections/${collectionToDelete.id}?deleteArtifacts=${deleteOption === 'delete'}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const result = await response.json();
            if (result.success) {
                toast.success(result.message);
                setDeleteDialogOpen(false);
                setCollectionToDelete(null);

                // If we were viewing this collection, go back to list
                if (selectedCollection?.id === collectionToDelete.id) {
                    handleBackToCollections();
                }

                // Reload collections list
                loadCollections();
            } else {
                toast.error(result.message || 'Failed to delete collection');
            }
        } catch (error) {
            console.error('Error deleting collection:', error);
            toast.error('Failed to delete collection');
        }
    };

    // Artifact operation handlers
    const handleEdit = (artifact) => {
        setArtifactToEdit(artifact);
        setEditDialogOpen(true);
    };

    const handleDeleteArtifact = (artifact) => {
        setArtifactToDelete(artifact);
        setArtifactDeleteDialogOpen(true);
    };

    const handleManageTags = (artifact) => {
        setArtifactForTags(artifact);
        setTagManagerOpen(true);
    };

    const handleAssignStudies = (artifact) => {
        setArtifactForStudies(artifact);
        setStudyAssignmentOpen(true);
    };

    const handleSelectArtifact = (artifact, selected) => {
        if (selected) {
            setSelectedArtifacts(prev => [...prev, artifact]);
        } else {
            setSelectedArtifacts(prev => prev.filter(a => a.id !== artifact.id));
        }
    };

    const handleEditSuccess = (updatedArtifact) => {
        setCollectionArtifacts(prev => prev.map(a =>
            a.id === updatedArtifact.id ? updatedArtifact : a
        ));
        setEditDialogOpen(false);
    };

    const handleTagsUpdated = () => {
        // Reload collection artifacts to get updated tags
        loadCollectionArtifacts(selectedCollection.id, currentPage);
    };

    const handleStudiesUpdated = () => {
        // Reload collection artifacts to get updated studies
        loadCollectionArtifacts(selectedCollection.id, currentPage);
    };

    const confirmDeleteArtifact = async () => {
        if (!artifactToDelete) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/artifacts/${artifactToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (result.success) {
                toast.success('Artifact deleted successfully');
                setArtifactDeleteDialogOpen(false);
                setArtifactToDelete(null);
                // Reload collection artifacts
                loadCollectionArtifacts(selectedCollection.id, currentPage);
                // Also reload collections to update file count
                loadCollections();
            } else {
                toast.error(result.message || 'Failed to delete artifact');
            }
        } catch (error) {
            console.error('Error deleting artifact:', error);
            toast.error('Failed to delete artifact');
        }
    };

    const handleSelectAll = () => {
        setSelectedArtifacts([...collectionArtifacts]);
    };

    const handleClearSelection = () => {
        setSelectedArtifacts([]);
    };

    const handleBulkActionsComplete = () => {
        // Reload artifacts after bulk actions
        loadCollectionArtifacts(selectedCollection.id, currentPage);
        setSelectedArtifacts([]);
        // Also reload collections to update counts if needed
        loadCollections();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {selectedCollection && (
                            <IconButton onClick={handleBackToCollections} size="small">
                                <ArrowBack />
                            </IconButton>
                        )}
                        <Folder color="primary" />
                        <Typography variant="h6">
                            {selectedCollection ? selectedCollection.name : 'Artifact Collections'}
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose}>
                        <Close />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : selectedCollection ? (
                    /* Collection Artifacts View */
                    <Box>
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.50' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {selectedCollection.description}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                        <Chip
                                            label={`${selectedCollection.file_count} files`}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={formatFileSize(selectedCollection.total_size)}
                                            size="small"
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={`Imported: ${formatDate(selectedCollection.created_at)}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Box>
                                </Box>
                                <IconButton
                                    color="error"
                                    onClick={(e) => handleDeleteClick(selectedCollection, e)}
                                    size="small"
                                >
                                    <Delete />
                                </IconButton>
                            </Box>
                        </Paper>

                        {/* Bulk Action Buttons */}
                        {selectedArtifacts.length > 0 && (
                            <Box sx={{ mb: 2, display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<Assignment />}
                                        onClick={() => setBulkActionsOpen(true)}
                                    >
                                        Bulk Actions ({selectedArtifacts.length})
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<Download />}
                                        onClick={() => setExportDialogOpen(true)}
                                    >
                                        Export ({selectedArtifacts.length})
                                    </Button>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    {selectedArtifacts.length} of {collectionArtifacts.length} selected
                                </Typography>
                            </Box>
                        )}

                        {/* Selection Controls */}
                        {collectionArtifacts.length > 0 && (
                            <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                                <Tooltip title="Select all artifacts on this page">
                                    <Button
                                        size="small"
                                        startIcon={<SelectAll />}
                                        onClick={handleSelectAll}
                                        disabled={selectedArtifacts.length === collectionArtifacts.length}
                                    >
                                        Select All
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Clear all selections">
                                    <Button
                                        size="small"
                                        startIcon={<ClearAll />}
                                        onClick={handleClearSelection}
                                        disabled={selectedArtifacts.length === 0}
                                    >
                                        Clear Selection
                                    </Button>
                                </Tooltip>
                            </Box>
                        )}

                        {collectionArtifacts.length === 0 ? (
                            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                                No artifacts in this collection
                            </Typography>
                        ) : (
                            <>
                                <ArtifactList
                                    artifacts={collectionArtifacts}
                                    loading={false}
                                    onEdit={handleEdit}
                                    onDelete={handleDeleteArtifact}
                                    onView={(artifact) => setViewingArtifactId(artifact.id)}
                                    onManageTags={handleManageTags}
                                    onAssignStudies={handleAssignStudies}
                                    selectedArtifacts={selectedArtifacts}
                                    onSelectArtifact={handleSelectArtifact}
                                />

                                {/* Pagination */}
                                {totalArtifacts > itemsPerPage && (
                                    <Box sx={{ mt: 2 }}>
                                        <Pagination
                                            totalItems={totalArtifacts}
                                            itemsPerPage={itemsPerPage}
                                            currentPage={currentPage}
                                            onPageChange={handlePageChange}
                                            onItemsPerPageChange={handleItemsPerPageChange}
                                        />
                                    </Box>
                                )}
                            </>
                        )}
                    </Box>
                ) : (
                    /* Collections List View */
                    <Box>
                        {collections.length === 0 ? (
                            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                                No collections yet. Collections are created when you bulk import files.
                            </Typography>
                        ) : (
                            <List>
                                {collections.map((collection, index) => (
                                    <React.Fragment key={collection.id}>
                                        {index > 0 && <Divider />}
                                        <ListItemButton onClick={() => handleCollectionClick(collection)}>
                                            <Folder sx={{ mr: 2, color: 'primary.main' }} />
                                            <ListItemText
                                                primary={collection.name}
                                                secondary={
                                                    <Box>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {collection.description}
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                                            <Chip
                                                                label={`${collection.file_count} files`}
                                                                size="small"
                                                                color="primary"
                                                                variant="outlined"
                                                            />
                                                            <Chip
                                                                label={formatFileSize(collection.total_size)}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                            <Chip
                                                                label={formatDate(collection.created_at)}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        </Box>
                                                    </Box>
                                                }
                                            />
                                            <IconButton
                                                edge="end"
                                                color="error"
                                                onClick={(e) => handleDeleteClick(collection, e)}
                                                sx={{ ml: 1 }}
                                            >
                                                <Delete />
                                            </IconButton>
                                        </ListItemButton>
                                    </React.Fragment>
                                ))}
                            </List>
                        )}
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>

            {/* Artifact Details Dialog */}
            <ArtifactDetails
                open={!!viewingArtifactId}
                onClose={() => setViewingArtifactId(null)}
                artifactId={viewingArtifactId}
                canEdit={true}
            />

            {/* Edit Artifact Dialog */}
            <EditForm
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                artifact={artifactToEdit}
                onEditSuccess={handleEditSuccess}
            />

            {/* Tag Manager Dialog */}
            <TagManager
                open={tagManagerOpen}
                onClose={() => setTagManagerOpen(false)}
                artifactId={artifactForTags?.id}
                currentTags={artifactForTags?.metadata?.tags || []}
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

            {/* Delete Artifact Confirmation Dialog */}
            <Dialog open={artifactDeleteDialogOpen} onClose={() => setArtifactDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Delete Artifact</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" gutterBottom>
                        Are you sure you want to delete <strong>{artifactToDelete?.name}</strong>? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setArtifactDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={confirmDeleteArtifact} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Delete Collection</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" gutterBottom>
                        Are you sure you want to delete <strong>{collectionToDelete?.name}</strong>?
                    </Typography>

                    <FormControl component="fieldset" sx={{ mt: 2 }}>
                        <RadioGroup value={deleteOption} onChange={(e) => setDeleteOption(e.target.value)}>
                            <FormControlLabel
                                value="keep"
                                control={<Radio />}
                                label={
                                    <Box>
                                        <Typography variant="body2"><strong>Delete collection only</strong></Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Artifacts will be preserved and remain accessible
                                        </Typography>
                                    </Box>
                                }
                            />
                            <FormControlLabel
                                value="delete"
                                control={<Radio />}
                                label={
                                    <Box>
                                        <Typography variant="body2" color="error"><strong>Delete collection and all artifacts</strong></Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            All {collectionToDelete?.file_count || 0} artifacts will be permanently deleted
                                        </Typography>
                                    </Box>
                                }
                            />
                        </RadioGroup>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Bulk Actions Dialog */}
            <BulkActionsDialog
                open={bulkActionsOpen}
                onClose={() => setBulkActionsOpen(false)}
                selectedArtifacts={selectedArtifacts}
                onActionComplete={handleBulkActionsComplete}
            />

            {/* Export Dialog */}
            <ExportDialog
                open={exportDialogOpen}
                onClose={() => setExportDialogOpen(false)}
                selectedArtifacts={selectedArtifacts}
            />
        </Dialog>
    );
};

export default CollectionsDialog;
