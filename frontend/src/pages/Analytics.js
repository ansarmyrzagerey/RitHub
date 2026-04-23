import React from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button,
  Grid,
  Paper,
  Tab,
  Tabs,
  LinearProgress
} from '@mui/material';
import { 
  Analytics as AnalyticsIcon, 
  TrendingUp, 
  Assessment,
  PieChart,
  BarChart,
  Timeline,
  Download
} from '@mui/icons-material';

const Analytics = () => {
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const metrics = [
    { 
      title: 'Total Evaluations', 
      value: '0', 
      change: '+0%', 
      icon: <Assessment />, 
      color: 'primary' 
    },
    { 
      title: 'Avg. Completion Rate', 
      value: '0%', 
      change: '+0%', 
      icon: <TrendingUp />, 
      color: 'success' 
    },
    { 
      title: 'Active Participants', 
      value: '0', 
      change: '+0%', 
      icon: <PieChart />, 
      color: 'info' 
    },
    { 
      title: 'Studies Completed', 
      value: '0', 
      change: '+0%', 
      icon: <BarChart />, 
      color: 'secondary' 
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AnalyticsIcon color="primary" />
          Analytics & Reports
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<Download />}
          sx={{ minWidth: 140 }}
        >
          Export Report
        </Button>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {metrics.map((metric, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ color: `${metric.color}.main` }}>
                  {React.cloneElement(metric.icon, { sx: { fontSize: 32 } })}
                </Box>
                <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                  {metric.change}
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                {metric.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {metric.title}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Analytics Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Overview" />
          <Tab label="Study Performance" />
          <Tab label="Participant Insights" />
          <Tab label="Artifact Analysis" />
        </Tabs>
      </Card>

      {/* Sample Charts Placeholder */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timeline color="primary" />
                Evaluation Trends
              </Typography>
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Timeline sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  Chart will appear here once you have evaluation data
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PieChart color="primary" />
                Study Distribution
              </Typography>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <PieChart sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  No studies to analyze yet
                </Typography>
              </Box>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Completion Rates
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Study A</Typography>
                  <Typography variant="body2">0%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={0} />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Study B</Typography>
                  <Typography variant="body2">0%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={0} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Study C</Typography>
                  <Typography variant="body2">0%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={0} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Empty State */}
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <AnalyticsIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
            No Analytics Data Yet
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
            Start creating studies and collecting evaluations to see detailed analytics and insights. 
            You'll be able to track participant engagement, study performance, and artifact effectiveness.
          </Typography>
          <Button 
            variant="contained" 
            size="large"
            sx={{ minWidth: 160 }}
          >
            Create Your First Study
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Analytics;