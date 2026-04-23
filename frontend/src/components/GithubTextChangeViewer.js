import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Divider
} from '@mui/material';
import { Code } from '@mui/icons-material';

// Myers diff algorithm implementation for better line matching
const computeDiff = (text1, text2) => {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  
  // Use dynamic programming to find the longest common subsequence
  const n = lines1.length;
  const m = lines2.length;
  
  // dp[i][j] = length of LCS of lines1[0..i-1] and lines2[0..j-1]
  const dp = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));
  
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Reconstruct the diff
  const diff = [];
  let i = n, j = m;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
      // Lines match
      diff.unshift({
        type: 'same',
        oldLine: i,
        newLine: j,
        oldContent: lines1[i - 1],
        newContent: lines2[j - 1]
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Line added
      diff.unshift({
        type: 'add',
        oldLine: null,
        newLine: j,
        oldContent: null,
        newContent: lines2[j - 1]
      });
      j--;
    } else {
      // Line removed
      diff.unshift({
        type: 'remove',
        oldLine: i,
        newLine: null,
        oldContent: lines1[i - 1],
        newContent: null
      });
      i--;
    }
  }
  
  // Post-process to identify modified lines (lines that are close together)
  const processedDiff = [];
  for (let idx = 0; idx < diff.length; idx++) {
    const current = diff[idx];
    const next = diff[idx + 1];
    
    if (current.type === 'remove' && next && next.type === 'add') {
      // Check if this is a modification (removal followed by addition)
      processedDiff.push({
        type: 'modify',
        oldLine: current.oldLine,
        newLine: next.newLine,
        oldContent: current.oldContent,
        newContent: next.newContent
      });
      idx++; // Skip the next item as we've processed it
    } else {
      processedDiff.push(current);
    }
  }
  
  return processedDiff;
};

