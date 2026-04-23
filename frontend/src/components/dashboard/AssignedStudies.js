import React, { useState } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, Chip } from '@mui/material';

const AssignedStudies = ({ studies = [], onSelect, onRefresh }) => {
  const [query, setQuery] = useState('');

  const filtered = studies.filter(s => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (s.title || '').toLowerCase().includes(q) || (s.status || '').toLowerCase().includes(q);
  });

  return (
    <Box>
      <Box display="flex" gap={1} mb={2}>
        <TextField label="Search studies" size="small" fullWidth value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button variant="contained" onClick={onRefresh}>Refresh</Button>
      </Box>

      <List>
        {filtered.map(s => (
          <ListItem key={s.id} button onClick={() => onSelect(s)}>
            <ListItemText primary={s.title} secondary={s.description} />
            <Chip label={s.status} color={s.status === 'ongoing' ? 'success' : s.status === 'past' ? 'default' : 'primary'} />
          </ListItem>
        ))}
        {filtered.length === 0 && <Typography variant="body2">No studies found</Typography>}
      </List>
    </Box>
  );
};

export default AssignedStudies;
