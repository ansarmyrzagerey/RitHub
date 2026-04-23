import {
  Typography,
  Box,
  Button
} from '@mui/material';
import {
  Assessment,
  Code,
  People,
  TrendingUp
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';

const QuickActions = ({
  onCreateStudy,
  onUploadArtifacts,
  onManageParticipants,
  onViewAnalytics
}) => {
  const { isResearcher } = useAuth();

  const handleCreateStudyClick = () => {
    console.log('Create Study button clicked');
    console.log('isResearcher:', isResearcher);
    console.log('onCreateStudy:', onCreateStudy);
    if (onCreateStudy) {
      onCreateStudy();
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
        Quick Actions
      </Typography>

      <Box display="flex" flexDirection="column" gap={2}>
        {/* Only show Create Study for researchers */}
        {isResearcher && (
          <Button
            variant="outlined"
            startIcon={<Assessment />}
            fullWidth
            onClick={handleCreateStudyClick}
            sx={{ justifyContent: 'flex-start', py: 1.5 }}
          >
            Create New Study
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<Code />}
          fullWidth
          onClick={onUploadArtifacts}
          sx={{ justifyContent: 'flex-start', py: 1.5 }}
        >
          Upload Artifacts (To where?)
        </Button>
        <Button
          variant="outlined"
          startIcon={<People />}
          fullWidth
          onClick={onManageParticipants}
          sx={{ justifyContent: 'flex-start', py: 1.5 }}
        >
          Manage Participants For Each Study
        </Button>
        <Button
          variant="outlined"
          startIcon={<TrendingUp />}
          fullWidth
          onClick={onViewAnalytics}
          sx={{ justifyContent: 'flex-start', py: 1.5 }}
        >
          Statistics stuff
        </Button>
      </Box>
    </Box>
  );
};

export default QuickActions;