const GithubTextChangeViewer = ({ artifacts, onClose }) => {
  const [selectedArtifacts, setSelectedArtifacts] = useState([0, 1]);
  const [diffResult, setDiffResult] = useState([]);
  const [oldLineNumbers, setOldLineNumbers] = useState([]);
  const [newLineNumbers, setNewLineNumbers] = useState([]);

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
      
      // Calculate line numbers for display
      let oldLineNum = 0;
      let newLineNum = 0;
      const oldLines = [];
      const newLines = [];
      
      diff.forEach(item => {
        if (item.type === 'same' || item.type === 'remove' || item.type === 'modify') {
          oldLineNum++;
          oldLines.push(oldLineNum);
        } else {
          oldLines.push(null);
        }
        
        if (item.type === 'same' || item.type === 'add' || item.type === 'modify') {
          newLineNum++;
          newLines.push(newLineNum);
        } else {
          newLines.push(null);
        }
      });
      
      setOldLineNumbers(oldLines);
      setNewLineNumbers(newLines);
    }
  }, [artifacts, selectedArtifacts]);

  const getRowStyle = (type) => {
    switch (type) {
      case 'add':
        return {
          bgcolor: 'rgba(46, 160, 67, 0.15)', // GitHub green
          '&:hover': { bgcolor: 'rgba(46, 160, 67, 0.25)' }
        };
      case 'remove':
        return {
          bgcolor: 'rgba(248, 81, 73, 0.15)', // GitHub red
          '&:hover': { bgcolor: 'rgba(248, 81, 73, 0.25)' }
        };
      case 'modify':
        return {
          bgcolor: 'rgba(255, 193, 7, 0.15)', // GitHub yellow/orange
          '&:hover': { bgcolor: 'rgba(255, 193, 7, 0.25)' }
        };
      default:
        return {
          bgcolor: 'transparent',
          '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.02)' }
        };
    }
  };

  const getLineNumberStyle = (type) => {
    switch (type) {
      case 'add':
        return {
          bgcolor: 'rgba(46, 160, 67, 0.2)',
          color: 'success.dark',
          fontWeight: 600
        };
      case 'remove':
        return {
          bgcolor: 'rgba(248, 81, 73, 0.2)',
          color: 'error.dark',
          fontWeight: 600
        };
      case 'modify':
        return {
          bgcolor: 'rgba(255, 193, 7, 0.2)',
          color: 'warning.dark',
          fontWeight: 600
        };
      default:
        return {
          bgcolor: 'grey.100',
          color: 'text.secondary'
        };
    }
  };

  const getContentStyle = (type) => {
    switch (type) {
      case 'add':
        return {
          color: 'success.dark',
          fontWeight: 500
        };
      case 'remove':
        return {
          color: 'error.dark',
          textDecoration: 'line-through',
          opacity: 0.8
        };
      case 'modify':
        return {
          color: 'warning.dark',
          fontWeight: 500
        };
      default:
        return {
          color: 'text.primary'
        };
    }
  };

  const stats = useMemo(() => {
    const added = diffResult.filter(l => l.type === 'add').length;
    const removed = diffResult.filter(l => l.type === 'remove').length;
    const modified = diffResult.filter(l => l.type === 'modify').length;
    const same = diffResult.filter(l => l.type === 'same').length;
    return { added, removed, modified, same };
  }, [diffResult]);

  if (artifacts.length < 2) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          At least 2 artifacts are required for text comparison.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Artifact Selection */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Code />
          Select Artifacts to Compare
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
          {artifacts.map((artifact, index) => (
            <Chip
              key={artifact.id}
              label={`${artifact.name || `Artifact ${index + 1}`}`}
              onClick={() => {
                if (selectedArtifacts.includes(index)) {
                  setSelectedArtifacts(selectedArtifacts.filter(i => i !== index));
                } else if (selectedArtifacts.length < 2) {
                  setSelectedArtifacts([...selectedArtifacts, index]);
                } else {
                  // Replace the first selected artifact
                  setSelectedArtifacts([index, selectedArtifacts[1]]);
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

      {/* GitHub-style Diff Display */}
      {selectedArtifacts.length === 2 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">
              Comparing: {artifacts[selectedArtifacts[0]].name || `Artifact ${selectedArtifacts[0] + 1}`}
              {' ↔ '}
              {artifacts[selectedArtifacts[1]].name || `Artifact ${selectedArtifacts[1] + 1}`}
            </Typography>
            
            {/* Statistics */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {stats.added > 0 && (
                <Chip
                  label={`+${stats.added}`}
                  color="success"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {stats.removed > 0 && (
                <Chip
                  label={`-${stats.removed}`}
                  color="error"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {stats.modified > 0 && (
                <Chip
                  label={`~${stats.modified}`}
                  color="warning"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {stats.same > 0 && (
                <Chip
                  label={`${stats.same} unchanged`}
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
          </Box>

          <Paper
            variant="outlined"
            sx={{
              overflow: 'auto',
              maxHeight: '600px',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              lineHeight: 1.5
            }}
          >
            <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <TableBody>
                {diffResult.map((item, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      ...getRowStyle(item.type),
                      '& td': {
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        py: 0.5,
                        px: 1,
                        verticalAlign: 'top'
                      }
                    }}
                  >
                    {/* Old file line number */}
                    <TableCell
                      sx={{
                        ...getLineNumberStyle(item.type),
                        width: '50px',
                        textAlign: 'right',
                        userSelect: 'none',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        borderRight: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      {oldLineNumbers[index] || ''}
                    </TableCell>
                    
                    {/* Old file content */}
                    <TableCell
                      sx={{
                        ...getContentStyle(item.type),
                        width: '50%',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        fontFamily: 'monospace'
                      }}
                    >
                      {item.oldContent !== null ? (
                        <span>{item.oldContent || ' '}</span>
                      ) : (
                        <span style={{ opacity: 0.3 }}>{'\u00A0'}</span>
                      )}
                    </TableCell>
                    
                    {/* New file line number */}
                    <TableCell
                      sx={{
                        ...getLineNumberStyle(item.type),
                        width: '50px',
                        textAlign: 'right',
                        userSelect: 'none',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        borderRight: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      {newLineNumbers[index] || ''}
                    </TableCell>
                    
                    {/* New file content */}
                    <TableCell
                      sx={{
                        ...getContentStyle(item.type),
                        width: '50%',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'monospace'
                      }}
                    >
                      {item.newContent !== null ? (
                        <span>{item.newContent || ' '}</span>
                      ) : (
                        <span style={{ opacity: 0.3 }}>{'\u00A0'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {/* Legend */}
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Legend:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box
                sx={{
                  width: '20px',
                  height: '20px',
                  bgcolor: 'rgba(46, 160, 67, 0.15)',
                  border: '1px solid',
                  borderColor: 'success.main',
                  borderRadius: '2px'
                }}
              />
              <Typography variant="caption">Added</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box
                sx={{
                  width: '20px',
                  height: '20px',
                  bgcolor: 'rgba(248, 81, 73, 0.15)',
                  border: '1px solid',
                  borderColor: 'error.main',
                  borderRadius: '2px'
                }}
              />
              <Typography variant="caption">Removed</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box
                sx={{
                  width: '20px',
                  height: '20px',
                  bgcolor: 'rgba(255, 193, 7, 0.15)',
                  border: '1px solid',
                  borderColor: 'warning.main',
                  borderRadius: '2px'
                }}
              />
              <Typography variant="caption">Modified</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default GithubTextChangeViewer;


