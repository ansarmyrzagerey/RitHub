import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { Save, FolderOpen } from '@mui/icons-material';
import toast from 'react-hot-toast';
import ArtifactBrowser from './ArtifactBrowser';

const ArtifactSelectionPanel = ({ data, onChange, onNext, onBack, studyId }) => {
  const [selectedArtifacts, setSelectedArtifacts] = useState(data.artifacts || []);
  const [artifactSets, setArtifactSets] = useState([]);
  const [showSaveSetDialog, setShowSaveSetDialog] = useState(false);
  const [showLoadSetDialog, setShowLoadSetDialog] = useState(false);
  const [setName, setSetName] = useState('');
  const [setDescription, setSetDescription] = useState('');

  useEffect(() => {
    // Update parent component when selection changes
    onChange({ artifacts: selectedArtifacts });
  }, [selectedArtifacts]);

  useEffect(() => {
    // Load saved artifact sets
    loadArtifactSets();
  }, []);

  const loadArtifactSets = async () => {
    try {
      // TODO: Call API to load artifact sets
      // const sets = await studyService.getArtifactSets();
      // setArtifactSets(sets);
      setArtifactSets([]);
    } catch (error) {
      console.error('Failed to load artifact sets:', error);
    }
  };

  const handleArtifactSelect = (artifacts) => {
    setSelectedArtifacts(artifacts);
  };

  const handleSaveSet = async () => {
    if (!setName.trim()) {
      toast.error('Please enter a name for the artifact set');
      return;
    }

    if (selectedArtifacts.length < 2) {
      toast.error('Please select at least 2 artifacts to save as a set');
      return;
    }

    try {
      // TODO: Call API to save artifact set
      // await studyService.createArtifactSet({
      //   name: setName,
      //   description: setDescription,
      //   artifact_ids: selectedArtifacts.map(a => a.id),
      // });
      toast.success('Artifact set saved successfully');
      setShowSaveSetDialog(false);
      setSetName('');
      setSetDescription('');
      loadArtifactSets();
    } catch (error) {
      console.error('Failed to save artifact set:', error);
      toast.error('Failed to save artifact set');
    }
  };

  const handleLoadSet = (set) => {
    // TODO: Load artifacts from the set
    // setSelectedArtifacts(set.artifacts);
    setShowLoadSetDialog(false);
    toast.success('Artifact set loaded');
  };

  const isValid = selectedArtifacts.length >= 2 && selectedArtifacts.length <= 3;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
            Select Artifacts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose 2-3 artifacts for participants to evaluate
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FolderOpen />}
            onClick={() => setShowLoadSetDialog(true)}
            disabled={artifactSets.length === 0}
          >
            Load Set
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Save />}
            onClick={() => setShowSaveSetDialog(true)}
            disabled={selectedArtifacts.length < 2}
          >
            Save Set
          </Button>
        </Box>
      </Box>

      {/* Selection Status */}
      <Alert
        severity={isValid ? 'success' : 'info'}
        sx={{ mb: 3 }}
      >
        {selectedArtifacts.length === 0 && 'Please select 2-3 artifacts to compare'}
        {selectedArtifacts.length === 1 && 'Please select 1-2 more artifacts'}
        {selectedArtifacts.length >= 2 && selectedArtifacts.length <= 3 &&
          `${selectedArtifacts.length} artifacts selected - ready to proceed`}
        {selectedArtifacts.length > 3 && 'Too many artifacts selected - maximum is 3'}
      </Alert>

      {/* Selected Artifacts Display */}
      {selectedArtifacts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Selected Artifacts:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {selectedArtifacts.map((artifact) => (
              <Chip
                key={artifact.id}
                label={artifact.name}
                onDelete={() => {
                  setSelectedArtifacts(selectedArtifacts.filter(a => a.id !== artifact.id));
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Artifact Browser */}
      <ArtifactBrowser
        selectedArtifacts={selectedArtifacts}
        onSelectionChange={handleArtifactSelect}
        maxSelection={3}
        studyId={studyId}
      />

      {/* Save Artifact Set Dialog */}
      <Dialog open={showSaveSetDialog} onClose={() => setShowSaveSetDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Artifact Set</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Set Name"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Description (optional)"
              value={setDescription}
              onChange={(e) => setSetDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveSetDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveSet} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Load Artifact Set Dialog */}
      <Dialog open={showLoadSetDialog} onClose={() => setShowLoadSetDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Load Artifact Set</DialogTitle>
        <DialogContent>
          {artifactSets.length === 0 ? (
            <Typography color="text.secondary">No saved artifact sets</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {artifactSets.map((set) => (
                <Button
                  key={set.id}
                  variant="outlined"
                  onClick={() => handleLoadSet(set)}
                  sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  <Box>
                    <Typography variant="subtitle2">{set.name}</Typography>
                    {set.description && (
                      <Typography variant="caption" color="text.secondary">
                        {set.description}
                      </Typography>
                    )}
                  </Box>
                </Button>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLoadSetDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArtifactSelectionPanel;
