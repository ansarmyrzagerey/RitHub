import React from 'react';
import { 
  Typography, 
  Box, 
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip
} from '@mui/material';
import { 
  Science,
  Code,
  Assessment,
  People,
  TrendingUp,
  Security,
  Speed,
  CheckCircle,
  ArrowForward,
  PlayArrow,
  School,
  Business
} from '@mui/icons-material';

// Import constants
import { MOCK_DATA } from '../../constants';

const UseCasesSection = () => {
  const { USE_CASES } = MOCK_DATA;

  // Icon mapping
  const iconMap = {
    Science,
    Code,
    Assessment,
    People,
    TrendingUp,
    Security,
    Speed,
    CheckCircle,
    ArrowForward,
    PlayArrow,
    School,
    Business,
  };

  return (
    <Box mb={8}>
      <Box textAlign="center" mb={6}>
        <Typography variant="h3" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
          Perfect For
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Whether you're in academia or industry, our platform adapts to your research needs
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {USE_CASES.map((useCase, index) => {
          const IconComponent = iconMap[useCase.icon];
          
          return (
            <Grid item xs={12} md={6} key={index}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: 4 }}>
                  <Box display="flex" alignItems="center" mb={3}>
                    <Avatar
                      sx={{
                        backgroundColor: 'primary.50',
                        color: 'primary.main',
                        width: 48,
                        height: 48,
                        mr: 2,
                      }}
                    >
                      <IconComponent />
                    </Avatar>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {useCase.title}
                    </Typography>
                  </Box>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {useCase.description}
                  </Typography>
                  <Box>
                    {useCase.examples.map((example, idx) => (
                      <Chip
                        key={idx}
                        label={example}
                        variant="outlined"
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default UseCasesSection;