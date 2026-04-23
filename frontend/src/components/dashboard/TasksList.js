import React, { useEffect, useState } from 'react';
import { Box, List, ListItem, ListItemText, Button, Chip } from '@mui/material';
import ParticipantService from '../../services/participantService';

const TasksList = ({ studyId }) => {
  const [tasks, setTasks] = useState([]);

  const load = async () => {
    try {
      const t = await ParticipantService.getStudyTasks(studyId);
      setTasks(t);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (studyId) load(); }, [studyId]);

  const start = async (taskId) => {
    try {
      await ParticipantService.startTask(taskId);
      // navigate to task — for now we just reload and log
      // In real app: route to task page, e.g. /tasks/:id
      console.log('Started task', taskId);
      load();
      // optionally navigate: window.location.href = `/tasks/${taskId}`;
    } catch (e) { console.error(e); }
  };

  const filterBy = (s) => tasks.filter(t => (s === 'all') || (s === 'pending' && t.status !== 'completed') || (s === 'completed' && t.status === 'completed'));

  return (
    <Box>
      <Box display="flex" gap={1} mb={1}>
        <Button size="small" onClick={() => setTasks(prev => prev)}>Refresh</Button>
      </Box>
      <List>
        {tasks.map(t => (
          <ListItem key={t.id} secondaryAction={(
            <div>
              <Button variant="contained" size="small" onClick={() => start(t.id)}>{t.status === 'in_progress' ? 'Resume' : 'Start'}</Button>
            </div>
          )}>
            <ListItemText primary={t.task_type} secondary={t.instructions} />
            <Chip label={t.status} color={t.status === 'completed' ? 'success' : 'warning'} />
          </ListItem>
        ))}
        {tasks.length === 0 && <div style={{ padding: 8 }}>No tasks</div>}
      </List>
    </Box>
  );
};

export default TasksList;
