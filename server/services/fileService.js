const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class FileService {
  constructor() {
    // Create uploads directory if it doesn't exist
    this.uploadsDir = path.join(__dirname, '..', 'uploads');
    this.documentsDir = path.join(__dirname, '..', 'documents');
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    const dirs = [this.uploadsDir, this.documentsDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Upload file to local storage
   * @param {string} filePath - Local file path
   * @param {string} fileName - Original file name
   * @param {string} folder - Storage folder path
   * @param {object|null} req - Express request object (optional)
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(filePath, fileName, folder = 'uploads', req = null) {
    try {
      console.log(`📤 Uploading file locally: ${fileName}`);
      
      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const targetDir = folder === 'uploads' ? this.uploadsDir : this.documentsDir;
      const targetPath = path.join(targetDir, uniqueFileName);
      
      // Copy file to target location
      fs.copyFileSync(filePath, targetPath);
      
      console.log(`✅ File uploaded successfully: ${targetPath}`);
      
      // Generate full URL for production
      let baseUrl;
      if (req) {
        let protocol = req.protocol;
        let host = req.get('host');
        if (host && host.includes('onrender.com')) {
          protocol = 'https';
        }
        baseUrl = protocol + '://' + host;
      } else {
        baseUrl = process.env.NODE_ENV === 'production' 
          ? 'https://docnexus-backend-teresha.onrender.com'
          : 'http://localhost:5000';
      }
      
      return {
        success: true,
        url: `${baseUrl}/api/files/${folder}/${uniqueFileName}`,
        key: `${folder}/${uniqueFileName}`,
        localPath: targetPath,
        originalName: fileName,
        size: fs.statSync(targetPath).size
      };
    } catch (error) {
      console.error(`❌ Local upload failed for ${fileName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload buffer to local storage
   * @param {Buffer} buffer - File buffer
   * @param {string} fileName - File name
   * @param {string} folder - Storage folder path
   * @param {object|null} req - Express request object (optional)
   * @returns {Promise<Object>} Upload result
   */
  async uploadBuffer(buffer, fileName, folder = 'documents', req = null) {
    try {
      console.log(`📤 Uploading buffer locally: ${fileName}`);
      
      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const targetDir = folder === 'uploads' ? this.uploadsDir : this.documentsDir;
      const targetPath = path.join(targetDir, uniqueFileName);
      
      // Write buffer to file
      fs.writeFileSync(targetPath, buffer);
      
      console.log(`✅ Buffer uploaded successfully: ${targetPath}`);
      
      // Generate full URL for production
      let baseUrl;
      if (req) {
        let protocol = req.protocol;
        let host = req.get('host');
        if (host && host.includes('onrender.com')) {
          protocol = 'https';
        }
        baseUrl = protocol + '://' + host;
      } else {
        baseUrl = process.env.NODE_ENV === 'production' 
          ? 'https://docnexus-backend-teresha.onrender.com'
          : 'http://localhost:5000';
      }
      
      return {
        success: true,
        url: `${baseUrl}/api/files/${folder}/${uniqueFileName}`,
        key: `${folder}/${uniqueFileName}`,
        localPath: targetPath,
        originalName: fileName,
        size: buffer.length
      };
    } catch (error) {
      console.error(`❌ Local buffer upload failed for ${fileName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get file from local storage
   * @param {string} key - File key (folder/filename)
   * @returns {Promise<Object>} File result
   */
  async getFile(key) {
    try {
      console.log(`📥 Getting file locally: ${key}`);
      
      const [folder, filename] = key.split('/');
      const targetDir = folder === 'uploads' ? this.uploadsDir : this.documentsDir;
      const filePath = path.join(targetDir, filename);
      
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }
      
      const buffer = fs.readFileSync(filePath);
      const stats = fs.statSync(filePath);
      
      console.log(`✅ File retrieved successfully: ${filePath}`);
      
      return {
        success: true,
        buffer: buffer,
        contentType: this.getContentType(path.extname(filename)),
        size: stats.size,
        localPath: filePath,
        metadata: {
          originalName: filename,
          uploadedAt: stats.birthtime.toISOString(),
          fileSize: stats.size.toString()
        }
      };
    } catch (error) {
      console.error(`❌ Local file retrieval failed for ${key}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete file from local storage
   * @param {string} key - File key (folder/filename)
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(key) {
    try {
      console.log(`🗑️ Deleting file locally: ${key}`);
      
      const [folder, filename] = key.split('/');
      const targetDir = folder === 'uploads' ? this.uploadsDir : this.documentsDir;
      const filePath = path.join(targetDir, filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ File deleted successfully: ${filePath}`);
      }
      
      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      console.error(`❌ Local file deletion failed for ${key}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List files in local storage
   * @param {string} folder - Folder to list
   * @returns {Promise<Object>} List result
   */
  async listFiles(folder = 'uploads') {
    try {
      console.log(`📋 Listing files locally: ${folder}`);
      
      const targetDir = folder === 'uploads' ? this.uploadsDir : this.documentsDir;
      
      if (!fs.existsSync(targetDir)) {
        return {
          success: true,
          files: []
        };
      }
      
      const files = fs.readdirSync(targetDir)
        .filter(file => fs.statSync(path.join(targetDir, file)).isFile())
        .map(file => {
          const filePath = path.join(targetDir, file);
          const stats = fs.statSync(filePath);
          // Generate full URL for production
          const baseUrl = process.env.NODE_ENV === 'production' 
            ? 'https://docnexus-backend-teresha.onrender.com'
            : 'http://localhost:5000';
          
          return {
            key: `${folder}/${file}`,
            name: file,
            size: stats.size,
            lastModified: stats.mtime,
            url: `${baseUrl}/api/files/${folder}/${file}`
          };
        });
      
      console.log(`✅ Files listed successfully: ${files.length} files`);
      
      return {
        success: true,
        files: files
      };
    } catch (error) {
      console.error(`❌ Local file listing failed for ${folder}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if file exists
   * @param {string} key - File key
   * @returns {Promise<boolean>} Exists result
   */
  async fileExists(key) {
    try {
      const [folder, filename] = key.split('/');
      const targetDir = folder === 'uploads' ? this.uploadsDir : this.documentsDir;
      const filePath = path.join(targetDir, filename);
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get content type based on file extension
   * @param {string} extension - File extension
   * @returns {string} Content type
   */
  getContentType(extension) {
    const contentTypes = {
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.pdf': 'application/pdf',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.json': 'application/json'
    };
    
    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}

module.exports = new FileService(); 