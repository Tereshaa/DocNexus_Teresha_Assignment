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
   * Generate PowerPoint presentation
   * @param {Object} transcriptData - Transcript and analysis data
   * @returns {Promise<Object>} Generation result
   */
  async generatePowerPoint(transcriptData) {
    try {
      console.log('📊 Generating PowerPoint presentation...');
      console.log('📊 Transcript data received:', {
        hcpName: transcriptData.hcpName,
        hcpSpecialty: transcriptData.hcpSpecialty,
        meetingDate: transcriptData.meetingDate,
        meetingDuration: transcriptData.meetingDuration,
        attendees: transcriptData.attendees,
        sentimentAnalysis: transcriptData.sentimentAnalysis,
        keyInsights: transcriptData.keyInsights?.length || 0,
        actionItems: transcriptData.actionItems?.length || 0,
        rawTranscript: transcriptData.rawTranscript?.length || 0,
        editedTranscript: transcriptData.editedTranscript?.length || 0
      });
      
      const pptx = new PptxGenJS();
      
      // Set presentation properties
      pptx.author = 'DocNexus.ai';
      pptx.company = 'DocNexus.ai';
      pptx.title = `Meeting Summary - ${transcriptData.hcpName || 'Unknown HCP'}`;
      pptx.subject = 'Healthcare Meeting Analysis';
      
      // Slide 1: Title Slide
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: 'FFFFFF' };
      try {
        titleSlide.addImage({ path: logoPath, x: 3.75, y: 0.5, w: 2.5, h: 1 }); // Large, centered logo
      } catch (e) {}
      titleSlide.addText('DocNexus.ai', {
        x: 1, y: 1.7, w: 8, h: 1,
        fontSize: 40,
        color: 'FFFFFF',
        bold: true,
        align: 'center',
        fontFace: this.brandFonts.title
      });
      // Accent line under title
      titleSlide.addShape(pptx.ShapeType.rect, {
        x: 4, y: 2.6, w: 2, h: 0.08,
        fill: { color: 'FFFFFF' },
        line: { color: 'FFFFFF' }
      });
      // Title Slide: Improved alignment and spacing
      // Main title
      titleSlide.addText('Healthcare Meeting Analysis', {
        x: 0.5, y: 1.8, w: 9, h: 1,
        fontSize: 40,
        color: this.brandColors.primary,
        bold: true,
        align: 'center',
        fontFace: this.brandFonts.title
      });
      // Subtitle: Meeting with ...
      titleSlide.addText(`Meeting with ${transcriptData.hcpName || 'Unknown HCP'}`,
        { x: 0.5, y: 2.7, w: 9, h: 0.7, fontSize: 26, color: this.brandColors.accent, align: 'center', fontFace: this.brandFonts.body });
      // Date
      titleSlide.addText(`Date: ${transcriptData.meetingDate ? new Date(transcriptData.meetingDate).toLocaleDateString() : 'Unknown Date'}`,
        { x: 0.5, y: 3.6, w: 9, h: 0.7, fontSize: 22, color: this.brandColors.dark, align: 'center', fontFace: this.brandFonts.body });
      // Footer (already handled by slide master)
      

      // Slide 2: Meeting Overview (reverted to reliable layout)
      const overviewSlide = pptx.addSlide();
      // Header bar
      overviewSlide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 10, h: 0.8,
        fill: { color: this.brandColors.primary },
        line: { color: this.brandColors.primary }
      });
      // Header text
      overviewSlide.addText('Meeting Overview', {
        x: 0.5, y: 0.1, w: 9, h: 0.8,
        fontSize: 20,
        color: 'FFFFFF',
        bold: true,
        fontFace: this.brandFonts.title,
        align: 'left',
        valign: 'middle',
        autoFit: true
      });
      // Table (fixed position and width)
      // Table data (without Sentiment row)
      const overviewData = [
        ['HCP Name', transcriptData.hcpName || 'Unknown'],
        ['Specialty', transcriptData.hcpSpecialty || 'Unknown'],
        ['Meeting Date', transcriptData.meetingDate ? new Date(transcriptData.meetingDate).toLocaleDateString() : 'Unknown'],
        ['Duration', transcriptData.meetingDuration ? `${Math.round(transcriptData.meetingDuration / 60)} minutes` : 'Unknown'],
        ['Attendees', transcriptData.attendees && transcriptData.attendees.length > 0 ? transcriptData.attendees.map(a => a.name).join(', ') : 'Unknown']
      ];
      overviewSlide.addTable(overviewData.map(row => [
        { text: row[0], options: { color: this.brandColors.primary, bold: true, align: 'left', valign: 'middle', margin: [8, 8, 8, 8] } },
        { text: row[1], options: { color: this.brandColors.dark, align: 'left', valign: 'middle', margin: [8, 8, 8, 8] } }
      ]), {
        x: 1.5, y: 1, w: 7, h: 4,
        colW: [2.5, 4.5],
        border: { type: 'solid', color: 'D1D5DB' },
        fontSize: 16,
        valign: 'middle',
        rowH: 0.9,
        fill: '#FFFFFF',
        fontFace: this.brandFonts.body
      });
      
      // Slide 3: Sentiment Analysis
      const sentimentSlide = pptx.addSlide();
      sentimentSlide.addText('Sentiment Analysis', {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 20,
        color: this.brandColors.primary,
        bold: true
      });
      
      const sentimentScore = transcriptData.sentimentAnalysis?.score || 0;
      const sentimentColor = sentimentScore > 0.3 ? this.brandColors.success : 
                           sentimentScore < -0.3 ? this.brandColors.danger : 
                           this.brandColors.warning;
      
      sentimentSlide.addText(`Overall Sentiment: ${transcriptData.sentimentAnalysis?.overall ? transcriptData.sentimentAnalysis.overall.toUpperCase() : 'UNKNOWN'}`, {
        x: 0.5, y: 1.5, w: 9, h: 0.8,
        fontSize: 16,
        color: sentimentColor,
        bold: true
      });
      
      sentimentSlide.addText(`Sentiment Score: ${sentimentScore.toFixed(2)}`, {
        x: 0.5, y: 2.5, w: 9, h: 0.5,
        fontSize: 14,
        color: this.brandColors.dark
      });
      
      // Sentiment breakdown
      const sentimentDetails = transcriptData.sentimentAnalysis?.details || { positive: 0, neutral: 0, negative: 0 };
      // Sentiment breakdown table (remove color code column)
      const sentimentBreakdown = [
        ['Positive', `${sentimentDetails.positive || 0}%`],
        ['Neutral', `${sentimentDetails.neutral || 0}%`],
        ['Negative', `${sentimentDetails.negative || 0}%`]
      ];
      sentimentSlide.addTable(sentimentBreakdown, {
        x: 0.5, y: 3.2, w: 9, h: 2,
        colW: [3, 3],
        border: { type: 'solid', color: 'D1D5DB' },
        fontSize: 16,
        fill: '#FFFFFF',
        color: this.brandColors.dark,
        align: ['left', 'left']
      });
      
      // Slide 4: Key Insights
      const insightsSlide = pptx.addSlide();
      insightsSlide.addText('Key Insights', {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 20,
        color: this.brandColors.primary,
        bold: true
      });
      // --- Key Insights: vertically center the list block ---
      const insights = (transcriptData.keyInsights || []).slice(0, 5);
      if (insights.length > 0) {
        const insightTexts = insights.map(i => (typeof i === 'string' ? i : i.insight) || 'No insight text available');
        insightsSlide.addText(
          insightTexts.map((t, i) => `${i + 1}. ${t}`).join('\n'),
          {
            x: 1, y: 1.3, w: 7, h: 4, // y changed from 0.3 to 1.3 for spacing below heading
            fontSize: 15,
            color: this.brandColors.dark,
            align: 'left',
            lineSpacing: 32
          }
        );
      } else {
        insightsSlide.addText('No key insights available for this meeting.', {
          x: 1.2, y: 1.3, w: 7, h: 0.6, // y changed from 0.5 to 1.3 for spacing below heading
          fontSize: 14,
          color: this.brandColors.dark,
          italic: true,
          align: 'left'
        });
      }
      
      // Slide 5: Action Items
      const actionSlide = pptx.addSlide();
      actionSlide.addText('Action Items', {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 20,
        color: this.brandColors.primary,
        bold: true
      });
      // --- Action Items: two-column table (item | priority), centered, padded ---
      const actionItems = (transcriptData.actionItems || []).slice(0, 5);
      if (actionItems.length > 0) {
        const actionTable = actionItems.map((item, idx) => [
          { text: `${idx + 1}. ${(typeof item === 'string' ? item : item.item) || 'No action item text available'}`, options: { color: this.brandColors.dark, align: 'left', valign: 'middle', margin: [8, 8, 8, 8], fontSize: 12 } },
          { text: `Priority: ${(item.priority || 'medium').toUpperCase()}`, options: { color: item.priority === 'high' ? this.brandColors.danger : item.priority === 'medium' ? this.brandColors.warning : this.brandColors.success, bold: true, align: 'right', valign: 'middle', margin: [8, 8, 8, 8], fontSize: 12 } }
        ]);
        actionSlide.addTable(actionTable, {
          x: 1, y: 1.5, w: 7, h: 4, // centered, more vertical space
          colW: [5.2, 1.8],
          border: { type: 'solid', color: 'D1D5DB' },
          fontSize: 12,
          valign: 'middle',
          rowH: 0.9,
          fill: '#FFFFFF',
          fontFace: this.brandFonts.body
        });
      } else {
        actionSlide.addText('No action items identified for this meeting.', {
          x: 1.2, y: 1.8, w: 7, h: 0.6,
          fontSize: 14,
          color: this.brandColors.dark,
          italic: true,
          align: 'left'
        });
      }
      
      // Slide 6: Transcript Highlights
      // Removed Next Steps & Recommendations slide
      
      // Footer on all slides
      pptx.defineSlideMaster({
        title: 'MASTER_SLIDE',
        objects: [
          { 'text': { text: 'Generated by DocNexus.ai', options: { x: 0.5, y: 6.8, w: 7, h: 0.3, fontSize: 10, color: this.brandColors.primary, align: 'left', fontFace: this.brandFonts.body } } },
          { 'text': { text: new Date().toLocaleDateString(), options: { x: 7, y: 6.8, w: 2, h: 0.3, fontSize: 10, color: this.brandColors.dark, align: 'right', fontFace: this.brandFonts.body } } },
          // Logo as footer (if supported)
          { 'image': { path: logoPath, options: { x: 8.5, y: 6.7, w: 1, h: 0.3 } } }
        ]
      });
      
      // Generate buffer
      const buffer = await pptx.write('nodebuffer');
      
      // Upload to local storage
      const fileName = `meeting_summary_${transcriptData.hcpName.replace(/\s+/g, '_')}_${Date.now()}.pptx`;
      const uploadResult = await fileService.uploadBuffer(buffer, fileName, 'documents');
      
      if (uploadResult.success) {
        console.log('✅ PowerPoint presentation generated and uploaded');
        return {
          success: true,
          url: uploadResult.url,
          fileName: fileName,
          size: uploadResult.size
        };
      } else {
        throw new Error('Failed to upload PowerPoint to S3');
      }
    } catch (error) {
      console.error('❌ PowerPoint generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate PDF report
   * @param {Object} transcriptData - Transcript and analysis data
   * @returns {Promise<Object>} Generation result
   */
  async generatePDF(transcriptData) {
    try {
      console.log('📄 Generating PDF report...');
      console.log('📄 Transcript data received:', {
        hcpName: transcriptData.hcpName,
        hcpSpecialty: transcriptData.hcpSpecialty,
        meetingDate: transcriptData.meetingDate,
        meetingDuration: transcriptData.meetingDuration,
        attendees: transcriptData.attendees,
        sentimentAnalysis: transcriptData.sentimentAnalysis,
        keyInsights: transcriptData.keyInsights?.length || 0,
        actionItems: transcriptData.actionItems?.length || 0,
        rawTranscript: transcriptData.rawTranscript?.length || 0,
        editedTranscript: transcriptData.editedTranscript?.length || 0
      });
      
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
      
      // Modern, thinner blue banner with logo and title horizontally aligned
      doc.rect(0, 0, doc.page.width, 40).fill(this.brandColors.primary);
      try {
        doc.image(logoPath, 50, 8, { width: 32 });
      } catch (e) {}
      doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('DocNexus.ai', 90, 14, { align: 'left', continued: false });
      doc.moveDown(2);
      // Centered main report title
      doc.fillColor(this.brandColors.dark).fontSize(20).font('Helvetica-Bold').text('Healthcare Meeting Analysis Report', { align: 'center' });
      doc.moveDown(1.5);
      // Section: Meeting Details
      doc.fillColor(this.brandColors.primary).fontSize(14).font('Helvetica-Bold').text('Meeting Details', { align: 'left', underline: false });
      doc.moveDown(0.2);
      doc.fontSize(11).font('Helvetica').fillColor(this.brandColors.dark);
      doc.text(`HCP Name: ${transcriptData.hcpName || 'Unknown'}`);
      doc.text(`Specialty: ${transcriptData.hcpSpecialty || 'Unknown'}`);
      doc.text(`Meeting Date: ${transcriptData.meetingDate ? new Date(transcriptData.meetingDate).toLocaleDateString() : 'Unknown'}`);
      doc.text(`Duration: ${transcriptData.meetingDuration ? Math.round(transcriptData.meetingDuration / 60) : 'Unknown'} minutes`);
      doc.text(`Attendees: ${transcriptData.attendees && transcriptData.attendees.length > 0 ? transcriptData.attendees.map(a => a.name).join(', ') : 'Unknown'}`);
      doc.moveDown(1);
      // Section: Sentiment Analysis
      doc.fillColor(this.brandColors.primary).fontSize(14).font('Helvetica-Bold').text('Sentiment Analysis', { align: 'left', underline: false });
      doc.moveDown(0.2);
      doc.fontSize(11).font('Helvetica').fillColor(this.brandColors.dark);
      const sentimentScore = transcriptData.sentimentAnalysis?.score || 0;
      const sentimentColor = sentimentScore > 0.3 ? this.brandColors.success : 
                           sentimentScore < -0.3 ? this.brandColors.danger : 
                           this.brandColors.warning;
      doc.text(`Overall Sentiment: `, { continued: true }).fillColor(this.brandColors.success).text(`${transcriptData.sentimentAnalysis?.overall ? transcriptData.sentimentAnalysis.overall.toUpperCase() : 'UNKNOWN'}`);
      doc.fillColor(this.brandColors.dark).text(`Sentiment Score: ${sentimentScore.toFixed(2)}`);
      doc.moveDown(0.2);
      // Sentiment Breakdown
      doc.fontSize(12).fillColor(this.brandColors.primary).font('Helvetica-Bold').text('Sentiment Breakdown:', { align: 'left', underline: false });
      const sentimentDetails = transcriptData.sentimentAnalysis?.details || { positive: 0, neutral: 0, negative: 0 };
      doc.fontSize(11).font('Helvetica').fillColor(this.brandColors.success).text(`• Positive: ${sentimentDetails.positive || 0}%`);
      doc.fillColor(this.brandColors.warning).text(`• Neutral: ${sentimentDetails.neutral || 0}%`);
      doc.fillColor(this.brandColors.danger).text(`• Negative: ${sentimentDetails.negative || 0}%`);
      doc.fillColor(this.brandColors.dark);
      doc.moveDown(1);
      // Section: Key Insights
      doc.fillColor(this.brandColors.primary).fontSize(14).font('Helvetica-Bold').text('Key Insights', { align: 'left', underline: false });
      doc.moveDown(0.2);
      doc.fontSize(11).font('Helvetica').fillColor(this.brandColors.dark);
      const insights = (transcriptData.keyInsights || []).slice(0, 8);
      if (insights.length > 0) {
        insights.forEach((insight, index) => {
          doc.text(`${index + 1}. ${insight.insight || 'No insight text available'}`);
        });
      } else {
        doc.text('No key insights available for this meeting.');
      }
      doc.moveDown(1);
      // Section: Action Items
      doc.fillColor(this.brandColors.primary).fontSize(14).font('Helvetica-Bold').text('Action Items', { align: 'left', underline: false });
      doc.moveDown(0.2);
      doc.fontSize(11).font('Helvetica').fillColor(this.brandColors.dark);
      const actionItems = (transcriptData.actionItems || []).slice(0, 8);
      if (actionItems.length > 0) {
        actionItems.forEach((item, index) => {
          doc.text(`${index + 1}. ${item.item || 'No action item text available'}`);
          const priorityColor = item.priority === 'high' ? this.brandColors.danger :
                                item.priority === 'medium' ? this.brandColors.warning :
                                this.brandColors.success;
          doc.fillColor(priorityColor).font('Helvetica-Bold').text(`   Priority: ${(item.priority || 'medium').toUpperCase()}`);
          doc.fillColor(this.brandColors.dark).font('Helvetica');
        });
      } else {
        doc.text('No action items identified for this meeting.');
      }
      doc.moveDown(1);
      
      // Transcript Summary
      // (Removed Transcript Summary section)
      
      // --- Footer (add only if enough space left, else on new page) ---
      const footerHeight = 50;
      const minSpaceForFooter = 70; // space needed for footer and logo
      if (doc.y + minSpaceForFooter > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
      doc.moveDown(2);
      doc.fontSize(8)
         .fillColor(this.brandColors.primary)
         .text('Generated by DocNexus.ai - Healthcare Workflow Automation', { align: 'center' });
      try {
        doc.image(logoPath, doc.page.width - 100, doc.y + 8, { width: 50 });
      } catch (e) {}
      doc.fontSize(8)
         .fillColor(this.brandColors.dark)
         .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
      
      // End the document
      doc.end();
      
      // Wait for the document to finish
      return new Promise((resolve, reject) => {
        doc.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            
            // Upload to local storage
            const fileName = `meeting_report_${transcriptData.hcpName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
            const uploadResult = await fileService.uploadBuffer(buffer, fileName, 'documents');
            
            if (uploadResult.success) {
              console.log('✅ PDF report generated and uploaded');
              resolve({
                success: true,
                url: uploadResult.url,
                fileName: fileName,
                size: uploadResult.size
              });
            } else {
              reject(new Error('Failed to upload PDF to S3'));
            }
          } catch (error) {
            reject(error);
          }
        });
        
        doc.on('error', reject);
      });
    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      return {
        success: false,
        error: error.message
      };
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
   * Generate both PPT and PDF documents
   * @param {Object} transcriptData - Transcript and analysis data
   * @returns {Promise<Object>} Generation results
   */
  async generateDocuments(transcriptData) {
    try {
      console.log('📋 Generating both PPT and PDF documents...');
      
      const [pptResult, pdfResult] = await Promise.all([
        this.generatePowerPoint(transcriptData),
        this.generatePDF(transcriptData)
      ]);
      
      const results = {
        success: pptResult.success && pdfResult.success,
        powerpoint: pptResult,
        pdf: pdfResult,
        generatedAt: new Date()
      };
      
      if (results.success) {
        console.log('✅ Both documents generated successfully');
      } else {
        console.log('⚠️ Some documents failed to generate');
      }
      
      return results;
    } catch (error) {
      console.error('❌ Document generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new DocumentService(); 