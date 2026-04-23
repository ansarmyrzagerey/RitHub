import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, IconButton, Divider } from '@mui/material';
import { Markunread, Done } from '@mui/icons-material';
import ParticipantService from '../../services/participantService';

const NotificationsCenter = ({ notifications = [], onRefresh }) => {
  const markRead = async (id) => {
    try { await ParticipantService.markRead(id); onRefresh(); } catch (e) { console.error(e); }
  };

  const markUnread = async (id) => {
    try { await ParticipantService.markUnread(id); onRefresh(); } catch (e) { console.error(e); }
  };

  return (
    <Box>
      <Typography variant="h6">Notifications</Typography>
      <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
        {notifications.length === 0 && <Typography variant="body2">No notifications</Typography>}
        {notifications.map(n => (
          <React.Fragment key={n.id}>
            <ListItem alignItems="flex-start" secondaryAction={(
              <div>
                {n.is_read ? (
                  <IconButton edge="end" aria-label="mark-unread" onClick={() => markUnread(n.id)}><Markunread /></IconButton>
                ) : (
                  <IconButton edge="end" aria-label="mark-read" onClick={() => markRead(n.id)}><Done /></IconButton>
                )}
              </div>
            )}>
              <ListItemText primary={n.title} secondary={<span style={{ color: n.is_read ? '#777' : '#000' }}>{n.body}</span>} />
            </ListItem>
            <Divider component="li" />
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default NotificationsCenter;
