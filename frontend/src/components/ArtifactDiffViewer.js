import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Add,
  Remove,
  Edit,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';

// Simple diff utility functions
const computeDiff = (text1, text2) => {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const diff = [];

  // Simple line-by-line diff (can be enhanced with more sophisticated algorithms)
  const maxLines = Math.max(lines1.length, lines2.length);

  for (let i = 0; i < maxLines; i++) {
    const line1 = lines1[i] || '';
    const line2 = lines2[i] || '';

    if (line1 === line2) {
      if (line1) diff.push({ type: 'same', content: line1 });
    } else {
      if (line1) diff.push({ type: 'remove', content: line1 });
      if (line2) diff.push({ type: 'add', content: line2 });
    }
  }

  return diff;
};

const ArtifactDiffViewer = ({ artifacts, onClose }) => {
  const [selectedArtifacts, setSelectedArtifacts] = useState([0, 1]);
  const [diffResult, setDiffResult] = useState([]);
  const [expandedLines, setExpandedLines] = useState(new Set());

  useEffect(() => {
    if (artifacts.length >= 2 && selectedArtifacts.length === 2) {
      const artifact1 = artifacts[selectedArtifacts[0]];
      const artifact2 = artifacts[selectedArtifacts[1]];

      const content1 = typeof artifact1.content === 'string'
        ? artifact1.content
        : JSON.stringify(artifact1.content, null, 2);

      const content2 = typeof artifact2.content === 'string'
        ? artifact2.content
        : JSON.stringify(artifact2.content, null, 2);

      const diff = computeDiff(content1, content2);
      setDiffResult(diff);
    }
  }, [artifacts, selectedArtifacts]);

  const toggleLineExpansion = (index) => {
    const newExpanded = new Set(expandedLines);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLines(newExpanded);
  };

  const getDiffLineStyle = (type) => {
    switch (type) {
      case 'add':
        return {
          bgcolor: 'success.light',
          borderLeft: 4,
          borderColor: 'success.main',
          color: 'success.contrastText'
        };
      case 'remove':
        return {
          bgcolor: 'error.light',
          borderLeft: 4,
          borderColor: 'error.main',
          color: 'error.contrastText'
        };
      default:
        return {
          bgcolor: 'grey.50',
          color: 'text.primary'
        };
    }
  };

  const getDiffIcon = (type) => {
    switch (type) {
      case 'add':
        return <Add sx={{ fontSize: '1rem', mr: 1 }} />;
      case 'remove':
        return <Remove sx={{ fontSize: '1rem', mr: 1 }} />;
      case 'edit':
        return <Edit sx={{ fontSize: '1rem', mr: 1 }} />;
      default:
        return null;
    }
  };

  if (artifacts.length < 2) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          At least 2 artifacts are required for diff comparison.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Artifact Selection */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Select Artifacts to Compare
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {artifacts.map((artifact, index) => (
            <Chip
              key={artifact.id}
              label={`${artifact.name || `Artifact ${index + 1}`}`}
              onClick={() => {
                if (selectedArtifacts.includes(index)) {
                  setSelectedArtifacts(selectedArtifacts.filter(i => i !== index));
                } else if (selectedArtifacts.length < 2) {
                  setSelectedArtifacts([...selectedArtifacts, index]);
                }
              }}
              color={selectedArtifacts.includes(index) ? 'primary' : 'default'}
              variant={selectedArtifacts.includes(index) ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Diff Display */}
      {selectedArtifacts.length === 2 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Comparing: {artifacts[selectedArtifacts[0]].name || `Artifact ${selectedArtifacts[0] + 1}`}
              {' ↔ '}
              {artifacts[selectedArtifacts[1]].name || `Artifact ${selectedArtifacts[1] + 1}`}
            </Typography>
          </Box>

          <Paper
            variant="outlined"
            sx={{
              maxHeight: '500px',
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }}
          >
            {diffResult.map((line, index) => (
              <Box
                key={index}
                sx={{
                  ...getDiffLineStyle(line.type),
                  p: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: line.content.length > 100 ? 'pointer' : 'default',
                  '&:hover': {
                    opacity: 0.8
                  }
                }}
                onClick={() => line.content.length > 100 && toggleLineExpansion(index)}
              >
                {getDiffIcon(line.type)}
                <Box sx={{ flex: 1, mr: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      whiteSpace: expandedLines.has(index) ? 'pre-wrap' : 'nowrap',
                      overflow: expandedLines.has(index) ? 'visible' : 'hidden',
                      textOverflow: expandedLines.has(index) ? 'clip' : 'ellipsis',
                      maxWidth: expandedLines.has(index) ? 'none' : '500px'
                    }}
                  >
                    {line.content}
                  </Typography>
                </Box>
                {line.content.length > 100 && (
                  <IconButton size="small">
                    {expandedLines.has(index) ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                )}
              </Box>
            ))}
          </Paper>

          {/* Summary */}
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Chip
              label={`Added: ${diffResult.filter(l => l.type === 'add').length} lines`}
              color="success"
              size="small"
            />
            <Chip
              label={`Removed: ${diffResult.filter(l => l.type === 'remove').length} lines`}
              color="error"
              size="small"
            />
            <Chip
              label={`Same: ${diffResult.filter(l => l.type === 'same').length} lines`}
              color="default"
              size="small"
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ArtifactDiffViewer;

