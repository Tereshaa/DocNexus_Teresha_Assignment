import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Chip,
  Alert,
  LinearProgress,
  List,
  ListItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Save,
  Cancel,
  Spellcheck,
  Undo,
  Redo,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const TranscriptEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedTranscription, setEditedTranscription] = useState('');
  const [medicalTerms, setMedicalTerms] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editHistory, setEditHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);

  useEffect(() => {
    fetchTranscript();
  }, [id]);

  useEffect(() => {
    if (transcript) {
      setEditedTranscription(transcript.transcription || '');
      setEditHistory([transcript.transcription || '']);
      setHistoryIndex(0);
    }
  }, [transcript]);

  const fetchTranscript = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/transcripts/${id}`);
      setTranscript(response.data.transcript);
    } catch (error) {
      console.error('Error fetching transcript:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscriptionChange = (newText) => {
    setEditedTranscription(newText);
    
    // Add to history
    const newHistory = editHistory.slice(0, historyIndex + 1);
    newHistory.push(newText);
    setEditHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setEditedTranscription(editHistory[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < editHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setEditedTranscription(editHistory[newIndex]);
    }
  };

  const validateMedicalTerms = async () => {
    try {
      const response = await api.post('/ai/validate-terminology', {
        text: editedTranscription,
      });
      setMedicalTerms(response.data.medicalTerms || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error validating medical terms:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/transcripts/${id}`, {
        transcription: editedTranscription,
        metadata: {
          lastEdited: new Date().toISOString(),
          editedBy: 'current_user', // Replace with actual user ID
        },
      });
      
      // Trigger reanalysis if needed
      if (transcript.transcription !== editedTranscription) {
        await api.post(`/transcripts/${id}/reanalyze`);
      }
      
      navigate(`/transcripts/${id}`);
    } catch (error) {
      console.error('Error saving transcript:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (transcript.transcription !== editedTranscription) {
      setValidationDialogOpen(true);
    } else {
      navigate(`/transcripts/${id}`);
    }
  };

  const applySuggestion = (original, suggestion) => {
    const newText = editedTranscription.replace(new RegExp(original, 'gi'), suggestion);
    handleTranscriptionChange(newText);
  };

  const getMedicalTermColor = (confidence) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  if (!transcript) {
    return (
      <Alert severity="error">
        Transcript not found
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Edit Transcript
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {transcript.fileName} • {transcript.hcpName} • {transcript.specialty}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Undo />}
            onClick={handleUndo}
            disabled={historyIndex <= 0}
          >
            Undo
          </Button>
          <Button
            variant="outlined"
            startIcon={<Redo />}
            onClick={handleRedo}
            disabled={historyIndex >= editHistory.length - 1}
          >
            Redo
          </Button>
          <Button
            variant="outlined"
            startIcon={<Spellcheck />}
            onClick={validateMedicalTerms}
          >
            Validate Terms
          </Button>
          <Button
            variant="outlined"
            startIcon={<Cancel />}
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Main Editor */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Transcription Text
              </Typography>
              <TextField
                multiline
                rows={20}
                fullWidth
                value={editedTranscription}
                onChange={(e) => handleTranscriptionChange(e.target.value)}
                variant="outlined"
                placeholder="Edit the transcription text here..."
                sx={{
                  '& .MuiInputBase-root': {
                    fontFamily: 'monospace',
                    fontSize: '14px',
                  },
                }}
              />
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  {editedTranscription.length} characters
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {editedTranscription.split(/\s+/).length} words
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Medical Terms Validation */}
          {showSuggestions && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Medical Terms Validation
                </Typography>
                <List>
                  {medicalTerms.map((term, index) => (
                    <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {/* MedicalServices color="primary" fontSize="small" */}
                        <Typography variant="body2" fontWeight="medium">
                          {term.original}
                        </Typography>
                        <Chip
                          label={`${Math.round(term.confidence * 100)}%`}
                          color={getMedicalTermColor(term.confidence)}
                          size="small"
                        />
                      </Box>
                      {term.suggestions && term.suggestions.length > 0 && (
                        <Box sx={{ ml: 2 }}>
                          <Typography variant="caption" color="textSecondary">
                            Suggestions:
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                            {term.suggestions.map((suggestion, idx) => (
                              <Chip
                                key={idx}
                                label={suggestion}
                                size="small"
                                variant="outlined"
                                onClick={() => applySuggestion(term.original, suggestion)}
                                sx={{ cursor: 'pointer' }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </ListItem>
                  ))}
                </List>
                {medicalTerms.length === 0 && (
                  <Typography color="textSecondary" align="center">
                    No medical terms found for validation
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          {/* Meeting Information */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Meeting Information
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="HCP Name"
                  value={transcript.hcpName || ''}
                  fullWidth
                  size="small"
                  disabled
                />
                <TextField
                  label="Specialty"
                  value={transcript.specialty || ''}
                  fullWidth
                  size="small"
                  disabled
                />
                <TextField
                  label="Meeting Date"
                  value={transcript.meetingDate 
                    ? new Date(transcript.meetingDate).toLocaleDateString()
                    : 'Not specified'
                  }
                  fullWidth
                  size="small"
                  disabled
                />
                <TextField
                  label="Duration"
                  value={transcript.duration 
                    ? `${Math.round(transcript.duration / 60)} minutes`
                    : 'Unknown'
                  }
                  fullWidth
                  size="small"
                  disabled
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Validation Dialog */}
      <Dialog open={validationDialogOpen} onClose={() => setValidationDialogOpen(false)}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <Typography>
            You have unsaved changes. Are you sure you want to discard them?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValidationDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              setValidationDialogOpen(false);
              navigate(`/transcripts/${id}`);
            }} 
            color="error"
          >
            Discard Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TranscriptEditor; 