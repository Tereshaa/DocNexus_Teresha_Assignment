const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const fileService = require('../services/fileService');
const openaiService = require('../services/openaiService');
const Transcript = require('../models/Transcript');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a',
    'video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/wmv', 'video/flv', 'video/webm'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio and video files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    return res.status(400).json({
      success: false,
      error: 'File upload error: ' + err.message
    });
  } else if (err) {
    console.error('File filter error:', err);
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next();
};

/**
 * POST /api/upload
 * Upload and process audio/video file
 */
router.post('/', upload.single('file'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { hcpName, hcpSpecialty, meetingDate, meetingDuration, attendees } = req.body;

    // Validate required fields
    if (!hcpName || !meetingDate) {
      return res.status(400).json({
        success: false,
        error: 'HCP name and meeting date are required'
      });
    }

    // Create transcript record
    const transcript = new Transcript({
      hcpName,
      hcpSpecialty: hcpSpecialty || '',
      meetingDate: new Date(meetingDate),
      meetingDuration: meetingDuration ? parseInt(meetingDuration) : 0,
      attendees: attendees ? JSON.parse(attendees) : [],
      originalFileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      transcriptionStatus: 'pending',
      analysisStatus: 'pending'
    });

    await transcript.save();
    const transcriptId = transcript._id;

    // Start transcription in background
    processTranscription(transcriptId, req.file.path);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      transcriptId: transcriptId,
      status: 'processing'
    });
  } catch (error) {
    console.error('❌ File upload failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Process transcription in background
 * @param {string} transcriptId - Transcript ID
 * @param {string} filePath - File path
 */
async function processTranscription(transcriptId, filePath) {
  try {
    // Update status to processing
    await Transcript.findByIdAndUpdate(transcriptId, {
      transcriptionStatus: 'processing',
      lastUpdated: new Date()
    });

    // Perform transcription
    const transcriptionResult = await openaiService.transcribeFile(filePath);
    
    if (!transcriptionResult.success) {
      throw new Error('Transcription failed');
    }

    // Update transcript with transcription results
    const updateData = {
      rawTranscript: transcriptionResult.text,
      editedTranscript: transcriptionResult.text,
      transcriptionStatus: 'completed',
      language: transcriptionResult.language,
      duration: transcriptionResult.duration,
      segments: transcriptionResult.segments,
      lastUpdated: new Date()
    };

    await Transcript.findByIdAndUpdate(transcriptId, updateData);

    // Start AI analysis in background
    processAIAnalysis(transcriptId, transcriptionResult.text);

  } catch (error) {
    console.error(`❌ Transcription processing failed for ${transcriptId}:`, error);
    
    // Update status to failed
    try {
      await Transcript.findByIdAndUpdate(transcriptId, {
        transcriptionStatus: 'failed',
        error: error.message,
        lastUpdated: new Date()
      });
    } catch (dbError) {
      console.error('❌ Database update failed:', dbError);
    }
  }
}

/**
 * Process AI analysis in background
 * @param {string} transcriptId - Transcript ID
 * @param {string} text - Transcript text
 */
async function processAIAnalysis(transcriptId, text) {
  try {
    // Update status to analyzing
    await Transcript.findByIdAndUpdate(transcriptId, {
      analysisStatus: 'processing',
      lastUpdated: new Date()
    });

    // Perform AI analysis
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
      lastAnalyzed: new Date(),
      lastUpdated: new Date()
    };

    await Transcript.findByIdAndUpdate(transcriptId, updateData);

  } catch (error) {
    console.error(`❌ AI analysis failed for ${transcriptId}:`, error);
    
    // Update status to failed
    try {
      await Transcript.findByIdAndUpdate(transcriptId, {
        analysisStatus: 'failed',
        error: error.message,
        lastUpdated: new Date()
      });
    } catch (dbError) {
      console.error('❌ Database update failed:', dbError);
      console.error('❌ Error details:', {
        transcriptId,
        error: error.message,
        stack: error.stack
      });
    }
  }
}

/**
 * GET /api/upload/status/:id
 * Get upload and processing status
 */
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const transcript = await Transcript.findById(id);
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    res.json({
      success: true,
      status: {
        transcriptionStatus: transcript.transcriptionStatus,
        analysisStatus: transcript.analysisStatus,
        lastUpdated: transcript.lastUpdated,
        error: transcript.error
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

module.exports = router; 