const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Transcribe audio/video file using OpenAI Whisper
   * @param {string} filePath - Path to the audio/video file
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeFile(filePath) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Check if file is video and extract audio
      const fileExt = path.extname(filePath).toLowerCase();
      const isVideo = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'].includes(fileExt);
      
      let audioPath = filePath;
      
      if (isVideo) {
        audioPath = filePath.replace(fileExt, '.mp3');
        await this.extractAudio(filePath, audioPath);
      }

      const maxRetries = 3;
      let lastError;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const transcription = await this.openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['word']
          });

          // Clean up extracted audio file if it was created
          if (isVideo && fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
          }

          return {
            success: true,
            text: transcription.text,
            segments: transcription.segments,
            language: transcription.language,
            duration: transcription.duration
          };
        } catch (error) {
          lastError = error;
          
          if (attempt < maxRetries - 1) {
            const wait = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, wait));
          }
        }
      }

      throw lastError;
    } catch (error) {
      console.error(`❌ OpenAI transcription failed for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract audio from video file
   * @param {string} videoPath - Path to video file
   * @param {string} audioPath - Path for output audio file
   */
  async extractAudio(videoPath, audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(['-vn', '-acodec', 'libmp3lame', '-q:a', '2'])
        .output(audioPath)
        .on('end', () => resolve())
        .on('error', (err) => {
          console.error(`❌ Audio extraction failed:`, err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Enhanced sentiment analysis with emotional indicators
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} Sentiment analysis result
   */
  async analyzeSentiment(text) {
    try {
      const prompt = `Analyze the sentiment and emotional indicators in the following text. Return a JSON object with:
      {
        "overallSentiment": "positive/negative/neutral",
        "sentimentScore": -1.0 to 1.0,
        "confidence": 0.0 to 1.0,
        "emotionalIndicators": [
          {
            "emotion": "joy/sadness/anger/fear/surprise/disgust/trust/anticipation",
            "intensity": 0.0 to 1.0,
            "context": "brief description of what triggered this emotion"
          }
        ],
        "keyPhrases": ["phrase1", "phrase2"],
        "tone": "professional/casual/formal/informal",
        "summary": "brief summary of the emotional content"
      }

      Text: ${text.slice(0, 4000)}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0].message.content;
      let result;

      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.warn('Failed to parse emotionalIndicators as JSON, setting to empty array:', parseError.message);
        result = {
          overallSentiment: 'neutral',
          sentimentScore: 0,
          confidence: 0.5,
          emotionalIndicators: [],
          keyPhrases: [],
          tone: 'neutral',
          summary: 'Unable to analyze sentiment'
        };
      }

      // Validate emotionalIndicators
      if (!Array.isArray(result.emotionalIndicators)) {
        console.warn('emotionalIndicators is not an array, setting to empty array');
        result.emotionalIndicators = [];
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ OpenAI sentiment analysis failed:', error);
      throw error;
    }
  }

  /**
   * Extract key insights and action items
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} Key insights result
   */
  async extractKeyInsights(text) {
    try {
      const prompt = `Extract key insights and action items from the following text. Return a JSON object with:
      {
        "keyInsights": [
          {
            "insight": "description of the insight",
            "category": "clinical/business/operational/strategic",
            "importance": "high/medium/low",
            "context": "brief context"
          }
        ],
        "actionItems": [
          {
            "action": "specific action to take",
            "priority": "high/medium/low",
            "assignee": "who should do this",
            "deadline": "when this should be done",
            "category": "clinical/business/operational/strategic"
          }
        ],
        "topics": ["topic1", "topic2"],
        "summary": "brief summary of key points"
      }

      Text: ${text.slice(0, 4000)}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500
      });

      const content = response.choices[0].message.content;
      let result;

      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parsing failed:', parseError);
        console.error('Raw content:', content);
        result = {
          keyInsights: [],
          actionItems: [],
          topics: [],
          summary: 'Unable to extract insights'
        };
      }

      // Validate arrays
      if (!Array.isArray(result.keyInsights)) {
        console.warn('keyInsights is not an array, setting to empty array');
        result.keyInsights = [];
      }

      if (!Array.isArray(result.actionItems)) {
        console.warn('actionItems is not an array, setting to empty array');
        result.actionItems = [];
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ OpenAI key insights extraction failed:', error);
      throw error;
    }
  }

  /**
   * Detailed sentiment breakdown analysis
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} Sentiment breakdown result
   */
  async analyzeSentimentBreakdown(text) {
    try {
      const prompt = `Provide a detailed sentiment breakdown analysis of the following text. Return a JSON object with:
      {
        "overallSentiment": "positive/negative/neutral",
        "sentimentScore": -1.0 to 1.0,
        "confidence": 0.0 to 1.0,
        "emotionalBreakdown": {
          "joy": 0.0 to 1.0,
          "sadness": 0.0 to 1.0,
          "anger": 0.0 to 1.0,
          "fear": 0.0 to 1.0,
          "surprise": 0.0 to 1.0,
          "disgust": 0.0 to 1.0,
          "trust": 0.0 to 1.0,
          "anticipation": 0.0 to 1.0
        },
        "toneAnalysis": {
          "formality": "formal/informal",
          "professionalism": "high/medium/low",
          "engagement": "high/medium/low",
          "clarity": "high/medium/low"
        },
        "contextualSentiment": [
          {
            "segment": "text segment",
            "sentiment": "positive/negative/neutral",
            "emotions": ["emotion1", "emotion2"]
          }
        ],
        "summary": "detailed analysis summary"
      }

      Text: ${text.slice(0, 4000)}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content;
      let result;

      try {
        result = JSON.parse(content);
      } catch (parseError) {
        result = {
          overallSentiment: 'neutral',
          sentimentScore: 0,
          confidence: 0.5,
          emotionalBreakdown: {},
          toneAnalysis: {},
          contextualSentiment: [],
          summary: 'Unable to analyze sentiment breakdown'
        };
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ OpenAI sentiment breakdown analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate executive summary
   * @param {string} text - Text to summarize
   * @returns {Promise<Object>} Executive summary result
   */
  async generateExecutiveSummary(text) {
    try {
      const prompt = `Generate a professional executive summary of the following text. Return a JSON object with:
      {
        "summary": "concise executive summary (2-3 paragraphs)",
        "keyPoints": ["point1", "point2", "point3"],
        "recommendations": ["recommendation1", "recommendation2"],
        "nextSteps": ["step1", "step2"],
        "riskFactors": ["risk1", "risk2"],
        "opportunities": ["opportunity1", "opportunity2"]
      }

      Text: ${text.slice(0, 4000)}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500
      });

      const content = response.choices[0].message.content;
      let result;

      try {
        result = JSON.parse(content);
      } catch (parseError) {
        result = {
          summary: 'Unable to generate executive summary',
          keyPoints: [],
          recommendations: [],
          nextSteps: [],
          riskFactors: [],
          opportunities: []
        };
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ OpenAI executive summary generation failed:', error);
      throw error;
    }
  }

  /**
   * Validate medical terminology
   * @param {string} text - Text to validate
   * @returns {Promise<Object>} Medical terminology validation result
   */
  async validateMedicalTerminology(text) {
    try {
      const prompt = `Validate and correct medical terminology in the following text. Return a JSON object with:
      {
        "validatedText": "text with corrected medical terms",
        "corrections": [
          {
            "original": "incorrect term",
            "corrected": "correct term",
            "category": "medication/procedure/diagnosis/anatomy",
            "confidence": 0.0 to 1.0
          }
        ],
        "medicalTerms": ["term1", "term2"],
        "confidence": 0.0 to 1.0,
        "summary": "brief summary of corrections made"
      }

      Text: ${text.slice(0, 4000)}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content;
      let result;

      try {
        result = JSON.parse(content);
      } catch (parseError) {
        result = {
          validatedText: text,
          corrections: [],
          medicalTerms: [],
          confidence: 0.5,
          summary: 'Unable to validate medical terminology'
        };
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ OpenAI medical terminology validation failed:', error);
      throw error;
    }
  }

  /**
   * Test OpenAI API connection
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      });

      return {
        success: true,
        message: 'OpenAI API connection successful',
        model: response.model,
        usage: response.usage
      };
    } catch (error) {
      console.error('❌ OpenAI API connection test failed:', error);
      throw error;
    }
  }
}

module.exports = new OpenAIService(); 