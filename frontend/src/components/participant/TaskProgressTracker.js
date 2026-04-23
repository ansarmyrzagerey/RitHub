import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Assignment,
  Schedule,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';

/**
 * TaskProgressTracker - Organism Component
 * Shows completed vs. pending tasks within each study
 */
const TaskProgressTracker = ({ tasks = [] }) => {
  const [showAllTasks, setShowAllTasks] = useState(false);
  
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress');
  
  const totalTasks = tasks.length;
  const completionPercentage = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;
  
  // Show first 3 tasks initially, all when expanded
  const displayedTasks = showAllTasks ? tasks : tasks.slice(0, 3);
  const hasMoreTasks = tasks.length > 3;

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Assignment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Tasks Available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You don't have any tasks assigned yet.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

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
            Task Progress
          </Typography>
          <Chip
            label={`${completedTasks.length}/${totalTasks} Completed`}
            color="success"
            variant="outlined"
            size="small"
            sx={{ flexShrink: 0 }}
          />
        </Box>

        {/* Progress Bar */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
              Overall Progress
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
              {Math.round(completionPercentage)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={completionPercentage}
            sx={{ height: 10, borderRadius: 1 }}
            color="success"
          />
        </Box>

        {/* Task Statistics */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
          <Chip
            icon={<CheckCircle />}
            label={`${completedTasks.length} Completed`}
            color="success"
            variant="outlined"
            size="small"
          />
          <Chip
            icon={<Schedule />}
            label={`${inProgressTasks.length} In Progress`}
            color="warning"
            variant="outlined"
            size="small"
          />
          <Chip
            icon={<RadioButtonUnchecked />}
            label={`${pendingTasks.length} Pending`}
            color="default"
            variant="outlined"
            size="small"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Task List */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 1 }}>
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 600, 
              color: 'text.secondary', 
              fontSize: '0.875rem',
              flex: 1,
              minWidth: 0
            }}
          >
            Tasks
          </Typography>
          {hasMoreTasks && (
            <Button
              size="small"
              onClick={() => setShowAllTasks(!showAllTasks)}
              endIcon={showAllTasks ? <ExpandLess /> : <ExpandMore />}
              sx={{ 
                minWidth: 'auto', 
                px: 1, 
                fontSize: '0.75rem',
                textTransform: 'none',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              {showAllTasks ? 'Show Less' : `Show More (${tasks.length - 3})`}
            </Button>
          )}
        </Box>
        
        <List sx={{ pt: 0 }}>
          {displayedTasks.map((task, index) => (
            <React.Fragment key={task.id}>
              <ListItem
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
                  {task.status === 'completed' ? (
                    <CheckCircle color="success" fontSize="small" />
                  ) : task.status === 'in_progress' ? (
                    <Schedule color="warning" fontSize="small" />
                  ) : (
                    <RadioButtonUnchecked color="disabled" fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  sx={{ 
                    m: 0,
                    pr: 1,
                    '& .MuiListItemText-primary': {
                      mb: 0.5,
                    }
                  }}
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: task.status === 'completed' ? 500 : 400, 
                          fontSize: '0.875rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 0
                        }}
                      >
                        {task.title}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
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
                        {task.studyTitle}
                      </Typography>
                      {task.dueDate && (
                        <>
                          <Typography variant="caption" color="text.secondary">•</Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                          >
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </Typography>
                        </>
                      )}
                    </Box>
                  }
                />
                <Chip
                  label={task.status === 'completed' ? 'Done' : task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                  size="small"
                  color={task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'warning' : 'default'}
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20, flexShrink: 0, mt: 0.5 }}
                />
              </ListItem>
              {index < displayedTasks.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export default TaskProgressTracker;


