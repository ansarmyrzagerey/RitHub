import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  AdminPanelSettings,
  Storage,
  Policy,
  Analytics,
  People,
  Schedule,
  DeleteSweep
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import FilePolicyManager from '../components/admin/FilePolicyManager';
import StorageQuotaManager from '../components/admin/StorageQuotaManager';
import StorageAnalytics from '../components/admin/StorageAnalytics';
import RetentionPolicyManager from '../components/admin/RetentionPolicyManager';
import DeletedArtifactsManager from '../components/admin/DeletedArtifactsManager';
import StudyTrashManager from '../components/admin/StudyTrashManager';

const AdminControls = () => {
  const { user, loading, isAdmin } = useAuth();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Admin privileges required.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AdminPanelSettings />
          Admin Controls
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage system policies, storage quotas, retention rules, and view analytics
        </Typography>
      </Box>

      {/* Quick Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Policy color="primary" />
                <Box>
                  <Typography variant="h6">File Policies</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage allowed file types
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
                <Storage color="primary" />
                <Box>
                  <Typography variant="h6">Storage Quotas</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Control storage limits
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
                <Schedule color="primary" />
                <Box>
                  <Typography variant="h6">Retention Policies</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage data lifecycle
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
                <DeleteSweep color="primary" />
                <Box>
                  <Typography variant="h6">Study Trash</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage deleted studies
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
                <Analytics color="primary" />
                <Box>
                  <Typography variant="h6">Usage Analytics</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monitor system usage
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab 
              label="File Policies" 
              icon={<Policy />} 
              iconPosition="start"
            />
            <Tab 
              label="Storage Quotas" 
              icon={<Storage />} 
              iconPosition="start"
            />
            <Tab 
              label="Retention Policies" 
              icon={<Schedule />} 
              iconPosition="start"
            />
            <Tab 
              label="Study Trash" 
              icon={<DeleteSweep />} 
              iconPosition="start"
            />
            <Tab 
              label="Deleted Artifacts" 
              icon={<DeleteSweep />} 
              iconPosition="start"
            />
            <Tab 
              label="Analytics" 
              icon={<Analytics />} 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {tabValue === 0 && <FilePolicyManager />}
          {tabValue === 1 && <StorageQuotaManager />}
          {tabValue === 2 && <RetentionPolicyManager />}
          {tabValue === 3 && <StudyTrashManager />}
          {tabValue === 4 && <DeletedArtifactsManager />}
          {tabValue === 5 && <StorageAnalytics />}
        </Box>
      </Paper>
    </Box>
  );
};

export default AdminControls;