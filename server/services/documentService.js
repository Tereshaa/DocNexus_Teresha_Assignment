const PptxGenJS = require('pptxgenjs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const fileService = require('./fileService');

const logoPath = path.resolve(__dirname, '../../client/public/logo.png');

class DocumentService {
  constructor() {
    this.brandColors = {
      primary: '#2563EB',    // Blue
      secondary: '#1E40AF',  // Dark Blue
      accent: '#3B82F6',     // Light Blue
      success: '#10B981',    // Green
      warning: '#F59E0B',    // Orange
      danger: '#EF4444',     // Red
      dark: '#1F2937',       // Dark Gray
      light: '#F9FAFB'       // Light Gray
    };
    
    this.brandFonts = {
      title: 'Arial',
      body: 'Arial',
      accent: 'Arial'
    };
  }

  /**
   * Generate PowerPoint presentation from transcript data
   * @param {Object} transcriptData - Transcript and analysis data
   * @returns {Promise<Object>} PowerPoint generation result
   */
  async generatePowerPoint(transcriptData) {
    try {
      const pptx = new PptxGenJS();

      // Title slide
      const titleSlide = pptx.addSlide();
      titleSlide.addText('Meeting Summary', {
        x: 1, y: 1, w: 8, h: 1,
        fontSize: 36,
        bold: true,
        color: '363636'
      });
      titleSlide.addText(`HCP: ${transcriptData.hcpName || 'N/A'}`, {
        x: 1, y: 2.5, w: 8, h: 0.5,
        fontSize: 18,
        color: '666666'
      });
      titleSlide.addText(`Date: ${transcriptData.meetingDate || 'N/A'}`, {
        x: 1, y: 3, w: 8, h: 0.5,
        fontSize: 14,
        color: '666666'
      });

      // Sentiment Analysis slide
      if (transcriptData.sentimentAnalysis) {
        const sentimentSlide = pptx.addSlide();
        sentimentSlide.addText('Sentiment Analysis', {
          x: 0.5, y: 0.5, w: 9, h: 0.5,
          fontSize: 24,
          bold: true,
          color: '363636'
        });

        const sentiment = transcriptData.sentimentAnalysis;
        sentimentSlide.addText(`Overall Sentiment: ${sentiment.overallSentiment || sentiment.overall || 'N/A'}`, {
          x: 0.5, y: 1.5, w: 4, h: 0.5,
          fontSize: 16,
          bold: true
        });
        sentimentSlide.addText(`Sentiment Score: ${sentiment.sentimentScore || sentiment.score || 'N/A'}`, {
          x: 0.5, y: 2, w: 4, h: 0.5,
          fontSize: 14
        });
        sentimentSlide.addText(`Confidence: ${sentiment.confidence || 'N/A'}`, {
          x: 0.5, y: 2.5, w: 4, h: 0.5,
          fontSize: 14
        });

        if (sentiment.emotionalIndicators && sentiment.emotionalIndicators.length > 0) {
          sentimentSlide.addText('Emotional Indicators:', {
            x: 5, y: 1.5, w: 4, h: 0.5,
            fontSize: 16,
            bold: true
          });

          sentiment.emotionalIndicators.slice(0, 3).forEach((indicator, index) => {
            sentimentSlide.addText(`${indicator.emotion || indicator.indicator}: ${indicator.intensity || 'N/A'}`, {
              x: 5, y: 2 + (index * 0.4), w: 4, h: 0.3,
              fontSize: 12
            });
          });
        }
      }

      // Key Insights slide
      if (transcriptData.keyInsights && transcriptData.keyInsights.length > 0) {
        const insightsSlide = pptx.addSlide();
        insightsSlide.addText('Key Insights', {
          x: 0.5, y: 0.5, w: 9, h: 0.5,
          fontSize: 24,
          bold: true,
          color: '363636'
        });

        transcriptData.keyInsights.slice(0, 5).forEach((insight, index) => {
          insightsSlide.addText(`${index + 1}. ${insight.insight || insight.item}`, {
            x: 0.5, y: 1.2 + (index * 0.6), w: 9, h: 0.5,
            fontSize: 14,
            bullet: { type: 'number' }
          });
        });
      }

      // Action Items slide
      if (transcriptData.actionItems && transcriptData.actionItems.length > 0) {
        const actionsSlide = pptx.addSlide();
        actionsSlide.addText('Action Items', {
          x: 0.5, y: 0.5, w: 9, h: 0.5,
          fontSize: 24,
          bold: true,
          color: '363636'
        });

        transcriptData.actionItems.slice(0, 5).forEach((item, index) => {
          const actionText = item.action || item.item;
          const priority = item.priority || 'Medium';
          const assignee = item.assignee || 'TBD';
          
          actionsSlide.addText(`${index + 1}. ${actionText}`, {
            x: 0.5, y: 1.2 + (index * 0.8), w: 7, h: 0.4,
            fontSize: 14,
            bullet: { type: 'number' }
          });
          actionsSlide.addText(`Priority: ${priority} | Assignee: ${assignee}`, {
            x: 0.5, y: 1.6 + (index * 0.8), w: 7, h: 0.3,
            fontSize: 12,
            color: '666666'
          });
        });
      }

      // Executive Summary slide
      if (transcriptData.executiveSummary) {
        const summarySlide = pptx.addSlide();
        summarySlide.addText('Executive Summary', {
          x: 0.5, y: 0.5, w: 9, h: 0.5,
          fontSize: 24,
          bold: true,
          color: '363636'
        });

        const summary = transcriptData.executiveSummary.summary || transcriptData.executiveSummary;
        summarySlide.addText(summary, {
          x: 0.5, y: 1.2, w: 9, h: 4,
          fontSize: 14,
          align: 'left',
          valign: 'top'
        });
      }

      // Generate buffer
      const buffer = await pptx.write('nodebuffer');
      
      // Upload to storage
      const fileName = `meeting-summary-${Date.now()}.pptx`;
      const uploadResult = await fileService.uploadBuffer(buffer, fileName, 'documents');

      return {
        success: true,
        url: uploadResult.url,
        key: uploadResult.key,
        fileName: fileName
      };
    } catch (error) {
      console.error('❌ PowerPoint generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate PDF report from transcript data
   * @param {Object} transcriptData - Transcript and analysis data
   * @returns {Promise<Object>} PDF generation result
   */
  async generatePDF(transcriptData) {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      
      const bufferPromise = new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      // Title
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('Meeting Summary Report', { align: 'center' })
         .moveDown();

      // Meeting details
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Meeting Details')
         .moveDown(0.5);

      doc.fontSize(12)
         .font('Helvetica')
         .text(`HCP: ${transcriptData.hcpName || 'N/A'}`)
         .text(`Date: ${transcriptData.meetingDate || 'N/A'}`)
         .text(`Duration: ${transcriptData.meetingDuration || 'N/A'} minutes`)
         .moveDown();

      // Sentiment Analysis
      if (transcriptData.sentimentAnalysis) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Sentiment Analysis')
           .moveDown(0.5);

        const sentiment = transcriptData.sentimentAnalysis;
        doc.fontSize(12)
           .font('Helvetica')
           .text(`Overall Sentiment: ${sentiment.overallSentiment || sentiment.overall || 'N/A'}`)
           .text(`Sentiment Score: ${sentiment.sentimentScore || sentiment.score || 'N/A'}`)
           .text(`Confidence: ${sentiment.confidence || 'N/A'}`)
           .moveDown();

        if (sentiment.emotionalIndicators && sentiment.emotionalIndicators.length > 0) {
          doc.text('Emotional Indicators:')
             .moveDown(0.5);
          
          sentiment.emotionalIndicators.slice(0, 5).forEach(indicator => {
            doc.text(`• ${indicator.emotion || indicator.indicator}: ${indicator.intensity || 'N/A'}`);
          });
          doc.moveDown();
        }
      }

      // Key Insights
      if (transcriptData.keyInsights && transcriptData.keyInsights.length > 0) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Key Insights')
           .moveDown(0.5);

        doc.fontSize(12)
           .font('Helvetica');

        transcriptData.keyInsights.slice(0, 10).forEach((insight, index) => {
          doc.text(`${index + 1}. ${insight.insight || insight.item}`);
        });
        doc.moveDown();
      }

      // Action Items
      if (transcriptData.actionItems && transcriptData.actionItems.length > 0) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Action Items')
           .moveDown(0.5);

        doc.fontSize(12)
           .font('Helvetica');

        transcriptData.actionItems.slice(0, 10).forEach((item, index) => {
          const actionText = item.action || item.item;
          const priority = item.priority || 'Medium';
          const assignee = item.assignee || 'TBD';
          
          doc.text(`${index + 1}. ${actionText}`)
             .fontSize(10)
             .text(`   Priority: ${priority} | Assignee: ${assignee}`)
             .fontSize(12);
        });
        doc.moveDown();
      }

      // Executive Summary
      if (transcriptData.executiveSummary) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Executive Summary')
           .moveDown(0.5);

        const summary = transcriptData.executiveSummary.summary || transcriptData.executiveSummary;
        doc.fontSize(12)
           .font('Helvetica')
           .text(summary)
           .moveDown();
      }

      // Close document
      doc.end();

      // Wait for buffer
      const buffer = await bufferPromise;
      
      // Upload to storage
      const fileName = `meeting-report-${Date.now()}.pdf`;
      const uploadResult = await fileService.uploadBuffer(buffer, fileName, 'documents');

      return {
        success: true,
        url: uploadResult.url,
        key: uploadResult.key,
        fileName: fileName
      };
    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      throw error;
    }
  }

  /**
   * Extract highlights from transcript data
   * @param {Object} transcriptData - Transcript and analysis data
   * @returns {Array} Array of highlights (not duplicating key insights)
   */
  extractHighlights(transcriptData) {
    // Get key insight texts for exclusion
    const keyInsightTexts = (transcriptData.keyInsights || []).map(i => (i.insight || '').trim());
    // Get transcript text
    const transcriptText = transcriptData.editedTranscript || transcriptData.rawTranscript || '';
    // Split transcript into sentences
    const sentences = transcriptText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    // Remove duplicates, very short sentences, and any that match a key insight
    const uniqueSentences = Array.from(new Set(sentences))
      .filter(s => s.length > 40 && !keyInsightTexts.some(insight => insight && s.includes(insight)));
    // Pick up to 5 unique, non-trivial sentences as highlights
    return uniqueSentences.slice(0, 5);
  }

  /**
   * Generate transcript summary
   * @param {string} transcriptText - Transcript text
   * @returns {string} Summary text
   */
  generateTranscriptSummary(transcriptText) {
    // Simple summary generation
    const sentences = transcriptText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const wordCount = transcriptText.split(/\s+/).length;
    
    return `The meeting transcript contains ${sentences.length} sentences and approximately ${wordCount} words. The conversation covered various topics including clinical discussions, treatment protocols, and potential collaboration opportunities. Key themes emerged around patient care, clinical outcomes, and strategic partnerships.`;
  }

  /**
   * Generate both PowerPoint and PDF documents
   * @param {Object} transcriptData - Transcript and analysis data
   * @returns {Promise<Object>} Document generation result
   */
  async generateDocuments(transcriptData) {
    try {
      const results = {
        success: true,
        documents: []
      };

      // Generate PowerPoint
      try {
        const pptResult = await this.generatePowerPoint(transcriptData);
        results.documents.push({
          type: 'powerpoint',
          ...pptResult
        });
      } catch (error) {
        console.error('❌ PowerPoint generation failed:', error);
      }

      // Generate PDF
      try {
        const pdfResult = await this.generatePDF(transcriptData);
        results.documents.push({
          type: 'pdf',
          ...pdfResult
        });
      } catch (error) {
        console.error('❌ PDF generation failed:', error);
      }

      if (results.documents.length === 0) {
        throw new Error('All document generation failed');
      }

      return results;
    } catch (error) {
      console.error('❌ Document generation failed:', error);
      throw error;
    }
  }
}

module.exports = new DocumentService(); 