const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

class FileService {
  constructor() {
    this.s3 = null;
    this.bucketName = process.env.AWS_S3_BUCKET;
    this.initializeS3();
  }

  /**
   * Initialize S3 client
   */
  initializeS3() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && this.bucketName) {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });
    } else {
      console.warn('⚠️ S3 not configured - will use local storage fallback');
    }
  }

  /**
   * Upload file to S3 or local storage
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - File name
   * @param {string} folder - Folder path
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(fileBuffer, fileName, folder = 'uploads') {
    try {
      if (this.s3 && this.bucketName) {
        const key = `${folder}/${Date.now()}-${fileName}`;
        const params = {
          Bucket: this.bucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: this.getContentType(fileName),
          ACL: 'public-read'
        };

        const result = await this.s3.upload(params).promise();
        return {
          success: true,
          url: result.Location,
          key: key,
          storage: 's3'
        };
      } else {
        return await this.uploadToLocalStorage(fileBuffer, fileName, folder);
      }
    } catch (error) {
      console.error(`❌ S3 upload failed for ${fileName}:`, error);
      return await this.uploadToLocalStorage(fileBuffer, fileName, folder);
    }
  }

  /**
   * Upload buffer to S3 or local storage
   * @param {Buffer} buffer - Buffer to upload
   * @param {string} fileName - File name
   * @param {string} folder - Folder path
   * @returns {Promise<Object>} Upload result
   */
  async uploadBuffer(buffer, fileName, folder = 'uploads') {
    try {
      if (this.s3 && this.bucketName) {
        const key = `${folder}/${Date.now()}-${fileName}`;
        const params = {
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: this.getContentType(fileName),
          ACL: 'public-read'
        };

        const result = await this.s3.upload(params).promise();
        return {
          success: true,
          url: result.Location,
          key: key,
          storage: 's3'
        };
      } else {
        return await this.uploadBufferToLocalStorage(buffer, fileName, folder);
      }
    } catch (error) {
      console.error(`❌ S3 buffer upload failed for ${fileName}:`, error);
      return await this.uploadBufferToLocalStorage(buffer, fileName, folder);
    }
  }

  /**
   * Get file from S3 or local storage
   * @param {string} key - File key
   * @returns {Promise<Object>} File result
   */
  async getFile(key) {
    try {
      if (this.s3 && this.bucketName) {
        const params = {
          Bucket: this.bucketName,
          Key: key
        };

        const result = await this.s3.getObject(params).promise();
        return {
          success: true,
          data: result.Body,
          contentType: result.ContentType,
          storage: 's3'
        };
      } else {
        return await this.getFileFromLocalStorage(key);
      }
    } catch (error) {
      console.error(`❌ S3 file retrieval failed for ${key}:`, error);
      return await this.getFileFromLocalStorage(key);
    }
  }

  /**
   * Delete file from S3 or local storage
   * @param {string} key - File key
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(key) {
    try {
      if (this.s3 && this.bucketName) {
        const params = {
          Bucket: this.bucketName,
          Key: key
        };

        await this.s3.deleteObject(params).promise();
        return {
          success: true,
          message: 'File deleted from S3',
          storage: 's3'
        };
      } else {
        return await this.deleteFileFromLocalStorage(key);
      }
    } catch (error) {
      console.error(`❌ S3 file deletion failed for ${key}:`, error);
      return await this.deleteFileFromLocalStorage(key);
    }
  }

  /**
   * List files in S3 or local storage
   * @param {string} folder - Folder path
   * @returns {Promise<Object>} List result
   */
  async listFiles(folder = 'uploads') {
    try {
      if (this.s3 && this.bucketName) {
        const params = {
          Bucket: this.bucketName,
          Prefix: folder + '/'
        };

        const result = await this.s3.listObjectsV2(params).promise();
        const files = result.Contents.map(item => ({
          key: item.Key,
          size: item.Size,
          lastModified: item.LastModified,
          url: `https://${this.bucketName}.s3.amazonaws.com/${item.Key}`
        }));

        return {
          success: true,
          files: files,
          storage: 's3'
        };
      } else {
        return await this.listFilesFromLocalStorage(folder);
      }
    } catch (error) {
      console.error(`❌ S3 file listing failed for ${folder}:`, error);
      return await this.listFilesFromLocalStorage(folder);
    }
  }

  /**
   * Upload file to local storage
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - File name
   * @param {string} folder - Folder path
   * @returns {Promise<Object>} Upload result
   */
  async uploadToLocalStorage(fileBuffer, fileName, folder = 'uploads') {
    try {
      const uploadDir = path.join(__dirname, '..', folder);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const timestamp = Date.now();
      const key = `${folder}/${timestamp}-${fileName}`;
      const filePath = path.join(uploadDir, `${timestamp}-${fileName}`);

      fs.writeFileSync(filePath, fileBuffer);
      const localUrl = `/api/files/${key}`;

      return {
        success: true,
        url: localUrl,
        key: key,
        storage: 'local'
      };
    } catch (error) {
      console.error(`❌ Local storage upload failed for ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Upload buffer to local storage
   * @param {Buffer} buffer - Buffer to upload
   * @param {string} fileName - File name
   * @param {string} folder - Folder path
   * @returns {Promise<Object>} Upload result
   */
  async uploadBufferToLocalStorage(buffer, fileName, folder = 'uploads') {
    try {
      const uploadDir = path.join(__dirname, '..', folder);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const timestamp = Date.now();
      const key = `${folder}/${timestamp}-${fileName}`;
      const filePath = path.join(uploadDir, `${timestamp}-${fileName}`);

      fs.writeFileSync(filePath, buffer);
      const localUrl = `/api/files/${key}`;

      return {
        success: true,
        url: localUrl,
        key: key,
        storage: 'local'
      };
    } catch (error) {
      console.error(`❌ Local storage buffer upload failed for ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Get file from local storage
   * @param {string} key - File key
   * @returns {Promise<Object>} File result
   */
  async getFileFromLocalStorage(key) {
    try {
      const filePath = path.join(__dirname, '..', key);
      
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const data = fs.readFileSync(filePath);
      const contentType = this.getContentType(path.basename(key));

      return {
        success: true,
        data: data,
        contentType: contentType,
        storage: 'local'
      };
    } catch (error) {
      console.error(`❌ Local file retrieval failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete file from local storage
   * @param {string} key - File key
   * @returns {Promise<Object>} Delete result
   */
  async deleteFileFromLocalStorage(key) {
    try {
      const filePath = path.join(__dirname, '..', key);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return {
        success: true,
        message: 'File deleted from local storage',
        storage: 'local'
      };
    } catch (error) {
      console.error(`❌ Local file deletion failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * List files from local storage
   * @param {string} folder - Folder path
   * @returns {Promise<Object>} List result
   */
  async listFilesFromLocalStorage(folder = 'uploads') {
    try {
      const folderPath = path.join(__dirname, '..', folder);
      
      if (!fs.existsSync(folderPath)) {
        return {
          success: true,
          files: [],
          storage: 'local'
        };
      }

      const files = fs.readdirSync(folderPath)
        .filter(file => !file.startsWith('.'))
        .map(file => {
          const filePath = path.join(folderPath, file);
          const stats = fs.statSync(filePath);
          return {
            key: `${folder}/${file}`,
            size: stats.size,
            lastModified: stats.mtime,
            url: `/api/files/${folder}/${file}`
          };
        });

      return {
        success: true,
        files: files,
        storage: 'local'
      };
    } catch (error) {
      console.error(`❌ Local file listing failed for ${folder}:`, error);
      throw error;
    }
  }

  /**
   * Get content type based on file extension
   * @param {string} fileName - File name
   * @returns {string} Content type
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.json': 'application/json'
    };
    return contentTypes[ext] || 'application/octet-stream';
  }
}

module.exports = new FileService(); 