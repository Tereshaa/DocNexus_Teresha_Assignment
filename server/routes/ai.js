const openaiService = require('../services/openaiService');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Transcript = require('../models/Transcript');

const router = express.Router();

/**
 * POST /api/ai/transcribe
 * Transcribe audio file
 */
router.post('/transcribe', async (req, res) => {
  try {
    const { filePath, language = 'en' } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      });
    }

    console.log('🎤 Starting transcription request...');
    
    const result = await openaiService.transcribeAudio(filePath, language);
    
    if (result.success) {
      console.log('✅ Transcription completed');
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Transcription request failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/analyze-sentiment
 * Analyze sentiment of text
 */
router.post('/analyze-sentiment', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    console.log('🧠 Starting sentiment analysis...');
    
    const result = await openaiService.analyzeSentiment(text);
    
    if (result.success) {
      console.log('✅ Sentiment analysis completed');
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Sentiment analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/extract-insights
 * Extract key insights from text
 */
router.post('/extract-insights', async (req, res) => {
  try {
    const { text, historicalData = [], medicalPublications = [] } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    console.log('🔍 Starting insights extraction...');
    
    const result = await openaiService.extractKeyInsights(text, historicalData, medicalPublications);
    
    if (result.success) {
      console.log('✅ Insights extraction completed');
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Insights extraction failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/generate-summary
 * Generate executive summary
 */
router.post('/generate-summary', async (req, res) => {
  try {
    const { transcriptData } = req.body;
    
    if (!transcriptData) {
      return res.status(400).json({
        success: false,
        error: 'Transcript data is required'
      });
    }

    console.log('📊 Generating executive summary...');
    
    const result = await openaiService.generateExecutiveSummary(transcriptData);
    
    if (result.success) {
      console.log('✅ Executive summary generated');
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Executive summary generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/validate-terminology
 * Validate medical terminology
 */
router.post('/validate-terminology', async (req, res) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Transcript text is required'
      });
    }

    console.log('🏥 Validating medical terminology...');
    
    const result = await openaiService.validateMedicalTerminology(transcript);
    
    if (result.success) {
      console.log('✅ Medical terminology validation completed');
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

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
 * Analyze specific transcript by ID
 */
router.post('/analyze-transcript/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeHistoricalData = false } = req.body;
    
    // Find transcript
    const transcript = await Transcript.findById(id);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    const transcriptText = transcript.editedTranscript || transcript.rawTranscript;
    
    if (!transcriptText) {
      return res.status(400).json({
        success: false,
        error: 'No transcript text available for analysis'
      });
    }

    console.log(`🧠 Analyzing transcript: ${id}`);

    // Get historical data if requested
    let historicalData = [];
    if (includeHistoricalData) {
      const historicalTranscripts = await Transcript.find({
        hcpName: transcript.hcpName,
        _id: { $ne: id },
        transcriptionStatus: 'completed'
      })
      .sort({ meetingDate: -1 })
      .limit(5)
      .select('keyInsights sentimentAnalysis');
      
      historicalData = historicalTranscripts.map(t => ({
        summary: `Meeting with ${t.hcpName} - Sentiment: ${t.sentimentAnalysis.overall}`,
        insights: t.keyInsights
      }));
    }

    // Perform analysis
    const [sentimentResult, insightsResult] = await Promise.all([
      openaiService.analyzeSentiment(transcriptText),
      openaiService.extractKeyInsights(transcriptText, historicalData)
    ]);

    if (!sentimentResult.success || !insightsResult.success) {
      throw new Error('Analysis failed');
    }

    // Update transcript with results
    const updatedTranscript = await Transcript.findByIdAndUpdate(
      id,
      {
        sentimentAnalysis: {
          overall: sentimentResult.overall,
          score: sentimentResult.score,
          details: sentimentResult.details,
          explanations: sentimentResult.explanations
        },
        keyInsights: insightsResult.keyInsights || [],
        actionItems: insightsResult.actionItems || []
      },
      { new: true }
    );

    console.log(`✅ Transcript analysis completed: ${id}`);

    res.json({
      success: true,
      data: {
        transcript: updatedTranscript,
        sentiment: sentimentResult,
        insights: insightsResult
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
    const { transcriptIds, includeHistoricalData = false } = req.body;
    
    if (!transcriptIds || !Array.isArray(transcriptIds)) {
      return res.status(400).json({
        success: false,
        error: 'Transcript IDs array is required'
      });
    }

    console.log(`🧠 Starting batch analysis for ${transcriptIds.length} transcripts`);

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

        const transcriptText = transcript.editedTranscript || transcript.rawTranscript;
        
        if (!transcriptText) {
          errors.push({
            transcriptId,
            error: 'No transcript text available'
          });
          continue;
        }

        // Get historical data if requested
        let historicalData = [];
        if (includeHistoricalData) {
          const historicalTranscripts = await Transcript.find({
            hcpName: transcript.hcpName,
            _id: { $ne: transcriptId },
            transcriptionStatus: 'completed'
          })
          .sort({ meetingDate: -1 })
          .limit(3)
          .select('keyInsights sentimentAnalysis');
          
          historicalData = historicalTranscripts.map(t => ({
            summary: `Meeting with ${t.hcpName} - Sentiment: ${t.sentimentAnalysis.overall}`,
            insights: t.keyInsights
          }));
        }

        // Perform analysis
        const [sentimentResult, insightsResult] = await Promise.all([
          openaiService.analyzeSentiment(transcriptText),
          openaiService.extractKeyInsights(transcriptText, historicalData)
        ]);

        if (sentimentResult.success && insightsResult.success) {
          // Update transcript
          await Transcript.findByIdAndUpdate(
            transcriptId,
            {
              sentimentAnalysis: {
                overall: sentimentResult.overall,
                score: sentimentResult.score,
                details: sentimentResult.details,
                explanations: sentimentResult.explanations
              },
              keyInsights: insightsResult.keyInsights || [],
              actionItems: insightsResult.actionItems || []
            }
          );

          results.push({
            transcriptId,
            success: true,
            sentiment: sentimentResult,
            insights: insightsResult
          });
        } else {
          errors.push({
            transcriptId,
            error: 'Analysis failed'
          });
        }

      } catch (error) {
        errors.push({
          transcriptId,
          error: error.message
        });
      }
    }

    console.log(`✅ Batch analysis completed: ${results.length} successful, ${errors.length} failed`);

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
    // Test OpenAI connection
    const connectionTest = await openaiService.testOpenAIConnection();
    
    res.json({
      success: true,
      status: connectionTest.success ? 'healthy' : 'unhealthy',
      openai: {
        connected: connectionTest.success,
        message: connectionTest.message || connectionTest.error,
        details: connectionTest.details
      },
      environment: {
        apiKeyPresent: !!process.env.OPENAI_API_KEY,
        nodeEnv: process.env.NODE_ENV
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ AI health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 