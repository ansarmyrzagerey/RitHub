import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Slider,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import {
  SwapHoriz,
  Opacity,
  Layers,
  Visibility,
  VisibilityOff,
  TouchApp
} from '@mui/icons-material';

const ArtifactOverlayComparison = ({ artifacts, onClose }) => {
  // Initialize with first two artifacts, or handle fewer artifacts
  const getInitialSelection = () => {
    if (artifacts.length >= 2) {
      return [0, 1];
    } else if (artifacts.length === 1) {
      return [0, 0]; // Same artifact for both if only one available
    } else {
      return [0, 0]; // Fallback
    }
  };

  const [selectedArtifacts, setSelectedArtifacts] = useState(getInitialSelection());
  const [opacity, setOpacity] = useState(50);
  const [topLayer, setTopLayer] = useState(1); // Index in selectedArtifacts array (0=bottom, 1=top)
  const [showLabels, setShowLabels] = useState(true);
  const [scrollableLayer, setScrollableLayer] = useState('top'); // 'bottom' or 'top'

  const getArtifactContent = (artifact) => {
    if (!artifact) {
      return {
        type: 'text',
        content: 'Artifact not available'
      };
    }

    if (artifact.type?.toLowerCase().includes('image')) {
      return {
        type: 'image',
        content: artifact.content,
        alt: artifact.name
      };
    }

    return {
      type: 'text',
      content: typeof artifact.content === 'string'
        ? artifact.content
        : JSON.stringify(artifact.content, null, 2)
    };
  };

  const swapLayers = () => {
    setTopLayer(topLayer === 0 ? 1 : 0);
  };

  if (artifacts.length < 2) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          At least 2 artifacts are required for overlay comparison.
        </Typography>
      </Box>
    );
  }

  const bottomArtifact = artifacts[selectedArtifacts[topLayer === 0 ? 1 : 0]];
  const topArtifact = artifacts[selectedArtifacts[topLayer]];

  // Ensure artifacts exist before proceeding
  if (!bottomArtifact || !topArtifact) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="error">
          Selected artifacts are not available. Please check your selection.
        </Typography>
      </Box>
    );
  }

  const bottomContent = getArtifactContent(bottomArtifact);
  const topContent = getArtifactContent(topArtifact);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Controls */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Overlay Comparison Controls
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          {/* Artifact Selection */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Bottom Layer</InputLabel>
            <Select
              value={selectedArtifacts[topLayer === 0 ? 1 : 0]}
              label="Bottom Layer"
              onChange={(e) => {
                const newBottomIndex = parseInt(e.target.value);
                if (newBottomIndex >= 0 && newBottomIndex < artifacts.length) {
                  const currentTopIndex = selectedArtifacts[topLayer];
                  const newSelection = topLayer === 0
                    ? [currentTopIndex, newBottomIndex]  // topLayer is 0, so selectedArtifacts[0] is top
                    : [newBottomIndex, currentTopIndex]; // topLayer is 1, so selectedArtifacts[1] is top
                  setSelectedArtifacts(newSelection);
                }
              }}
            >
              {artifacts.map((artifact, index) => (
                <MenuItem key={artifact.id} value={index}>
                  {artifact.name || `Artifact ${index + 1}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Top Layer</InputLabel>
            <Select
              value={selectedArtifacts[topLayer]}
              label="Top Layer"
              onChange={(e) => {
                const newTopIndex = parseInt(e.target.value);
                if (newTopIndex >= 0 && newTopIndex < artifacts.length) {
                  const currentBottomIndex = selectedArtifacts[topLayer === 0 ? 1 : 0];
                  const newSelection = topLayer === 0
                    ? [newTopIndex, currentBottomIndex]  // topLayer is 0, so selectedArtifacts[0] is top
                    : [currentBottomIndex, newTopIndex]; // topLayer is 1, so selectedArtifacts[1] is top
                  setSelectedArtifacts(newSelection);
                }
              }}
            >
              {artifacts.map((artifact, index) => (
                <MenuItem key={artifact.id} value={index}>
                  {artifact.name || `Artifact ${index + 1}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title="Swap layers">
            <IconButton onClick={swapLayers} size="small">
              <SwapHoriz />
            </IconButton>
          </Tooltip>

          <Tooltip title="Hide labels">
            <IconButton
              onClick={() => setShowLabels(!showLabels)}
              size="small"
              color={showLabels ? 'primary' : 'default'}
            >
              {showLabels ? <Visibility /> : <VisibilityOff />}
            </IconButton>
          </Tooltip>

          <Tooltip title={`Scroll ${scrollableLayer === 'bottom' ? 'top' : 'bottom'} layer`}>
            <IconButton
              onClick={() => setScrollableLayer(scrollableLayer === 'bottom' ? 'top' : 'bottom')}
              size="small"
              color="primary"
            >
              <TouchApp />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Opacity Control */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Opacity />
          <Typography variant="body2" sx={{ minWidth: '80px' }}>
            Top Layer Opacity: {opacity}%
          </Typography>
          <Slider
            value={opacity}
            onChange={(e, newValue) => setOpacity(newValue)}
            aria-labelledby="opacity-slider"
            min={0}
            max={100}
            sx={{ flex: 1, maxWidth: '200px' }}
          />
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Overlay Display */}
      <Paper
        variant="outlined"
        sx={{
          position: 'relative',
          height: '500px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100'
        }}
      >
        {/* Bottom Layer */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1
          }}
        >
          {bottomContent.type === 'image' ? (
            <img
              src={bottomContent.content}
              alt={bottomContent.alt}
              style={{
                maxWidth: '90%',
                maxHeight: '90%',
                objectFit: 'contain'
              }}
            />
          ) : (
            <Box
              sx={{
                p: 2,
                bgcolor: 'white',
                borderRadius: 1,
                maxWidth: '90%',
                maxHeight: '90%',
                overflow: scrollableLayer === 'bottom' ? 'auto' : 'hidden',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}
            >
              {bottomContent.content}
            </Box>
          )}
        </Box>

        {/* Top Layer */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            opacity: opacity / 100,
            pointerEvents: scrollableLayer === 'top' ? 'auto' : 'none'
          }}
        >
          {topContent.type === 'image' ? (
            <img
              src={topContent.content}
              alt={topContent.alt}
              style={{
                maxWidth: '90%',
                maxHeight: '90%',
                objectFit: 'contain'
              }}
            />
          ) : (
            <Box
              sx={{
                p: 2,
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 1,
                maxWidth: '90%',
                maxHeight: '90%',
                overflow: scrollableLayer === 'top' ? 'auto' : 'hidden',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}
            >
              {topContent.content}
            </Box>
          )}
        </Box>

        {/* Labels */}
        {showLabels && (
          <>
            <Box
              sx={{
                position: 'absolute',
                top: 10,
                left: 10,
                bgcolor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                px: 2,
                py: 1,
                borderRadius: 1,
                fontSize: '0.75rem',
                zIndex: 3
              }}
            >
              Bottom: {bottomArtifact.name || `Artifact ${selectedArtifacts[topLayer === 0 ? 1 : 0] + 1}`} {scrollableLayer === 'bottom' && '(Scrollable)'}
            </Box>
            <Box
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                color: 'black',
                px: 2,
                py: 1,
                borderRadius: 1,
                fontSize: '0.75rem',
                zIndex: 3
              }}
            >
              Top: {topArtifact.name || `Artifact ${selectedArtifacts[topLayer] + 1}`} ({opacity}%) {scrollableLayer === 'top' && '(Scrollable)'}
            </Box>
          </>
        )}
      </Paper>

      {/* Legend */}
      <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 16, height: 16, bgcolor: 'grey.300', borderRadius: 1 }} />
          <Typography variant="body2">Bottom Layer (100% opacity)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 16, height: 16, bgcolor: 'rgba(255, 255, 255, 0.5)', border: 1, borderColor: 'grey.400', borderRadius: 1 }} />
          <Typography variant="body2">Top Layer ({opacity}% opacity)</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ArtifactOverlayComparison;
