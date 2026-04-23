import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  Analytics,
  Storage,
  Warning,
  TrendingUp
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const StorageAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/storage-analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.analytics);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const prepareChartData = () => {
    if (!analytics?.userUsage) return [];
    
    return analytics.userUsage
      .slice(0, 10) // Top 10 users
      .map(user => ({
        name: `${user.first_name} ${user.last_name}`,
        usage: Math.round(user.usage / (1024 * 1024)), // Convert to MB
        artifacts: user.artifact_count
      }));
  };

  const preparePieData = () => {
    if (!analytics?.userUsage) return [];
    
    const topUsers = analytics.userUsage.slice(0, 5);
    const othersUsage = analytics.userUsage
      .slice(5)
      .reduce((sum, user) => sum + parseInt(user.usage), 0);
    
    const data = topUsers.map(user => ({
      name: `${user.first_name} ${user.last_name}`,
      value: parseInt(user.usage)
    }));
    
    if (othersUsage > 0) {
      data.push({ name: 'Others', value: othersUsage });
    }
    
    return data;
  };

  if (loading) {
    return <Typography>Loading storage analytics...</Typography>;
  }

  if (!analytics) {
    return (
      <Alert severity="error">
        Failed to load storage analytics. Please try again.
      </Alert>
    );
  }

  const chartData = prepareChartData();
  const pieData = preparePieData();

  return (
    <Box>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Analytics />
        Storage Analytics
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Storage color="primary" />
                <Box>
                  <Typography variant="h6">
                    {formatBytes(analytics.totalUsage)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Storage Used
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp color="success" />
                <Box>
                  <Typography variant="h6">
                    {analytics.userUsage?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Researchers
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning color="warning" />
                <Box>
                  <Typography variant="h6">
                    {analytics.recentViolations?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recent Violations
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Storage color="info" />
                <Box>
                  <Typography variant="h6">
                    {analytics.userUsage?.reduce((sum, user) => sum + user.artifact_count, 0) || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Artifacts
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Storage Usage by User (Top 10)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'usage' ? `${value} MB` : value,
                    name === 'usage' ? 'Storage Usage' : 'Artifacts'
                  ]}
                />
                <Bar dataKey="usage" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Storage Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatBytes(value)} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* User Usage Table */}
      <Paper sx={{ mb: 4 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">User Storage Details</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Storage Used</TableCell>
                <TableCell>Artifacts</TableCell>
                <TableCell>Usage Level</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {analytics.userUsage?.map((user) => {
                const usageLevel = user.usage > 1024 * 1024 * 1024 ? 'high' : 
                                 user.usage > 100 * 1024 * 1024 ? 'medium' : 'low';
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      {user.first_name} {user.last_name}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{formatBytes(user.usage)}</TableCell>
                    <TableCell>{user.artifact_count}</TableCell>
                    <TableCell>
                      <Chip 
                        label={usageLevel.toUpperCase()} 
                        color={usageLevel === 'high' ? 'error' : usageLevel === 'medium' ? 'warning' : 'success'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Recent Violations */}
      {analytics.recentViolations && analytics.recentViolations.length > 0 && (
        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">Recent Policy Violations</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Violation Type</TableCell>
                  <TableCell>File Name</TableCell>
                  <TableCell>Error Message</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analytics.recentViolations.slice(0, 10).map((violation) => (
                  <TableRow key={violation.id}>
                    <TableCell>
                      {violation.first_name} {violation.last_name}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={violation.violation_type.replace('_', ' ')} 
                        color="error"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{violation.file_name || 'N/A'}</TableCell>
                    <TableCell>{violation.error_message}</TableCell>
                    <TableCell>
                      {new Date(violation.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default StorageAnalytics;