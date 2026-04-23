import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    LinearProgress,
    Paper,
    IconButton,
    Collapse
} from '@mui/material';
import { AutoAwesome, Close, Preview, Code, ContentCopy } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';

const ARTIFACT_TYPES = [
    { value: 'source_code', label: 'Source Code', description: 'Generate programming code' },
    { value: 'test_case', label: 'Test Case', description: 'Generate unit or integration tests' },
    { value: 'requirements', label: 'Requirements', description: 'Generate requirements documentation' },
    { value: 'documentation', label: 'Documentation', description: 'Generate technical documentation' },
    { value: 'uml_diagram', label: 'UML Diagram', description: 'Generate PlantUML diagrams' },
    { value: 'bug_report', label: 'Bug Report', description: 'Generate realistic bug reports' },
    { value: 'code_clone', label: 'Code Clone', description: 'Generate duplicate code examples' }
];

const PROGRAMMING_LANGUAGES = [
    { value: 'java', label: 'Java' },
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' }
];

const GenerateArtifactDialog = ({ open, onClose, onGenerateSuccess }) => {
    const [generating, setGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [generatedImageUrl, setGeneratedImageUrl] = useState(null); // For UML diagrams
    const [showPreview, setShowPreview] = useState(false);

    const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({
        defaultValues: {
            prompt: '',
            type: '',
            name: '',
            language: 'java'
        }
    });

    const selectedType = watch('type');
    const needsLanguage = selectedType === 'source_code' || selectedType === 'test_case' || selectedType === 'code_clone';

    const handleClose = () => {
        if (!generating) {
            reset();
            setGeneratedContent(null);
            setGeneratedImageUrl(null);
            setShowPreview(false);
            onClose();
        }
    };

    const onSubmit = async (data) => {
        setGenerating(true);
        setShowPreview(false);
        setGeneratedImageUrl(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/artifacts/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: data.prompt,
                    type: data.type,
                    name: data.name || 'Generated Artifact',
                    language: needsLanguage ? data.language : undefined
                })
            });

            const result = await response.json();

            if (result.success) {
                setGeneratedContent(result.artifact.content);

                // If it's a UML diagram with an image URL, display that too
                if (result.artifact.imageUrl) {
                    setGeneratedImageUrl(result.artifact.imageUrl);
                }

                setShowPreview(true);
                toast.success('Artifact generated successfully!');

                // Auto-close after showing preview briefly
                setTimeout(() => {
                    onGenerateSuccess(result.artifact);
                    handleClose();
                }, 2000);
            } else {
                toast.error(result.message || 'Generation failed');
            }
        } catch (error) {
            console.error('Generation error:', error);
            toast.error('Failed to generate artifact. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = () => {
        if (generatedContent) {
            navigator.clipboard.writeText(generatedContent);
            toast.success('Copied to clipboard!');
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AutoAwesome sx={{ color: 'primary.main' }} />
                        Generate Artifact with AI
                    </Box>
                    <IconButton onClick={handleClose} disabled={generating}>
                        <Close />
                    </IconButton>
                </Box>
            </DialogTitle>

            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                        <Alert severity="info">
                            Describe what you want to generate and our AI will create it for you. Limited to 10 generations per hour.
                        </Alert>

                        {/* Prompt Field */}
                        <Controller
                            name="prompt"
                            control={control}
                            rules={{ required: 'Please describe what you want to generate' }}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="What would you like to generate? *"
                                    multiline
                                    rows={4}
                                    fullWidth
                                    error={!!errors.prompt}
                                    helperText={errors.prompt?.message || 'Be specific: e.g., "Create a Java UserRepository class with CRUD operations"'}
                                    disabled={generating}
                                    placeholder="Example: Create a Python task manager class with methods to add, complete, and list tasks"
                                />
                            )}
                        />

                        {/* Type Field */}
                        <Controller
                            name="type"
                            control={control}
                            rules={{ required: 'Artifact type is required' }}
                            render={({ field }) => (
                                <FormControl fullWidth error={!!errors.type} disabled={generating}>
                                    <InputLabel>Artifact Type *</InputLabel>
                                    <Select {...field} label="Artifact Type *">
                                        {ARTIFACT_TYPES.map((type) => (
                                            <MenuItem key={type.value} value={type.value}>
                                                <Box>
                                                    <Typography variant="body1">{type.label}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {type.description}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {errors.type && (
                                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                                            {errors.type.message}
                                        </Typography>
                                    )}
                                </FormControl>
                            )}
                        />

                        {/* Language Selector (for code types) */}
                        {needsLanguage && (
                            <Controller
                                name="language"
                                control={control}
                                render={({ field }) => (
                                    <FormControl fullWidth disabled={generating}>
                                        <InputLabel>Programming Language</InputLabel>
                                        <Select {...field} label="Programming Language">
                                            {PROGRAMMING_LANGUAGES.map((lang) => (
                                                <MenuItem key={lang.value} value={lang.value}>
                                                    {lang.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                )}
                            />
                        )}

                        {/* Name Field */}
                        <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Artifact Name (optional)"
                                    fullWidth
                                    disabled={generating}
                                    helperText="Leave blank to auto-generate from prompt"
                                />
                            )}
                        />

                        {/* Loading State */}
                        {generating && (
                            <Box>
                                <LinearProgress />
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                                    Generating your artifact... This may take a moment.
                                </Typography>
                            </Box>
                        )}

                        {/* Preview */}
                        <Collapse in={showPreview && (generatedContent || generatedImageUrl)}>
                            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Preview color="success" />
                                        <Typography variant="subtitle2" color="success.main">
                                            Generated Successfully!
                                        </Typography>
                                    </Box>
                                    <IconButton size="small" onClick={copyToClipboard}>
                                        <ContentCopy fontSize="small" />
                                    </IconButton>
                                </Box>

                                {/* Show UML diagram image if available */}
                                {generatedImageUrl && (
                                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                            Rendered Diagram:
                                        </Typography>
                                        <img
                                            src={generatedImageUrl}
                                            alt="Generated UML Diagram"
                                            style={{
                                                maxWidth: '100%',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                backgroundColor: 'white'
                                            }}
                                        />
                                    </Box>
                                )}

                                {/* Show text content */}
                                {generatedContent && (
                                    <>
                                        {generatedImageUrl && (
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, mb: 1, display: 'block' }}>
                                                PlantUML Source Code:
                                            </Typography>
                                        )}
                                        <Box
                                            sx={{
                                                maxHeight: 200,
                                                overflow: 'auto',
                                                fontFamily: 'monospace',
                                                fontSize: '0.85rem',
                                                whiteSpace: 'pre-wrap',
                                                bgcolor: 'white',
                                                p: 1,
                                                borderRadius: 1
                                            }}
                                        >
                                            {generatedContent}
                                        </Box>
                                    </>
                                )}
                            </Paper>
                        </Collapse>

                    </Box>
                </DialogContent>

                <DialogActions>
                    {!showPreview ? (
                        <>
                            <Button onClick={handleClose} disabled={generating}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={generating}
                                startIcon={<AutoAwesome />}
                            >
                                {generating ? 'Generating...' : 'Generate Artifact'}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={handleClose}>
                                Close
                            </Button>
                            <Button
                                variant="contained"
                                color="success"
                                onClick={() => {
                                    // Trigger the success callback and close
                                    onGenerateSuccess({ content: generatedContent, imageUrl: generatedImageUrl });
                                    handleClose();
                                }}
                                startIcon={<Preview />}
                            >
                                Save Artifact
                            </Button>
                        </>
                    )}
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default GenerateArtifactDialog;
