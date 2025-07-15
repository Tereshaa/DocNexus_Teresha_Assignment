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
  Tabs,
  Tab,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
} from '@mui/material';
import {
  Edit,
  Business,
  PictureAsPdf,
  PlayArrow,
  Pause,
  Schedule,
  Person,
  CalendarToday,
  MedicalServices,
  Description,
  TrendingUp,
  SentimentSatisfied,
  SentimentNeutral,
  SentimentDissatisfied,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import GenerateDocumentDialog from '../components/GenerateDocumentDialog';

const TranscriptDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reanalyzeDialogOpen, setReanalyzeDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isFinalized, setIsFinalized] = useState(false);
  
  // Polling state for transcript processing
  const [processingTime, setProcessingTime] = useState(0);
  const [processingStartTime, setProcessingStartTime] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);

  const audioRef = useRef(null);

  // Play/pause effect
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Update duration when audio loads
  useEffect(() => {
    if (audioRef.current) {
      const handleLoadedMetadata = () => {
        setDuration(audioRef.current.duration || 0);
      };
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
      };
    }
  }, [audioUrl]);

  // Update currentTime as audio plays
  useEffect(() => {
    if (audioRef.current) {
      const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current.currentTime);
      };
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        }
      };
    }
  }, [audioUrl]);

  // Seek handler
  const handleSeek = (e) => {
    if (audioRef.current && duration) {
      const percent = e.nativeEvent.offsetX / e.target.offsetWidth;
      const newTime = percent * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  useEffect(() => {
    fetchTranscript();
    
    // Cleanup interval on unmount
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [id]);

  const fetchTranscript = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/transcripts/${id}`);
      const transcriptData = response.data.data;
      
      setTranscript(transcriptData);
      
      // Get audio URL if available
      if (transcriptData.fileUrl) {
        setAudioUrl(transcriptData.fileUrl);
      }
      
      setEditedTranscript(transcriptData.editedTranscript || transcriptData.rawTranscript || '');
      setIsFinalized(transcriptData.transcriptionStatus === 'finalized');
      
      // Check if transcript is still processing
      if (transcriptData.transcriptionStatus === 'pending' || transcriptData.transcriptionStatus === 'processing') {
        // Start refresh interval if not already running
        if (!refreshInterval) {
          setProcessingStartTime(Date.now());
          const interval = setInterval(async () => {
            setProcessingTime(Math.floor((Date.now() - processingStartTime) / 1000));
            // Fetch transcript status without page reload
            try {
              const response = await api.get(`/transcripts/${id}`);
              const transcriptData = response.data.data;
              setTranscript(transcriptData);
              
              // Update audio URL if available
              if (transcriptData.fileUrl) {
                setAudioUrl(transcriptData.fileUrl);
              }
              
              // If transcript is completed, stop polling
              if (transcriptData.transcriptionStatus === 'completed') {
                clearInterval(interval);
                setRefreshInterval(null);
                setShowSuccessMessage(true);
                setTimeout(() => setShowSuccessMessage(false), 5000);
              }
            } catch (error) {
              console.error('Error polling transcript status:', error);
              // Stop polling on error to avoid infinite retries
              clearInterval(interval);
              setRefreshInterval(null);
            }
          }, 10000); // Refresh every 10 seconds
          setRefreshInterval(interval);
        }
      } else {
        // Stop refresh if transcript is completed
        if (refreshInterval) {
          clearInterval(refreshInterval);
          setRefreshInterval(null);
          if (transcriptData.transcriptionStatus === 'completed') {
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 5000);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching transcript:', error);
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    try {
      await api.post(`/transcripts/${id}/reanalyze`);
      setReanalyzeDialogOpen(false);
      fetchTranscript(); // Refresh the data
    } catch (error) {
      console.error('Error reanalyzing transcript:', error);
    }
  };

  const handleSyncToCRM = async () => {
    try {
      await api.post('/crm/sync', { transcriptId: id });
      fetchTranscript(); // Refresh the data
    } catch (error) {
      console.error('Error syncing to CRM:', error);
    }
  };

  const handleCheckCRMTasks = async () => {
    try {
      const response = await api.get('/crm/tasks');
      console.log('Salesforce Tasks:', response.data);
      alert(`Found ${response.data.data.length} meeting tasks in Salesforce. Check console for details.`);
    } catch (error) {
      console.error('Error checking CRM tasks:', error);
      alert('Error checking CRM tasks. Check console for details.');
    }
  };

  const getSentimentIcon = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return <SentimentSatisfied color="success" />;
      case 'negative':
        return <SentimentDissatisfied color="error" />;
      case 'neutral':
        return <SentimentNeutral color="warning" />;
      default:
        return <SentimentNeutral color="action" />;
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'success';
      case 'negative':
        return 'error';
      case 'neutral':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatProcessingTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Processing indicator component
  const ProcessingIndicator = () => (
    <Alert severity="info" sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ 
          width: 24, 
          height: 24, 
          borderRadius: '50%', 
          bgcolor: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulse 2s infinite'
        }}>
          <Typography variant="caption" color="white" fontWeight="bold">AI</Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            Processing transcript... ({formatProcessingTime(processingTime)})
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Page will refresh automatically when ready
          </Typography>
        </Box>
      </Box>
    </Alert>
  );

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
      {/* Add CSS for pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
      
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {transcript.originalFileName || 'Untitled Transcript'}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {transcript.hcpName} • {transcript.hcpSpecialty} • {new Date(transcript.createdAt).toLocaleDateString()}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Business />}
            onClick={handleSyncToCRM}
          >
            Sync to CRM
          </Button>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdf />}
            onClick={() => setGenerateDialogOpen(true)}
          >
            Generate Document
          </Button>
        </Box>
      </Box>

      {/* Processing Indicator */}
      {refreshInterval && <ProcessingIndicator />}

      {/* Success Message */}
      {showSuccessMessage && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          onClose={() => setShowSuccessMessage(false)}
        >
          🎉 Transcript is ready! You can now view and edit the generated text.
        </Alert>
      )}

      {/* Metadata Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person color="primary" />
                <Typography variant="h6">HCP</Typography>
              </Box>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {transcript.hcpName || 'Unknown'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MedicalServices color="primary" />
                <Typography variant="h6">Specialty</Typography>
              </Box>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {transcript.hcpSpecialty || 'Unknown'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarToday color="primary" />
                <Typography variant="h6">Meeting Date</Typography>
              </Box>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {transcript.meetingDate 
                  ? new Date(transcript.meetingDate).toLocaleDateString()
                  : 'Not specified'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule color="primary" />
                <Typography variant="h6">Duration</Typography>
              </Box>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {transcript.meetingDuration 
                  ? formatDuration(transcript.meetingDuration)
                  : 'Unknown'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Audio Player */}
      {audioUrl && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Audio Recording
            </Typography>
            <audio
              ref={audioRef}
              src={audioUrl}
              style={{ display: 'none' }}
              onEnded={() => setIsPlaying(false)}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                color="primary"
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={!audioUrl}
              >
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
              <Box
                sx={{ flexGrow: 1, cursor: 'pointer' }}
                onClick={handleSeek}
              >
                <LinearProgress
                  variant="determinate"
                  value={duration ? (currentTime / duration) * 100 : 0}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Typography variant="body2" color="textSecondary">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Transcript" icon={<Description />} />
          <Tab label="Insights" icon={<TrendingUp />} />
          <Tab label="Sentiment" icon={<SentimentSatisfied />} />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6">Transcript</Typography>
          
          {refreshInterval ? (
            <Card sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  width: 60, 
                  height: 60, 
                  borderRadius: '50%', 
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 2s infinite'
                }}>
                  <Typography variant="h4" color="white">AI</Typography>
                </Box>
                <Typography variant="h6" color="primary.main">
                  Generating Transcript
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Converting your audio to text... This may take a few minutes.
                </Typography>
                <LinearProgress 
                  variant="indeterminate" 
                  sx={{ width: '100%', maxWidth: 400, height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="textSecondary">
                  Processing time: {formatProcessingTime(processingTime)}
                </Typography>
              </Box>
            </Card>
          ) : (
            <>
              <TextField
                value={editedTranscript}
                onChange={e => setEditedTranscript(e.target.value)}
                multiline
                minRows={10}
                fullWidth
                disabled={isFinalized}
                sx={{ mb: 2 }}
                placeholder={editedTranscript ? '' : 'Transcript will appear here once processing is complete...'}
              />
              {!isFinalized && editedTranscript && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    try {
                      await api.put(`/transcripts/${id}`, { editedTranscript });
                      await api.post('/crm/sync', { transcriptId: id });
                      setIsFinalized(true);
                      fetchTranscript();
                    } catch (error) {
                      alert('Error finalizing transcript or pushing to CRM');
                    }
                  }}
                >
                  Finalize & Push to CRM
                </Button>
              )}
              {isFinalized && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Transcript finalized and pushed to Salesforce CRM.
                </Alert>
              )}
            </>
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                  Key Insights
                </Typography>
                <List sx={{ pl: 2, mb: 2 }}>
                  {transcript.keyInsights?.map((insight, index) => (
                    <ListItem key={index} sx={{ alignItems: 'flex-start', pb: 2 }}>
                      <ListItemIcon sx={{ mt: 0.5 }}>
                        <TrendingUp color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={insight.insight} />
                    </ListItem>
                  ))}
                </List>
                {(!transcript.keyInsights || transcript.keyInsights.length === 0) && (
                  <Typography color="textSecondary" align="center">
                    No insights available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Action Items
                </Typography>
                <List>
                  {transcript.actionItems?.map((item, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Schedule color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={item.item} />
                    </ListItem>
                  ))}
                </List>
                {(!transcript.actionItems || transcript.actionItems.length === 0) && (
                  <Typography color="textSecondary" align="center">
                    No action items available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Overall Sentiment
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  {getSentimentIcon(transcript.sentimentAnalysis?.overall)}
                  <Chip
                    label={transcript.sentimentAnalysis?.overall || 'Unknown'}
                    color={getSentimentColor(transcript.sentimentAnalysis?.overall)}
                  />
                </Box>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Confidence: {typeof transcript.sentimentAnalysis?.confidence === 'number' && transcript.sentimentAnalysis.confidence > 0 ? `${Math.round(transcript.sentimentAnalysis.confidence * 100)}%` : 'N/A'}
                </Typography>
                {/* Sentiment Details */}
                {transcript.sentimentAnalysis?.details && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Sentiment Breakdown
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label={`Positive: ${transcript.sentimentAnalysis.details.positive}%`} 
                        color="success" 
                        size="small" 
                      />
                      <Chip 
                        label={`Neutral: ${transcript.sentimentAnalysis.details.neutral}%`} 
                        color="warning" 
                        size="small" 
                      />
                      <Chip 
                        label={`Negative: ${transcript.sentimentAnalysis.details.negative}%`} 
                        color="error" 
                        size="small" 
                      />
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Reanalyze Dialog */}
      <Dialog open={reanalyzeDialogOpen} onClose={() => setReanalyzeDialogOpen(false)}>
        <DialogTitle>Reanalyze Transcript</DialogTitle>
        <DialogContent>
          <Typography>
            This will reanalyze the transcript and update all insights, sentiment analysis, and key points. This may take a few minutes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReanalyzeDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleReanalyze} variant="contained">
            Reanalyze
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate Document Dialog */}
      <GenerateDocumentDialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        onSuccess={() => {
          setGenerateDialogOpen(false);
          navigate('/documents');
        }}
        transcriptId={id}
        transcripts={transcript ? [transcript] : []}
        defaultTitle=""
      />
    </Box>
  );
};

export default TranscriptDetail; 