const express = require('express');
const openaiService = require('../services/openaiService');
const Transcript = require('../models/Transcript');

const router = express.Router();

/**
 * GET /api/transcripts/stats
 * Returns dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const totalTranscripts = await Transcript.countDocuments();
    const pendingTranscriptions = await Transcript.countDocuments({ transcriptionStatus: 'pending' });
    const completedAnalyses = await Transcript.countDocuments({ transcriptionStatus: 'completed' });
    const crmSyncs = await Transcript.countDocuments({ crmSyncStatus: 'synced' });
    // Count all generated documents (PDF + PPT)
    const documents = await Transcript.aggregate([
      { $unwind: '$generatedDocuments' },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    const documentsGenerated = documents[0]?.count || 0;

    res.json({
      success: true,
      stats: {
        totalTranscripts,
        pendingTranscriptions,
        completedAnalyses,
        crmSyncs,
        documentsGenerated
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transcripts/analytics
 * Returns analytics data for the Analytics page
 */
router.get('/analytics', async (req, res) => {
  try {
    // Parse query params
    const { timeRange = '30d', specialty } = req.query;
    // Calculate date range
    let startDate;
    const now = new Date();
    if (timeRange === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (timeRange === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (timeRange === '90d') startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (timeRange === '1y') startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    else startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build filter
    const filter = { createdAt: { $gte: startDate } };
    if (specialty && specialty !== 'all') {
      filter.hcpSpecialty = specialty;
    }

    // Get all specialties for filter dropdown
    const specialties = await Transcript.distinct('hcpSpecialty', { hcpSpecialty: { $ne: null } });

    // Get analytics for current period
    const transcripts = await Transcript.find(filter);
    const totalTranscripts = transcripts.length;
    const uniqueHCPs = new Set(transcripts.map(t => t.hcpName).filter(Boolean)).size;
    const averageDuration = transcripts.reduce((sum, t) => sum + (t.meetingDuration || 0), 0) / (totalTranscripts || 1);

    // Sentiment distribution
    const sentimentDistribution = { positive: 0, negative: 0, neutral: 0 };
    transcripts.forEach(t => {
      const sentiment = t.sentimentAnalysis?.overall?.toLowerCase();
      if (sentiment === 'positive') sentimentDistribution.positive++;
      else if (sentiment === 'negative') sentimentDistribution.negative++;
      else if (sentiment === 'neutral') sentimentDistribution.neutral++;
    });

    // Growth calculation (compare to previous period)
    let prevStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    let prevEndDate = startDate;
    const prevFilter = { createdAt: { $gte: prevStartDate, $lt: prevEndDate } };
    if (specialty && specialty !== 'all') {
      prevFilter.hcpSpecialty = specialty;
    }
    const prevTranscripts = await Transcript.find(prevFilter);
    const prevTotalTranscripts = prevTranscripts.length;
    const prevUniqueHCPs = new Set(prevTranscripts.map(t => t.hcpName).filter(Boolean)).size;
    const transcriptGrowth = prevTotalTranscripts === 0 ? 100 : Math.round(((totalTranscripts - prevTotalTranscripts) / prevTotalTranscripts) * 100);
    const hcpGrowth = prevUniqueHCPs === 0 ? 100 : Math.round(((uniqueHCPs - prevUniqueHCPs) / prevUniqueHCPs) * 100);

    // Top Specialties
    const specialtyCounts = {};
    transcripts.forEach(t => {
      if (t.hcpSpecialty) {
        specialtyCounts[t.hcpSpecialty] = (specialtyCounts[t.hcpSpecialty] || 0) + 1;
      }
    });
    const totalSpecialtyMeetings = Object.values(specialtyCounts).reduce((a, b) => a + b, 0);
    const topSpecialties = Object.entries(specialtyCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalSpecialtyMeetings ? Math.round((count / totalSpecialtyMeetings) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Weekly Trends (group by week)
    const weekMap = {};
    transcripts.forEach(t => {
      if (!t.meetingDate) return;
      const d = new Date(t.meetingDate);
      const year = d.getFullYear();
      const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
      const key = `${year}-W${week}`;
      if (!weekMap[key]) weekMap[key] = { week: key, meetings: 0, totalDuration: 0, sentiments: [] };
      weekMap[key].meetings++;
      weekMap[key].totalDuration += t.meetingDuration || 0;
      if (t.sentimentAnalysis?.overall) weekMap[key].sentiments.push(t.sentimentAnalysis.overall);
    });
    const weeklyTrends = Object.values(weekMap).map(w => {
      // Most common sentiment for the week
      const sentimentCounts = {};
      w.sentiments.forEach(s => { sentimentCounts[s] = (sentimentCounts[s] || 0) + 1; });
      const sentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Neutral';
      return {
        week: w.week,
        meetings: w.meetings,
        avgDuration: w.meetings ? w.totalDuration / w.meetings : 0,
        sentiment
      };
    }).sort((a, b) => a.week.localeCompare(b.week));

    // Key Insights (top 5 most recent)
    const allInsights = [];
    transcripts.forEach(t => {
      if (Array.isArray(t.keyInsights)) {
        t.keyInsights.forEach(i => allInsights.push(i.insight));
      }
    });
    const keyInsights = allInsights.slice(0, 5);

    // Top HCPs (by number of meetings or sentiment)
    const sortByHCP = req.query.sortByHCP || 'meetings';
    const hcpMap = {};
    transcripts.forEach(t => {
      if (!t.hcpName) return;
      if (!hcpMap[t.hcpName]) {
        hcpMap[t.hcpName] = {
          name: t.hcpName,
          specialty: t.hcpSpecialty || '',
          meetings: 0,
          totalDuration: 0,
          sentiments: [],
          lastMeeting: t.meetingDate || t.createdAt
        };
      }
      hcpMap[t.hcpName].meetings++;
      hcpMap[t.hcpName].totalDuration += t.meetingDuration || 0;
      if (t.sentimentAnalysis?.overall) hcpMap[t.hcpName].sentiments.push(t.sentimentAnalysis.overall);
      if (t.meetingDate && new Date(t.meetingDate) > new Date(hcpMap[t.hcpName].lastMeeting)) {
        hcpMap[t.hcpName].lastMeeting = t.meetingDate;
      }
    });
    const sentimentOrder = { 'positive': 2, 'neutral': 1, 'negative': 0 };
    const topHCPs = Object.values(hcpMap)
      .map(hcp => {
        // Most common sentiment
        const sentimentCounts = {};
        hcp.sentiments.forEach(s => { sentimentCounts[s] = (sentimentCounts[s] || 0) + 1; });
        // Find the most common sentiment, case-insensitive
        let sentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Neutral';
        sentiment = sentiment?.toLowerCase?.() || 'neutral';
        // Sentiment score: Positive=1, Neutral=0, Negative=-1
        const sentimentScore = hcp.sentiments.length
          ? hcp.sentiments.reduce((sum, s) => sum + (s.toLowerCase() === 'positive' ? 1 : s.toLowerCase() === 'negative' ? -1 : 0), 0) / hcp.sentiments.length
          : 0;
        return {
          name: hcp.name,
          specialty: hcp.specialty,
          meetings: hcp.meetings,
          avgDuration: hcp.meetings ? hcp.totalDuration / hcp.meetings : 0,
          sentiment,
          sentimentScore,
          lastMeeting: hcp.lastMeeting
        };
      })
      .sort((a, b) => {
        if (sortByHCP === 'sentiment') {
          // Sort by most common sentiment: Positive > Neutral > Negative (case-insensitive)
          const aOrder = sentimentOrder[a.sentiment] ?? -1;
          const bOrder = sentimentOrder[b.sentiment] ?? -1;
          if (bOrder !== aOrder) return bOrder - aOrder;
          // If same sentiment, sort by meetings desc
          return b.meetings - a.meetings;
        } else {
          // Default: sort by meetings (desc)
          return b.meetings - a.meetings;
        }
      })
      .slice(0, 5);

    res.json({
      success: true,
      totalTranscripts,
      transcriptGrowth,
      uniqueHCPs,
      hcpGrowth,
      averageDuration,
      specialties,
      sentimentDistribution,
      topSpecialties,
      weeklyTrends,
      keyInsights,
      topHCPs
    });
  } catch (error) {
    console.error('❌ Analytics endpoint failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transcripts
 * Get all transcripts with pagination and filtering
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      hcpName,
      specialty,
      startDate,
      endDate,
      organization,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) {
      filter.transcriptionStatus = status;
    }
    
    if (hcpName) {
      filter.hcpName = { $regex: hcpName, $options: 'i' };
    }
    
    if (specialty) {
      filter.hcpSpecialty = { $regex: specialty, $options: 'i' };
    }
    
    if (startDate || endDate) {
      filter.meetingDate = {};
      if (startDate) filter.meetingDate.$gte = new Date(startDate);
      if (endDate) filter.meetingDate.$lte = new Date(endDate);
    }
    
    if (organization) {
      filter.organization = organization;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query
    const transcripts = await Transcript.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-rawTranscript -editedTranscript') // Exclude large text fields, but keep keyInsights and actionItems
      .lean();

    // Get total count
    const total = await Transcript.countDocuments(filter);

    // Ensure keyInsights and actionItems are always present (default to empty array if missing)
    transcripts.forEach(t => {
      if (!t.keyInsights) t.keyInsights = [];
      if (!t.actionItems) t.actionItems = [];
    });

    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Retrieved ${transcripts.length} transcripts`);
    }

    res.json({
      success: true,
      data: transcripts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Get transcripts failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/transcripts/:id
 * Get specific transcript by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const transcript = await Transcript.findById(id);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    console.log(`✅ Retrieved transcript: ${id}`);

    res.json({
      success: true,
      data: transcript
    });

  } catch (error) {
    console.error('❌ Get transcript failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/transcripts/:id
 * Update transcript (mainly for editing)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Find transcript
    const transcript = await Transcript.findById(id);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    // Validate updateable fields
    const allowedFields = [
      'editedTranscript',
      'hcpName',
      'hcpSpecialty',
      'meetingDate',
      'attendees',
      'keyInsights',
      'actionItems'
    ];

    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });

    // Update transcript
    const updatedTranscript = await Transcript.findByIdAndUpdate(
      id,
      filteredData,
      { new: true, runValidators: true }
    );

    console.log(`✅ Updated transcript: ${id}`);

    res.json({
      success: true,
      data: updatedTranscript,
      message: 'Transcript updated successfully'
    });

  } catch (error) {
    console.error('❌ Update transcript failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});



/**
 * POST /api/transcripts/:id/reanalyze
 * Re-analyze transcript with updated text
 */
router.post('/:id/reanalyze', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find transcript
    const transcript = await Transcript.findById(id);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    // Use edited transcript if available, otherwise use raw transcript
    const transcriptText = transcript.editedTranscript || transcript.rawTranscript;
    
    if (!transcriptText) {
      return res.status(400).json({
        success: false,
        error: 'No transcript text available for analysis'
      });
    }

    console.log(`🧠 Re-analyzing transcript: ${id}`);

    // Perform sentiment analysis
    const sentimentResult = await openaiService.analyzeSentiment(transcriptText);
    
    if (!sentimentResult.success) {
      throw new Error(`Sentiment analysis failed: ${sentimentResult.error}`);
    }

    // Extract key insights
    const insightsResult = await openaiService.extractKeyInsights(transcriptText);
    
    if (!insightsResult.success) {
      throw new Error(`Insights extraction failed: ${insightsResult.error}`);
    }

    // Log the sentimentResult for debugging
    console.log('SENTIMENT RESULT:', JSON.stringify(sentimentResult, null, 2));
    // Update transcript with new analysis
    const updatedTranscript = await Transcript.findByIdAndUpdate(
      id,
      {
        sentimentAnalysis: {
          overall: sentimentResult.overall,
          score: sentimentResult.score,
          details: sentimentResult.details,
          explanations: sentimentResult.explanations // <-- add explanations
        },
        keyInsights: insightsResult.keyInsights || [],
        actionItems: insightsResult.actionItems || []
      },
      { new: true }
    );

    console.log(`✅ Transcript re-analyzed: ${id}`);

    res.json({
      success: true,
      data: updatedTranscript,
      message: 'Transcript re-analyzed successfully'
    });

  } catch (error) {
    console.error('❌ Re-analyze transcript failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/transcripts/:id
 * Delete transcript
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const transcript = await Transcript.findById(id);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    // Delete from database
    await Transcript.findByIdAndDelete(id);

    console.log(`✅ Deleted transcript: ${id}`);

    res.json({
      success: true,
      message: 'Transcript deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete transcript failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/transcripts/stats/overview
 * Get transcript statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { organization, startDate, endDate } = req.query;
    
    // Build filter
    const filter = {};
    if (organization) filter.organization = organization;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Get statistics
    const [
      totalTranscripts,
      completedTranscripts,
      failedTranscripts,
      pendingTranscripts,
      totalDuration,
      averageConfidence
    ] = await Promise.all([
      Transcript.countDocuments(filter),
      Transcript.countDocuments({ ...filter, transcriptionStatus: 'completed' }),
      Transcript.countDocuments({ ...filter, transcriptionStatus: 'failed' }),
      Transcript.countDocuments({ ...filter, transcriptionStatus: 'pending' }),
      Transcript.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$meetingDuration' } } }
      ]),
      Transcript.aggregate([
        { $match: { ...filter, transcriptionStatus: 'completed' } },
        { $group: { _id: null, avg: { $avg: '$transcriptionConfidence' } } }
      ])
    ]);

    // Get sentiment distribution
    const sentimentStats = await Transcript.aggregate([
      { $match: { ...filter, transcriptionStatus: 'completed' } },
      { $group: { _id: '$sentimentAnalysis.overall', count: { $sum: 1 } } }
    ]);

    // Get top specialties
    const topSpecialties = await Transcript.aggregate([
      { $match: filter },
      { $group: { _id: '$hcpSpecialty', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    console.log('✅ Retrieved transcript statistics');

    res.json({
      success: true,
      data: {
        total: totalTranscripts,
        completed: completedTranscripts,
        failed: failedTranscripts,
        pending: pendingTranscripts,
        totalDuration: totalDuration[0]?.total || 0,
        averageConfidence: averageConfidence[0]?.avg || 0,
        sentimentDistribution: sentimentStats,
        topSpecialties: topSpecialties
      }
    });

  } catch (error) {
    console.error('❌ Get statistics failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/transcripts/search
 * Search transcripts
 */
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Build search filter
    const searchFilter = {
      $or: [
        { hcpName: { $regex: q, $options: 'i' } },
        { hcpSpecialty: { $regex: q, $options: 'i' } },
        { rawTranscript: { $regex: q, $options: 'i' } },
        { editedTranscript: { $regex: q, $options: 'i' } }
      ]
    };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute search
    const transcripts = await Transcript.find(searchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-rawTranscript -editedTranscript');

    // Get total count
    const total = await Transcript.countDocuments(searchFilter);

    console.log(`✅ Search completed: ${transcripts.length} results found`);

    res.json({
      success: true,
      data: transcripts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      query: q
    });

  } catch (error) {
    console.error('❌ Search failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 