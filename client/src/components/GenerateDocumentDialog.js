import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Typography, List, ListItem, ListItemText, Checkbox, FormControlLabel, Box, Alert, CircularProgress
} from '@mui/material';
import api from '../services/api';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import DeleteIcon from '@mui/icons-material/Delete';

const GenerateDocumentDialog = ({ open, onClose, onSuccess, transcriptId, transcripts = [], defaultTitle = '' }) => {
  const [selectedTranscript, setSelectedTranscript] = useState(transcriptId || '');
  const [documentType, setDocumentType] = useState('pdf');
  const [documentTitle, setDocumentTitle] = useState(defaultTitle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDocumentTitle(defaultTitle);
      setDocumentType('pdf');
      setSelectedTranscript(transcriptId || '');
    }
  }, [open, defaultTitle, transcriptId]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '/documents/generate-both';
      let payload = { transcriptId: selectedTranscript, documentTitle };
      if (documentType === 'pdf') endpoint = '/documents/generate-pdf';
      if (documentType === 'ppt') endpoint = '/documents/generate-ppt';
      await api.post(endpoint, payload);
      setLoading(false);
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to generate document');
      setLoading(false);
    }
  };

  const handleDeletePDF = () => {
    // TODO: Implement PDF deletion logic
    alert('Delete PDF clicked');
  };

  const handleDeletePPT = () => {
    // TODO: Implement PPT deletion logic
    alert('Delete PPT clicked');
  };

  const handleDeleteAll = () => {
    // TODO: Implement delete all logic
    alert('Delete All clicked');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Generate Document</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ mt: 1 }}>
          <TextField
            label="Document Title"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            fullWidth
            placeholder="Enter a title for your document"
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Document Type</InputLabel>
            <Select
              value={documentType}
              label="Document Type"
              onChange={(e) => setDocumentType(e.target.value)}
            >
              <MenuItem value="pdf">PDF Report</MenuItem>
              <MenuItem value="ppt">PowerPoint Presentation</MenuItem>
              <MenuItem value="both">Both (PDF + PPT)</MenuItem>
            </Select>
          </FormControl>
          {!transcriptId && (
            <>
              <Typography variant="h6" gutterBottom>Select Transcript</Typography>
              <List sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
                {transcripts.map((transcript) => (
                  <ListItem key={transcript._id}>
                    <Checkbox
                      checked={selectedTranscript === transcript._id}
                      onChange={() => setSelectedTranscript(transcript._id)}
                    />
                    <ListItemText
                      primary={transcript.fileName || 'Untitled'}
                      secondary={`${transcript.hcpName} • ${transcript.specialty} • ${new Date(transcript.createdAt).toLocaleDateString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, width: '100%' }}>
          <Button onClick={onClose} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            color="primary"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Generate'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default GenerateDocumentDialog; 