const express = require('express');
const openaiService = require('../services/openaiService');
const Transcript = require('../models/Transcript');

const router = express.Router();

/**
 * POST /api/ai/transcribe
 * Transcribe audio/video file
 */
router.post('/transcribe', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      });
    }

    const result = await openaiService.transcribeFile(filePath);
    
    res.json({
      success: true,
      transcription: result
    });
  } catch (error) {
    console.error('❌ Transcription request failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/sentiment
 * Analyze sentiment of text
 */
router.post('/sentiment', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const result = await openaiService.analyzeSentiment(text);
    
    res.json({
      success: true,
      sentiment: result
    });
  } catch (error) {
    console.error('❌ Sentiment analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/insights
 * Extract key insights from text
 */
router.post('/insights', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const result = await openaiService.extractKeyInsights(text);
    
    res.json({
      success: true,
      insights: result
    });
  } catch (error) {
    console.error('❌ Insights extraction failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/summary
 * Generate executive summary
 */
router.post('/summary', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const result = await openaiService.generateExecutiveSummary(text);
    
    res.json({
      success: true,
      summary: result
    });
  } catch (error) {
    console.error('❌ Executive summary generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/validate-medical
 * Validate medical terminology
 */
router.post('/validate-medical', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const result = await openaiService.validateMedicalTerminology(text);
    
    res.json({
      success: true,
      validation: result
    });
  } catch (error) {
    console.error('❌ Medical terminology validation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/analyze-transcript/:id
 * Analyze a specific transcript
 */
router.post('/analyze-transcript/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Transcript ID is required'
      });
    }

    // Find transcript
    const transcript = await Transcript.findById(id);
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    const text = transcript.editedTranscript || transcript.rawTranscript;
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'No transcript text available for analysis'
      });
    }

    // Perform analysis
    const [sentimentResult, insightsResult, summaryResult] = await Promise.all([
      openaiService.analyzeSentiment(text),
      openaiService.extractKeyInsights(text),
      openaiService.generateExecutiveSummary(text)
    ]);

    // Update transcript with analysis results
    const updateData = {
      sentimentAnalysis: sentimentResult,
      keyInsights: insightsResult.keyInsights || [],
      actionItems: insightsResult.actionItems || [],
      executiveSummary: summaryResult.summary || summaryResult,
      analysisStatus: 'completed',
      lastAnalyzed: new Date()
    };

    await Transcript.findByIdAndUpdate(id, updateData);

    res.json({
      success: true,
      analysis: {
        sentiment: sentimentResult,
        insights: insightsResult,
        summary: summaryResult
      }
    });
  } catch (error) {
    console.error('❌ Transcript analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/batch-analyze
 * Analyze multiple transcripts
 */
router.post('/batch-analyze', async (req, res) => {
  try {
    const { transcriptIds } = req.body;
    
    if (!transcriptIds || !Array.isArray(transcriptIds)) {
      return res.status(400).json({
        success: false,
        error: 'Transcript IDs array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const transcriptId of transcriptIds) {
      try {
        const transcript = await Transcript.findById(transcriptId);
        if (!transcript) {
          errors.push({ transcriptId, error: 'Transcript not found' });
          continue;
        }

        const text = transcript.editedTranscript || transcript.rawTranscript;
        if (!text) {
          errors.push({ transcriptId, error: 'No transcript text available' });
          continue;
        }

        // Perform analysis
        const [sentimentResult, insightsResult, summaryResult] = await Promise.all([
          openaiService.analyzeSentiment(text),
          openaiService.extractKeyInsights(text),
          openaiService.generateExecutiveSummary(text)
        ]);

        // Update transcript
        const updateData = {
          sentimentAnalysis: sentimentResult,
          keyInsights: insightsResult.keyInsights || [],
          actionItems: insightsResult.actionItems || [],
          executiveSummary: summaryResult.summary || summaryResult,
          analysisStatus: 'completed',
          lastAnalyzed: new Date()
        };

        await Transcript.findByIdAndUpdate(transcriptId, updateData);

        results.push({
          transcriptId,
          success: true,
          analysis: {
            sentiment: sentimentResult,
            insights: insightsResult,
            summary: summaryResult
          }
        });
      } catch (error) {
        errors.push({ transcriptId, error: error.message });
      }
    }

    res.json({
      success: true,
      results,
      errors,
      summary: {
        total: transcriptIds.length,
        successful: results.length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error('❌ Batch analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai/health
 * Check AI service health
 */
router.get('/health', async (req, res) => {
  try {
    const result = await openaiService.testConnection();
    res.json({
      success: true,
      status: 'healthy',
      details: result
    });
  } catch (error) {
    console.error('❌ AI health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router; 