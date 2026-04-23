import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Avatar, 
  Chip,
  Divider,
  Paper,
  Alert,
  Button
} from '@mui/material';
import { 
  Person, 
  Email, 
  Business, 
  AccountCircle,
  Badge
} from '@mui/icons-material';
import AccountSettings from '../components/auth/AccountSettings';
import { authService } from '../services/api';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authService.getCurrentUser();
        setUser(res.data.user || res.data);
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'error';
      case 'researcher': return 'primary';
      case 'reviewer': return 'secondary';
      case 'participant': return 'success';
      default: return 'default';
    }
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Profile</Typography>
      
      {/* Email verification banner */}
      {user && !user.is_verified && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          icon={<Email />}
          action={
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Check the Email Verification section below
            </Typography>
          }
        >
          <Typography variant="body1">
            Your email address is not verified. Please verify your email to access all features.
          </Typography>
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Profile Overview Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: 'fit-content' }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Avatar
                sx={{ 
                  width: 80, 
                  height: 80, 
                  mx: 'auto', 
                  mb: 2,
                  bgcolor: 'primary.main',
                  fontSize: '2rem'
                }}
              >
                {user ? getInitials(user.first_name, user.last_name) : <Person />}
              </Avatar>
              
              <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
                {user ? `${user.first_name} ${user.last_name}` : 'Loading...'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {user?.email}
              </Typography>
              
              <Chip 
                label={user?.role || 'Unknown'} 
                color={getRoleColor(user?.role)}
                variant="outlined"
                sx={{ mb: 2, textTransform: 'capitalize' }}
              />
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ textAlign: 'left' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AccountCircle sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Username: {user?.username || 'Not set'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Business sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Organization: {user?.organization || 'Not specified'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Badge sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Member since: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Account Settings Card */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Account Settings
              </Typography>
              <AccountSettings user={user} loading={loading} onProfileUpdated={setUser} />
            </CardContent>
          </Card>
        </Grid>

        {/* Account Statistics Card */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Account Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary.main" sx={{ fontWeight: 600 }}>
                    {user?.role === 'researcher' ? '0' : '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user?.role === 'researcher' ? 'Studies Created' : 'Studies Participated'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="secondary.main" sx={{ fontWeight: 600 }}>
                    0
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Evaluations Completed
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main" sx={{ fontWeight: 600 }}>
                    {user?.is_verified ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Email Verified
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main" sx={{ fontWeight: 600 }}>
                    Active
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Account Status
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile;
