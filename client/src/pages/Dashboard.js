import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Avatar,
  Divider,
} from '@mui/material';
import {
  CloudUpload,
  Description,
  Business,
  PictureAsPdf,
  TrendingUp,
  Schedule,
  CheckCircle,
  Error,
  Warning,
  CalendarToday,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatDateIST } from '../utils/dateUtils';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalTranscripts: 0,
    pendingTranscriptions: 0,
    completedAnalyses: 0,
    crmSyncs: 0,
    documentsGenerated: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, activityResponse] = await Promise.all([
        api.get('/transcripts/stats'),
        api.get('/transcripts?limit=3&sort=-createdAt'),
      ]);

      setStats(statsResponse.data.stats);
      setRecentActivity(Array.isArray(activityResponse.data.data) ? activityResponse.data.data : []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'processing':
        return <Schedule color="warning" />;
      case 'failed':
        return <Error color="error" />;
      default:
        return <Warning color="default" />;
    }
  };

  const StatCard = ({ title, value, icon, color, onClick }) => (
    <Card 
      sx={{ 
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { boxShadow: 3 } : {},
        transition: 'box-shadow 0.3s ease-in-out',
        minHeight: 120, // Ensures all cards are the same height
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      onClick={onClick}
    >
      <CardContent sx={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography color="textSecondary" gutterBottom variant="h6">
            {title}
          </Typography>
          <Typography variant="h4" component="div" color={color}>
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: color, width: 40, height: 40 }}>
          {React.cloneElement(icon, { fontSize: 'medium' })}
        </Avatar>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  console.log('Recent Activity:', recentActivity);
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
  

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Transcripts"
            value={stats.totalTranscripts}
            icon={<Description />}
            color="primary.main"
            onClick={() => navigate('/transcripts')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="CRM Syncs"
            value={stats.crmSyncs}
            icon={<Business />}
            color="warning.main"
            onClick={() => navigate('/crm')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Documents Generated"
            value={stats.documentsGenerated}
            icon={<PictureAsPdf />}
            color="secondary.main"
            onClick={() => navigate('/documents')}
          />
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <List>
                {recentActivity.map((activity, index) => (
                  <React.Fragment key={activity._id}>
                    <ListItem>
                      <ListItemIcon>
                        {getStatusIcon(activity.transcriptionStatus)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          activity.originalFileName
                            || (activity.hcpName && activity.meetingDate
                                  ? `${activity.hcpName} (${formatDateIST(activity.meetingDate)})`
                                  : 'Untitled Transcript')
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Typography variant="body2" color="text.secondary">
                              {activity.hcpName || 'Unknown HCP'}
                            </Typography>
                            <CalendarToday sx={{ fontSize: 16, color: 'text.secondary', ml: 0.5, mr: 0.5 }} />
                            <Typography variant="body2" color="text.secondary">
                              {formatDateIST(activity.createdAt)}
                            </Typography>
                          </Box>
                        }
                      />
                      <Chip
                        label={activity.transcriptionStatus}
                        color={getStatusColor(activity.transcriptionStatus)}
                        size="small"
                        sx={{
                          color: activity.transcriptionStatus === 'completed' ? '#fff' : undefined,
                        }}
                      />
                    </ListItem>
                    {index < recentActivity.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              {recentActivity.length === 0 && (
                <Typography color="textSecondary" align="center" sx={{ py: 2 }}>
                  No recent activity
                </Typography>
              )}
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/transcripts')}
                >
                  View All Transcripts
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<CloudUpload />}
                  onClick={() => navigate('/upload')}
                  fullWidth
                >
                  Upload New Recording
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Description />}
                  onClick={() => navigate('/transcripts')}
                  fullWidth
                >
                  View Transcripts
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Business />}
                  onClick={() => navigate('/crm')}
                  fullWidth
                >
                  CRM Integration
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PictureAsPdf />}
                  onClick={() => navigate('/documents')}
                  fullWidth
                >
                  Generate Documents
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 