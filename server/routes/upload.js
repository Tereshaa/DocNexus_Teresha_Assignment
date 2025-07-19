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
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 200 * 1024 * 1024 // 200MB default
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

    // Normalize emotionalIndicators to always be an array of objects
    console.log('🔍 Raw emotionalIndicators from OpenAI:', sentimentResult.emotionalIndicators);
    console.log('🔍 Type of emotionalIndicators:', typeof sentimentResult.emotionalIndicators);
    
    let normalizedIndicators = [];
    if (sentimentResult.emotionalIndicators) {
      if (typeof sentimentResult.emotionalIndicators === 'string') {
        console.log('🔍 emotionalIndicators is a string, attempting to parse...');
        try {
          // First try JSON.parse
          normalizedIndicators = JSON.parse(sentimentResult.emotionalIndicators);
          console.log('✅ JSON.parse successful:', normalizedIndicators);
        } catch (e) {
          console.log('❌ JSON.parse failed, trying eval...');
          try {
            // Try to eval as JS array if JSON.parse fails
            normalizedIndicators = eval(sentimentResult.emotionalIndicators);
            console.log('✅ eval successful:', normalizedIndicators);
          } catch (e2) {
            console.log('❌ eval also failed, setting to empty array');
            normalizedIndicators = [];
          }
        }
      } else if (Array.isArray(sentimentResult.emotionalIndicators)) {
        console.log('✅ emotionalIndicators is already an array');
        normalizedIndicators = sentimentResult.emotionalIndicators;
      } else {
        console.log('❌ emotionalIndicators is neither string nor array, setting to empty array');
        normalizedIndicators = [];
      }
      
      // Ensure array of objects with required fields
      if (!Array.isArray(normalizedIndicators)) {
        console.log('❌ normalizedIndicators is not an array after processing, setting to empty array');
        normalizedIndicators = [];
      } else {
        console.log('🔍 Filtering normalizedIndicators for valid objects...');
        normalizedIndicators = normalizedIndicators.filter(ind => {
          const isValid = ind && typeof ind === 'object' &&
                         typeof ind.indicator === 'string' &&
                         typeof ind.type === 'string' &&
                         typeof ind.context === 'string';
          if (!isValid) {
            console.log('❌ Invalid indicator object:', ind);
          }
          return isValid;
        });
        console.log('✅ Final normalizedIndicators:', normalizedIndicators);
      }
    } else {
      console.log('❌ No emotionalIndicators found in sentimentResult');
    }

    // Final safety check before saving
    console.log('🔍 Final safety check before saving to database...');
    console.log('🔍 normalizedIndicators type:', typeof normalizedIndicators);
    console.log('🔍 normalizedIndicators isArray:', Array.isArray(normalizedIndicators));
    console.log('🔍 normalizedIndicators value:', normalizedIndicators);
    
    // Ensure normalizedIndicators is always a valid array
    if (!Array.isArray(normalizedIndicators)) {
      console.log('❌ CRITICAL: normalizedIndicators is not an array, forcing to empty array');
      normalizedIndicators = [];
    }
    
    // Update transcript with AI analysis results
    const updateData = {
      sentimentAnalysis: {
        overall: sentimentResult.overall || 'neutral',
        score: sentimentResult.score || 0,
        details: sentimentResult.details || { positive: 0, negative: 0, neutral: 0 },
        explanations: sentimentResult.explanations || { positive: '', negative: '', neutral: '' },
        emotionalIndicators: normalizedIndicators,
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
    };
    
    console.log('🔍 Final update data emotionalIndicators:', updateData.sentimentAnalysis.emotionalIndicators);
    
    try {
      await Transcript.findByIdAndUpdate(transcriptId, updateData);
      console.log('✅ Database update successful');
    } catch (dbError) {
      console.error('❌ Database update failed:', dbError);
      console.error('❌ Error details:', {
        message: dbError.message,
        name: dbError.name,
        code: dbError.code
      });
      
      // Try to save with empty emotionalIndicators as fallback
      try {
        console.log('🔄 Attempting fallback save with empty emotionalIndicators...');
        const fallbackData = {
          ...updateData,
          sentimentAnalysis: {
            ...updateData.sentimentAnalysis,
            emotionalIndicators: []
          }
        };
        await Transcript.findByIdAndUpdate(transcriptId, fallbackData);
        console.log('✅ Fallback save successful');
      } catch (fallbackError) {
        console.error('❌ Fallback save also failed:', fallbackError);
        throw fallbackError;
      }
    }

    console.log(`✅ AI analysis completed for transcript: ${transcriptId}`);

  } catch (error) {
    console.error(`❌ AI analysis failed for ${transcriptId}:`, error);
  }
}

module.exports = router; 