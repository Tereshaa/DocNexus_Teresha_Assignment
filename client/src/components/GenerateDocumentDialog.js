import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, CircularProgress
} from '@mui/material';
import api from '../services/api';

const GenerateDocumentDialog = ({ open, onClose, onSuccess, transcriptId, defaultTitle = '' }) => {
  const [documentType, setDocumentType] = useState('pdf');
  const [documentTitle, setDocumentTitle] = useState(defaultTitle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDocumentTitle(defaultTitle);
      setDocumentType('pdf');
    }
  }, [open, defaultTitle]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '/documents/generate-both';
      let payload = { transcriptId, documentTitle };
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Generate Document</DialogTitle>
      <DialogContent>
        {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
        <TextField
          fullWidth
          label="Document Title"
          value={documentTitle}
          onChange={(e) => setDocumentTitle(e.target.value)}
          sx={{ mb: 2, mt: 1 }}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !documentTitle}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Generating...' : 'Generate Document'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GenerateDocumentDialog; 