import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Breadcrumbs,
  Link,
  Chip,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  Avatar,
  ListItemAvatar,
  TextField,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  NavigateNext,
  Science,
  Assignment,
  People,
  Schedule,
  CheckCircle,
  Edit,
  Save,
  Cancel,
  CancelPresentation,
  Quiz,
  EditNote,
  Delete,
} from '@mui/icons-material';
import { studyService } from '../services/studyService';
import { useAuth } from '../hooks/useAuth';
import { EnrollmentLinkManager } from '../components/studies';
import StateTransitionHistory from '../components/studies/StateTransitionHistory';
import EvaluationDataSummary from '../components/studies/EvaluationDataSummary';
import CreateStudyWizard from '../components/studies/CreateStudyWizard';

const StudyDetailView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [study, setStudy] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Inline editing state
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Cancellation dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchStudyDetails();
  }, [id]);

  const fetchStudyDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const [studyData, quizzesData, questionsData, participantsData] = await Promise.all([
        studyService.getStudy(id),
        fetch(`/api/studies/${id}/quizzes`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }).then(res => res.json()).catch(() => ({ success: false, quizzes: [] })),
        studyService.getStudyQuestions(id).catch(() => ({ success: false, questions: [] })),
        studyService.getParticipantsWithQuizResults(id).catch(() => ({ success: false, participants: [] }))
      ]);
      
      // Deduplicate participants by participant_id
      const participantsList = participantsData.participants || [];
      const uniqueParticipants = participantsList.filter((p, index, self) => 
        index === self.findIndex(t => t.participant_id === p.participant_id)
      );
      
      const studyWithQuestions = {
        ...(studyData.study || studyData),
        questions: questionsData.questions || [],
        participants: uniqueParticipants
      };
      
      setStudy(studyWithQuestions);
      setQuizzes(quizzesData.success ? quizzesData.quizzes : []);
    } catch (err) {
      console.error('Error fetching study details:', err);
      setError('Failed to load study details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      active: 'success',
      completed: 'info',
      cancelled: 'error',
      archived: 'default',
    };
    return colors[status] || 'default';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeadlineText = () => {
    if (!study?.deadline) return 'No deadline';
    
    const deadline = new Date(study.deadline);
    const now = new Date();
    const diff = deadline - now;
    
    if (diff < 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days ${hours} hours remaining`;
    if (hours > 0) return `${hours} hours remaining`;
    return 'Less than 1 hour remaining';
  };

  const handleEditField = (field, currentValue) => {
    setEditingField(field);
    setEditValues({ [field]: currentValue });
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValues({});
  };

  const handleSaveField = async (field) => {
    setSaving(true);
    try {
      const updateData = { [field]: editValues[field] };
      const updatedStudy = await studyService.updateStudy(study.id, updateData);
      setStudy(updatedStudy);
      setEditingField(null);
      setEditValues({});
    } catch (err) {
      console.error('Error updating study:', err);
      alert('Failed to update study. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canEditField = (field) => {
    if (!canEdit) return false;
    
    // Title and description can only be edited in draft status
    if (field === 'title' || field === 'description') {
      return study.status === 'draft';
    }
    
    // Deadline and capacity can be edited in draft or active status
    if (field === 'deadline' || field === 'participant_capacity') {
      return study.status === 'draft' || study.status === 'active';
    }
    
    return false;
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleOpenCancelDialog = () => {
    setCancelDialogOpen(true);
  };

  const handleCloseCancelDialog = () => {
    if (!cancelling) {
      setCancelDialogOpen(false);
      setCancelReason('');
    }
  };

  const handleCancelStudy = async () => {
    setCancelling(true);
    try {
      if (isAdmin && !isOwner) {
        // Admin cancelling another researcher's study
        await studyService.adminCancelStudy(study.id, cancelReason);
      } else {
        // Researcher cancelling their own study
        await studyService.cancelStudy(study.id, cancelReason);
      }
      
      // Refresh study details
      await fetchStudyDetails();
      setCancelDialogOpen(false);
      setCancelReason('');
    } catch (err) {
      console.error('Error cancelling study:', err);
      alert('Failed to cancel study. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !study) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || 'Study not found'}
        </Alert>
      </Box>
    );
  }

  const isOwner = user?.id === study.created_by;
  const canEdit = isOwner || isAdmin;

  const canCancelStudy = () => {
    return (isOwner || isAdmin) && (study.status === 'draft' || study.status === 'active');
  };

  const canEditStudy = () => {
    return (isOwner || isAdmin) && study.status === 'draft';
  };

  const canDeleteStudy = () => {
    return (isOwner || isAdmin) && study.status !== 'deleted';
  };

  const handleEditStudy = () => {
    setEditMode(true);
  };

  const handleEditComplete = () => {
    setEditMode(false);
    fetchStudyDetails(); // Refresh study data
  };

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (!deleting) {
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteStudy = async () => {
    setDeleting(true);
    try {
      await studyService.deleteStudy(study.id);
      // Navigate back to studies page after successful deletion
      navigate('/studies', { 
        state: { message: 'Study moved to trash bin successfully' }
      });
    } catch (err) {
      console.error('Error deleting study:', err);
      alert('Failed to delete study. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // If in edit mode, show the wizard
  if (editMode) {
    return (
      <CreateStudyWizard 
        studyId={study.id} 
        editMode={true}
        onComplete={handleEditComplete}
      />
    );
  }

  return (
    <Box>
      {/* Breadcrumb Navigation */}
      <Breadcrumbs 
        separator={<NavigateNext fontSize="small" />} 
        sx={{ mb: 3 }}
      >
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/studies')}
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            textDecoration: 'none',
            color: 'text.primary',
            '&:hover': { textDecoration: 'underline' }
          }}
        >
          <Science sx={{ mr: 0.5 }} fontSize="small" />
          Studies
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          {study.title}
        </Typography>
      </Breadcrumbs>

      {/* Study Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            {/* Title - Editable in draft only */}
            {editingField === 'title' ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  value={editValues.title || ''}
                  onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                  variant="outlined"
                  size="small"
                  disabled={saving}
                  inputProps={{ maxLength: 255 }}
                />
                <IconButton 
                  color="primary" 
                  onClick={() => handleSaveField('title')}
                  disabled={saving || !editValues.title?.trim()}
                >
                  <Save />
                </IconButton>
                <IconButton 
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  <Cancel />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {study.title}
                </Typography>
                {canEditField('title') && (
                  <IconButton 
                    size="small" 
                    onClick={() => handleEditField('title', study.title)}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                )}
              </Box>
            )}
            <Chip 
              label={study.status?.toUpperCase() || 'UNKNOWN'} 
              color={getStatusColor(study.status)}
              sx={{ mb: 2 }}
            />
          </Box>
          
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            {/* Edit Study Button (for draft studies) */}
            {canEditStudy() && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<EditNote />}
                onClick={handleEditStudy}
              >
                Edit Study
              </Button>
            )}
            
            {/* Cancel Study Button */}
            {canCancelStudy() && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelPresentation />}
                onClick={handleOpenCancelDialog}
              >
                Cancel Study
              </Button>
            )}

            {/* Delete Study Button */}
            {canDeleteStudy() && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={handleOpenDeleteDialog}
                sx={{ 
                  borderColor: 'error.main',
                  '&:hover': {
                    backgroundColor: 'error.main',
                    color: 'white'
                  }
                }}
              >
                Delete Study
              </Button>
            )}
          </Box>
        </Box>

        {/* Description - Editable in draft only */}
        {editingField === 'description' ? (
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={editValues.description || ''}
              onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
              variant="outlined"
              disabled={saving}
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button 
                variant="contained"
                startIcon={<Save />}
                onClick={() => handleSaveField('description')}
                disabled={saving || !editValues.description?.trim()}
              >
                Save
              </Button>
              <Button 
                variant="outlined"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'start', gap: 1 }}>
              <Typography variant="body1" color="text.secondary" sx={{ flexGrow: 1 }}>
                {study.description}
              </Typography>
              {canEditField('description') && (
                <IconButton 
                  size="small" 
                  onClick={() => handleEditField('description', study.description)}
                >
                  <Edit fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>
        )}

        {/* Assigned Quiz */}
        {quizzes.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 2, 
                backgroundColor: 'primary.50',
                border: '1px solid',
                borderColor: 'primary.200'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                  <Quiz />
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    Assigned Quiz: {quizzes[0].title}
                  </Typography>
                  {quizzes[0].description && (
                    <Typography variant="body2" color="text.secondary">
                      {quizzes[0].description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    {quizzes[0].is_published && (
                      <Chip label="Published" size="small" color="success" variant="outlined" />
                    )}
                    {quizzes[0].is_skippable && (
                      <Chip label="Skippable" size="small" variant="outlined" />
                    )}
                    {quizzes[0].passing_score && (
                      <Chip label={`Passing Score: ${quizzes[0].passing_score}%`} size="small" variant="outlined" />
                    )}
                    {quizzes[0].is_ai_generated && (
                      <Chip label="AI Generated" size="small" color="info" variant="outlined" />
                    )}
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Study Metadata */}
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Created
              </Typography>
              <Typography variant="body2">
                {formatDate(study.created_at)}
              </Typography>
            </Box>
          </Grid>
          
          {/* Deadline - Editable in draft and active */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Deadline
                </Typography>
                {canEditField('deadline') && editingField !== 'deadline' && (
                  <IconButton 
                    size="small" 
                    sx={{ p: 0 }}
                    onClick={() => handleEditField('deadline', study.deadline)}
                  >
                    <Edit sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Box>
              {editingField === 'deadline' ? (
                <Box>
                  <TextField
                    type="datetime-local"
                    value={formatDateForInput(editValues.deadline)}
                    onChange={(e) => setEditValues({ ...editValues, deadline: e.target.value })}
                    size="small"
                    disabled={saving}
                    inputProps={{
                      min: new Date().toISOString().slice(0, 16)
                    }}
                    sx={{ mb: 0.5 }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton 
                      size="small"
                      color="primary" 
                      onClick={() => handleSaveField('deadline')}
                      disabled={saving}
                    >
                      <Save fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      <Cancel fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <>
                  <Typography variant="body2">
                    {study.deadline ? formatDate(study.deadline) : 'No deadline'}
                  </Typography>
                  {study.deadline && (
                    <Typography variant="caption" color="primary">
                      {getDeadlineText()}
                    </Typography>
                  )}
                </>
              )}
            </Box>
          </Grid>
          
          {/* Participant Capacity - Editable in draft and active */}
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Participants
                </Typography>
                {canEditField('participant_capacity') && editingField !== 'participant_capacity' && (
                  <IconButton 
                    size="small" 
                    sx={{ p: 0 }}
                    onClick={() => handleEditField('participant_capacity', study.participant_capacity)}
                  >
                    <Edit sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Box>
              {editingField === 'participant_capacity' ? (
                <Box>
                  <TextField
                    type="number"
                    value={editValues.participant_capacity || ''}
                    onChange={(e) => setEditValues({ ...editValues, participant_capacity: e.target.value })}
                    size="small"
                    disabled={saving}
                    inputProps={{ min: study.enrolled_count || 1 }}
                    sx={{ mb: 0.5, width: 120 }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton 
                      size="small"
                      color="primary" 
                      onClick={() => handleSaveField('participant_capacity')}
                      disabled={saving}
                    >
                      <Save fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      <Cancel fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2">
                  {study.enrolled_count || 0} / {study.participant_capacity || 'Unlimited'}
                </Typography>
              )}
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Last Updated
              </Typography>
              <Typography variant="body2">
                {formatDate(study.updated_at)}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Cancellation Info */}
        {study.status === 'cancelled' && study.cancellation_reason && (
          <>
            <Divider sx={{ my: 2 }} />
            <Alert severity="warning">
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Study Cancelled
              </Typography>
              <Typography variant="body2">
                {study.cancellation_reason}
              </Typography>
              {study.cancelled_at && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Cancelled on {formatDate(study.cancelled_at)}
                </Typography>
              )}
            </Alert>
          </>
        )}
      </Paper>

      <Grid container spacing={3}>
        {/* Questions Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assignment />
                Study Questions ({study.questions?.length || 0})
              </Typography>
              {study.questions && study.questions.length > 0 ? (
                <List>
                  {study.questions.map((question, index) => (
                    <ListItem 
                      key={question.id} 
                      divider={index < study.questions.length - 1}
                      sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, width: '100%' }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: question.question_type === 'comparison' ? 'primary.main' : 'secondary.main' }}>
                            {question.question_type === 'comparison' ? <Assignment /> : <CheckCircle />}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {question.title || `Question ${index + 1}`}
                              </Typography>
                              <Chip 
                                label={question.question_type || 'comparison'} 
                                size="small" 
                                color={question.question_type === 'comparison' ? 'primary' : 'secondary'}
                              />
                            </Box>
                          }
                          secondary={question.description}
                        />
                      </Box>
                      
                      {/* Artifacts for this question */}
                      {question.artifacts && question.artifacts.length > 0 && (
                        <Box sx={{ pl: 7, mb: 1, width: '100%' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                            Artifacts ({question.artifacts.length}):
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {question.artifacts.map((artifact) => (
                              <Chip 
                                key={artifact.artifact_id || artifact.id}
                                label={artifact.name || `Artifact ${artifact.artifact_id || artifact.id}`}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                      
                      {/* Criteria for this question */}
                      {question.criteria && question.criteria.length > 0 && (
                        <Box sx={{ pl: 7, width: '100%' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                            Evaluation Criteria ({question.criteria.length}):
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {question.criteria.map((criterion) => (
                              <Chip 
                                key={criterion.id}
                                label={
                                  question.question_type === 'rating' 
                                    ? `${criterion.name} (${criterion.scale || 'stars_5'})`
                                    : criterion.name
                                }
                                size="small"
                                variant="outlined"
                                color="success"
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No questions defined for this study
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Enrollment Link Section */}
        {(isOwner || isAdmin) && (
          <Grid item xs={12}>
            <EnrollmentLinkManager 
              studyId={study.id} 
              studyStatus={study.status}
              onLinkGenerated={() => {
                // Optionally refresh study details when link is generated
                fetchStudyDetails();
              }}
            />
          </Grid>
        )}

        {/* Participant Quiz Statistics (US 4.7) - Anonymous statistics only for ethical reasons */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Quiz />
                Quiz Results Statistics
              </Typography>
              {study.participants && study.participants.length > 0 ? (
                (() => {
                  // Calculate statistics
                  const stats = {
                    total: study.participants.length,
                    passed: 0,
                    failed: 0,
                    notTaken: 0,
                    pendingGrading: 0
                  };
                  study.participants.forEach(p => {
                    if (!p.quiz_attempt) {
                      stats.notTaken++;
                    } else if (p.quiz_attempt.grading_status === 'pending_grading') {
                      stats.pendingGrading++;
                    } else if (p.quiz_attempt.passed === true) {
                      stats.passed++;
                    } else if (p.quiz_attempt.passed === false) {
                      stats.failed++;
                    } else {
                      stats.pendingGrading++;
                    }
                  });
                  const passRate = stats.passed + stats.failed > 0 
                    ? ((stats.passed / (stats.passed + stats.failed)) * 100).toFixed(1) 
                    : null;
                  const completionRate = ((stats.total - stats.notTaken) / stats.total * 100).toFixed(1);
                  
                  return (
                    <Box>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6} sm={4} md={2.4}>
                          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <People sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>{stats.total}</Typography>
                            <Typography variant="body2" color="text.secondary">Total</Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2.4}>
                          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <CheckCircle sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>{stats.passed}</Typography>
                            <Typography variant="body2" color="text.secondary">Passed</Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2.4}>
                          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'error.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Cancel sx={{ fontSize: 32, color: 'error.main', mb: 1 }} />
                            <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>{stats.failed}</Typography>
                            <Typography variant="body2" color="text.secondary">Failed</Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2.4}>
                          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Schedule sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>{stats.notTaken}</Typography>
                            <Typography variant="body2" color="text.secondary">Not Taken</Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2.4}>
                          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Assignment sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
                            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>{stats.pendingGrading}</Typography>
                            <Typography variant="body2" color="text.secondary">Pending Grading</Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {passRate !== null && <>Pass rate: <strong>{passRate}%</strong> • </>}
                          Completion rate: <strong>{completionRate}%</strong>
                        </Typography>
                      </Box>
                    </Box>
                  );
                })()
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No participants enrolled yet
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Evaluation Data Summary Section */}
        <Grid item xs={12}>
          <EvaluationDataSummary studyId={study.id} studyStatus={study.status} />
        </Grid>

        {/* State Transition History Section */}
        <Grid item xs={12}>
          <StateTransitionHistory studyId={study.id} />
        </Grid>
      </Grid>

      {/* Cancellation Dialog */}
      <Dialog 
        open={cancelDialogOpen} 
        onClose={handleCloseCancelDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {isAdmin && !isOwner ? 'Admin Cancel Study' : 'Cancel Study'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {isAdmin && !isOwner ? (
              <>
                You are about to cancel this study as an administrator. 
                The study owner will be notified of this action. 
                All enrolled participants will also be notified.
              </>
            ) : (
              <>
                Are you sure you want to cancel this study? This action cannot be undone.
                All enrolled participants will be notified of the cancellation.
              </>
            )}
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label={isAdmin && !isOwner ? "Reason for cancellation (required)" : "Reason for cancellation (optional)"}
            fullWidth
            multiline
            rows={4}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            disabled={cancelling}
            placeholder="Provide a reason for cancelling this study..."
            required={isAdmin && !isOwner}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseCancelDialog} 
            disabled={cancelling}
          >
            Keep Study
          </Button>
          <Button 
            onClick={handleCancelStudy} 
            color="error" 
            variant="contained"
            disabled={cancelling || (isAdmin && !isOwner && !cancelReason.trim())}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Study'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={handleCloseDeleteDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Study</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{study.title}"? 
            The study will be moved to the trash bin and can be restored within 20 days. 
            After 20 days, it will be permanently deleted automatically.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteDialog} 
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteStudy} 
            color="error" 
            variant="contained"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Study'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudyDetailView;
