const express = require('express');
const path = require('path');
const fs = require('fs');
const fileService = require('../services/fileService');

const router = express.Router();

/**
 * GET /api/files/:folder/:filename
 * Serve files from local storage
 */
router.get('/:folder/:filename', async (req, res) => {
  try {
    const { folder, filename } = req.params;
    
    // Validate folder parameter
    if (!['uploads', 'documents'].includes(folder)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid folder'
      });
    }
    
    const fileKey = `${folder}/${filename}`;
    const fileResult = await fileService.getFile(fileKey);
    
    if (!fileResult.success) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', fileResult.contentType);
    res.setHeader('Content-Length', fileResult.size);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    // Send the file buffer
    res.send(fileResult.buffer);
    
  } catch (error) {
    console.error('❌ File serving failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/files/:folder
 * List files in a folder
 */
router.get('/:folder', async (req, res) => {
  try {
    const { folder } = req.params;
    
    // Validate folder parameter
    if (!['uploads', 'documents'].includes(folder)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid folder'
      });
    }
    
    const listResult = await fileService.listFiles(folder);
    
    if (!listResult.success) {
      return res.status(500).json({
        success: false,
        error: listResult.error
      });
    }
    
    res.json({
      success: true,
      files: listResult.files
    });
    
  } catch (error) {
    console.error('❌ File listing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/files/:folder/:filename
 * Delete a file from local storage
 */
router.delete('/:folder/:filename', async (req, res) => {
  try {
    const { folder, filename } = req.params;
    
    // Validate folder parameter
    if (!['uploads', 'documents'].includes(folder)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid folder'
      });
    }
    
    const fileKey = `${folder}/${filename}`;
    const deleteResult = await fileService.deleteFile(fileKey);
    
    if (!deleteResult.success) {
      return res.status(500).json({
        success: false,
        error: deleteResult.error
      });
    }
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ File deletion failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 