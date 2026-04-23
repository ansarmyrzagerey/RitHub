import React from 'react';
import { 
  Typography, 
  Box, 
  Grid,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar
} from '@mui/material';
import { 
  CheckCircle,
  Speed
} from '@mui/icons-material';

// Import constants
import { MOCK_DATA, APP_CONFIG } from '../../constants';

const BenefitsSection = () => {
  const { BENEFITS } = MOCK_DATA;

  return (
    <Box mb={8}>
      <Grid container spacing={6} alignItems="center">
        <Grid item xs={12} lg={6}>
          <Typography variant="h3" component="h2" sx={{ fontWeight: 700, mb: 3 }}>
            Why Choose {APP_CONFIG.NAME}?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
            Our platform streamlines the entire research process, from study design to data analysis, 
            allowing you to focus on what matters most: generating meaningful insights about software engineering practices.
          </Typography>
          <List>
            {BENEFITS.map((benefit, index) => (
              <ListItem key={index} sx={{ px: 0 }}>
                <ListItemIcon>
                  <CheckCircle color="primary" />
                </ListItemIcon>
                <ListItemText primary={benefit} />
              </ListItem>
            ))}
          </List>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Paper
            sx={{
              p: 4,
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              borderRadius: 3,
            }}
          >
            <Box textAlign="center">
              <Avatar
                sx={{
                  backgroundColor: 'primary.main',
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <Speed sx={{ fontSize: 40 }} />
              </Avatar>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                Fast & Reliable
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Built for researchers who need results quickly without compromising on data quality or study integrity.
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BenefitsSection;