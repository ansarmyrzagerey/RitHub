import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import { Search, EmojiEvents } from '@mui/icons-material';
import axios from 'axios';

// Import participant components
import {
  AssignedStudiesList,
  DeadlinesNotifications,
  StudyHistory
} from '../components/participant';

// Import services
import ParticipantService from '../services/participantService';

// Import styles
import '../styles/globals.css';
import '../styles/components.css';

const ParticipantDashboard = () => {
  const [assignedStudies, setAssignedStudies] = useState([]);
  const [filteredStudies, setFilteredStudies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllStudies, setShowAllStudies] = useState(false);
  const [deadlines, setDeadlines] = useState([]);
  const [completedStudies, setCompletedStudies] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    // Filter studies based on search query
    let filtered = assignedStudies;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = assignedStudies.filter(study => 
        (study.title || '').toLowerCase().includes(query) ||
        (study.description || '').toLowerCase().includes(query) ||
        (study.status || '').toLowerCase().includes(query)
      );
    }
    setFilteredStudies(filtered);
    // Reset showAllStudies when search changes
    setShowAllStudies(false);
  }, [searchQuery, assignedStudies]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch studies from backend
      const studiesData = await ParticipantService.getAssignedStudies();
      
      // Ensure we have an array
      const studiesArray = Array.isArray(studiesData) ? studiesData : [];
      
      console.log('Fetched studies data:', studiesArray);
      
      // Transform backend data to match component expectations
      const now = new Date();
      const transformedStudies = studiesArray.map(study => {
        // Map backend status to frontend status
        let status = study.status || 'upcoming';
        if (status === 'ongoing') status = 'active';
        if (status === 'past') status = 'completed';
        // If all tasks completed, mark as completed regardless
        const completedTasks = study.completed_tasks || 0;
        const totalTasks = study.total_tasks || 0;
        if (totalTasks > 0 && completedTasks >= totalTasks) {
          status = 'completed';
        }
        const deadlineDate = study.deadline ? new Date(study.deadline) : null;
        
        return {
          id: study.id,
          title: study.title,
          description: study.description,
          status: status,
          deadline: study.deadline,
          deadlineDate,
          completedTasks: completedTasks,
          totalTasks: totalTasks
        };
      });
      
      console.log('Transformed studies:', transformedStudies);
      // Split into active assignments vs history: remove completed, past-deadline, and inactive statuses
      const activeAssignedStudies = transformedStudies.filter(s => {
        const isCompleted = s.totalTasks > 0 && s.completedTasks >= s.totalTasks;
        const inactiveStatus = ['completed', 'cancelled', 'archived'].includes((s.status || '').toLowerCase());
        const pastDeadline = s.deadlineDate ? s.deadlineDate < now : false;
        return !isCompleted && !inactiveStatus && !pastDeadline;
      });
      setAssignedStudies(activeAssignedStudies);

      // Fetch real tasks for dashboard
      const tasksResp = await ParticipantService.getDashboardTasks().catch(() => ({ tasks: [] }));

      // Fetch real deadlines
      const deadlinesResp = await ParticipantService.getDashboardDeadlines().catch(() => ({ deadlines: [] }));
      let dl = deadlinesResp.deadlines || [];
      // Fallback: derive deadlines from assigned (active) studies when none returned
      if (!dl.length) {
        dl = activeAssignedStudies
          .filter(s => s.deadline && s.deadlineDate && s.deadlineDate >= now)
          .map((s, idx) => ({
            id: idx + 1,
            taskTitle: s.title,
            studyTitle: s.title,
            studyId: s.id,
            dueDate: s.deadline,
            status: (s.completedTasks >= s.totalTasks && s.totalTasks > 0) ? 'completed' : (s.completedTasks > 0 ? 'in_progress' : 'pending')
          }));
      }
      setDeadlines(dl);

      // Fetch badges
      const token = localStorage.getItem('token');
      const badgesResponse = await axios.get('/api/badges/my-badges', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => ({ data: { badges: [] } }));
      setBadges(badgesResponse.data.badges || []);

      // Fetch completed studies from dedicated endpoint
      try {
        const completedResponse = await ParticipantService.getCompletedStudies();
        const completedStudiesData = completedResponse.studies || [];
        
        // Transform completed studies data to match StudyHistory component expectations
        const transformedCompletedStudies = completedStudiesData.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          completedAt: s.last_completed_at || s.deadline || null,
          tasksCompleted: s.completed_evaluations || s.total_tasks || 0,
          totalTasks: s.total_tasks || 0,
          evaluationsCount: s.completed_evaluations || 0,
          avgRating: null,
          summary: ''
        }));

        // Derive past-deadline or inactive studies from assigned list and merge without duplicates
        const derivedPastDue = transformedStudies
          .filter(s => {
            const isCompleted = s.totalTasks > 0 && s.completedTasks >= s.totalTasks;
            const inactiveStatus = ['completed', 'cancelled', 'archived'].includes((s.status || '').toLowerCase());
            const pastDeadline = s.deadlineDate ? s.deadlineDate < now : false;
            return isCompleted || inactiveStatus || pastDeadline;
          })
          .map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            completedAt: s.deadline || null,
            tasksCompleted: s.completedTasks,
            totalTasks: s.totalTasks,
            evaluationsCount: s.completedTasks,
            avgRating: null,
            summary: ''
          }));

        const mergedCompleted = [...transformedCompletedStudies];
        derivedPastDue.forEach(candidate => {
          if (!mergedCompleted.some(existing => existing.id === candidate.id)) {
            mergedCompleted.push(candidate);
          }
        });

        setCompletedStudies(mergedCompleted);
      } catch (error) {
        console.error('Failed to fetch completed studies:', error);
        // Fallback: derive from transformed list if endpoint fails
        const derivedCompletedStudies = transformedStudies
          .filter(s => {
            const isCompleted = s.totalTasks > 0 && s.completedTasks >= s.totalTasks;
            const inactiveStatus = ['completed', 'cancelled', 'archived'].includes((s.status || '').toLowerCase());
            const pastDeadline = s.deadlineDate ? s.deadlineDate < now : false;
            return isCompleted || inactiveStatus || pastDeadline;
          })
          .map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            completedAt: s.deadline || null,
            tasksCompleted: s.completedTasks,
            totalTasks: s.totalTasks,
            evaluationsCount: s.completedTasks,
            avgRating: null,
            summary: ''
          }));
        setCompletedStudies(derivedCompletedStudies);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Set empty array on error so UI shows "No studies" message
      setAssignedStudies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStudyClick = (study) => {
    // Navigate to study evaluation page
    window.location.href = `/participant/studies/${study.id}`;
  };

  const handleTaskClick = (taskOrDeadline) => {
    // Navigate to study page so participant can complete tasks
    const studyId = taskOrDeadline.studyId || taskOrDeadline.study_id || taskOrDeadline.studyID;
    if (studyId) {
      window.location.href = `/participant/studies/${studyId}`;
    }
  };

  // Determine which studies to display
  const displayedStudies = showAllStudies ? filteredStudies : filteredStudies.slice(0, 3);
  const hasMoreStudies = filteredStudies.length > 3;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          Participant Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview of your assigned studies, tasks, and progress
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Sidebar - Deadlines & Notifications */}
        <Grid item xs={12} md={4}>
          <Box sx={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Badges Section */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <EmojiEvents color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    My Badges ({badges.length})
                  </Typography>
                </Box>
                {badges.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Complete quizzes to earn badges!
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {badges.slice(0, 3).map((badge) => (
                      <Chip
                        key={badge.id}
                        icon={<EmojiEvents />}
                        label={badge.name}
                        color="primary"
                        size="small"
                      />
                    ))}
                    {badges.length > 3 && (
                      <Chip
                        label={`+${badges.length - 3} more`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>

            <DeadlinesNotifications 
              deadlines={deadlines}
              onTaskClick={handleTaskClick}
            />
          </Box>
        </Grid>

        {/* Right Side - Main Content */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={3}>
            {/* Search Bar */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                placeholder="Search studies by title, description, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
            </Grid>

            {/* Assigned Studies List */}
            <Grid item xs={12}>
              <AssignedStudiesList 
                studies={displayedStudies}
                onStudyClick={handleStudyClick}
                showMoreButton={hasMoreStudies && !showAllStudies}
                showLessButton={hasMoreStudies && showAllStudies}
                onShowMore={() => setShowAllStudies(true)}
                onShowLess={() => setShowAllStudies(false)}
                totalCount={filteredStudies.length}
              />
            </Grid>

            {/* Study History */}
            <Grid item xs={12}>
              <StudyHistory 
                completedStudies={completedStudies}
                onStudyClick={handleStudyClick}
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ParticipantDashboard;
