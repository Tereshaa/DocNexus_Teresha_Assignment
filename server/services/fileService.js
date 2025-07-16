const AWS = require('aws-sdk');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Check if AWS credentials are available
const hasAWSCredentials = process.env.AWS_ACCESS_KEY_ID && 
                         process.env.AWS_SECRET_ACCESS_KEY && 
                         process.env.AWS_REGION && 
                         process.env.AWS_S3_BUCKET;

console.log('🔧 AWS Configuration Check:', {
  hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
  hasRegion: !!process.env.AWS_REGION,
  hasBucket: !!process.env.AWS_S3_BUCKET,
  hasAllCredentials: hasAWSCredentials
});

const s3 = hasAWSCredentials ? new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
}) : null;

const BUCKET = process.env.AWS_S3_BUCKET;

class FileService {
  /**
   * Upload file to S3
   * @param {string} filePath - Local file path
   * @param {string} fileName - Original file name
   * @param {string} folder - S3 folder
   * @param {object|null} req - Express request object (optional)
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(filePath, fileName, folder = 'uploads', req = null) {
    const fs = require('fs');
    try {
      // Check if S3 is configured
      if (!s3 || !BUCKET) {
        console.warn('⚠️ S3 not configured, using local storage fallback');
        return this.uploadToLocalStorage(filePath, fileName, folder, req);
      }

      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const s3Key = `${folder}/${uniqueFileName}`;
      const fileContent = fs.readFileSync(filePath);
      const params = {
        Bucket: BUCKET,
        Key: s3Key,
        Body: fileContent,
        ContentType: this.getContentType(fileExtension),
      };
      await s3.upload(params).promise();
      // Optionally delete local file after upload
      fs.unlinkSync(filePath);
      return {
        success: true,
        url: await this.getSignedUrl(s3Key),
        key: s3Key,
        originalName: fileName,
        size: fileContent.length
      };
    } catch (error) {
      console.error(`❌ S3 upload failed for ${fileName}:`, error);
      console.log('🔄 Falling back to local storage...');
      return this.uploadToLocalStorage(filePath, fileName, folder, req);
    }
  }

  /**
   * Upload buffer to S3
   * @param {Buffer} buffer - File buffer
   * @param {string} fileName - File name
   * @param {string} folder - S3 folder
   * @param {object|null} req - Express request object (optional)
   * @returns {Promise<Object>} Upload result
   */
  async uploadBuffer(buffer, fileName, folder = 'documents', req = null) {
    try {
      // Check if S3 is configured
      if (!s3 || !BUCKET) {
        console.warn('⚠️ S3 not configured, using local storage fallback for buffer');
        return this.uploadBufferToLocalStorage(buffer, fileName, folder, req);
      }

      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const s3Key = `${folder}/${uniqueFileName}`;
      const params = {
        Bucket: BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: this.getContentType(fileExtension),
      };
      await s3.upload(params).promise();
      return {
        success: true,
        url: await this.getSignedUrl(s3Key),
        key: s3Key,
        originalName: fileName,
        size: buffer.length
      };
    } catch (error) {
      console.error(`❌ S3 buffer upload failed for ${fileName}:`, error);
      console.log('🔄 Falling back to local storage for buffer...');
      return this.uploadBufferToLocalStorage(buffer, fileName, folder, req);
    }
  }

  /**
   * Get a signed URL for a file in S3
   * @param {string} key - S3 key
   * @param {number} expires - Expiry in seconds (default 1 hour)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(key, expires = 3600) {
    // If S3 is not configured, return a local file URL
    if (!s3 || !BUCKET) {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://docnexus-backend-teresha.onrender.com' 
        : 'http://localhost:5000';
      return `${baseUrl}/api/files/${key}`;
    }

    const signedUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: BUCKET,
      Key: key,
      Expires: expires,
    });
    
    // Force HTTPS for production URLs to avoid mixed content issues
    if (process.env.NODE_ENV === 'production' && signedUrl.startsWith('http://')) {
      return signedUrl.replace('http://', 'https://');
    }
    
    return signedUrl;
  }

  /**
   * Get file from S3 (returns buffer and metadata)
   * @param {string} key - S3 key
   * @returns {Promise<Object>} File result
   */
  async getFile(key) {
    try {
      // If S3 is not configured, read from local storage
      if (!s3 || !BUCKET) {
        return this.getFileFromLocalStorage(key);
      }

      const params = {
        Bucket: BUCKET,
        Key: key,
      };
      const data = await s3.getObject(params).promise();
      return {
        success: true,
        buffer: data.Body,
        contentType: data.ContentType,
        size: data.ContentLength,
        metadata: data.Metadata
      };
    } catch (error) {
      console.error(`❌ S3 file retrieval failed for ${key}:`, error);
      console.log('🔄 Falling back to local storage...');
      return this.getFileFromLocalStorage(key);
    }
  }

