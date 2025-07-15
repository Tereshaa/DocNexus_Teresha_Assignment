const express = require('express');
const documentService = require('../services/documentService');
const Transcript = require('../models/Transcript');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/**
 * GET /api/documents
 * List all generated documents (across all transcripts)
 */
router.get('/', async (req, res) => {
  try {
    // Find all transcripts with generated documents
    const transcripts = await Transcript.find({ 'generatedDocuments.0': { $exists: true } })
      .select('hcpName meetingDate generatedDocuments');
    // Flatten the documents with transcript info
    const documents = [];
    transcripts.forEach(t => {
      (t.generatedDocuments || []).forEach(doc => {
        documents.push({
          transcriptId: t._id,
          hcpName: t.hcpName,
          meetingDate: t.meetingDate,
          ...(doc.toObject?.() || doc)
        });
      });
    });
    res.json({ success: true, data: documents });
  } catch (error) {
    console.error('❌ List documents failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/documents/generate-ppt
 * Generate PowerPoint presentation
 */
router.post('/generate-ppt', async (req, res) => {
  try {
    const { transcriptId, documentTitle } = req.body;
    console.log('Received documentTitle (PPT):', documentTitle);
    
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
        error: 'Transcript must be completed or edited before generating documents'
      });
    }

    console.log(`📊 Generating PowerPoint for transcript: ${transcriptId}`);
    console.log('📊 Transcript data being passed:', {
      hcpName: transcript.hcpName,
      hcpSpecialty: transcript.hcpSpecialty,
      meetingDate: transcript.meetingDate,
      meetingDuration: transcript.meetingDuration,
      attendees: transcript.attendees,
      sentimentAnalysis: transcript.sentimentAnalysis,
      keyInsights: transcript.keyInsights?.length || 0,
      actionItems: transcript.actionItems?.length || 0,
      rawTranscript: transcript.rawTranscript?.length || 0,
      editedTranscript: transcript.editedTranscript?.length || 0
    });
    
    const result = await documentService.generatePowerPoint(transcript);
    
    if (result.success) {
      // Update transcript with generated document
      await Transcript.findByIdAndUpdate(transcriptId, {
        $push: {
          generatedDocuments: {
            type: 'ppt',
            url: result.url,
            generatedAt: new Date(),
            documentTitle: documentTitle || null
          }
        }
      });
      // Log the saved document
      const updatedTranscript = await Transcript.findById(transcriptId);
      console.log('Saved generated document (PPT):', updatedTranscript.generatedDocuments[updatedTranscript.generatedDocuments.length - 1]);

      console.log(`✅ PowerPoint generated for transcript: ${transcriptId}`);
      
      res.json({
        success: true,
        message: 'PowerPoint presentation generated successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ PowerPoint generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/generate-pdf
 * Generate PDF report
 */
router.post('/generate-pdf', async (req, res) => {
  try {
    const { transcriptId, documentTitle } = req.body;
    console.log('Received documentTitle (PDF):', documentTitle);
    
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
        error: 'Transcript must be completed or edited before generating documents'
      });
    }

    console.log(`📄 Generating PDF for transcript: ${transcriptId}`);
    console.log('📄 Transcript data being passed:', {
      hcpName: transcript.hcpName,
      hcpSpecialty: transcript.hcpSpecialty,
      meetingDate: transcript.meetingDate,
      meetingDuration: transcript.meetingDuration,
      attendees: transcript.attendees,
      sentimentAnalysis: transcript.sentimentAnalysis,
      keyInsights: transcript.keyInsights?.length || 0,
      actionItems: transcript.actionItems?.length || 0,
      rawTranscript: transcript.rawTranscript?.length || 0,
      editedTranscript: transcript.editedTranscript?.length || 0
    });
    
    const result = await documentService.generatePDF(transcript);
    
    if (result.success) {
      // Update transcript with generated document
      await Transcript.findByIdAndUpdate(transcriptId, {
        $push: {
          generatedDocuments: {
            type: 'pdf',
            url: result.url,
            generatedAt: new Date(),
            documentTitle: documentTitle || null
          }
        }
      });
      // Log the saved document
      const updatedTranscript = await Transcript.findById(transcriptId);
      console.log('Saved generated document (PDF):', updatedTranscript.generatedDocuments[updatedTranscript.generatedDocuments.length - 1]);

      console.log(`✅ PDF generated for transcript: ${transcriptId}`);
      
      res.json({
        success: true,
        message: 'PDF report generated successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/generate-both
 * Generate both PPT and PDF documents
 */
router.post('/generate-both', async (req, res) => {
  try {
    const { transcriptId, documentTitle } = req.body;
    
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
        error: 'Transcript must be completed or edited before generating documents'
      });
    }

    console.log(`📋 Generating both documents for transcript: ${transcriptId}`);
    
    const result = await documentService.generateDocuments(transcript);
    
    if (result.success) {
      // Update transcript with generated documents
      const documentsToAdd = [];
      if (result.powerpoint.success) {
        documentsToAdd.push({
          type: 'ppt',
          url: result.powerpoint.url,
          generatedAt: new Date(),
          documentTitle: documentTitle || null
        });
      }
      if (result.pdf.success) {
        documentsToAdd.push({
          type: 'pdf',
          url: result.pdf.url,
          generatedAt: new Date(),
          documentTitle: documentTitle || null
        });
      }
      if (documentsToAdd.length > 0) {
        await Transcript.findByIdAndUpdate(transcriptId, {
          $push: {
            generatedDocuments: { $each: documentsToAdd }
          }
        });
        // Debug log for saved documents
        const updatedTranscript = await Transcript.findById(transcriptId);
        console.log('Saved generated documents (BOTH):', updatedTranscript.generatedDocuments.slice(-documentsToAdd.length));
      }
      console.log(`✅ Documents generated for transcript: ${transcriptId}`);
      res.json({
        success: true,
        message: 'Documents generated successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Document generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/generate-batch
 * Generate documents for multiple transcripts
 */
router.post('/generate-batch', async (req, res) => {
  try {
    const { transcriptIds, documentTypes = ['ppt', 'pdf'] } = req.body;
    
    if (!transcriptIds || !Array.isArray(transcriptIds)) {
      return res.status(400).json({
        success: false,
        error: 'Transcript IDs array is required'
      });
    }

    console.log(`📋 Starting batch document generation for ${transcriptIds.length} transcripts`);

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
            error: 'Transcript not ready for document generation'
          });
          continue;
        }

        let generationResult;
        
        // Generate documents based on requested types
        if (documentTypes.includes('ppt') && documentTypes.includes('pdf')) {
          generationResult = await documentService.generateDocuments(transcript);
        } else if (documentTypes.includes('ppt')) {
          generationResult = await documentService.generatePowerPoint(transcript);
        } else if (documentTypes.includes('pdf')) {
          generationResult = await documentService.generatePDF(transcript);
        } else {
          errors.push({
            transcriptId,
            error: 'No valid document types specified'
          });
          continue;
        }

        if (generationResult.success) {
          // Update transcript with generated documents
          const documentsToAdd = [];
          
          if (generationResult.powerpoint && generationResult.powerpoint.success) {
            documentsToAdd.push({
              type: 'ppt',
              url: generationResult.powerpoint.url,
              generatedAt: new Date()
            });
          }
          
          if (generationResult.pdf && generationResult.pdf.success) {
            documentsToAdd.push({
              type: 'pdf',
              url: generationResult.pdf.url,
              generatedAt: new Date()
            });
          }

          if (documentsToAdd.length > 0) {
            await Transcript.findByIdAndUpdate(transcriptId, {
              $push: {
                generatedDocuments: { $each: documentsToAdd }
              }
            });
          }

          results.push({
            transcriptId,
            success: true,
            data: generationResult
          });
        } else {
          errors.push({
            transcriptId,
            error: generationResult.error || 'Document generation failed'
          });
        }

      } catch (error) {
        errors.push({
          transcriptId,
          error: error.message
        });
      }
    }

    console.log(`✅ Batch document generation completed: ${results.length} successful, ${errors.length} failed`);

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
    console.error('❌ Batch document generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:transcriptId
 * Get generated documents for a transcript
 */
router.get('/:transcriptId', async (req, res) => {
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

    res.json({
      success: true,
      data: {
        transcriptId: transcript._id,
        hcpName: transcript.hcpName,
        meetingDate: transcript.meetingDate,
        generatedDocuments: transcript.generatedDocuments || []
      }
    });

  } catch (error) {
    console.error('❌ Get documents failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/documents/:transcriptId/:documentId
 * Delete a specific generated document
 */
router.delete('/:transcriptId/:documentId', async (req, res) => {
  try {
    const { transcriptId, documentId } = req.params;
    
    // Find transcript
    const transcript = await Transcript.findById(transcriptId);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    // Find the specific document
    const document = transcript.generatedDocuments.find(doc => doc._id.toString() === documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Remove document from transcript
    await Transcript.findByIdAndUpdate(transcriptId, {
      $pull: {
        generatedDocuments: { _id: documentId }
      }
    });

    console.log(`✅ Document deleted: ${documentId}`);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete document failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/documents/:filename - Delete a generated document by filename
 */
router.delete('/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../documents', filename);
  let fileDeleted = false;
  let dbUpdated = false;
  try {
    console.log('Attempting to delete file:', filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      fileDeleted = true;
      console.log('File deleted:', filePath);
    } else {
      console.log('File not found:', filePath);
    }
    // Debug: Log all generatedDocuments URLs that match
    const docs = await Transcript.find({ 'generatedDocuments.url': { $regex: filename } });
    console.log('Matching docs for deletion:', docs.map(d => d.generatedDocuments));
    // Remove reference from MongoDB
    const dbResult = await Transcript.updateMany(
      { 'generatedDocuments.url': { $regex: filename } },
      { $pull: { generatedDocuments: { url: { $regex: filename } } } }
    );
    dbUpdated = dbResult.modifiedCount > 0;
    console.log('MongoDB update result:', dbResult);
    if (fileDeleted || dbUpdated) {
      return res.json({ success: true, message: 'File and/or database record deleted.' });
    } else {
      return res.status(404).json({ success: false, message: 'File and database record not found.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/documents/stats/overview
 * Get document generation statistics
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

    // Get document generation statistics
    const [
      totalTranscripts,
      transcriptsWithDocuments,
      totalDocuments,
      pptDocuments,
      pdfDocuments
    ] = await Promise.all([
      Transcript.countDocuments(filter),
      Transcript.countDocuments({
        ...filter,
        'generatedDocuments.0': { $exists: true }
      }),
      Transcript.aggregate([
        { $match: filter },
        { $unwind: '$generatedDocuments' },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]),
      Transcript.aggregate([
        { $match: filter },
        { $unwind: '$generatedDocuments' },
        { $match: { 'generatedDocuments.type': 'ppt' } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]),
      Transcript.aggregate([
        { $match: filter },
        { $unwind: '$generatedDocuments' },
        { $match: { 'generatedDocuments.type': 'pdf' } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ])
    ]);

    // Get recent document generation activity
    const recentDocuments = await Transcript.aggregate([
      { $match: filter },
      { $unwind: '$generatedDocuments' },
      { $sort: { 'generatedDocuments.generatedAt': -1 } },
      { $limit: 10 },
      { $project: {
        hcpName: 1,
        'document.type': '$generatedDocuments.type',
        'document.generatedAt': '$generatedDocuments.generatedAt',
        'document.url': '$generatedDocuments.url'
      }}
    ]);

    console.log('✅ Retrieved document generation statistics');

    res.json({
      success: true,
      data: {
        totalTranscripts,
        transcriptsWithDocuments,
        totalDocuments: totalDocuments[0]?.count || 0,
        pptDocuments: pptDocuments[0]?.count || 0,
        pdfDocuments: pdfDocuments[0]?.count || 0,
        documentGenerationRate: totalTranscripts > 0 ? (transcriptsWithDocuments / totalTranscripts) * 100 : 0,
        recentDocuments
      }
    });

  } catch (error) {
    console.error('❌ Get document stats failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 