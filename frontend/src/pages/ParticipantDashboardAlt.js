import React, { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import ParticipantService from '../services/participantService';
import NotificationsCenter from '../components/dashboard/NotificationsCenter';
import AssignedStudies from '../components/dashboard/AssignedStudies';
import StudyDetails from '../components/dashboard/StudyDetails';

const ParticipantDashboardAlt = () => {
  const [notifications, setNotifications] = useState([]);
  const [studies, setStudies] = useState([]);
  const [selectedStudy, setSelectedStudy] = useState(null);

  const loadNotifications = async () => {
    try {
      const n = await ParticipantService.getNotifications();
      setNotifications(n);
    } catch (e) { console.error(e); }
  };

  const loadStudies = async () => {
    try {
      const s = await ParticipantService.getAssignedStudies();
      // Filter to show only active and upcoming studies (not completed, cancelled, or all tasks done)
      const activeStudies = s.filter(study => {
        const allTasksCompleted = study.total_tasks > 0 && study.completed_tasks === study.total_tasks;
        return study.status !== 'past' && 
               study.status !== 'completed' && 
               study.status !== 'cancelled' &&
               !allTasksCompleted;
      });
      setStudies(activeStudies);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadNotifications(); loadStudies(); }, []);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Participant Dashboard (Alternative- will remove later)</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <NotificationsCenter notifications={notifications} onRefresh={loadNotifications} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <AssignedStudies studies={studies} onSelect={setSelectedStudy} onRefresh={loadStudies} />
          </Paper>

          {selectedStudy && (
            <Paper sx={{ p: 2 }}>
              <StudyDetails studyId={selectedStudy.id} />
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default ParticipantDashboardAlt;

