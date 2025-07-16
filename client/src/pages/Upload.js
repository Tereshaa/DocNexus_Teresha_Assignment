import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  Paper,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  IconButton,
} from '@mui/material';
import {
  CloudUpload,
  AudioFile,
  VideoFile,
  CheckCircle,
  Error,
  Schedule,
  Delete,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

const Upload = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [formData, setFormData] = useState({
    hcpName: '',
    hcpSpecialty: '',
    meetingDate: '',
    meetingType: '',
    notes: '',
  });
  const navigate = useNavigate();
  const [redirected, setRedirected] = useState(false);
  const redirectedRef = useRef(false);
  const [successMessage, setSuccessMessage] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0,
      error: null,
    }));
    setFiles(prev => [...prev, ...newFiles]);
    
    // Only auto-upload if required fields are filled
    if (formData.hcpName && formData.hcpSpecialty && formData.meetingDate) {
      newFiles.forEach(uploadFile);
    }
  }, [formData.hcpName, formData.hcpSpecialty, formData.meetingDate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac'],
      'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
    },
    multiple: true,
  });

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const uploadFile = async (fileData) => {
    // Check if required fields are filled
    if (!formData.hcpName || !formData.hcpSpecialty || !formData.meetingDate) {
      console.error('Required fields missing:', {
        hcpName: formData.hcpName,
        hcpSpecialty: formData.hcpSpecialty,
        meetingDate: formData.meetingDate
      });
      setFiles(prev =>
        prev.map(f =>
          f.id === fileData.id
            ? { ...f, status: 'error', error: 'Please fill in all required fields before uploading' }
            : f
        )
      );
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('file', fileData.file);
    formDataToSend.append('hcpName', formData.hcpName);
    formDataToSend.append('hcpSpecialty', formData.hcpSpecialty);
    formDataToSend.append('meetingDate', formData.meetingDate);
    formDataToSend.append('meetingType', formData.meetingType);
    formDataToSend.append('notes', formData.notes);

    // Debug: Log what we're sending
    console.log('Uploading with form data:', {
      hcpName: formData.hcpName,
      hcpSpecialty: formData.hcpSpecialty,
      meetingDate: formData.meetingDate,
      meetingType: formData.meetingType,
      notes: formData.notes,
      fileName: fileData.file.name
    });

    try {
      setUploadProgress(prev => ({
        ...prev,
        [fileData.id]: 0,
      }));

      const response = await api.post('/upload', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(prev => ({
            ...prev,
            [fileData.id]: progress,
          }));
        },
      });

      console.log('✅ Upload successful, response:', response.data);
      console.log('✅ Transcript ID:', response.data.transcriptId);
      console.log('✅ Redirected state:', redirected);
      
      setFiles(prev =>
        prev.map(f =>
          f.id === fileData.id
            ? { ...f, status: 'completed', transcriptId: response.data.transcriptId }
            : f
        )
      );
      // Redirect to transcript editor page after first successful upload
      if (response.data.transcriptId && !redirectedRef.current) {
        console.log('🔄 Redirecting to transcript editor:', `/transcripts/${response.data.transcriptId}/edit`);
        setRedirected(true);
        redirectedRef.current = true;
        setSuccessMessage('Upload successful! Redirecting to transcript editor...');

        // Poll for transcript existence before redirecting
        const checkTranscriptExists = async (id, retries = 10, delay = 500) => {
          for (let i = 0; i < retries; i++) {
            try {
              const res = await api.get(`/transcripts/${id}`);
              if (res.data && res.data.transcript) return true;
            } catch (e) {
              // Not found yet
            }
            await new Promise(r => setTimeout(r, delay));
          }
          return false;
        };

        const doRedirect = async () => {
          const found = await checkTranscriptExists(response.data.transcriptId);
          if (found) {
            navigate(`/transcripts/${response.data.transcriptId}/edit`);
          } else {
            setSuccessMessage('Transcript not found after upload. Please try again.');
            redirectedRef.current = false;
          }
        };
        doRedirect();
      } else {
        console.log('❌ Not redirecting - transcriptId:', response.data.transcriptId, 'redirected:', redirectedRef.current);
      }
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      setFiles(prev =>
        prev.map(f =>
          f.id === fileData.id
            ? { ...f, status: 'error', error: error.response?.data?.message || error.message || 'Upload failed' }
            : f
        )
      );
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const pendingFiles = files.filter(f => f.status === 'pending');

    for (const fileData of pendingFiles) {
      setFiles(prev =>
        prev.map(f =>
          f.id === fileData.id ? { ...f, status: 'uploading' } : f
        )
      );
      await uploadFile(fileData);
    }

    setUploading(false);
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'uploading':
        return <Schedule color="warning" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <CloudUpload color="action" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'uploading':
        return 'warning';
      case 'error':
        return 'error';
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

  const getFileIcon = (file) => {
    if (file.type.startsWith('audio/')) {
      return <AudioFile />;
    } else if (file.type.startsWith('video/')) {
      return <VideoFile />;
    }
    return <AudioFile />;
  };

  // Reset redirect state when component unmounts
  useEffect(() => {
    return () => {
      redirectedRef.current = false;
      setRedirected(false);
      setSuccessMessage('');
    };
  }, []);

  const requiredFieldsFilled = formData.hcpName && formData.hcpSpecialty && formData.meetingDate;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Upload Recordings
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
        Upload audio or video recordings from HCP meetings for transcription and analysis
      </Typography>

      {/* Success Message */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Upload Form */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Meeting Information
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="HCP Name *"
                  value={formData.hcpName}
                  onChange={(e) => handleFormChange('hcpName', e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Specialty *"
                  value={formData.hcpSpecialty}
                  onChange={(e) => handleFormChange('hcpSpecialty', e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Meeting Date *"
                  type="date"
                  value={formData.meetingDate}
                  onChange={(e) => handleFormChange('meetingDate', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <FormControl fullWidth>
                  <InputLabel>Meeting Type</InputLabel>
                  <Select
                    value={formData.meetingType}
                    label="Meeting Type"
                    onChange={(e) => handleFormChange('meetingType', e.target.value)}
                  >
                    <MenuItem value="consultation">Consultation</MenuItem>
                    <MenuItem value="presentation">Presentation</MenuItem>
                    <MenuItem value="discussion">Discussion</MenuItem>
                    <MenuItem value="training">Training</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Notes"
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  fullWidth
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* File Upload Area */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Upload Files
              </Typography>
              
              {/* Drop Zone */}
              {!requiredFieldsFilled && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Please fill in HCP Name, Specialty, and Meeting Date before uploading files.
                </Alert>
              )}
              <Box {...getRootProps()} sx={{
                border: '2px dashed #ccc',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                backgroundColor: isDragActive ? 'grey.100' : 'background.paper',
                color: !requiredFieldsFilled ? 'grey.400' : 'inherit',
                pointerEvents: !requiredFieldsFilled ? 'none' : 'auto',
                opacity: !requiredFieldsFilled ? 0.5 : 1,
                mb: 3,
              }}>
                <input {...getInputProps()} disabled={!requiredFieldsFilled} />
                <CloudUpload sx={{ fontSize: 48, mb: 2 }} />
                <Typography variant="h6">
                  {isDragActive ? 'Drop the files here...' : 'Drag & drop audio/video files here, or click to select files'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Supported formats: .mp3, .wav, .mp4, .mkv
                </Typography>
              </Box>

              {/* File List */}
              {files.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Files ({files.length})
                  </Typography>
                  <List>
                    {files.map((fileData, index) => (
                      <React.Fragment key={fileData.id}>
                        <ListItem>
                          <ListItemIcon>
                            {getFileIcon(fileData.file)}
                          </ListItemIcon>
                          <ListItemText
                            primary={fileData.file.name}
                            secondary={`${formatFileSize(fileData.file.size)} • ${fileData.file.type}`}
                          />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {fileData.status === 'uploading' && (
                              <Box sx={{ width: 100 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={uploadProgress[fileData.id] || 0}
                                />
                              </Box>
                            )}
                            <Chip
                              label={fileData.status}
                              color={getStatusColor(fileData.status)}
                              size="small"
                              icon={getStatusIcon(fileData.status)}
                            />
                            <IconButton
                              size="small"
                              onClick={() => removeFile(fileData.id)}
                              disabled={fileData.status === 'uploading'}
                            >
                              <Delete />
                            </IconButton>
                          </Box>
                        </ListItem>
                        {fileData.error && (
                          <Alert severity="error" sx={{ ml: 4, mr: 4, mb: 1 }}>
                            {fileData.error}
                          </Alert>
                        )}
                        {index < files.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                  
                  {/* Manual Upload Button */}
                  {!requiredFieldsFilled && files.some(f => f.status === 'pending') && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      Please fill in all required fields (HCP Name, Specialty, Meeting Date) to upload files.
                    </Alert>
                  )}
                  
                  {requiredFieldsFilled && files.some(f => f.status === 'pending') && (
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                      <Button
                        variant="contained"
                        onClick={handleUpload}
                        disabled={uploading}
                        startIcon={<CloudUpload />}
                      >
                        {uploading ? 'Uploading...' : 'Upload Files'}
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Upload; 