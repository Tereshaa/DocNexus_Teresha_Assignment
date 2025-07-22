import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  PictureAsPdf,
  Slideshow,
  Download,
  Delete,
  Visibility,
  CloudDownload,
  Description,
  Add,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import Tooltip from '@mui/material/Tooltip';
import { formatDateIST } from '../utils/dateUtils';

const Documents = () => {
  const [searchParams] = useSearchParams();
  const [documents, setDocuments] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedTranscripts, setSelectedTranscripts] = useState([]);
  const [documentType, setDocumentType] = useState('both');
  const [documentTitle, setDocumentTitle] = useState('');
  const [includeInsights, setIncludeInsights] = useState(true);
  const [includeSentiment, setIncludeSentiment] = useState(true);
  const [includeActionItems, setIncludeActionItems] = useState(true);
  const isInitialLoad = useRef(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { pdf: {url,...}, ppt: {url,...} }

  useEffect(() => {
    fetchDocuments();
    fetchTranscripts();
    // Remove auto-open dialog logic
    // Mark that we've completed the initial load
    isInitialLoad.current = false;
  }, [searchParams]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/documents');
      // Use response.data.data, not response.data.documents
      setDocuments(response.data.data || []);
      // Debug print
      console.log('Fetched documents:', response.data.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTranscripts = async () => {
    try {
      const response = await api.get('/transcripts?status=completed');
      setTranscripts(response.data.transcripts || []);
    } catch (error) {
      console.error('Error fetching transcripts:', error);
    }
  };

  const handleGenerateDocument = async () => {
    try {
      setGenerating(true);
      if (!selectedTranscripts[0]) return;
      let endpoint = '/documents/generate-both';
      let payload = { transcriptId: selectedTranscripts[0], documentTitle };
      if (documentType === 'pdf') endpoint = '/documents/generate-pdf';
      if (documentType === 'ppt') endpoint = '/documents/generate-ppt';
      const response = await api.post(endpoint, payload);
      setGenerateDialogOpen(false);
      setSelectedTranscripts([]);
      setDocumentTitle('');
      fetchDocuments(); // Refresh the list
    } catch (error) {
      console.error('Error generating document:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (documentUrl, documentType, fileName) => {
    try {
      // Construct the correct backend URL
      let fullUrl = documentUrl;
      
      // Handle relative URLs
      if (documentUrl.startsWith('/api/')) {
        fullUrl = `https://docnexus-backend-teresha.onrender.com${documentUrl}`;
      }
      // Handle localhost URLs (old documents)
      else if (documentUrl.includes('localhost:5000')) {
        fullUrl = documentUrl.replace('http://localhost:5000', 'https://docnexus-backend-teresha.onrender.com');
      }
      
      console.log('Downloading from:', fullUrl);
      
      // Fetch the file as a blob from the document URL
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element to trigger download
      const link = document.createElement('a');
      link.href = url;
      
      // Set the filename with proper extension
      const extension = documentType === 'pdf' ? 'pdf' : 'pptx';
      const downloadFileName = fileName || `document-${Date.now()}.${extension}`;
      link.setAttribute('download', downloadFileName);
      
      // Trigger the download
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      // Fallback to opening in new tab if download fails
      window.open(documentUrl, '_blank');
    }
  };

  const handleDeleteDocument = async (documentId) => {
    try {
      await api.delete(`/documents/${documentId}`);
      fetchDocuments(); // Refresh the list
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const getDocumentTypeIcon = (type) => {
    switch (type) {
      case 'pdf':
        return <PictureAsPdf color="error" />;
      case 'ppt':
        return <Slideshow color="primary" />;
      case 'both':
        return <Description color="success" />;
      default:
        return <Description color="action" />;
    }
  };

  const getDocumentTypeColor = (type) => {
    switch (type) {
      case 'pdf':
        return 'error';
      case 'ppt':
        return 'primary';
      case 'both':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileNameFromUrl = (url) => {
    try {
      return url.split('/').pop().split('?')[0];
    } catch {
      return url;
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  // Group documents by transcriptId + documentTitle
  const groupedDocuments = Object.values(documents.reduce((acc, doc) => {
    const key = `${doc.transcriptId}||${doc.documentTitle || ''}`;
    if (!acc[key]) {
      acc[key] = {
        transcriptId: doc.transcriptId,
        documentTitle: doc.documentTitle,
        hcpName: doc.hcpName,
        meetingDate: doc.meetingDate,
        generatedAt: doc.generatedAt,
        pdf: null,
        ppt: null
      };
    }
    if (doc.type === 'pdf') acc[key].pdf = doc;
    if (doc.type === 'ppt') acc[key].ppt = doc;
    // Use the latest generatedAt for the group
    if (doc.generatedAt && (!acc[key].generatedAt || new Date(doc.generatedAt) > new Date(acc[key].generatedAt))) {
      acc[key].generatedAt = doc.generatedAt;
    }
    return acc;
  }, {}));
  const visibleGroups = groupedDocuments.filter(group => group.pdf || group.ppt);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Document Generation
        </Typography>
        {/* Removed Generate Document Button */}
      </Box>

      {/* Document Statistics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PictureAsPdf color="error" />
                <Typography variant="h6">PDF Documents</Typography>
              </Box>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {documents.filter(d => d.type === 'pdf').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Slideshow color="primary" />
                <Typography variant="h6">PPT Documents</Typography>
              </Box>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {documents.filter(d => d.type === 'ppt').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Description color="success" />
                <Typography variant="h6">Total Documents</Typography>
              </Box>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {documents.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Documents Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Generated Documents
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Document Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Transcript Info</TableCell>
                  <TableCell>Generated</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Alert severity="info">No documents generated yet. Create your first document to get started.</Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleGroups.map((group) => (
                    <TableRow key={group.transcriptId + (group.documentTitle || '')}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">{group.documentTitle || '(No Title)'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {group.pdf && (
                            <Tooltip title="Download PDF">
                              <IconButton
                                size="small"
                                onClick={() => handleDownload(
                                  group.pdf.url,
                                  'pdf',
                                  group.pdf.fileName || `document-${group.transcriptId}`
                                )}
                              >
                                <PictureAsPdf color="error" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {group.ppt && (
                            <Tooltip title="Download PPT">
                              <IconButton
                                size="small"
                                onClick={() => handleDownload(
                                  group.ppt.url,
                                  'ppt',
                                  group.ppt.fileName || `document-${group.transcriptId}`
                                )}
                              >
                                <Slideshow color="primary" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {group.hcpName ? `HCP: ${group.hcpName}` : ''}
                        {group.meetingDate ? ` | Date: ${formatDateIST(group.meetingDate)}` : ''}
                      </TableCell>
                      <TableCell>
                        {group.generatedAt ? formatDateIST(group.generatedAt) : ''}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(group) || setDeleteDialogOpen(true)}
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Generate Document Dialog */}
      {/* Removed Generate Document Dialog and its trigger logic */}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Which file do you want to delete?</DialogTitle>
        <DialogContent>
          {deleteTarget && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {deleteTarget.pdf && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<PictureAsPdf color="error" />}
                  onClick={() => {
                    handleDeleteDocument(getFileNameFromUrl(deleteTarget.pdf.url));
                    setDeleteDialogOpen(false);
                  }}
                >
                  Delete PDF
                </Button>
              )}
              {deleteTarget.ppt && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Slideshow color="primary" />}
                  onClick={() => {
                    handleDeleteDocument(getFileNameFromUrl(deleteTarget.ppt.url));
                    setDeleteDialogOpen(false);
                  }}
                >
                  Delete PPT
                </Button>
              )}
              {/* Delete All Option */}
              {deleteTarget.pdf && deleteTarget.ppt && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => {
                    handleDeleteDocument(getFileNameFromUrl(deleteTarget.pdf.url));
                    handleDeleteDocument(getFileNameFromUrl(deleteTarget.ppt.url));
                    setDeleteDialogOpen(false);
                  }}
                >
                  Delete All
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Transcript Highlights Section */}
      {/* (Removed Transcript Highlights section) */}
    </Box>
  );
};

export default Documents; 