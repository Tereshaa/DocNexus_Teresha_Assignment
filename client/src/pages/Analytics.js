import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  TrendingUp,
  SentimentSatisfied,
  SentimentNeutral,
  SentimentDissatisfied,
  Business,
  Schedule,
  Person,
  MedicalServices,
  Description,
} from '@mui/icons-material';
import api from '../services/api';
import { formatDateIST } from '../utils/dateUtils';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [hcpSort, setHCPSort] = useState('meetings'); // 'meetings' or 'sentiment'

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/transcripts/analytics', {
        params: {
          timeRange,
          specialty: specialtyFilter !== 'all' ? specialtyFilter : undefined,
          sortByHCP: hcpSort,
        },
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, specialtyFilter, hcpSort]);

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

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  if (!analytics) {
    return (
      <Alert severity="error">
        Failed to load analytics data
      </Alert>
    );
  }

  // Convert sentimentDistribution object to array for mapping
  const sentimentArray = Object.entries(analytics.sentimentDistribution || {}).map(([sentiment, count]) => {
    const total = Object.values(analytics.sentimentDistribution || {}).reduce((a, b) => a + b, 0);
    return {
      sentiment,
      count,
      percentage: total ? Math.round((count / total) * 100) : 0,
    };
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Analytics & Insights
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small">
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Specialty</InputLabel>
            <Select
              value={specialtyFilter}
              label="Specialty"
              onChange={(e) => setSpecialtyFilter(e.target.value)}
            >
              <MenuItem value="all">All Specialties</MenuItem>
              {analytics.specialties?.map(specialty => (
                <MenuItem key={specialty} value={specialty}>
                  {specialty}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Description color="primary" />
                <Typography variant="h6">Total Transcripts</Typography>
              </Box>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {analytics.totalTranscripts || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {analytics.transcriptGrowth > 0 ? '+' : ''}{analytics.transcriptGrowth || 0}% from last period
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person color="primary" />
                <Typography variant="h6">Unique HCPs</Typography>
              </Box>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {analytics.uniqueHCPs || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {analytics.hcpGrowth > 0 ? '+' : ''}{analytics.hcpGrowth || 0}% from last period
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule color="primary" />
                <Typography variant="h6">Avg Duration</Typography>
              </Box>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {analytics.averageDuration ? Math.round(analytics.averageDuration / 60) : 0}m
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Per meeting
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sentiment Analysis */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Specialties
              </Typography>
              <List>
                {analytics.topSpecialties?.map((specialty, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <MedicalServices color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={specialty.name}
                      secondary={`${specialty.count} meetings`}
                    />
                    <Chip
                      label={`${specialty.percentage}%`}
                      variant="outlined"
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Trends and Patterns */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Meeting Trends
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Week</TableCell>
                      <TableCell>Meetings</TableCell>
                      <TableCell>Avg Duration</TableCell>
                      <TableCell>Sentiment</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.weeklyTrends?.map((week, index) => (
                      <TableRow key={index}>
                        <TableCell>{week.week}</TableCell>
                        <TableCell>{week.meetings}</TableCell>
                        <TableCell>{Math.round(week.avgDuration / 60)}m</TableCell>
                        <TableCell>
                          <Chip
                            label={week.sentiment}
                            color={getSentimentColor(week.sentiment)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Key Insights
              </Typography>
              <List>
                {analytics.keyInsights?.map((insight, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <TrendingUp color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={insight} />
                  </ListItem>
                ))}
              </List>
              {(!analytics.keyInsights || analytics.keyInsights.length === 0) && (
                <Typography color="textSecondary" align="center">
                  No insights available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top HCPs */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Top Healthcare Providers
            </Typography>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={hcpSort}
                label="Sort By"
                onChange={e => setHCPSort(e.target.value)}
              >
                <MenuItem value="meetings">Number of Meetings</MenuItem>
                <MenuItem value="sentiment">Sentiment</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>HCP Name</TableCell>
                  <TableCell>Specialty</TableCell>
                  <TableCell>Meetings</TableCell>
                  <TableCell>Avg Duration</TableCell>
                  <TableCell>Sentiment</TableCell>
                  <TableCell>Last Meeting</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analytics.topHCPs?.map((hcp, index) => (
                  <TableRow key={index}>
                    <TableCell>{hcp.name}</TableCell>
                    <TableCell>{hcp.specialty}</TableCell>
                    <TableCell>{hcp.meetings}</TableCell>
                    <TableCell>{Math.round(hcp.avgDuration / 60)}m</TableCell>
                    <TableCell>
                      <Chip
                        label={hcp.sentiment}
                        color={getSentimentColor(hcp.sentiment)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {hcp.lastMeeting ? formatDateIST(hcp.lastMeeting) : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Analytics; 