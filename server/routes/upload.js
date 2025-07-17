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
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Validate required fields
    const { hcpName, hcpSpecialty, meetingDate } = req.body;
    
    if (!hcpName || !hcpSpecialty || !meetingDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hcpName, hcpSpecialty, meetingDate'
      });
    }

    // Check for duplicate transcript (more comprehensive)
    const existing = await Transcript.findOne({
      $or: [
        {
          originalFileName: req.file.originalname,
          meetingDate: new Date(meetingDate),
          hcpName: hcpName,
          hcpSpecialty: hcpSpecialty
        },
        {
          // Also check for same file name uploaded recently (within last 2 minutes)
          originalFileName: req.file.originalname,
          createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
        }
      ]
    });
    
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Transcript already exists',
        transcriptId: existing._id,
        status: existing.transcriptionStatus
      });
    }

    // Upload file to storage
    const fileResult = await fileService.uploadFile(
      req.file.path,
      req.file.originalname,
      'uploads',
      req
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
      fileKey: fileResult.key,
      fileSize: req.file.size,
      fileType: fileType,
      mimeType: req.file.mimetype,
      meetingDate: new Date(meetingDate),
      hcpName: hcpName,
      hcpSpecialty: hcpSpecialty,
      meetingDuration: 0,
      createdBy: req.body.createdBy || 'system',
      organization: req.body.organization || 'DocNexus.ai',
      transcriptionStatus: 'pending'
    });

    await transcript.save();

    // Start transcription process asynchronously (don't await to avoid blocking response)
    setImmediate(() => {
      processTranscription(transcript._id, fileResult.key);
    });

    console.log('✅ File upload completed successfully');
    
    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      transcriptId: transcript._id,
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
 * Process transcription asynchronously
 */
async function processTranscription(transcriptId, fileKey) {
  try {
    console.log(`🎤 Starting transcription for transcript: ${transcriptId}`);
    
    // Update status to processing
    await Transcript.findByIdAndUpdate(transcriptId, {
      transcriptionStatus: 'processing',
      processingStartTime: new Date()
    });

    // Get file from storage
    const fileResult = await fileService.getFile(fileKey);
    if (!fileResult.success) {
      throw new Error(`Failed to get file for transcription: ${fileResult.error}`);
    }

    // Save to temp file for OpenAI
    const ext = path.extname(fileKey);
    const tempFilePath = path.join(require('os').tmpdir(), `${transcriptId}${ext}`);
    fs.writeFileSync(tempFilePath, fileResult.buffer);

    // Transcribe audio
    const transcriptionResult = await openaiService.transcribeAudio(tempFilePath);

    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    if (!transcriptionResult.success) {
      throw new Error(`Transcription failed: ${transcriptionResult.error}`);
    }

    // Update transcript with results
    await Transcript.findByIdAndUpdate(transcriptId, {
      rawTranscript: transcriptionResult.text,
      transcriptionStatus: 'completed',
      meetingDuration: transcriptionResult.duration || 0,
      processingEndTime: new Date()
    });

    console.log(`✅ Transcription completed for transcript: ${transcriptId}`);

    // Start AI analysis
    await processAIAnalysis(transcriptId);

  } catch (error) {
    console.error(`❌ Transcription processing failed for ${transcriptId}:`, error);
    await Transcript.findByIdAndUpdate(transcriptId, {
      transcriptionStatus: 'failed',
      processingEndTime: new Date()
    });
  }
}

/**
 * Process AI analysis asynchronously
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
        overall: sentimentResult.overall || 'neutral',
        score: sentimentResult.score || 0,
        details: sentimentResult.details || { positive: 0, negative: 0, neutral: 0 },
        explanations: sentimentResult.explanations || { positive: '', negative: '', neutral: '' },
        emotionalIndicators: Array.isArray(sentimentResult.emotionalIndicators) ? sentimentResult.emotionalIndicators : [],
        confidence: sentimentResult.confidence || 0,
        sentimentTrends: Array.isArray(sentimentResult.sentimentTrends) ? sentimentResult.sentimentTrends : [],
        contextFactors: sentimentResult.contextFactors || {
          medicalConcerns: [],
          businessOpportunities: [],
          personalRapport: 'neutral',
          professionalTone: 'formal'
        }
      },
      keyInsights: Array.isArray(insightsResult.keyInsights) ? insightsResult.keyInsights : [],
      actionItems: Array.isArray(insightsResult.actionItems) ? insightsResult.actionItems : []
    });

    console.log(`✅ AI analysis completed for transcript: ${transcriptId}`);

  } catch (error) {
    console.error(`❌ AI analysis failed for ${transcriptId}:`, error);
  }
}

module.exports = router; 