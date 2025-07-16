const AWS = require('aws-sdk');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

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
      return {
        success: false,
        error: error.message
      };
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
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get a signed URL for a file in S3
   * @param {string} key - S3 key
   * @param {number} expires - Expiry in seconds (default 1 hour)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(key, expires = 3600) {
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
      return {
        success: false,
        error: error.message
      };
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