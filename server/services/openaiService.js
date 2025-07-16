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
   * Transcribe audio or video file using OpenAI Whisper
   * @param {string} filePath - Path to the audio or video file
   * @param {string} language - Language code (optional)
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeAudio(filePath, language = 'en') {
    let audioPath = filePath;
    let tempAudioCreated = false;
    const maxRetries = 2;
    let attempt = 0;
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    try {
      console.log(`🎤 Starting OpenAI transcription for: ${filePath}`);
      console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`);
      console.log(`📁 File exists: ${fs.existsSync(filePath)}`);
      console.log(`📏 File size: ${fs.statSync(filePath).size} bytes`);
      
      const ext = path.extname(filePath).toLowerCase();
      const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv'];
      // If video, extract audio
      if (videoExtensions.includes(ext)) {
        audioPath = filePath + '.mp3';
        console.log(`🎬 Extracting audio from video to: ${audioPath}`);
        await new Promise((resolve, reject) => {
          ffmpeg(filePath)
            .output(audioPath)
            .audioCodec('libmp3lame')
            .on('end', () => {
              tempAudioCreated = true;
              console.log(`✅ Audio extraction completed`);
              resolve();
            })
            .on('error', (err) => {
              console.error(`❌ Audio extraction failed:`, err);
              reject(err);
            })
            .run();
        });
      }
      let lastError = null;
      while (attempt < maxRetries) {
        try {
          console.log(`🚀 Sending to OpenAI Whisper API... (attempt ${attempt + 1})`);
          // If the OpenAI SDK supports timeout, set it here. Otherwise, rely on default.
          const transcription = await this.openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: 'whisper-1',
            language: language,
            response_format: 'verbose_json',
            timestamp_granularities: ['word']
          });
          console.log(`✅ OpenAI transcription completed for: ${filePath}`);
          return {
            success: true,
            text: transcription.text,
            confidence: transcription.confidence || 0,
            language: transcription.language,
            duration: transcription.duration,
            segments: transcription.segments || []
          };
        } catch (error) {
          lastError = error;
          // Retry only on network errors
          const isNetworkError = error.code === 'ECONNRESET' || error.message?.includes('ECONNRESET') || error.message?.includes('Connection error') || error.cause?.code === 'ECONNRESET';
          console.error(`❌ OpenAI transcription failed (attempt ${attempt + 1}) for ${filePath}:`, error);
          if (isNetworkError && attempt < maxRetries - 1) {
            const wait = 1000 * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
            console.log(`🔁 Retrying OpenAI transcription in ${wait / 1000}s...`);
            await sleep(wait);
            attempt++;
            continue;
          } else {
            break;
          }
        }
      }
      // If we reach here, all attempts failed
      console.error(`❌ OpenAI transcription failed after ${maxRetries} attempts for ${filePath}:`, lastError);
      return {
        success: false,
        error: lastError?.message || 'Unknown error'
      };
    } finally {
      // Clean up temp audio file if created
      if (tempAudioCreated && fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    }
  }

  /**
   * Analyze sentiment of transcript text with enhanced breakdown
   * @param {string} text - Transcript text to analyze
   * @returns {Promise<Object>} Enhanced sentiment analysis result
   */
  async analyzeSentiment(text) {
    try {
      console.log('🧠 Starting OpenAI enhanced sentiment analysis...');
      console.log('Sentiment analysis input:', text.slice(0, 200));
      
      const prompt = `
        Analyze the sentiment of the following healthcare meeting transcript with comprehensive detail.
        
        Transcript:
        ${text}
        
        Provide a detailed sentiment analysis including:
        
        1. Overall sentiment classification (positive, negative, neutral)
        2. Sentiment score (-1.0 to 1.0, where -1 is very negative, 1 is very positive)
        3. Detailed breakdown of positive, negative, and neutral percentages
        4. For each sentiment category, provide specific explanations with supporting evidence from the transcript
        5. Key emotional indicators and tone markers found in the text
        6. Confidence level in the analysis
        7. Sentiment trends throughout the conversation (if applicable)
        8. Context-specific sentiment factors (e.g., medical concerns, business opportunities, personal rapport)
        
        Respond in JSON format:
        {
          "overall": "positive|negative|neutral",
          "score": -1.0 to 1.0,
          "details": {
            "positive": 0-100,
            "negative": 0-100,
            "neutral": 0-100
          },
          "explanations": {
            "positive": "Detailed explanation of positive elements with specific quotes or examples",
            "negative": "Detailed explanation of negative elements with specific quotes or examples", 
            "neutral": "Detailed explanation of neutral elements with specific quotes or examples"
          },
          "emotionalIndicators": [
            {
              "indicator": "string",
              "type": "positive|negative|neutral",
              "context": "string"
            }
          ],
          "confidence": 0.0 to 1.0,
          "sentimentTrends": [
            {
              "segment": "string",
              "sentiment": "positive|negative|neutral",
              "reason": "string"
            }
          ],
          "contextFactors": {
            "medicalConcerns": ["string"],
            "businessOpportunities": ["string"],
            "personalRapport": "positive|negative|neutral",
            "professionalTone": "formal|casual|mixed"
          }
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a healthcare sentiment analysis expert with deep understanding of medical conversations, business relationships, and emotional intelligence. Provide accurate, nuanced, and contextually relevant sentiment analysis for medical meeting transcripts. Focus on both the emotional tone and the professional context of healthcare interactions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1500
      });

      const content = response.choices[0].message.content;
      console.log('Raw OpenAI sentiment response:', content);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in OpenAI response');
      const result = JSON.parse(jsonMatch[0]);
      console.log('Extracted sentiment JSON:', result);
      
      console.log('✅ OpenAI enhanced sentiment analysis completed');
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ OpenAI sentiment analysis failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract comprehensive key insights and action items using OpenAI
   * @param {string} transcript - Meeting transcript
   * @param {Array} historicalData - Historical meeting data for context
   * @param {Array} medicalPublications - Relevant medical publications
   * @returns {Promise<Object>} Enhanced key insights and action items
   */
  async extractKeyInsights(transcript, historicalData = [], medicalPublications = []) {
    try {
      console.log('🔍 Starting OpenAI enhanced key insights extraction...');
      
      // Build context from historical data
      const historicalContext = historicalData.length > 0 
        ? `Historical Context:\n${historicalData.map(item => `- ${item.summary}`).join('\n')}\n\n`
        : '';

      // Build medical context
      const medicalContext = medicalPublications.length > 0
        ? `Medical Publications Context:\n${medicalPublications.map(pub => `- ${pub.title}: ${pub.summary}`).join('\n')}\n\n`
        : '';

      const prompt = `
        Analyze the following healthcare meeting transcript and extract comprehensive insights and actionable items.
        
        ${historicalContext}
        ${medicalContext}
        
        Current Meeting Transcript:
        ${transcript}
        
        Please provide a comprehensive analysis including:
        
        1. KEY INSIGHTS:
           - Medical insights (clinical observations, treatment discussions, patient care insights)
           - Business insights (market opportunities, competitive intelligence, partnership potential)
           - Strategic insights (long-term implications, trend analysis, future considerations)
           - Operational insights (process improvements, workflow optimizations, efficiency gains)
        
        2. ACTION ITEMS:
           - High priority items requiring immediate attention
           - Medium priority items for follow-up
           - Low priority items for future consideration
           - Each item should include assignee suggestions and realistic due dates
        
        3. FOLLOW-UP RECOMMENDATIONS:
           - Specific next steps for relationship development
           - Knowledge gaps that need addressing
           - Resources or information to provide
        
        4. RISK FACTORS:
           - Potential concerns or red flags
           - Compliance or regulatory considerations
           - Competitive threats or market risks
        
        5. OPPORTUNITIES:
           - Collaboration possibilities
           - Market expansion opportunities
           - Innovation or research partnerships
        
        6. SUMMARY:
           - Executive summary of key outcomes
           - Most important takeaway
           - Strategic implications
        
        Respond in JSON format:
        {
          "keyInsights": [
            {
              "insight": "string",
              "category": "medical|business|strategic|operational",
              "confidence": 0.0-1.0,
              "timestamp": "HH:MM:SS",
              "impact": "high|medium|low",
              "context": "string"
            }
          ],
          "actionItems": [
            {
              "item": "string",
              "priority": "high|medium|low",
              "assignee": "string",
              "dueDate": "YYYY-MM-DD",
              "category": "follow-up|research|meeting|documentation",
              "estimatedEffort": "string",
              "dependencies": ["string"]
            }
          ],
          "followUpRecommendations": [
            {
              "recommendation": "string",
              "timeline": "string",
              "priority": "high|medium|low",
              "type": "relationship|knowledge|resource"
            }
          ],
          "riskFactors": [
            {
              "risk": "string",
              "severity": "high|medium|low",
              "mitigation": "string",
              "category": "compliance|competitive|operational"
            }
          ],
          "opportunities": [
            {
              "opportunity": "string",
              "potential": "high|medium|low",
              "timeline": "string",
              "category": "collaboration|market|innovation"
            }
          ],
          "summary": {
            "executiveSummary": "string",
            "keyTakeaway": "string",
            "strategicImplications": "string",
            "nextSteps": "string"
          }
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a senior healthcare business analyst and strategic advisor with expertise in medical affairs, market access, and healthcare business development. Extract actionable, strategic insights from medical meeting transcripts with high accuracy and business relevance. Focus on both immediate actionable items and long-term strategic implications.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2500
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      console.log('✅ OpenAI enhanced key insights extraction completed');
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ OpenAI key insights extraction failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate comprehensive sentiment breakdown analysis
   * @param {string} text - Transcript text to analyze
   * @returns {Promise<Object>} Detailed sentiment breakdown
   */
  async generateSentimentBreakdown(text) {
    try {
      console.log('📊 Starting OpenAI sentiment breakdown analysis...');
      
      const prompt = `
        Provide a comprehensive sentiment breakdown analysis for the following healthcare meeting transcript.
        
        Transcript:
        ${text}
        
        Analyze the sentiment across different dimensions:
        
        1. OVERALL SENTIMENT METRICS:
           - Primary sentiment classification
           - Sentiment intensity score
           - Confidence level
        
        2. SENTIMENT BREAKDOWN BY SEGMENTS:
           - Analyze sentiment changes throughout the conversation
           - Identify key turning points
           - Segment by topic or speaker if applicable
        
        3. EMOTIONAL DIMENSIONS:
           - Trust and confidence levels
           - Engagement and interest
           - Concern and apprehension
           - Enthusiasm and optimism
        
        4. CONTEXTUAL FACTORS:
           - Professional vs personal tone
           - Formal vs informal communication
           - Collaborative vs adversarial stance
           - Openness to new ideas or approaches
        
        5. SENTIMENT INDICATORS:
           - Specific phrases or expressions that indicate sentiment
           - Tone markers and emotional cues
           - Non-verbal indicators (if mentioned)
        
        Respond in JSON format:
        {
          "overallMetrics": {
            "primarySentiment": "positive|negative|neutral",
            "intensityScore": -1.0 to 1.0,
            "confidence": 0.0 to 1.0,
            "sentimentStability": "stable|variable|volatile"
          },
          "segmentAnalysis": [
            {
              "segment": "string",
              "sentiment": "positive|negative|neutral",
              "intensity": -1.0 to 1.0,
              "keyPhrases": ["string"],
              "context": "string"
            }
          ],
          "emotionalDimensions": {
            "trust": {
              "level": "high|medium|low",
              "indicators": ["string"],
              "score": 0.0 to 1.0
            },
            "engagement": {
              "level": "high|medium|low",
              "indicators": ["string"],
              "score": 0.0 to 1.0
            },
            "concern": {
              "level": "high|medium|low",
              "indicators": ["string"],
              "score": 0.0 to 1.0
            },
            "enthusiasm": {
              "level": "high|medium|low",
              "indicators": ["string"],
              "score": 0.0 to 1.0
            }
          },
          "contextualFactors": {
            "professionalTone": "formal|casual|mixed",
            "communicationStyle": "collaborative|adversarial|neutral",
            "opennessToIdeas": "high|medium|low",
            "relationshipQuality": "strong|developing|strained"
          },
          "sentimentIndicators": [
            {
              "indicator": "string",
              "type": "positive|negative|neutral",
              "context": "string",
              "confidence": 0.0 to 1.0
            }
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a healthcare communication analyst specializing in sentiment analysis and emotional intelligence. Provide detailed, nuanced breakdowns of sentiment in medical conversations, considering both the emotional and professional context of healthcare interactions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      console.log('✅ OpenAI sentiment breakdown analysis completed');
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ OpenAI sentiment breakdown analysis failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate executive summary for leadership
   * @param {Object} transcriptData - Transcript and analysis data
   * @returns {Promise<Object>} Executive summary
   */
  async generateExecutiveSummary(transcriptData) {
    try {
      console.log('📊 Generating OpenAI executive summary...');
      
      const prompt = `
        Create an executive summary for leadership based on the following healthcare meeting data:
        
        Meeting Details:
        - HCP: ${transcriptData.hcpName}
        - Specialty: ${transcriptData.hcpSpecialty}
        - Date: ${transcriptData.meetingDate}
        - Duration: ${transcriptData.meetingDuration} minutes
        
        Sentiment Analysis:
        - Overall: ${transcriptData.sentimentAnalysis.overall}
        - Score: ${transcriptData.sentimentAnalysis.score}
        
        Key Insights: ${transcriptData.keyInsights.map(insight => insight.insight).join(', ')}
        
        Action Items: ${transcriptData.actionItems.map(item => item.item).join(', ')}
        
        Please provide a concise executive summary suitable for C-level leadership, including:
        1. Meeting overview and key outcomes
        2. Sentiment analysis summary
        3. Critical insights and recommendations
        4. Next steps and action items
        5. Risk assessment and opportunities
        
        Respond in JSON format:
        {
          "executiveSummary": "string",
          "keyOutcomes": ["string"],
          "criticalInsights": ["string"],
          "recommendations": ["string"],
          "nextSteps": ["string"],
          "riskAssessment": "string",
          "opportunities": ["string"]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an executive communication expert. Create clear, actionable summaries for healthcare leadership.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      console.log('✅ OpenAI executive summary generated');
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ OpenAI executive summary generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate medical terminology in transcript
   * @param {string} transcript - Transcript text to validate
   * @returns {Promise<Object>} Medical terminology validation result
   */
  async validateMedicalTerminology(transcript) {
    try {
      console.log('🏥 Validating medical terminology with OpenAI...');
      
      const prompt = `
        Review the following healthcare meeting transcript and identify any potential errors in medical terminology, drug names, or medical procedures.
        
        Transcript:
        ${transcript}
        
        Please provide:
        1. Identified medical terms that may be incorrect
        2. Suggested corrections
        3. Confidence level for each correction
        4. Medical context validation
        
        Respond in JSON format:
        {
          "medicalTerms": [
            {
              "term": "string",
              "suggestedCorrection": "string",
              "confidence": 0.0-1.0,
              "context": "string"
            }
          ],
          "validationScore": 0.0-1.0,
          "recommendations": ["string"]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a medical terminology expert. Validate and correct medical terms in healthcare transcripts with high accuracy.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      console.log('✅ OpenAI medical terminology validation completed');
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ OpenAI medical terminology validation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test OpenAI API connectivity
   * @returns {Promise<Object>} Test result
   */
  async testOpenAIConnection() {
    try {
      console.log('🧪 Testing OpenAI API connection...');
      console.log(`🔑 API Key present: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test message.'
          }
        ],
        max_tokens: 10
      });
      
      console.log('✅ OpenAI API connection test successful');
      return {
        success: true,
        message: 'OpenAI API is accessible',
        response: response.choices[0].message.content
      };
    } catch (error) {
      console.error('❌ OpenAI API connection test failed:', error);
      return {
        success: false,
        error: error.message,
        details: {
          status: error.status,
          code: error.code,
          type: error.type
        }
      };
    }
  }
}

module.exports = new OpenAIService(); 