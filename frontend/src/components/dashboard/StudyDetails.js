import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import ParticipantService from '../../services/participantService';
import TasksList from './TasksList';

const StudyDetails = ({ studyId }) => {
  const [study, setStudy] = useState(null);

  const load = async () => {
    try {
      const s = await ParticipantService.getStudyDetails(studyId);
      setStudy(s);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (studyId) load(); }, [studyId]);

  if (!study) return <Typography>Loading...</Typography>;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">{study.title}</Typography>
        <Typography variant="body2">Status: {study.status}</Typography>
      </Box>
      <Typography variant="body2" sx={{ mb: 1 }}>{study.description}</Typography>
      <Typography variant="caption">Start: {study.start_date || 'N/A'} • End: {study.end_date || 'N/A'}</Typography>

      <Divider sx={{ my: 2 }} />

      <Box display="flex" gap={2} mb={2}>
        <Typography>Total tasks: {study.total_tasks}</Typography>
        <Typography>Completed: {study.completed_tasks}</Typography>
        <Typography>Pending: {study.pending_tasks}</Typography>
        <Typography>Time spent: {Math.floor((study.time_spent_seconds||0)/60)} min</Typography>
      </Box>

      <TasksList studyId={studyId} />
    </Box>
  );
};

export default StudyDetails;
