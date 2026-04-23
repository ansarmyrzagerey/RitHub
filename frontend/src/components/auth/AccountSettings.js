import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Stack, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Typography,
  Grid,
  Divider,
  InputAdornment,
  Alert,
  Chip
} from '@mui/material';
import { 
  Person, 
  Email, 
  Business, 
  AccountCircle,
  CheckCircle,
  Lock,
  Save,
  Delete,
  Security
} from '@mui/icons-material';
import api, { authService } from '../../services/api';
import { validatePassword } from '../../utils/validation';

const AccountSettings = ({ user, loading, onProfileUpdated }) => {
  const [form, setForm] = useState({ 
    first_name: user?.first_name || '', 
    last_name: user?.last_name || '', 
    username: user?.username || '',
    organization: user?.organization || '' 
  });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPwDialogOpen, setConfirmPwDialogOpen] = useState(false);
  const [confirmPw, setConfirmPw] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [verificationSending, setVerificationSending] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  React.useEffect(() => {
    setForm({ 
      first_name: user?.first_name || '', 
      last_name: user?.last_name || '', 
      username: user?.username || '',
      organization: user?.organization || '' 
    });
  }, [user]);

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSuccessMessage('');
    setProfileError('');
    try {
      const res = await api.put(`/users/${user.id}`, form);
      onProfileUpdated(res.data.user || res.data);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to update', err);
      const msg = err?.response?.data?.message || 'Failed to update profile. Please try again.';
      setProfileError(msg);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    // open password confirmation dialog
    setConfirmPw('');
    setConfirmPwDialogOpen(true);
  };

  const handleConfirmPwChange = (e) => {
    setConfirmPw(e.target.value);
    // Clear error when user starts typing
    if (deleteError) setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!user) return;
    setConfirmingDelete(true);
    setDeleteError('');
    try {
      const res = await api.post(`/users/${user.id}/delete`, { password: confirmPw });
      if (res.data && res.data.success) {
        authService.logout();
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Failed to delete account', err);
      const msg = err?.response?.data?.message || 'Failed to delete account';
      setDeleteError(msg);
    } finally {
      setConfirmingDelete(false);
      setConfirmPwDialogOpen(false);
    }
  };

  const handlePwChange = (field) => (e) => {
    setPwForm(prev => ({ ...prev, [field]: e.target.value }));
    // Clear error when user starts typing
    if (pwError) setPwError('');
  };

  const handleChangePassword = async () => {
    if (!user) return;
    
    // Clear previous errors
    setPwError('');
    
    // Validate new password
    const passwordValidation = validatePassword(pwForm.newPassword);
    if (!passwordValidation.isValid) {
      setPwError(passwordValidation.message);
      return;
    }
    
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }
    
    setPwSaving(true);
    try {
      const res = await api.post(`/users/${user.id}/change-password`, {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword
      });
      
      if (res.data && res.data.success) {
        setSuccessMessage('Password changed successfully!');
        setPwDialogOpen(false);
        setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPwError('');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      console.error('Failed to change password', err);
      const msg = err?.response?.data?.message || 'Failed to change password';
      setPwError(msg);
    } finally { setPwSaving(false); }
  };

  const handleRequestVerification = async () => {
    if (!user) return;
    setVerificationSending(true);
    setVerificationMessage('');
    try {
      const res = await api.post(`/users/${user.id}/request-verification`);
      if (res.data && res.data.success) {
        setVerificationMessage('Verification email sent! Please check your inbox.');
        // In development, also show the verification URL
        if (res.data.verificationUrl) {
          console.log('Verification URL:', res.data.verificationUrl);
        }
      }
    } catch (err) {
      console.error('Failed to request verification', err);
      const msg = err?.response?.data?.message || 'Failed to send verification email';
      setVerificationMessage(msg);
    } finally { 
      setVerificationSending(false); 
    }
  };

  return (
    <Box>
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}
      
      {profileError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {profileError}
        </Alert>
      )}

      {/* Email Verification Section */}
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Email color="primary" />
        Email Verification
      </Typography>
      
      <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Email: {user?.email}
        </Typography>
        {user?.is_verified ? (
          <Chip 
            icon={<CheckCircle />} 
            label="Verified" 
            color="success" 
            size="small" 
          />
        ) : (
          <Chip 
            icon={<Email />} 
            label="Not Verified" 
            color="warning" 
            size="small" 
          />
        )}
      </Box>
      
      {!user?.is_verified && (
        <Box sx={{ mb: 3 }}>
          <Button 
            variant="outlined" 
            onClick={handleRequestVerification}
            disabled={verificationSending || loading}
            startIcon={<Email />}
            sx={{ mb: 2 }}
          >
            {verificationSending ? 'Sending...' : 'Send Verification Email'}
          </Button>
          {verificationMessage && (
            <Alert 
              severity={verificationMessage.includes('sent') ? 'success' : 'error'} 
              sx={{ mb: 2 }}
            >
              {verificationMessage}
            </Alert>
          )}
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Person color="primary" />
        Personal Information
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth
            label="First Name" 
            value={form.first_name} 
            onChange={handleChange('first_name')} 
            disabled={loading || saving}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Person color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth
            label="Last Name" 
            value={form.last_name} 
            onChange={handleChange('last_name')} 
            disabled={loading || saving}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Person color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth
            label="Username" 
            value={form.username} 
            onChange={handleChange('username')} 
            disabled={loading || saving}
            helperText="Choose a unique username (3-20 characters)"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AccountCircle color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            fullWidth
            label="Organization" 
            value={form.organization} 
            onChange={handleChange('organization')} 
            disabled={loading || saving}
            placeholder="University, Company, etc."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Business color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
      </Grid>

      <Box display="flex" gap={2} sx={{ mb: 3 }}>
        <Button 
          variant="contained" 
          startIcon={<Save />}
          onClick={handleSave} 
          disabled={saving || loading}
          sx={{ minWidth: 140 }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Security color="primary" />
        Security Settings
      </Typography>

      <Box display="flex" gap={2} sx={{ mb: 3 }}>
        <Button 
          variant="outlined" 
          startIcon={<Lock />}
          onClick={() => setPwDialogOpen(true)} 
          disabled={saving || loading}
        >
          Change Password
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 2, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Delete color="error" />
        Danger Zone
      </Typography>

      <Alert severity="warning" sx={{ mb: 2 }}>
        Once you delete your account, there is no going back. Please be certain.
      </Alert>

      <Button 
        variant="outlined" 
        color="error" 
        startIcon={<Delete />}
        onClick={() => setConfirmOpen(true)} 
        disabled={saving || loading}
      >
        Delete Account
      </Button>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete account</DialogTitle>
        <DialogContent>Are you sure you want to permanently delete your account? This action cannot be undone.</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmPwDialogOpen} onClose={() => {
        setConfirmPwDialogOpen(false);
        setDeleteError('');
        setConfirmPw('');
      }}>
        <DialogTitle>Confirm account deletion</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>Please enter your password to confirm deletion.</Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={confirmPw}
            onChange={handleConfirmPwChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setConfirmPwDialogOpen(false);
            setDeleteError('');
            setConfirmPw('');
          }} disabled={confirmingDelete}>Cancel</Button>
          <Button color="error" onClick={handleConfirmDelete} disabled={confirmingDelete} variant="contained">Delete account</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pwDialogOpen} onClose={() => {
        setPwDialogOpen(false);
        setPwError('');
        setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Lock color="primary" />
          Change Password
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {pwError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {pwError}
              </Alert>
            )}
            <TextField 
              label="Current Password" 
              type="password" 
              fullWidth
              value={pwForm.currentPassword} 
              onChange={handlePwChange('currentPassword')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField 
              label="New Password" 
              type="password" 
              fullWidth
              value={pwForm.newPassword} 
              onChange={handlePwChange('newPassword')}
              helperText="Must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField 
              label="Confirm New Password" 
              type="password" 
              fullWidth
              value={pwForm.confirmPassword} 
              onChange={handlePwChange('confirmPassword')}
              error={pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword}
              helperText={pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword ? 'Passwords do not match' : ''}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => {
            setPwDialogOpen(false);
            setPwError('');
            setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
          }} disabled={pwSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleChangePassword} 
            disabled={pwSaving || !pwForm.currentPassword || !pwForm.newPassword || pwForm.newPassword !== pwForm.confirmPassword} 
            variant="contained"
            startIcon={<Save />}
          >
            {pwSaving ? 'Saving...' : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountSettings;
