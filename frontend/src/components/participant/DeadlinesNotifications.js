import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button
} from '@mui/material';
import {
  Notifications,
  Warning,
  Schedule,
  CheckCircle
} from '@mui/icons-material';

/**
 * DeadlinesNotifications - Organism Component
 * Notifies participants of due dates and reminders for incomplete tasks
 */
const DeadlinesNotifications = ({ deadlines = [], onTaskClick }) => {
  const [showAll, setShowAll] = useState(false);
  // Sort deadlines by due date (soonest first)
  const sortedDeadlines = [...deadlines].sort((a, b) => {
    const dateA = new Date(a.dueDate);
    const dateB = new Date(b.dueDate);
    return dateA - dateB;
  });

  // Get overdue, upcoming (within 3 days), and upcoming (within 7 days) deadlines
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const overdue = sortedDeadlines.filter(d => new Date(d.dueDate) < now && d.status !== 'completed');
  const urgent = sortedDeadlines.filter(d => {
    const dueDate = new Date(d.dueDate);
    return dueDate >= now && dueDate <= threeDaysFromNow && d.status !== 'completed';
  });
  const upcoming = sortedDeadlines.filter(d => {
    const dueDate = new Date(d.dueDate);
    return dueDate > threeDaysFromNow && dueDate <= sevenDaysFromNow && d.status !== 'completed';
  });

  if (deadlines.length === 0) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              All Caught Up!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You don't have any upcoming deadlines.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const getDaysUntilDue = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPriorityColor = (deadline) => {
    const daysUntil = getDaysUntilDue(deadline.dueDate);
    if (daysUntil < 0) return 'error';
    if (daysUntil <= 3) return 'warning';
    return 'info';
  };

  const getPriorityLabel = (deadline) => {
    const daysUntil = getDaysUntilDue(deadline.dueDate);
    if (daysUntil < 0) return 'Overdue';
    if (daysUntil === 0) return 'Due Today';
    if (daysUntil === 1) return 'Due Tomorrow';
    return `Due in ${daysUntil} days`;
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, gap: 1 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600, 
              fontSize: '1.1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0
            }}
          >
            Deadlines & Notifications
          </Typography>
          <Chip
            icon={<Notifications />}
            label={`${deadlines.filter(d => d.status !== 'completed').length} Active`}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ flexShrink: 0 }}
          />
        </Box>

        {/* Overdue Alert */}
        {overdue.length > 0 && (
          <Alert 
            severity="error" 
            icon={<Warning />}
            sx={{ mb: 1.5 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.875rem' }}>
              {overdue.length} Overdue {overdue.length === 1 ? 'Task' : 'Tasks'}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
              Please complete these tasks as soon as possible.
            </Typography>
          </Alert>
        )}

        {/* Urgent Alert */}
        {urgent.length > 0 && (
          <Alert 
            severity="warning" 
            icon={<Schedule />}
            sx={{ mb: 1.5 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.875rem' }}>
              {urgent.length} Urgent {urgent.length === 1 ? 'Deadline' : 'Deadlines'} (Within 3 Days)
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
              These tasks are due soon. Make sure to complete them on time.
            </Typography>
          </Alert>
        )}

        {/* Upcoming Alert */}
        {upcoming.length > 0 && (
          <Alert 
            severity="info" 
            icon={<Schedule />}
            sx={{ mb: 1.5 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.875rem' }}>
              {upcoming.length} Upcoming {upcoming.length === 1 ? 'Deadline' : 'Deadlines'} (Within 7 Days)
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
              Plan ahead for these upcoming tasks.
            </Typography>
          </Alert>
        )}

        {/* Deadlines List */}
        <List sx={{ pt: 0 }}>
          {(showAll ? sortedDeadlines : sortedDeadlines.slice(0, 5)).map((deadline, index) => (
            <ListItem
              key={deadline.id}
              sx={{
                px: 0,
                py: 1.25,
                mb: 0.5,
                borderRadius: 1,
                alignItems: 'flex-start',
                transition: 'box-shadow 0.3s ease, background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: 'action.hover',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                <Schedule color={getPriorityColor(deadline)} fontSize="small" />
              </ListItemIcon>
              <ListItemText
                sx={{ 
                  m: 0,
                  pr: onTaskClick ? 1 : 0,
                  '& .MuiListItemText-primary': {
                    mb: 0.5,
                  }
                }}
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 500, 
                        fontSize: '0.875rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        minWidth: 0
                      }}
                    >
                      {deadline.taskTitle}
                    </Typography>
                    <Chip
                      label={getPriorityLabel(deadline)}
                      color={getPriorityColor(deadline)}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 20, flexShrink: 0 }}
                    />
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      sx={{ 
                        fontSize: '0.75rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%'
                      }}
                    >
                      {deadline.studyTitle}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">•</Typography>
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                    >
                      {new Date(deadline.dueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Typography>
                  </Box>
                }
              />
              {onTaskClick && (
                <Button
                  size="small"
                  onClick={() => onTaskClick(deadline)}
                  sx={{ 
                    ml: 1, 
                    minWidth: 'auto', 
                    px: 1.5, 
                    fontSize: '0.75rem',
                    flexShrink: 0,
                    mt: 0.5
                  }}
                >
                  View
                </Button>
              )}
            </ListItem>
          ))}
        </List>

        {sortedDeadlines.length > 5 && (
          <Box sx={{ mt: 1.5, textAlign: 'center' }}>
            <Button
              size="small"
              variant="text"
              onClick={() => setShowAll((v) => !v)}
              sx={{ fontSize: '0.8125rem' }}
            >
              {showAll ? 'View less' : `View all (${sortedDeadlines.length})`}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DeadlinesNotifications;


