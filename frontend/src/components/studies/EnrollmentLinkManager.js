import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Link as LinkIcon,
  ContentCopy,
  Refresh,
  QrCode2,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { studyService } from '../../services/studyService';

const EnrollmentLinkManager = ({ studyId, studyStatus, onLinkGenerated }) => {
  const [enrollmentLink, setEnrollmentLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);

  useEffect(() => {
    // Fetch existing enrollment link when component mounts
    fetchEnrollmentLink();
  }, [studyId]);

  const fetchEnrollmentLink = async () => {
    try {
      const response = await studyService.getEnrollmentLink(studyId);
      setEnrollmentLink(response.enrollment_link);
      setExpiresAt(response.expires_at);
      setError(null);
    } catch (err) {
      // If no link exists yet, that's okay - user can generate one
      if (err.response?.status === 404) {
        setEnrollmentLink(null);
        setExpiresAt(null);
      } else {
        console.error('Error fetching enrollment link:', err);
      }
    }
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await studyService.generateEnrollmentLink(studyId);
      setEnrollmentLink(response.enrollment_link);
      setExpiresAt(response.expires_at);
      
      if (onLinkGenerated) {
        onLinkGenerated(response);
      }
    } catch (err) {
      console.error('Error generating enrollment link:', err);
      setError(err.response?.data?.message || 'Failed to generate enrollment link');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateLink = async () => {
    // Invalidate old link first, then generate new one
    setLoading(true);
    setError(null);
    try {
      await studyService.invalidateEnrollmentLink(studyId);
      await handleGenerateLink();
    } catch (err) {
      console.error('Error regenerating enrollment link:', err);
      setError(err.response?.data?.message || 'Failed to regenerate enrollment link');
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(enrollmentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      alert('Failed to copy link to clipboard');
    }
  };

  const handleOpenQrDialog = () => {
    setQrDialogOpen(true);
  };

  const handleCloseQrDialog = () => {
    setQrDialogOpen(false);
  };

  const isLinkValid = () => {
    if (!enrollmentLink) return false;
    if (studyStatus !== 'active') return false;
    if (expiresAt) {
      const expirationDate = new Date(expiresAt);
      return expirationDate > new Date();
    }
    return true;
  };

  const getLinkStatusText = () => {
    if (!enrollmentLink) return null;
    
    if (studyStatus !== 'active') {
      return 'Link inactive (study not active)';
    }
    
    if (expiresAt) {
      const expirationDate = new Date(expiresAt);
      if (expirationDate <= new Date()) {
        return 'Link expired';
      }
      return `Valid until ${expirationDate.toLocaleString()}`;
    }
    
    return 'Link active';
  };

  const canGenerateLink = studyStatus === 'active' || studyStatus === 'draft';

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkIcon />
        Enrollment Link
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!canGenerateLink && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Enrollment links can only be generated for draft or active studies.
        </Alert>
      )}

      {!enrollmentLink ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Generate a shareable enrollment link to allow participants to join your study.
          </Typography>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <LinkIcon />}
            onClick={handleGenerateLink}
            disabled={loading || !canGenerateLink}
          >
            {loading ? 'Generating...' : 'Generate Link'}
          </Button>
        </Box>
      ) : (
        <Box>
          {/* Link Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Chip
              icon={isLinkValid() ? <CheckCircle /> : <Warning />}
              label={getLinkStatusText()}
              color={isLinkValid() ? 'success' : 'warning'}
              size="small"
            />
          </Box>

          {/* Link Display and Copy */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              value={enrollmentLink}
              InputProps={{
                readOnly: true,
              }}
              size="small"
            />
            <Tooltip title={copied ? 'Copied!' : 'Copy link'}>
              <IconButton
                color={copied ? 'success' : 'primary'}
                onClick={handleCopyLink}
              >
                {copied ? <CheckCircle /> : <ContentCopy />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<QrCode2 />}
              onClick={handleOpenQrDialog}
            >
              Show QR Code
            </Button>
            <Button
              variant="outlined"
              startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
              onClick={handleRegenerateLink}
              disabled={loading || !canGenerateLink}
            >
              {loading ? 'Regenerating...' : 'Regenerate Link'}
            </Button>
          </Box>

          {!isLinkValid() && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This link is currently inactive. 
              {studyStatus !== 'active' && ' Activate the study to enable enrollment.'}
              {studyStatus === 'active' && expiresAt && new Date(expiresAt) <= new Date() && ' Regenerate the link to create a new valid link.'}
            </Alert>
          )}
        </Box>
      )}

      {/* QR Code Dialog */}
      <Dialog
        open={qrDialogOpen}
        onClose={handleCloseQrDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Enrollment QR Code</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
            {enrollmentLink && (
              <>
                <QRCodeSVG
                  value={enrollmentLink}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                  Scan this QR code to access the enrollment page
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseQrDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default EnrollmentLinkManager;
