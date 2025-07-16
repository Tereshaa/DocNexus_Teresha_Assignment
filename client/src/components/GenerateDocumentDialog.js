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
    // Placeholder for PDF deletion functionality
    console.log('PDF deletion requested');
  };

  const handleDeletePPT = () => {
    // Placeholder for PPT deletion functionality
    console.log('PPT deletion requested');
  };

  const handleDeleteAll = () => {
    // Placeholder for delete all functionality
    console.log('Delete all requested');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate Document</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Select Transcript</InputLabel>
          <Select
            value={selectedTranscript}
            onChange={(e) => setSelectedTranscript(e.target.value)}
            label="Select Transcript"
          >
            {transcripts.map((transcript) => (
              <MenuItem key={transcript._id} value={transcript._id}>
                {transcript.hcpName} - {transcript.meetingDate}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          label="Document Title"
          value={documentTitle}
          onChange={(e) => setDocumentTitle(e.target.value)}
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Document Type</InputLabel>
          <Select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            label="Document Type"
          >
            <MenuItem value="pdf">PDF Report</MenuItem>
            <MenuItem value="ppt">PowerPoint Presentation</MenuItem>
            <MenuItem value="both">Both (PDF + PowerPoint)</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="h6" sx={{ mb: 1 }}>Document Options</Typography>
        <List dense>
          <ListItem>
            <ListItemText 
              primary="Include Key Insights" 
              secondary="Add AI-generated insights and recommendations"
            />
            <Checkbox defaultChecked />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Include Sentiment Analysis" 
              secondary="Add emotional tone and sentiment breakdown"
            />
            <Checkbox defaultChecked />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Include Action Items" 
              secondary="Add extracted action items and follow-ups"
            />
            <Checkbox defaultChecked />
          </ListItem>
        </List>

        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Quick Actions</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              startIcon={<PictureAsPdfIcon />}
              onClick={handleDeletePDF}
              variant="outlined"
            >
              Delete PDF
            </Button>
            <Button
              size="small"
              startIcon={<SlideshowIcon />}
              onClick={handleDeletePPT}
              variant="outlined"
            >
              Delete PPT
            </Button>
            <Button
              size="small"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteAll}
              variant="outlined"
              color="error"
            >
              Delete All
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading || !selectedTranscript || !documentTitle}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Generating...' : 'Generate Document'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GenerateDocumentDialog; 