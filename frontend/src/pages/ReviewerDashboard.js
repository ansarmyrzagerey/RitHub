import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReviewerService from '../services/reviewerService';
import {
  Grid,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Button,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Box,
  TextField
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Science as ScienceIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircleOutline as CheckIcon,
  Flag as FlagIcon,
  OutlinedFlag as OutlinedFlagIcon
} from '@mui/icons-material';

export default function ReviewerDashboard() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [studies, setStudies] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifPage, setNotifPage] = useState({ limit: 5, offset: 0, total: 0 });

  const loadNotifications = async (page = { limit: 5, offset: 0 }) => {
    setLoading(true);
    const data = await ReviewerService.getNotifications(page);
    setNotifications(data.notifications || []);
    setNotifPage({ limit: data.limit || page.limit, offset: data.offset || page.offset, total: data.total || 0 });
    setLoading(false);
  };

  const loadStudies = async (q = '') => {
    const data = await ReviewerService.getStudies(q);
    setStudies(data || []);
  };

  useEffect(() => { loadNotifications(); loadStudies(); }, []);

  const onNotificationClick = async (n) => {
    const val = String(n.link || '');
    const mStudy = val.match(/studies\/(\d+)/);
    const mEval = val.match(/evaluations\/(\d+)/);
    if (mStudy) {
      await ReviewerService.assignToStudy(parseInt(mStudy[1], 10));
      await loadStudies();
    } else if (mEval) {
      const res = await ReviewerService.assignByEvaluation(parseInt(mEval[1], 10));
      if (res?.studyId) await loadStudies();
    }
    await ReviewerService.markRead(n.id);
    await loadNotifications({ limit: notifPage.limit, offset: notifPage.offset });
  };

  const onUnflag = async (evaluationId) => {
    if (!evaluationId) return;
    await ReviewerService.unflagEvaluation(evaluationId);
  };

  const onReflag = async (evaluationId) => {
    if (!evaluationId) return;
    await ReviewerService.flagEvaluation(evaluationId);
  };

  const CompletionChip = ({ pct }) => (
    <Chip
      label={`Completion ${pct}%`}
      color={pct >= 100 ? 'success' : pct >= 50 ? 'primary' : 'default'}
      variant="outlined"
      size="small"
      sx={{ fontWeight: 600 }}
    />
  );

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>Reviewer Dashboard</Typography>
      <Grid container spacing={2}>
        {/* Notifications Block */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardHeader
              avatar={<NotificationsIcon color="primary" />}
              title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Notifications</Typography>}
              subheader={<Typography variant="body2">Flag alerts and system messages</Typography>}
            />
            <Divider />
            <CardContent sx={{ pt: 0 }}>
              {loading ? (
                <Typography variant="body2">Loading…</Typography>
              ) : (notifications.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No notifications</Typography>
              ) : (
                <List>
                  {notifications.map((n) => (
                    <ListItem key={n.id} alignItems="flex-start" sx={{ py: 1 }}>
                      <ListItemText
                        primary={<Typography sx={{ fontWeight: 600 }}>{n.title}</Typography>}
                        secondary={
                          <>
                            <Typography variant="body2" color="text.secondary">{n.body}</Typography>
                            <Typography variant="caption" color="text.disabled">{new Date(n.created_at).toLocaleString()}</Typography>
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Open & assign study">
                          <IconButton edge="end" onClick={() => onNotificationClick(n)}>
                            <OpenInNewIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ))}
            </CardContent>
            <CardActions sx={{ justifyContent: 'space-between' }}>
              <Button disabled={notifPage.offset <= 0} onClick={() => loadNotifications({ limit: notifPage.limit, offset: Math.max(0, notifPage.offset - notifPage.limit) })}>Prev</Button>
              <Typography variant="caption">Showing {notifications.length} of {notifPage.total}</Typography>
              <Button disabled={notifPage.offset + notifPage.limit >= notifPage.total} onClick={() => loadNotifications({ limit: notifPage.limit, offset: notifPage.offset + notifPage.limit })}>Next</Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Studies Block */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardHeader
              avatar={<ScienceIcon color="primary" />}
              title={<Typography variant="h6" sx={{ fontWeight: 700 }}>Assigned Studies</Typography>}
              subheader={
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="body2">Same drill-down as researcher</Typography>
                </Box>
              }
            />
            <Divider />
            <CardContent sx={{ pt: 0 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search studies by title…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button variant="contained" onClick={() => loadStudies(search)}>Search</Button>
              </Box>
              {studies.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No assigned studies yet</Typography>
              ) : (
                <List>
                  {studies.map((s) => (
                    <ListItem key={s.id} sx={{ py: 1 }}>
                      <ListItemText
                        primary={<Typography sx={{ fontWeight: 600 }}>{s.title}</Typography>}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                            <CompletionChip pct={s.completion_pct} />
                            <Chip label={s.status} size="small" variant="outlined" />
                            {s.deadline && (
                              <Chip label={`Due ${new Date(s.deadline).toLocaleDateString()}`} size="small" variant="outlined" />
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          variant="contained"
                          endIcon={<OpenInNewIcon />}
                          onClick={() => navigate(`/reviewer/studies/${s.id}`)}
                        >
                          Open analytics
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
