import React from 'react';
import { 
  Typography, 
  Box
} from '@mui/material';

const RecentActivity = ({ activities = [] }) => {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
        Recent Activity
      </Typography>
      
      {activities.length === 0 ? (
        <Box textAlign="center" py={2}>
          <Typography variant="body2" color="text.secondary">
            No recent activity to display.
          </Typography>
        </Box>
      ) : (
        <Box>
          {activities.map((activity, index) => (
            <Box key={index} mb={2}>
              {/* Activity item content would go here */}
              <Typography variant="body2">
                {activity.description}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default RecentActivity;