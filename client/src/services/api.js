import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://docnexus-backend-teresha.onrender.com/api',
  timeout: 120000, // Increased timeout to 2 minutes
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Debug logging for upload requests
    if (config.url === '/upload') {
      console.log('Upload request config:', {
        url: config.baseURL + config.url,
        method: config.method,
        headers: config.headers,
        dataType: config.data instanceof FormData ? 'FormData' : typeof config.data
      });
    }
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Upload API
export const uploadAPI = {
  // Upload single file
  uploadFile: (formData) => api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  // Upload multiple files
  uploadBatch: (formData) => api.post('/upload/batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  // Get upload status
  getStatus: (transcriptId) => api.get(`/upload/status/${transcriptId}`),

  // Delete upload
  deleteUpload: (transcriptId) => api.delete(`/upload/${transcriptId}`),
};

// Transcripts API
export const transcriptsAPI = {
  // Get all transcripts
  getTranscripts: (params) => api.get('/transcripts', { params }),

  // Get single transcript
  getTranscript: (id) => api.get(`/transcripts/${id}`),

  // Update transcript
  updateTranscript: (id, data) => api.put(`/transcripts/${id}`, data),

  // Edit transcript
  editTranscript: (id, data) => api.post(`/transcripts/${id}/edit`, data),

  // Re-analyze transcript
  reanalyzeTranscript: (id, data) => api.post(`/transcripts/${id}/reanalyze`, data),

  // Delete transcript
  deleteTranscript: (id) => api.delete(`/transcripts/${id}`),

  // Get transcript statistics
  getStats: (params) => api.get('/transcripts/stats/overview', { params }),

  // Search transcripts
  searchTranscripts: (params) => api.get('/transcripts/search', { params }),
};

// AI API
export const aiAPI = {
  // Transcribe audio
  transcribe: (data) => api.post('/ai/transcribe', data),

  // Analyze sentiment
  analyzeSentiment: (data) => api.post('/ai/analyze-sentiment', data),

  // Extract insights
  extractInsights: (data) => api.post('/ai/extract-insights', data),

  // Generate summary
  generateSummary: (data) => api.post('/ai/generate-summary', data),

  // Validate terminology
  validateTerminology: (data) => api.post('/ai/validate-terminology', data),

  // Analyze specific transcript
  analyzeTranscript: (id, data) => api.post(`/ai/analyze-transcript/${id}`, data),

  // Batch analyze
  batchAnalyze: (data) => api.post('/ai/batch-analyze', data),

  // Health check
  health: () => api.get('/ai/health'),
};

// CRM API
export const crmAPI = {
  // Sync to CRM
  sync: (data) => api.post('/crm/sync', data),

  // Batch sync
  batchSync: (data) => api.post('/crm/sync-batch', data),

  // Get sync status
  getStatus: (transcriptId) => api.get(`/crm/status/${transcriptId}`),

  // Search HCP
  searchHCP: (hcpName, params) => api.get(`/crm/hcp/${hcpName}`, { params }),

  // Initialize CRM
  initialize: (data) => api.post('/crm/initialize', data),

  // Health check
  health: () => api.get('/crm/health'),

  // Get sync statistics
  getSyncStats: (params) => api.get('/crm/sync-stats', { params }),
};

// Documents API
// Removed unused documentsAPI export

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
};

// Utility functions
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'processing':
      return 'info';
    case 'completed':
    case 'synced':
      return 'success';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
};

export const getStatusText = (status) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'edited':
      return 'Edited';
    case 'failed':
      return 'Failed';
    case 'synced':
      return 'Synced';
    default:
      return status;
  }
};

export default api; 
