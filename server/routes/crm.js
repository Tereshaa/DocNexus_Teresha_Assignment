const express = require('express');
const crmService = require('../services/crmService');
const Transcript = require('../models/Transcript');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Path to settings file
const SETTINGS_PATH = path.join(__dirname, '../crm-settings.json');

/**
 * POST /api/crm/sync
 * Sync transcript data to CRM
 */
router.post('/sync', async (req, res) => {
  try {
    const { transcriptId, preferredCRM = 'salesforce' } = req.body;
    
    if (!transcriptId) {
      return res.status(400).json({
        success: false,
        error: 'Transcript ID is required'
      });
    }

    // Find transcript
    const transcript = await Transcript.findById(transcriptId);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    if (transcript.transcriptionStatus !== 'completed' && transcript.transcriptionStatus !== 'edited') {
      return res.status(400).json({
        success: false,
        error: 'Transcript must be completed or edited before syncing to CRM'
      });
    }

    console.log(`🔄 Syncing transcript ${transcriptId} to CRM (${preferredCRM})...`);
    console.log('📋 Transcript data for sync:', {
      id: transcript._id,
      hcpName: transcript.hcpName,
      hcpSpecialty: transcript.hcpSpecialty,
      meetingDate: transcript.meetingDate,
      transcriptionStatus: transcript.transcriptionStatus,
      hasTranscript: !!(transcript.editedTranscript || transcript.rawTranscript),
      hasInsights: !!(transcript.keyInsights && transcript.keyInsights.length > 0),
      hasActionItems: !!(transcript.actionItems && transcript.actionItems.length > 0)
    });
    
    const syncResult = await crmService.syncToCRM(transcript, preferredCRM);
    console.log('🔄 Sync result:', syncResult);
    
    if (syncResult.success) {
      // Update transcript with sync status
      await Transcript.findByIdAndUpdate(transcriptId, {
        crmSyncStatus: 'synced',
        crmSyncDate: new Date(),
        crmRecordId: syncResult.recordId
      });

      console.log(`✅ CRM sync completed for transcript: ${transcriptId}`);
      
      res.json({
        success: true,
        message: 'Data synced to CRM successfully',
        data: syncResult
      });
    } else {
      // Update transcript with failed status
      await Transcript.findByIdAndUpdate(transcriptId, {
        crmSyncStatus: 'failed'
      });

      res.status(500).json({
        success: false,
        error: syncResult.error || 'Failed to sync to CRM',
        data: syncResult
      });
    }

  } catch (error) {
    console.error('❌ CRM sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/crm/batch-sync
 * Sync multiple transcripts to CRM
 */
router.post('/batch-sync', async (req, res) => {
  try {
    let { transcriptIds, preferredCRM = 'salesforce' } = req.body;
    
    // If no transcriptIds provided, get all pending transcripts
    if (!transcriptIds || !Array.isArray(transcriptIds) || transcriptIds.length === 0) {
      console.log('🔄 No transcript IDs provided, getting all pending transcripts...');
      const pendingTranscripts = await Transcript.find({
        $or: [
          { crmSyncStatus: { $exists: false } },
          { crmSyncStatus: 'pending' },
          { crmSyncStatus: 'failed' }
        ],
        transcriptionStatus: { $in: ['completed', 'edited'] }
      }).select('_id');
      
      transcriptIds = pendingTranscripts.map(t => t._id.toString());
      console.log(`🔄 Found ${transcriptIds.length} pending transcripts to sync`);
    }
    
    if (transcriptIds.length === 0) {
      return res.json({
        success: true,
        message: 'No transcripts to sync',
        results: [],
        errors: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 0
        }
      });
    }

    console.log(`🔄 Starting batch CRM sync for ${transcriptIds.length} transcripts`);

    const results = [];
    const errors = [];

    for (const transcriptId of transcriptIds) {
      try {
        // Find transcript
        const transcript = await Transcript.findById(transcriptId);
        
        if (!transcript) {
          errors.push({
            transcriptId,
            error: 'Transcript not found'
          });
          continue;
        }

        if (transcript.transcriptionStatus !== 'completed' && transcript.transcriptionStatus !== 'edited') {
          errors.push({
            transcriptId,
            error: 'Transcript not ready for sync'
          });
          continue;
        }

        // Sync to CRM
        const syncResult = await crmService.syncToCRM(transcript, preferredCRM);
        
        if (syncResult.success) {
          // Update transcript
          await Transcript.findByIdAndUpdate(transcriptId, {
            crmSyncStatus: 'synced',
            crmSyncDate: new Date(),
            crmRecordId: syncResult.recordId
          });

          results.push({
            transcriptId,
            success: true,
            data: syncResult
          });
        } else {
          // Update transcript with failed status
          await Transcript.findByIdAndUpdate(transcriptId, {
            crmSyncStatus: 'failed'
          });

          errors.push({
            transcriptId,
            error: syncResult.error || 'CRM sync failed',
            data: syncResult
          });
        }

      } catch (error) {
        errors.push({
          transcriptId,
          error: error.message
        });
      }
    }

    console.log(`✅ Batch CRM sync completed: ${results.length} successful, ${errors.length} failed`);

    res.json({
      success: true,
      results: results,
      errors: errors,
      summary: {
        total: transcriptIds.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error('❌ Batch CRM sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/status/:transcriptId
 * Get CRM sync status for a transcript
 */
router.get('/status/:transcriptId', async (req, res) => {
  try {
    const { transcriptId } = req.params;
    
    // Find transcript
    const transcript = await Transcript.findById(transcriptId);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    // Get detailed sync status
    const syncStatus = await crmService.getSyncStatus(transcriptId);
    
    if (!syncStatus.success) {
      return res.status(500).json({
        success: false,
        error: syncStatus.error
      });
    }

    res.json({
      success: true,
      data: {
        transcriptId: transcript._id,
        crmSyncStatus: transcript.crmSyncStatus,
        crmSyncDate: transcript.crmSyncDate,
        crmRecordId: transcript.crmRecordId,
        detailedStatus: syncStatus.status
      }
    });

  } catch (error) {
    console.error('❌ Get CRM status failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/status
 * Get overall CRM connection status and sync statistics
 */
router.get('/status', async (req, res) => {
  try {
    console.log('📊 Getting CRM status and statistics...');
    
    // Test Salesforce connection
    const salesforceResult = await crmService.initializeSalesforce();
    console.log('🔗 Salesforce connection result:', {
      success: salesforceResult.success,
      instanceUrl: salesforceResult.instanceUrl,
      error: salesforceResult.error
    });
    
    // Get sync statistics from database
    const Transcript = require('../models/Transcript');
    const totalTranscripts = await Transcript.countDocuments();
    const syncedTranscripts = await Transcript.countDocuments({ crmSyncStatus: 'synced' });
    const pendingTranscripts = await Transcript.countDocuments({ crmSyncStatus: 'pending' });
    const failedTranscripts = await Transcript.countDocuments({ crmSyncStatus: 'failed' });
    
    // Get last sync date
    const lastSynced = await Transcript.findOne({ crmSyncStatus: 'synced' })
      .sort({ crmSyncDate: -1 })
      .select('crmSyncDate');
    
    const successRate = totalTranscripts > 0 ? Math.round((syncedTranscripts / totalTranscripts) * 100) : 0;
    
    // Get all transcripts for sync status
    const allTranscripts = await Transcript.find({})
      .select('originalFileName hcpName hcpSpecialty crmSyncStatus crmSyncDate _id')
      .sort({ createdAt: -1 });
    
    // Format sync status data
    const syncStatus = allTranscripts.map(transcript => ({
      transcriptId: transcript._id,
      fileName: transcript.originalFileName || 'Unknown',
      hcpName: transcript.hcpName || 'Unknown',
      specialty: transcript.hcpSpecialty || 'Unknown',
      syncStatus: transcript.crmSyncStatus || 'pending',
      lastSync: transcript.crmSyncDate || null
    }));
    
    // Get pending syncs (transcripts that haven't been synced)
    const pendingSyncs = allTranscripts
      .filter(t => !t.crmSyncStatus || t.crmSyncStatus === 'pending')
      .map(transcript => ({
        transcriptId: transcript._id,
        fileName: transcript.originalFileName || 'Unknown',
        hcpName: transcript.hcpName || 'Unknown',
        specialty: transcript.hcpSpecialty || 'Unknown',
        syncStatus: transcript.crmSyncStatus || 'pending'
      }));
    
    // Get unique HCPs for HCP management
    const hcps = await Transcript.aggregate([
      {
        $group: {
          _id: '$hcpName',
          name: { $first: '$hcpName' },
          specialty: { $first: '$hcpSpecialty' },
          totalMeetings: { $sum: 1 },
          lastMeeting: { $max: '$createdAt' },
          crmId: { $first: '$crmRecordId' }
        }
      },
      {
        $match: {
          name: { $ne: null, $ne: '' }
        }
      },
      {
        $sort: { lastMeeting: -1 }
      }
    ]);
    
    const responseData = {
      success: true,
      data: {
        salesforce: {
          connected: salesforceResult.success,
          instanceUrl: salesforceResult.instanceUrl || null,
          error: salesforceResult.error || null
        },
        syncStats: {
          totalSynced: syncedTranscripts,
          pendingSync: pendingTranscripts,
          failedSync: failedTranscripts,
          successRate: successRate,
          lastSync: lastSynced?.crmSyncDate || null
        },
        syncStatus: syncStatus,
        pendingSyncs: pendingSyncs,
        hcps: hcps
      }
    };
    
    console.log('📊 CRM status response:', {
      salesforceConnected: responseData.data.salesforce.connected,
      totalTranscripts,
      syncedTranscripts,
      pendingTranscripts,
      syncStatusCount: syncStatus.length,
      pendingSyncsCount: pendingSyncs.length,
      hcpsCount: hcps.length
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Get CRM status failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/hcp/:hcpName
 * Search for HCP in CRM systems
 */
router.get('/hcp/:hcpName', async (req, res) => {
  try {
    const { hcpName } = req.params;
    const { crm = 'both' } = req.query;
    
    console.log(`🔍 Searching for HCP: ${hcpName} in CRM systems`);
    
    const results = {
      salesforce: null,
      veeva: null
    };

    // Search in Salesforce
    if (crm === 'salesforce' || crm === 'both') {
      results.salesforce = await crmService.getHCPFromSalesforce(hcpName);
    }

    // Search in Veeva
    if (crm === 'veeva' || crm === 'both') {
      results.veeva = await crmService.getHCPFromVeeva(hcpName);
    }

    res.json({
      success: true,
      data: results,
      hcpName: hcpName
    });

  } catch (error) {
    console.error('❌ HCP search failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/crm/initialize
 * Initialize CRM connections
 */
router.post('/initialize', async (req, res) => {
  try {
    const { crm = 'both' } = req.body;
    
    console.log('🔗 Initializing CRM connections...');
    
    const results = {
      salesforce: null,
      veeva: null
    };

    // Initialize Salesforce
    if (crm === 'salesforce' || crm === 'both') {
      results.salesforce = await crmService.initializeSalesforce();
    }

    // Initialize Veeva
    if (crm === 'veeva' || crm === 'both') {
      results.veeva = await crmService.initializeVeeva();
    }

    const overallSuccess = (results.salesforce && results.salesforce.success) || 
                          (results.veeva && results.veeva.success);

    if (overallSuccess) {
      console.log('✅ CRM connections initialized');
      res.json({
        success: true,
        message: 'CRM connections initialized successfully',
        data: results
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to initialize CRM connections',
        data: results
      });
    }

  } catch (error) {
    console.error('❌ CRM initialization failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/health
 * Check CRM service health
 */
router.get('/health', async (req, res) => {
  try {
    console.log('🏥 Checking CRM service health...');
    
    const healthStatus = {
      salesforce: 'unknown',
      veeva: 'unknown',
      timestamp: new Date().toISOString()
    };

    // Test Salesforce connection
    try {
      const sfResult = await crmService.initializeSalesforce();
      healthStatus.salesforce = sfResult.success ? 'connected' : 'error';
    } catch (error) {
      healthStatus.salesforce = 'error';
    }

    // Test Veeva connection
    try {
      const veevaResult = await crmService.initializeVeeva();
      healthStatus.veeva = veevaResult.success ? 'connected' : 'error';
    } catch (error) {
      healthStatus.veeva = 'error';
    }

    const overallHealth = healthStatus.salesforce === 'connected' || healthStatus.veeva === 'connected';

    res.json({
      success: overallHealth,
      status: overallHealth ? 'healthy' : 'unhealthy',
      data: healthStatus
    });

  } catch (error) {
    console.error('❌ CRM health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/crm/sync-stats
 * Get CRM sync statistics
 */
router.get('/sync-stats', async (req, res) => {
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

    // Get sync statistics
    const [
      totalTranscripts,
      syncedTranscripts,
      failedTranscripts,
      pendingTranscripts,
      syncSuccessRate
    ] = await Promise.all([
      Transcript.countDocuments(filter),
      Transcript.countDocuments({ ...filter, crmSyncStatus: 'synced' }),
      Transcript.countDocuments({ ...filter, crmSyncStatus: 'failed' }),
      Transcript.countDocuments({ ...filter, crmSyncStatus: 'pending' }),
      Transcript.aggregate([
        { $match: filter },
        { $group: { _id: '$crmSyncStatus', count: { $sum: 1 } } }
      ])
    ]);

    // Calculate success rate
    const totalProcessed = syncedTranscripts + failedTranscripts;
    const successRate = totalProcessed > 0 ? (syncedTranscripts / totalProcessed) * 100 : 0;

    // Get recent sync activity
    const recentSyncs = await Transcript.find({
      ...filter,
      crmSyncDate: { $exists: true }
    })
    .sort({ crmSyncDate: -1 })
    .limit(10)
    .select('hcpName crmSyncStatus crmSyncDate');

    console.log('✅ Retrieved CRM sync statistics');

    res.json({
      success: true,
      data: {
        total: totalTranscripts,
        synced: syncedTranscripts,
        failed: failedTranscripts,
        pending: pendingTranscripts,
        successRate: successRate.toFixed(2),
        syncDistribution: syncSuccessRate,
        recentSyncs: recentSyncs
      }
    });

  } catch (error) {
    console.error('❌ Get CRM sync stats failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/tasks
 * Check existing Task records in Salesforce
 */
router.get('/tasks', async (req, res) => {
  try {
    console.log('🔍 Checking existing Salesforce tasks...');
    
    const result = await crmService.checkExistingTasks();
    
    if (result.success) {
      res.json({
        success: true,
        data: result.tasks,
        message: `Found ${result.tasks.length} meeting tasks`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Check tasks failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/test-connection
 * Test CRM connection (Salesforce only)
 */
router.get('/test-connection', async (req, res) => {
  try {
    const { type } = req.query;
    
    if (type !== 'salesforce') {
      return res.status(400).json({
        success: false,
        error: 'Only Salesforce is supported for connection testing'
      });
    }

    console.log('🔗 Testing Salesforce connection...');
    
    // Test the connection using environment variables
    const result = await crmService.initializeSalesforce();
    
    if (result.success) {
      console.log('✅ Salesforce connection test successful');
      res.json({
        success: true,
        message: 'Salesforce connection successful',
        data: {
          instanceUrl: result.instanceUrl,
          connected: true
        }
      });
    } else {
      console.log('❌ Salesforce connection test failed');
      res.status(500).json({
        success: false,
        error: result.error || 'Connection failed - check your environment variables'
      });
    }
  } catch (error) {
    console.error('❌ Test connection failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/crm/test-connection
 * Test CRM connection (Salesforce only) - POST version
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { type } = req.body;
    
    if (type !== 'salesforce') {
      return res.status(400).json({
        success: false,
        error: 'Only Salesforce is supported for connection testing'
      });
    }

    console.log('🔗 Testing Salesforce connection...');
    
    // Test the connection using environment variables
    const result = await crmService.initializeSalesforce();
    
    if (result.success) {
      console.log('✅ Salesforce connection test successful');
      res.json({
        success: true,
        message: 'Salesforce connection successful',
        data: {
          instanceUrl: result.instanceUrl,
          connected: true
        }
      });
    } else {
      console.log('❌ Salesforce connection test failed');
      res.status(500).json({
        success: false,
        error: result.error || 'Connection failed - check your environment variables'
      });
    }
  } catch (error) {
    console.error('❌ Test connection failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/config
 * Check CRM configuration (environment variables)
 */
router.get('/config', async (req, res) => {
  try {
    const config = {
      salesforce: {
        username: process.env.SALESFORCE_USERNAME ? 'Set' : 'Not set',
        password: process.env.SALESFORCE_PASSWORD ? 'Set' : 'Not set',
        securityToken: process.env.SALESFORCE_SECURITY_TOKEN ? 'Set' : 'Not set',
        clientId: process.env.SALESFORCE_CLIENT_ID ? 'Set' : 'Not set',
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET ? 'Set' : 'Not set',
        loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
      }
    };
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 