import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Search,
  Code
} from '@mui/icons-material';
import researcherService from '../../services/researcherService';

export default function ArtifactRankings() {
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('avgRating');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    let mounted = true;
    researcherService.listArtifacts()
      .then(data => { 
        if (mounted) setArtifacts(data || []); 
      })
      .catch(() => { 
        if (mounted) setArtifacts([]); 
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  // Filter artifacts
  const filteredArtifacts = artifacts.filter(a => {
    const matchesSearch = !searchTerm || 
      a.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || a.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Sort by selected metric
  const sorted = [...filteredArtifacts].sort((a, b) => {
    const aVal = a[metric] || 0;
    const bVal = b[metric] || 0;
    return bVal - aVal;
  });

  // Get unique types for filter
  const types = [...new Set(artifacts.map(a => a.type).filter(Boolean))];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Artifact Statistics
        </Typography>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search artifacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            label="Type"
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <MenuItem value="all">All Types</MenuItem>
            {types.map(type => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={metric}
            label="Sort By"
            onChange={(e) => setMetric(e.target.value)}
          >
            <MenuItem value="avgRating">Average Rating</MenuItem>
            <MenuItem value="medianRating">Median Rating</MenuItem>
            <MenuItem value="usage_count">Usage Count</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : sorted.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="body1" color="text.secondary">
            No artifacts found.
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell align="right"><strong>Usage Count</strong></TableCell>
                <TableCell align="right"><strong>Avg Rating</strong></TableCell>
                <TableCell align="right"><strong>Median Rating</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(a => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Code fontSize="small" color="action" />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {a.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={a.type || 'N/A'} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {a.usage_count || 0}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {a.avgRating ? a.avgRating.toFixed(2) : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {a.medianRating ? a.medianRating.toFixed(2) : 'N/A'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
