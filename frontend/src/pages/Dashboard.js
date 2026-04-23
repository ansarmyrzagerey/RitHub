import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Box,
  Button
} from '@mui/material';
import { 
  Add
} from '@mui/icons-material';

// Import atomic components
import { 
  StatsCards, 
  RecentStudies
} from '../components';
import ResearcherNotifications from '../components/dashboard/ResearcherNotifications';
import ArtifactRankings from '../components/dashboard/ArtifactRankings';
import researcherService from '../services/researcherService';
import { ROUTES } from '../constants/routes';

// Import styles
import '../styles/globals.css';
import '../styles/components.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [allStudies, setAllStudies] = useState([]);
  const [filteredStudies, setFilteredStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch studies from backend
  useEffect(() => {
    fetchStudies();
  }, []);

  const fetchStudies = () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;
    
    researcherService.listStudies(params)
      .then(data => {
        setAllStudies(data || []);
        setFilteredStudies(data || []);
      })
      .catch(err => {
        console.error('Failed to fetch studies:', err);
        setAllStudies([]);
        setFilteredStudies([]);
      })
      .finally(() => setLoading(false));
  };

  // Determine which studies to show (max 3 unless showAll is true)
  const recentStudies = showAll ? filteredStudies : filteredStudies.slice(0, 3);

  const handleFilter = () => {
    fetchStudies();
  };

  const handleClearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    // Reset filters and fetch all studies
    setTimeout(() => {
      const params = {};
      setLoading(true);
      researcherService.listStudies(params)
        .then(data => {
          setAllStudies(data || []);
          setFilteredStudies(data || []);
        })
        .catch(err => {
          console.error('Failed to fetch studies:', err);
          setAllStudies([]);
          setFilteredStudies([]);
        })
        .finally(() => setLoading(false));
    }, 50);
  };

  const handleToggleShowAll = () => {
    setShowAll(!showAll);
  };

  // Event handlers
  const handleCreateStudy = () => {
    navigate(ROUTES.STUDIES);
  };

  // Removed Quick Actions handlers (replaced by Notification Center)

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your studies and view analytics
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateStudy}
          sx={{
            background: 'linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #0d7a5f 0%, #1a7f64 100%)',
            },
          }}
        >
          New Study
        </Button>
      </Box>

      {/* Stats Cards */}
      <StatsCards studies={allStudies} />

      <Grid container spacing={3}>
        {/* Recent Studies */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <RecentStudies 
                recentStudies={recentStudies}
                allStudies={allStudies}
                loading={loading}
                search={search}
                startDate={startDate}
                endDate={endDate}
                showAll={showAll}
                onSearchChange={setSearch}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onFilter={handleFilter}
                onClearFilters={handleClearFilters}
                onToggleShowAll={handleToggleShowAll}
              />
            </CardContent>
          </Card>

          {/* Artifact Statistics */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <ArtifactRankings />
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Center (replaces Quick Actions & Recent Activity) */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: 'fit-content' }}>
            <CardContent>
              <ResearcherNotifications />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;