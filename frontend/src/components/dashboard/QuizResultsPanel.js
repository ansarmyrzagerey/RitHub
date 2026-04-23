import React, { useEffect, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Collapse,
    IconButton,
    Alert,
    CircularProgress,
    Paper
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    CheckCircle,
    Cancel,
    HourglassEmpty,
    Quiz as QuizIcon
} from '@mui/icons-material';
import studyService from '../../services/studyService';

export default function QuizResultsPanel({ studyId }) {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Use the combined endpoint that returns participants with their quiz results
                const data = await studyService.getParticipantsWithQuizResults(studyId);
                // Deduplicate participants by participant_id
                const participantsList = data.participants || [];
                const uniqueParticipants = participantsList.filter((p, index, self) => 
                    index === self.findIndex(t => t.participant_id === p.participant_id)
                );
                setParticipants(uniqueParticipants);
            } catch (err) {
                console.error('Error fetching quiz results:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (studyId) {
            fetchData();
        }
    }, [studyId]);


    const toggleRow = (participantId) => {
        setExpandedRows(prev => ({
            ...prev,
            [participantId]: !prev[participantId]
        }));
    };

    const getStatusChip = (quizAttempt) => {
        if (!quizAttempt) {
            return <Chip label="Pending" size="small" color="default" icon={<HourglassEmpty />} />;
        }

        if (quizAttempt.grading_status === 'pending_grading') {
            return <Chip label="Pending Grading" size="small" color="warning" icon={<HourglassEmpty />} />;
        }

        if (quizAttempt.passed === true) {
            return <Chip label="Pass" size="small" color="success" icon={<CheckCircle />} />;
        } else if (quizAttempt.passed === false) {
            return <Chip label="Fail" size="small" color="error" icon={<Cancel />} />;
        }

        return <Chip label="Completed" size="small" color="info" />;
    };

    const getAnswerIcon = (isCorrect) => {
        if (isCorrect === null) {
            return <HourglassEmpty fontSize="small" color="action" />;
        }
        return isCorrect ?
            <CheckCircle fontSize="small" color="success" /> :
            <Cancel fontSize="small" color="error" />;
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                Error loading quiz results: {error}
            </Alert>
        );
    }

    if (participants.length === 0) {
        return (
            <Alert severity="info">
                No participants enrolled in this study yet.
            </Alert>
        );
    }

    return (
        <Card>
            <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                    <QuizIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Participant Quiz Results
                    </Typography>
                </Box>

                <TableContainer component={Paper} variant="outlined">
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: 'grey.50' }}>
                                <TableCell width="40px"></TableCell>
                                <TableCell><strong>Participant</strong></TableCell>
                                <TableCell><strong>Email</strong></TableCell>
                                <TableCell align="center"><strong>Score</strong></TableCell>
                                <TableCell align="center"><strong>Status</strong></TableCell>
                                <TableCell><strong>Date Taken</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {participants.map((participant) => (
                                <React.Fragment key={participant.participant_id}>
                                    {/* Main Row */}
                                    <TableRow
                                        hover
                                        sx={{
                                            cursor: participant.quiz_attempt ? 'pointer' : 'default',
                                            '&:hover': {
                                                backgroundColor: participant.quiz_attempt ? 'action.hover' : 'transparent'
                                            }
                                        }}
                                        onClick={() => participant.quiz_attempt && toggleRow(participant.participant_id)}
                                    >
                                        <TableCell>
                                            {participant.quiz_attempt && (
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleRow(participant.participant_id);
                                                    }}
                                                >
                                                    <ExpandMoreIcon
                                                        sx={{
                                                            transform: expandedRows[participant.participant_id] ? 'rotate(180deg)' : 'rotate(0deg)',
                                                            transition: 'transform 0.3s'
                                                        }}
                                                    />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {participant.first_name} {participant.last_name}
                                        </TableCell>
                                        <TableCell>{participant.email}</TableCell>
                                        <TableCell align="center">
                                            {participant.quiz_attempt ? (
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    {participant.quiz_attempt.score != null ? Number(participant.quiz_attempt.score).toFixed(1) : '—'}%
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">—</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="center">
                                            {getStatusChip(participant.quiz_attempt)}
                                        </TableCell>
                                        <TableCell>
                                            {participant.quiz_attempt ? (
                                                new Date(participant.quiz_attempt.submitted_at).toLocaleString()
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">—</Typography>
                                            )}
                                        </TableCell>
                                    </TableRow>

                                    {/* Expandable Details Row */}
                                    {participant.quiz_attempt && (
                                        <TableRow>
                                            <TableCell colSpan={6} sx={{ p: 0, borderBottom: expandedRows[participant.participant_id] ? 1 : 0 }}>
                                                <Collapse in={expandedRows[participant.participant_id]} timeout="auto" unmountOnExit>
                                                    <Box sx={{ p: 3, backgroundColor: 'grey.50' }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                                                            Quiz: {participant.quiz_attempt.quiz_title}
                                                        </Typography>

                                                        {participant.quiz_attempt.passing_score && (
                                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                                Passing Score: {participant.quiz_attempt.passing_score}%
                                                            </Typography>
                                                        )}

                                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                                            Per-Question Results:
                                                        </Typography>

                                                        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                                                            <Table size="small">
                                                                <TableHead>
                                                                    <TableRow>
                                                                        <TableCell width="40px"></TableCell>
                                                                        <TableCell><strong>Question</strong></TableCell>
                                                                        <TableCell><strong>Type</strong></TableCell>
                                                                        <TableCell><strong>Answer</strong></TableCell>
                                                                        <TableCell align="center"><strong>Result</strong></TableCell>
                                                                    </TableRow>
                                                                </TableHead>
                                                                <TableBody>
                                                                    {participant.quiz_attempt.questions?.map((q, idx) => (
                                                                        <TableRow key={q.question_id}>
                                                                            <TableCell>{idx + 1}</TableCell>
                                                                            <TableCell>{q.question_title}</TableCell>
                                                                            <TableCell>
                                                                                <Chip
                                                                                    label={q.question_type}
                                                                                    size="small"
                                                                                    variant="outlined"
                                                                                    sx={{ textTransform: 'capitalize' }}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {q.user_answer !== null && q.user_answer !== undefined ? (
                                                                                    <Typography variant="body2">
                                                                                        {String(q.user_answer)}
                                                                                    </Typography>
                                                                                ) : (
                                                                                    <Typography variant="body2" color="text.secondary">
                                                                                        No answer
                                                                                    </Typography>
                                                                                )}
                                                                                {q.question_type === 'multiple' && q.correct_answer && (
                                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                                        Correct: {q.correct_answer}
                                                                                    </Typography>
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell align="center">
                                                                                {getAnswerIcon(q.is_correct)}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </TableContainer>
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </CardContent>
        </Card>
    );
}
