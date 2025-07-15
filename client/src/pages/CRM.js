import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Business,
  Sync,
  CheckCircle,
  Error,
  Schedule,
  Person,
  Settings,
  Edit,
  Warning,
  CloudUpload,
} from '@mui/icons-material';
import { IconButton, List, ListItem, ListItemText } from '@mui/material';
import api from '../services/api';

const CRM = () => {
  const [crmData, setCrmData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [selectedTranscripts, setSelectedTranscripts] = useState([]);

  // Refresh CRM data on page focus
  useEffect(() => {
    const handleFocus = () => {
      fetchCRMData();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    fetchCRMData();
  }, []);

  const fetchCRMData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/crm/status');
      setCrmData(response.data.data);
    } catch (error) {
      console.error('Error fetching CRM data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debug print for crmData
  if (crmData) {
    // eslint-disable-next-line
    console.log('CRM DATA:', crmData);
  }

  const testConnection = async (crmType) => {
    try {
      const response = await api.get(`/crm/test-connection?type=${crmType}`);
      alert(response.data.message);
      await fetchCRMData();
    } catch (error) {
      alert('Connection test failed: ' + (error.response?.data?.message || error.message));
      await fetchCRMData();
    }
  };

  // Fix: allow handleSync to accept an array of transcript IDs
  const handleSync = async (ids) => {
    try {
      setSyncInProgress(true);
      await api.post('/crm/sync', {
        transcriptId: Array.isArray(ids) ? ids[0] : ids,
      });
      await fetchCRMData();
      setSyncDialogOpen(false);
      setSelectedTranscripts([]);
    } catch (error) {
      console.error('Error syncing to CRM:', error);
      await fetchCRMData();
    } finally {
      setSyncInProgress(false);
    }
  };

  const handleBatchSync = async () => {
    try {
      setSyncInProgress(true);
      await api.post('/crm/batch-sync');
      await fetchCRMData();
    } catch (error) {
      console.error('Error batch syncing to CRM:', error);
      await fetchCRMData();
    } finally {
      setSyncInProgress(false);
    }
  };

  const getSyncStatusColor = (status) => {
    switch (status) {
      case 'synced':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getSyncStatusIcon = (status) => {
    switch (status) {
      case 'synced':
        return <CheckCircle color="success" />;
      case 'pending':
        return <Schedule color="warning" />;
      case 'failed':
        return <Error color="error" />;
      default:
        return <Warning color="action" />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          CRM Integration
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Sync />}
            onClick={() => setSyncDialogOpen(true)}
          >
            Sync Selected
          </Button>
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={handleBatchSync}
            disabled={syncInProgress}
          >
            {syncInProgress ? 'Syncing...' : 'Batch Sync'}
          </Button>
        </Box>
      </Box>

      {/* Connection Status */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Business color="primary" />
                <Typography variant="h6">Salesforce</Typography>
                <Chip
                  label={crmData?.salesforce?.connected ? 'Connected' : 'Disconnected'}
                  color={crmData?.salesforce?.connected ? 'success' : 'error'}
                  size="small"
                />
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                {crmData?.salesforce?.connected 
                  ? `Connected to ${crmData.salesforce.instanceUrl}`
                  : 'Not connected to Salesforce'
                }
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ mb: 2, display: 'block' }}>
                Credentials are managed via environment variables (SALESFORCE_USERNAME, SALESFORCE_PASSWORD, etc.)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => testConnection('salesforce')}
                >
                  Test Connection
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sync Statistics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Synced
              </Typography>
              <Typography variant="h4">
                {crmData?.syncStats?.totalSynced || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Transcripts synced to CRM
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pending Sync
              </Typography>
              <Typography variant="h4">
                {crmData?.syncStats?.pendingSync || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Transcripts waiting to sync
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sync Success Rate
              </Typography>
              <Typography variant="h4">
                {crmData?.syncStats?.successRate || 0}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Successful syncs
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Last Sync
              </Typography>
              <Typography variant="h4">
                {crmData?.syncStats?.lastSync 
                  ? new Date(crmData.syncStats.lastSync).toLocaleDateString()
                  : 'Never'
                }
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Most recent sync
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Sync Status" icon={<Sync />} />
          <Tab label="HCP Management" icon={<Person />} />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Transcript Sync Status
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>File Name</TableCell>
                    <TableCell>HCP Name</TableCell>
                    <TableCell>Specialty</TableCell>
                    <TableCell>Sync Status</TableCell>
                    <TableCell>Last Sync</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {crmData?.syncStatus?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.fileName}</TableCell>
                      <TableCell>{item.hcpName}</TableCell>
                      <TableCell>{item.specialty}</TableCell>
                      <TableCell>
                        <Chip
                          label={item.syncStatus}
                          color={getSyncStatusColor(item.syncStatus)}
                          icon={getSyncStatusIcon(item.syncStatus)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {item.lastSync 
                          ? new Date(item.lastSync).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleSync(item.transcriptId)}
                          disabled={item.syncStatus === 'synced'}
                        >
                          <Sync />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Healthcare Provider Management
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>HCP Name</TableCell>
                    <TableCell>Specialty</TableCell>
                    <TableCell>CRM ID</TableCell>
                    <TableCell>Last Meeting</TableCell>
                    <TableCell>Total Meetings</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {crmData?.hcps?.map((hcp, index) => (
                    <TableRow key={index}>
                      <TableCell>{hcp.name}</TableCell>
                      <TableCell>{hcp.specialty}</TableCell>
                      <TableCell>{hcp.crmId || 'Not synced'}</TableCell>
                      <TableCell>
                        {hcp.lastMeeting 
                          ? new Date(hcp.lastMeeting).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>{hcp.totalMeetings}</TableCell>
                      <TableCell>
                        <IconButton size="small">
                          <Edit />
                        </IconButton>
                        <IconButton size="small">
                          <Sync />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Sync Transcripts to CRM</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Select transcripts to sync to your configured CRM systems:
          </Typography>
          <List>
            {crmData?.pendingSyncs?.map((transcript, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={transcript.fileName}
                  secondary={`${transcript.hcpName} • ${transcript.specialty}`}
                />
                <Chip
                  label={transcript.syncStatus}
                  color={getSyncStatusColor(transcript.syncStatus)}
                  size="small"
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSync} 
            variant="contained"
            disabled={syncInProgress || selectedTranscripts.length === 0}
          >
            {syncInProgress ? 'Syncing...' : 'Sync Selected'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CRM; 