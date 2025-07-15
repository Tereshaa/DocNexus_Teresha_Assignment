const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Transcript = require('../models/Transcript');
const fileService = require('../services/fileService');
const openaiService = require('../services/openaiService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
  const allowedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.avi', '.mov'];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio and video files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 // 100MB default
  }
});

// Add error handling for multer
const uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 100MB.'
        });
      }
      return res.status(400).json({
        success: false,
        error: `Upload error: ${err.message}`
      });
    } else if (err) {
      console.error('File filter error:', err);
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next();
  });
};

/**
 * POST /api/upload
 * Upload audio/video file and start processing
 */
router.post('/', uploadMiddleware, async (req, res) => {
  try {
    console.log('📤 File upload request received');
    console.log('📤 Request body:', req.body);
    console.log('📤 Request file:', req.file);
    console.log('📤 Request headers:', req.headers);
    
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Validate required fields
    const { hcpName, hcpSpecialty, meetingDate, attendees } = req.body;
    
    if (!hcpName || !hcpSpecialty || !meetingDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hcpName, hcpSpecialty, meetingDate'
      });
    }

    // Parse attendees
    let parsedAttendees = [];
    if (attendees) {
      try {
        parsedAttendees = JSON.parse(attendees);
      } catch (error) {
        console.warn('Failed to parse attendees JSON:', error);
        parsedAttendees = [];
      }
    }

    // Upload file to local storage
    console.log('📤 Uploading file to local storage...');
    const fileResult = await fileService.uploadFile(
      req.file.path,
      req.file.originalname,
      'uploads',
      req // pass the request object
    );

    if (!fileResult.success) {
      throw new Error(`File upload failed: ${fileResult.error}`);
    }

    // Determine file type
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const fileType = ['mp3', 'wav', 'm4a'].includes(fileExtension) ? 'audio' : 'video';

    // Create transcript record
    const transcript = new Transcript({
      originalFileName: req.file.originalname,
      fileUrl: fileResult.url,
      fileSize: req.file.size,
      fileType: fileType,
      mimeType: req.file.mimetype,
      meetingDate: new Date(meetingDate),
      hcpName: hcpName,
      hcpSpecialty: hcpSpecialty,
      attendees: parsedAttendees,
      meetingDuration: 0, // Will be updated after transcription
      createdBy: req.body.createdBy || 'system',
      organization: req.body.organization || 'DocNexus.ai',
      transcriptionStatus: 'pending'
    });

    await transcript.save();

    // Start transcription process asynchronously
    processTranscription(transcript._id, req.file.path);

    console.log('✅ File upload completed successfully');
    
    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      transcriptId: transcript._id,
      fileUrl: fileResult.url,
      status: 'processing'
    });

  } catch (error) {
    console.error('❌ File upload failed:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/upload/batch
 * Upload multiple files
 */
router.post('/batch', upload.array('files', 10), async (req, res) => {
  try {
    console.log('📤 Batch file upload request received');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const results = [];
    const errors = [];

    for (const file of req.files) {
      try {
        // Upload to local storage
        const fileResult = await fileService.uploadFile(
          file.path,
          file.originalname,
          'uploads',
          req // pass the request object
        );

        if (fileResult.success) {
          results.push({
            fileName: file.originalname,
            fileUrl: fileResult.url,
            size: file.size
          });
        } else {
          errors.push({
            fileName: file.originalname,
            error: fileResult.error
          });
        }

        // Clean up local file
        fs.unlinkSync(file.path);
      } catch (error) {
        errors.push({
          fileName: file.originalname,
          error: error.message
        });
        
        // Clean up local file if it exists
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    console.log('✅ Batch upload completed');
    
    res.status(200).json({
      success: true,
      message: 'Batch upload completed',
      results: results,
      errors: errors,
      totalFiles: req.files.length,
      successfulUploads: results.length,
      failedUploads: errors.length
    });

  } catch (error) {
    console.error('❌ Batch upload failed:', error);
    
    // Clean up any remaining files
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/upload/status/:transcriptId
 * Get upload and processing status
 */
router.get('/status/:transcriptId', async (req, res) => {
  try {
    const { transcriptId } = req.params;
    
    const transcript = await Transcript.findById(transcriptId);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    res.json({
      success: true,
      status: {
        transcriptId: transcript._id,
        fileName: transcript.originalFileName,
        transcriptionStatus: transcript.transcriptionStatus,
        processingStartTime: transcript.processingStartTime,
        processingEndTime: transcript.processingEndTime,
        processingDuration: transcript.calculateProcessingDuration(),
        fileSize: transcript.fileSize,
        fileType: transcript.fileType,
        hcpName: transcript.hcpName,
        meetingDate: transcript.meetingDate,
        errors: transcript.processingErrors
      }
    });

  } catch (error) {
    console.error('❌ Status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/upload/:transcriptId/retry
 * Retry transcription for failed transcript
 */
router.post('/:transcriptId/retry', async (req, res) => {
  try {
    const { transcriptId } = req.params;
    
    const transcript = await Transcript.findById(transcriptId);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    // Check if transcript is in a retryable state
    if (transcript.transcriptionStatus !== 'retryable_failed' && transcript.transcriptionStatus !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Transcript is not in a retryable state'
      });
    }

    // Get the file path from the stored file
    const filePath = path.join(__dirname, '..', transcript.fileUrl);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Original file not found'
      });
    }

    // Start transcription process asynchronously
    processTranscription(transcriptId, filePath);

    console.log(`🔄 Retrying transcription for transcript: ${transcriptId}`);
    
    res.json({
      success: true,
      message: 'Transcription retry started',
      transcriptId: transcriptId,
      status: 'processing'
    });

  } catch (error) {
    console.error('❌ Retry failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/upload/:transcriptId
 * Delete uploaded file and transcript
 */
router.delete('/:transcriptId', async (req, res) => {
  try {
    const { transcriptId } = req.params;
    
    const transcript = await Transcript.findById(transcriptId);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    // Delete from S3
    // if (transcript.fileUrl) {
    //   const key = transcript.fileUrl.split('/').pop();
    //   await s3Service.deleteFile(key);
    // }

    // Delete transcript from database
    await Transcript.findByIdAndDelete(transcriptId);

    console.log('✅ File and transcript deleted successfully');
    
    res.json({
      success: true,
      message: 'File and transcript deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Process transcription asynchronously
 * @param {string} transcriptId - Transcript ID
 * @param {string} filePath - Local file path
 */
async function processTranscription(transcriptId, filePath) {
  try {
    console.log(`🎤 Starting transcription for transcript: ${transcriptId}`);
    
    // Update status to processing
    await Transcript.findByIdAndUpdate(transcriptId, {
      transcriptionStatus: 'processing',
      processingStartTime: new Date()
    });

    // Transcribe audio
    const transcriptionResult = await openaiService.transcribeAudio(filePath);
    
    if (!transcriptionResult.success) {
      // Check if it's a retryable error
      if (transcriptionResult.retryable) {
        console.log(`🔄 Transcription failed but is retryable: ${transcriptionResult.error}`);
        // Update status to indicate retryable failure
        await Transcript.findByIdAndUpdate(transcriptId, {
          transcriptionStatus: 'retryable_failed',
          processingEndTime: new Date(),
          $push: {
            processingErrors: {
              error: transcriptionResult.error,
              timestamp: new Date(),
              retryable: true
            }
          }
        });
        return; // Don't throw error, just return
      }
      throw new Error(`Transcription failed: ${transcriptionResult.error}`);
    }

    // Update transcript with results
    await Transcript.findByIdAndUpdate(transcriptId, {
      rawTranscript: transcriptionResult.text,
      transcriptionStatus: 'completed',
      transcriptionConfidence: transcriptionResult.confidence,
      meetingDuration: transcriptionResult.duration || 0,
      processingEndTime: new Date()
    });

    console.log(`✅ Transcription completed for transcript: ${transcriptId}`);

    // Start AI analysis
    await processAIAnalysis(transcriptId);

  } catch (error) {
    console.error(`❌ Transcription processing failed for ${transcriptId}:`, error);
    
    // Update status to failed
    await Transcript.findByIdAndUpdate(transcriptId, {
      transcriptionStatus: 'failed',
      processingEndTime: new Date(),
      $push: {
        processingErrors: {
          error: error.message,
          timestamp: new Date()
        }
      }
    });
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * Process AI analysis asynchronously
 * @param {string} transcriptId - Transcript ID
 */
async function processAIAnalysis(transcriptId) {
  try {
    console.log(`🧠 Starting AI analysis for transcript: ${transcriptId}`);
    
    const transcript = await Transcript.findById(transcriptId);
    if (!transcript) {
      throw new Error('Transcript not found');
    }

    const transcriptText = transcript.rawTranscript;

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

    // Update transcript with AI analysis results
    await Transcript.findByIdAndUpdate(transcriptId, {
      sentimentAnalysis: {
        overall: sentimentResult.overall,
        score: sentimentResult.score,
        confidence: sentimentResult.confidence,
        details: sentimentResult.details,
        explanations: sentimentResult.explanations,
        emotionalIndicators: sentimentResult.emotionalIndicators,
        sentimentTrends: sentimentResult.sentimentTrends,
        contextFactors: sentimentResult.contextFactors
      },
      keyInsights: insightsResult.keyInsights || [],
      actionItems: insightsResult.actionItems || []
    });

    console.log(`✅ AI analysis completed for transcript: ${transcriptId}`);

  } catch (error) {
    console.error(`❌ AI analysis failed for ${transcriptId}:`, error);
    
    // Add error to transcript
    await Transcript.findByIdAndUpdate(transcriptId, {
      $push: {
        processingErrors: {
          error: `AI Analysis failed: ${error.message}`,
          timestamp: new Date()
        }
      }
    });
  }
}

module.exports = router; 