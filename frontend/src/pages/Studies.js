import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button,
  Grid,
  Paper,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Chip
} from '@mui/material';
import { 
  Science, 
  Add, 
  Assignment,
  People,
  Analytics,
  Search,
  Sort,
  Quiz,
  Delete
} from '@mui/icons-material';
import CreateQuizDialog from '../components/quiz/CreateQuizDialog';
import { studyService } from '../services/studyService';
import StudyCard from '../components/studies/StudyCard';
import { ROUTES } from '../constants';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const Studies = () => {
  const [createQuizOpen, setCreateQuizOpen] = useState(false);

  const handleQuizCreated = (quiz) => {
    console.log('Quiz created:', quiz);
    toast.success('Quiz created successfully! You can now assign it to a study.');
    setCreateQuizOpen(false);
  };
  const navigate = useNavigate();
  const { user, isResearcher, isAdmin } = useAuth();
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Stats
  const [stats, setStats] = useState({
    active: 0,
    totalParticipants: 0,
    completed: 0,
    draft: 0,
  });

  useEffect(() => {
    fetchStudies();
  }, [statusFilter, searchQuery, sortBy, sortOrder]);

  const fetchStudies = async () => {
    setLoading(true);
    try {
      const filters = {
        // When viewing "archived", include cancelled as archived: fetch all and filter client-side
        status: statusFilter !== 'all' && statusFilter !== 'archived' ? statusFilter : undefined,
        search: searchQuery || undefined,
        sortBy,
        sortOrder,
      };
      const data = await studyService.getStudies(filters);
      console.log('Studies.js - Raw API response:', data);
      const all = data.studies || data;
      console.log('Studies.js - Processed studies array:', all);
      console.log('Studies.js - Number of studies:', Array.isArray(all) ? all.length : 'not an array');

      // If filtering for archived, include both archived and cancelled
      const filtered = statusFilter === 'archived'
        ? all.filter(s => s.status === 'archived' || s.status === 'cancelled')
        : all;

      console.log('Studies.js - Filtered studies:', filtered);
      setStudies(filtered);
      
      // Calculate stats
      const allStudies = data.studies || data;
      setStats({
        active: allStudies.filter(s => s.status === 'active').length,
        totalParticipants: allStudies.reduce((sum, s) => sum + (s.enrolled_count || 0), 0),
        completed: allStudies.filter(s => s.status === 'completed').length,
        draft: allStudies.filter(s => s.status === 'draft').length,
      });
    } catch (error) {
      console.error('Error fetching studies:', error);
      setStudies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudy = () => {
    console.log('Studies page: Create Study clicked');
    console.log('Current location:', window.location.pathname);
    console.log('Target route:', ROUTES.STUDIES_CREATE);
    console.log('User:', user);
    console.log('User role:', user?.role);
    console.log('isResearcher:', isResearcher);
    console.log('Navigate function:', typeof navigate);
    navigate(ROUTES.STUDIES_CREATE);
    console.log('Navigate called');
  };

  const handleStatusFilterChange = (event, newValue) => {
    setStatusFilter(newValue);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleSortChange = (event) => {
    const value = event.target.value;
    if (value === 'date-desc') {
      setSortBy('date');
      setSortOrder('desc');
    } else if (value === 'date-asc') {
      setSortBy('date');
      setSortOrder('asc');
    } else if (value === 'title-asc') {
      setSortBy('title');
      setSortOrder('asc');
    } else if (value === 'title-desc') {
      setSortBy('title');
      setSortOrder('desc');
    } else if (value === 'status') {
      setSortBy('status');
      setSortOrder('asc');
    }
  };

  const getSortValue = () => {
    if (sortBy === 'date' && sortOrder === 'desc') return 'date-desc';
    if (sortBy === 'date' && sortOrder === 'asc') return 'date-asc';
    if (sortBy === 'title' && sortOrder === 'asc') return 'title-asc';
    if (sortBy === 'title' && sortOrder === 'desc') return 'title-desc';
    if (sortBy === 'status') return 'status';
    return 'date-desc';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Science color="primary" />
          Studies
        </Typography>
        {/* Only show Create Study button for researchers */}
        {isResearcher && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              variant="outlined" 
              startIcon={<Delete />}
              onClick={() => navigate('/studies/trash')}
            >
              Trash Bin
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<Quiz />}
              onClick={() => setCreateQuizOpen(true)}
            >
              Create Quiz
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              sx={{ minWidth: 140 }}
              onClick={handleCreateStudy}
            >
              Create Study
            </Button>
          </Box>
        )}
      </Box>

      <CreateQuizDialog
        open={createQuizOpen}
        onClose={() => setCreateQuizOpen(false)}
        onCreateSuccess={handleQuizCreated}
      />
      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h3" color="primary.main" sx={{ fontWeight: 600 }}>
              {stats.active}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Studies
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h3" color="secondary.main" sx={{ fontWeight: 600 }}>
              {stats.totalParticipants}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Participants
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h3" color="success.main" sx={{ fontWeight: 600 }}>
              {stats.completed}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Completed Studies
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h3" color="info.main" sx={{ fontWeight: 600 }}>
              {stats.draft}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Draft Studies
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      {!loading && studies.length === 0 && statusFilter === 'all' && !searchQuery ? (
        /* Empty State */
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Science sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
              No Studies Yet
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
              Create your first study to start conducting human-subject evaluations of software engineering artifacts. 
              Studies help you gather valuable insights from participants about code quality, usability, and more.
            </Typography>
            <Button 
              variant="contained" 
              size="large"
              startIcon={<Add />}
              sx={{ minWidth: 160 }}
              onClick={handleCreateStudy}
            >
              Create Your First Study
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status Filter Tabs */}
          <Box sx={{ mb: 3 }}>
            <Tabs 
              value={statusFilter} 
              onChange={handleStatusFilterChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="All" value="all" />
              <Tab label="Draft" value="draft" />
              <Tab label="Active" value="active" />
              <Tab label="Completed" value="completed" />
              <Tab label="Archived" value="archived" />
            </Tabs>
          </Box>

          {/* Search and Sort */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search studies..."
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={getSortValue()}
                onChange={handleSortChange}
                label="Sort By"
                startAdornment={
                  <InputAdornment position="start">
                    <Sort />
                  </InputAdornment>
                }
              >
                <MenuItem value="date-desc">Newest First</MenuItem>
                <MenuItem value="date-asc">Oldest First</MenuItem>
                <MenuItem value="title-asc">Title (A-Z)</MenuItem>
                <MenuItem value="title-desc">Title (Z-A)</MenuItem>
                <MenuItem value="status">Status</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Study List */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : studies.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <Science sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>
                  No studies found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your filters or search query
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {studies.map((study) => (
                <Grid item xs={12} md={6} lg={4} key={study.id}>
                  <StudyCard study={study} onUpdate={fetchStudies} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Box>
  );
};

export default Studies;