  /**
   * Delete file from S3
   * @param {string} key - S3 key
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(key) {
    try {
      const params = {
        Bucket: BUCKET,
        Key: key,
      };
      await s3.deleteObject(params).promise();
      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      console.error(`❌ S3 file deletion failed for ${key}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List files in S3 folder
   * @param {string} folder - S3 folder
   * @returns {Promise<Object>} List result
   */
  async listFiles(folder = 'uploads') {
    try {
      const params = {
        Bucket: BUCKET,
        Prefix: `${folder}/`,
      };
      const data = await s3.listObjectsV2(params).promise();
      const files = await Promise.all(data.Contents.map(async (item) => {
        return {
          key: item.Key,
          name: path.basename(item.Key),
          size: item.Size,
          lastModified: item.LastModified,
          url: await this.getSignedUrl(item.Key)
        };
      }));
      return {
        success: true,
        files: files
      };
    } catch (error) {
      console.error(`❌ S3 file listing failed for ${folder}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if file exists in S3
   * @param {string} key - S3 key
   * @returns {Promise<boolean>} Exists result
   */
  async fileExists(key) {
    try {
      const params = {
        Bucket: BUCKET,
        Key: key,
      };
      await s3.headObject(params).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upload buffer to local storage (fallback when S3 is not available)
   * @param {Buffer} buffer - File buffer
   * @param {string} fileName - Original file name
   * @param {string} folder - Storage folder
   * @param {object|null} req - Express request object (optional)
   * @returns {Promise<Object>} Upload result
   */
  async uploadBufferToLocalStorage(buffer, fileName, folder = 'documents', req = null) {
    const fs = require('fs');
    try {
      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const localFolder = path.join(__dirname, '..', folder);
      
      // Create folder if it doesn't exist
      if (!fs.existsSync(localFolder)) {
        fs.mkdirSync(localFolder, { recursive: true });
      }
      
      const localFilePath = path.join(localFolder, uniqueFileName);
      
      // Write buffer to local storage
      fs.writeFileSync(localFilePath, buffer);
      
      // Generate local URL
      const baseUrl = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:5000';
      const localUrl = `${baseUrl}/api/files/${folder}/${uniqueFileName}`;
      
      console.log('✅ Buffer uploaded to local storage:', localUrl);
      
      return {
        success: true,
        url: localUrl,
        key: `${folder}/${uniqueFileName}`,
        originalName: fileName,
        size: buffer.length
      };
    } catch (error) {
      console.error(`❌ Local storage buffer upload failed for ${fileName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get file from local storage (fallback when S3 is not available)
   * @param {string} key - File key (folder/filename)
   * @returns {Promise<Object>} File result
   */
  async getFileFromLocalStorage(key) {
    const fs = require('fs');
    try {
      const localFilePath = path.join(__dirname, '..', key);
      
      if (!fs.existsSync(localFilePath)) {
        return {
          success: false,
          error: 'File not found in local storage'
        };
      }
      
      const buffer = fs.readFileSync(localFilePath);
      const fileExtension = path.extname(key);
      
      return {
        success: true,
        buffer: buffer,
        contentType: this.getContentType(fileExtension),
        size: buffer.length,
        metadata: {}
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
   * Upload file to local storage (fallback when S3 is not available)
   * @param {string} filePath - Local file path
   * @param {string} fileName - Original file name
   * @param {string} folder - Storage folder
   * @param {object|null} req - Express request object (optional)
   * @returns {Promise<Object>} Upload result
   */
  async uploadToLocalStorage(filePath, fileName, folder = 'uploads', req = null) {
    const fs = require('fs');
    try {
      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const localFolder = path.join(__dirname, '..', folder);
      
      // Create folder if it doesn't exist
      if (!fs.existsSync(localFolder)) {
        fs.mkdirSync(localFolder, { recursive: true });
      }
      
      const localFilePath = path.join(localFolder, uniqueFileName);
      
      // Copy file to local storage
      fs.copyFileSync(filePath, localFilePath);
      
      // Generate local URL
      const baseUrl = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:5000';
      const localUrl = `${baseUrl}/api/files/${folder}/${uniqueFileName}`;
      
      console.log('✅ File uploaded to local storage:', localUrl);
      
      return {
        success: true,
        url: localUrl,
        key: `${folder}/${uniqueFileName}`,
        originalName: fileName,
        size: fs.statSync(localFilePath).size
      };
    } catch (error) {
      console.error(`❌ Local storage upload failed for ${fileName}:`, error);
      return {
        success: false,
        error: error.message
      };
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