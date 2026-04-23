import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  IconButton,
  Avatar,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon
} from '@mui/material';
import {
  MoreVert,
  Search,
  FilterList,
  Clear,
  GetApp,
  Science,
  CheckCircle,
  Schedule,
  PlayArrow,
  People as PeopleIcon,
  CalendarToday,
  TrendingUp,
  Visibility,
  Analytics,
  Group,
  ChevronRight
} from '@mui/icons-material';
import { getStatusColor, getStatusIcon } from '../../utils';
import ExportDialog from './ExportDialog';
import researcherService from '../../services/researcherService';

const RecentStudies = ({
  recentStudies = [],
  allStudies = [],
  loading = false,
  search = '',
  startDate = '',
  endDate = '',
  showAll = false,
  onSearchChange,
  onStartDateChange,
  onEndDateChange,
  onFilter,
  onClearFilters,
  onToggleShowAll
}) => {
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedStudyForExport, setSelectedStudyForExport] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuStudyId, setMenuStudyId] = useState(null);
  const [menuData, setMenuData] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);

  // Icon mapping for status icons using Material-UI icons
  const iconMap = {
    Science,
    Code: Science, // Using Science as default for code-related
    People: PeopleIcon,
    TrendingUp,
    Assessment: Science,
    Schedule,
    CheckCircle,
    PlayArrow,
  };

  // Get icon component based on status
  const getStatusIconComponent = (status) => {
    const iconName = getStatusIcon(status || 'draft');
    const IconComponent = iconMap[iconName] || Science;
    return IconComponent;
  };

  // Get status color for avatar background
  const getStatusAvatarColor = (status) => {
    const statusColors = {
      active: '#10a37f',
      completed: '#10a37f',
      draft: '#9e9e9e',
      pending: '#f59e0b',
      in_progress: '#6366f1',
    };
    return statusColors[status] || '#9e9e9e';
  };

  const handleMenuOpen = async (event, studyId) => {
    event.stopPropagation(); // Prevent triggering the list item click
    setAnchorEl(event.currentTarget);
    setMenuStudyId(studyId);
    setMenuData(null);
    setMenuLoading(true);

    // Fetch backend data for the study
    try {
      const [participantsStatus, analytics] = await Promise.all([
        researcherService.getParticipantsStatus(studyId),
        researcherService.getAnalytics(studyId)
      ]);
      setMenuData({ participantsStatus, analytics });
    } catch (error) {
      console.error('Failed to fetch study data:', error);
      setMenuData({
        participantsStatus: { enrolled: 0, inProgress: 0, done: 0 },
        analytics: { funnel: { zero: 0, lt50: 0, gte50lt100: 0, complete: 0 }, ratingCounts: {}, avgAnnotation: 0 }
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuStudyId(null);
    setMenuData(null);
  };

  const handleStudyClick = (studyId) => {
    navigate(`/researcher/studies/${studyId}`);
  };

  const handleExportStudy = (study) => {
    setSelectedStudyForExport(study);
    setExportOpen(true);
    handleMenuClose();
  };

  const handleExportAll = () => {
    setSelectedStudyForExport(null);
    setExportOpen(true);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Recent Studies
        </Typography>
        <Box display="flex" gap={1}>
          {allStudies.length > 3 && (
            <Button
              variant="text"
              size="small"
              onClick={onToggleShowAll}
            >
              {showAll ? 'Show Less' : `View All (${allStudies.length})`}
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<GetApp />}
            onClick={handleExportAll}
            disabled={allStudies.length === 0}
          >
            Export
          </Button>
        </Box>
      </Box>

      {/* Search and Filter Controls */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search studies..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onFilter()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
        <TextField
          size="small"
          type="date"
          label="Start Date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          size="small"
          type="date"
          label="End Date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<FilterList />}
          onClick={onFilter}
        >
          Filter
        </Button>
        {(search || startDate || endDate) && (
          <Button
            variant="text"
            size="small"
            startIcon={<Clear />}
            onClick={onClearFilters}
          >
            Clear
          </Button>
        )}
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : recentStudies.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="body1" color="text.secondary">
            No studies found. Create your first study to get started.
          </Typography>
        </Box>
      ) : (
        <List sx={{ py: 0 }}>
          {recentStudies.map((study, index) => {
            const StatusIcon = getStatusIconComponent(study.status);
            const avatarColor = getStatusAvatarColor(study.status);

            return (
              <React.Fragment key={study.id}>
                <ListItem
                  onClick={() => handleStudyClick(study.id)}
                  sx={{
                    px: 2,
                    py: 2.5,
                    borderRadius: 2,
                    mb: 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transform: 'translateX(4px)',
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        backgroundColor: avatarColor,
                        color: '#fff',
                        width: 48,
                        height: 48,
                      }}
                    >
                      <StatusIcon />


                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1.5} mb={0.5}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
                          {study.title || study.name}
                        </Typography>
                        <Chip
                          label={study.status || 'draft'}
                          size="small"
                          color={getStatusColor(study.status || 'draft')}
                          variant="outlined"
                          sx={{
                            textTransform: 'capitalize',
                            fontWeight: 500,
                            fontSize: '0.75rem'
                          }}
                        />
                        <ChevronRight
                          fontSize="small"
                          sx={{
                            color: 'text.secondary',
                            opacity: 0.6,
                            transition: 'all 0.2s ease-in-out',
                            '.MuiListItem-root:hover &': {
                              opacity: 1,
                              transform: 'translateX(4px)',
                            }
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mb={1}>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <PeopleIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
                            <Typography variant="body2" color="text.secondary">
                              {study.participant_count || 0} participants
                            </Typography>
                          </Box>
                          {study.start_date && (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <CalendarToday fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
                              <Typography variant="body2" color="text.secondary">
                                {new Date(study.start_date).toLocaleDateString()}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Box display="flex" alignItems="center" gap={1} flexGrow={1}>
                            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>
                              Progress:
                            </Typography>
                            <Box
                              sx={{
                                flexGrow: 1,
                                maxWidth: 200,
                                height: 8,
                                backgroundColor: 'grey.200',
                                borderRadius: 4,
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <Box
                                sx={{
                                  width: `${Math.min(study.completion_pct || 0, 100)}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, #10a37f 0%, #1a7f64 100%)',
                                  borderRadius: 4,
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'text.secondary',
                                fontWeight: 600,
                                minWidth: 40
                              }}
                            >
                              {study.completion_pct || 0}%
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    }
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuOpen(e, study.id);
                    }}
                    sx={{
                      ml: 1,
                      '&:hover': {
                        backgroundColor: 'action.selected',
                      }
                    }}
                  >
                    <MoreVert />
                  </IconButton>
                </ListItem>
                {index < recentStudies.length - 1 && (
                  <Divider sx={{ mx: 2 }} />
                )}
              </React.Fragment>
            );
          })}
        </List>
      )}

      {/* Context Menu with Backend Data */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            minWidth: 320,
            maxWidth: 400,
            mt: 1,
          }
        }}
      >
        {menuLoading ? (
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Loading study data...
            </Typography>
          </Box>
        ) : menuData ? (
          <>
            {/* View Study Details */}
            <MenuItem
              onClick={() => {
                handleMenuClose();
                handleStudyClick(menuStudyId);
              }}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon>
                <Visibility fontSize="small" />
              </ListItemIcon>
              <Typography variant="body2">View Study Details</Typography>
            </MenuItem>

            <Divider />

            {/* Participant Status */}
            <Box sx={{ px: 2, py: 1.5 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <Group fontSize="small" color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Participant Status
                </Typography>
              </Box>
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Enrolled:
                  </Typography>
                  <Chip
                    label={menuData.participantsStatus?.enrolled || 0}
                    size="small"
                    color="default"
                    variant="outlined"
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    In Progress:
                  </Typography>
                  <Chip
                    label={menuData.participantsStatus?.inProgress || 0}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Completed:
                  </Typography>
                  <Chip
                    label={menuData.participantsStatus?.done || 0}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                </Box>
              </Box>
            </Box>

            <Divider />

            {/* Analytics Summary */}
            <Box sx={{ px: 2, py: 1.5 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <Analytics fontSize="small" color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Analytics Summary
                </Typography>
              </Box>
              <Box display="flex" flexDirection="column" gap={1}>
                {menuData.analytics?.funnel && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Completion Distribution:
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={0.5}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption">0%</Typography>
                        <Chip label={menuData.analytics.funnel.zero || 0} size="small" variant="outlined" />
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption">&lt;50%</Typography>
                        <Chip label={menuData.analytics.funnel.lt50 || 0} size="small" variant="outlined" />
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption">50-99%</Typography>
                        <Chip label={menuData.analytics.funnel.gte50lt100 || 0} size="small" variant="outlined" />
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption">100%</Typography>
                        <Chip label={menuData.analytics.funnel.complete || 0} size="small" color="success" variant="outlined" />
                      </Box>
                    </Box>
                  </Box>
                )}
                {menuData.analytics?.avgAnnotation !== undefined && (
                  <Box mt={1}>
                    <Typography variant="body2" color="text.secondary">
                      Avg Annotations: <strong>{menuData.analytics.avgAnnotation?.toFixed(1) || 0}</strong>
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider />

            {/* Export Study */}
            <MenuItem
              onClick={() => {
                const study = allStudies.find(s => s.id === menuStudyId);
                handleExportStudy(study);
              }}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon>
                <GetApp fontSize="small" />
              </ListItemIcon>
              <Typography variant="body2">Export Study</Typography>
            </MenuItem>
          </>
        ) : (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No data available
            </Typography>
          </MenuItem>
        )}
      </Menu>

      {/* Export Dialog */}
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        studies={selectedStudyForExport ? [selectedStudyForExport] : allStudies}
      />
    </Box>
  );
};

export default RecentStudies;