const mongoose = require('mongoose');

const transcriptSchema = new mongoose.Schema({
  // File information
  originalFileName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileType: {
    type: String,
    required: true,
    enum: ['audio', 'video']
  },
  mimeType: {
    type: String,
    required: true
  },

  // Meeting metadata
  meetingDate: {
    type: Date,
    required: true
  },
  hcpName: {
    type: String,
    required: true
  },
  hcpSpecialty: {
    type: String,
    required: true
  },
  attendees: [{
    name: String,
    role: String,
    organization: String
  }],
  meetingDuration: {
    type: Number, // in seconds
    required: true
  },

  // Transcription data
  rawTranscript: {
    type: String,
    default: ''
  },
  editedTranscript: {
    type: String,
    default: ''
  },
  transcriptionStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  transcriptionConfidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },

  // AI Analysis
  sentimentAnalysis: {
    overall: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      default: 'neutral'
    },
    score: {
      type: Number,
      min: -1,
      max: 1,
      default: 0
    },
    details: {
      positive: Number,
      negative: Number,
      neutral: Number
    }
  },
  keyInsights: [{
    insight: String,
    category: String,
    confidence: Number,
    timestamp: String // Changed from Number to String to match OpenAI output
  }],
  actionItems: [{
    item: String,
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    assignee: String,
    dueDate: Date
  }],

  // CRM Integration
  crmSyncStatus: {
    type: String,
    enum: ['pending', 'synced', 'failed'],
    default: 'pending'
  },
  crmRecordId: {
    type: String,
    default: null
  },
  crmSyncDate: {
    type: Date,
    default: null
  },

  // Document Generation
  generatedDocuments: [{
    type: {
      type: String,
      enum: ['ppt', 'pdf'],
      required: true
    },
    url: String,
    generatedAt: {
      type: Date,
      default: Date.now
    },
    documentTitle: String
  }],

  // Processing metadata
  processingStartTime: {
    type: Date,
    default: Date.now
  },
  processingEndTime: {
    type: Date,
    default: null
  },
  processingErrors: [{
    error: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // User and organization
  createdBy: {
    type: String,
    required: true
  },
  organization: {
    type: String,
    required: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
transcriptSchema.index({ hcpName: 1, meetingDate: -1 });
transcriptSchema.index({ transcriptionStatus: 1 });
transcriptSchema.index({ crmSyncStatus: 1 });
transcriptSchema.index({ organization: 1, createdAt: -1 });
transcriptSchema.index({ 'sentimentAnalysis.overall': 1 });

// Pre-save middleware to update the updatedAt field
transcriptSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for processing duration
transcriptSchema.virtual('processingDuration').get(function() {
  if (this.processingStartTime && this.processingEndTime) {
    return this.processingEndTime - this.processingStartTime;
  }
  return null;
});

// Method to calculate processing duration
transcriptSchema.methods.calculateProcessingDuration = function() {
  if (this.processingStartTime && this.processingEndTime) {
    return this.processingEndTime - this.processingStartTime;
  }
  return null;
};

// Static method to get transcripts by status
transcriptSchema.statics.findByStatus = function(status) {
  return this.find({ transcriptionStatus: status });
};

// Static method to get transcripts by HCP
transcriptSchema.statics.findByHCP = function(hcpName) {
  return this.find({ hcpName: new RegExp(hcpName, 'i') });
};

// Static method to get transcripts by date range
transcriptSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    meetingDate: {
      $gte: startDate,
      $lte: endDate
    }
  });
};

module.exports = mongoose.model('Transcript', transcriptSchema); 