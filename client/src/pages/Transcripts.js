import React, { useState, useEffect } from 'react';
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
  Paper,
  Chip,
  IconButton,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Avatar,
} from '@mui/material';
import {
  Search,
  Edit,
  Delete,
  Visibility,
  MoreVert,
  Business,
  PictureAsPdf,
  Refresh,
  Add,
  CheckCircle,
  Error,
  Schedule,
  Pause,
  Help,
  Lightbulb,
  Assignment,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import GenerateDocumentDialog from '../components/GenerateDocumentDialog';

const Transcripts = () => {
  const navigate = useNavigate();
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuTranscript, setMenuTranscript] = useState(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedTranscriptForGeneration, setSelectedTranscriptForGeneration] = useState(null);

  useEffect(() => {
    fetchTranscripts();
    
    // Refresh transcripts when page becomes active (e.g., after upload)
    const handleFocus = () => {
      fetchTranscripts();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchTranscripts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/transcripts');
      setTranscripts(response.data.data || []); // Backend returns { success: true, data: transcripts }
      handleMenuClose(); // Close menu after refresh/filter
    } catch (error) {
      console.error('Error fetching transcripts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/transcripts/${selectedTranscript._id}`);
      setTranscripts(prev => prev.filter(t => t._id !== selectedTranscript._id));
      setDeleteDialogOpen(false);
      setSelectedTranscript(null);
      handleMenuClose(); // Close menu after delete
    } catch (error) {
      console.error('Error deleting transcript:', error);
    }
  };

  const handleMenuOpen = (event, transcript) => {
    setMenuAnchor(event.currentTarget);
    setMenuTranscript(transcript);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuTranscript(null);
  };

  const handleReanalyze = async (transcriptId) => {
    try {
      await api.post(`/transcripts/${transcriptId}/reanalyze`);
      fetchTranscripts(); // Refresh the list
      handleMenuClose();
    } catch (error) {
      console.error('Error reanalyzing transcript:', error);
    }
  };

  const handleSyncToCRM = async (transcriptId) => {
    try {
      await api.post(`/crm/sync`, { transcriptId });
      fetchTranscripts(); // Refresh the list
      handleMenuClose();
    } catch (error) {
      console.error('Error syncing to CRM:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'failed':
        return 'error';
      case 'pending':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle fontSize="small" />;
      case 'processing':
        return <Schedule fontSize="small" />;
      case 'failed':
        return <Error fontSize="small" />;
      case 'pending':
        return <Pause fontSize="small" />;
      default:
        return <Help fontSize="small" />;
    }
  };

  const filteredTranscripts = transcripts.filter(transcript => {
    const matchesSearch = 
      transcript.originalFileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transcript.hcpName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transcript.hcpSpecialty?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || transcript.transcriptionStatus === statusFilter;
    const matchesSpecialty = specialtyFilter === 'all' || transcript.hcpSpecialty === specialtyFilter;
    
    return matchesSearch && matchesStatus && matchesSpecialty;
  });

  const uniqueSpecialties = [...new Set(transcripts.map(t => t.hcpSpecialty).filter(Boolean))];

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Transcripts
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/upload')}
        >
          Upload New
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search transcripts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 300 }}
            />
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Specialty</InputLabel>
              <Select
                value={specialtyFilter}
                label="Specialty"
                onChange={(e) => setSpecialtyFilter(e.target.value)}
              >
                <MenuItem value="all">All Specialties</MenuItem>
                {uniqueSpecialties.map(specialty => (
                  <MenuItem key={specialty} value={specialty}>
                    {specialty}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchTranscripts}
            >
              Refresh
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Transcripts Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>File Name</TableCell>
              <TableCell>HCP Name</TableCell>
              <TableCell>Specialty</TableCell>
              <TableCell>Meeting Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Sentiment</TableCell>
              <TableCell>Key Insights</TableCell>
              <TableCell>Action Items</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTranscripts.map((transcript) => (
              <TableRow key={transcript._id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {transcript.originalFileName || 'Untitled'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {new Date(transcript.createdAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {transcript.hcpName || 'Unknown'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={transcript.hcpSpecialty || 'Unknown'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  {transcript.meetingDate 
                    ? new Date(transcript.meetingDate).toLocaleDateString()
                    : 'Not specified'
                  }
                </TableCell>
                <TableCell>
                  <Chip
                    label={transcript.transcriptionStatus}
                    color={getStatusColor(transcript.transcriptionStatus)}
                    size="small"
                    icon={getStatusIcon(transcript.transcriptionStatus)}
                    sx={{
                      color: transcript.transcriptionStatus === 'completed' ? '#fff' : undefined,
                      '& .MuiChip-icon': {
                        color: transcript.transcriptionStatus === 'completed' ? '#fff' : 'inherit',
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  {transcript.meetingDuration 
                    ? `${Math.round(transcript.meetingDuration / 60)} min`
                    : 'Unknown'
                  }
                </TableCell>
                <TableCell>
                  {transcript.sentimentAnalysis && transcript.sentimentAnalysis.overall
                    ? (
                        <Chip
                          label={transcript.sentimentAnalysis.overall}
                          size="small"
                          variant="outlined"
                          sx={{
                            backgroundColor: 
                              transcript.sentimentAnalysis.overall === 'Positive' ? 'success.50' :
                              transcript.sentimentAnalysis.overall === 'Negative' ? 'error.50' :
                              'warning.50',
                            borderColor: 
                              transcript.sentimentAnalysis.overall === 'Positive' ? 'success.main' :
                              transcript.sentimentAnalysis.overall === 'Negative' ? 'error.main' :
                              'warning.main',
                            color: 
                              transcript.sentimentAnalysis.overall === 'Positive' ? 'success.main' :
                              transcript.sentimentAnalysis.overall === 'Negative' ? 'error.main' :
                              'warning.main',
                          }}
                        />
                      )
                    : '—'
                  }
                </TableCell>
                <TableCell>
                  {transcript.keyInsights && transcript.keyInsights.length > 0 ? (
                    <Box sx={{ maxWidth: 200 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {transcript.keyInsights.slice(0, 2).map((insight, index) => (
                          <Box
                            key={index}
                            sx={{
                              p: 1,
                              backgroundColor: 'warning.50',
                              border: '1px solid',
                              borderColor: 'warning.200',
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              lineHeight: 1.2,
                              color: 'text.primary',
                            }}
                          >
                            {insight.insight}
                          </Box>
                        ))}
                        {transcript.keyInsights.length > 2 && (
                          <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                            +{transcript.keyInsights.length - 2} more insights
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">—</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {transcript.actionItems && transcript.actionItems.length > 0 ? (
                    <Box sx={{ maxWidth: 200 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {transcript.actionItems.slice(0, 2).map((item, index) => (
                          <Box
                            key={index}
                            sx={{
                              p: 1,
                              backgroundColor: 'info.50',
                              border: '1px solid',
                              borderColor: 'info.200',
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              lineHeight: 1.2,
                              color: 'text.primary',
                            }}
                          >
                            {item.item}
                          </Box>
                        ))}
                        {transcript.actionItems.length > 2 && (
                          <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                            +{transcript.actionItems.length - 2} more items
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">—</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/transcripts/${transcript._id}`)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="More Actions">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, transcript)}
                      >
                        <MoreVert />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredTranscripts.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No transcripts found. {searchTerm || statusFilter !== 'all' || specialtyFilter !== 'all' 
            ? 'Try adjusting your search criteria.' 
            : 'Upload your first recording to get started.'
          }
        </Alert>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Transcript</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedTranscript?.originalFileName}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          handleReanalyze(menuTranscript?._id);
        }}>
          <ListItemIcon>
            <Refresh fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reanalyze</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          handleSyncToCRM(menuTranscript?._id);
        }}>
          <ListItemIcon>
            <Business fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sync to CRM</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          setSelectedTranscriptForGeneration(menuTranscript);
          setGenerateDialogOpen(true);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <PictureAsPdf fontSize="small" />
          </ListItemIcon>
          <ListItemText>Generate Document</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          setSelectedTranscript(menuTranscript);
          setDeleteDialogOpen(true);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Generate Document Dialog */}
      <GenerateDocumentDialog
        open={generateDialogOpen}
        onClose={() => {
          setGenerateDialogOpen(false);
          setSelectedTranscriptForGeneration(null);
        }}
        onSuccess={() => {
          setGenerateDialogOpen(false);
          setSelectedTranscriptForGeneration(null);
          navigate('/documents'); // Redirect to documents page after successful generation
        }}
        transcriptId={selectedTranscriptForGeneration?._id}
        transcripts={transcripts}
        defaultTitle=""
      />
    </Box>
  );
};

export default Transcripts; 