const jsforce = require('jsforce');

class CRMService {
  constructor() {
    this.salesforceConn = null;
  }

  /**
   * Initialize Salesforce connection
   * @returns {Promise<Object>} Connection result
   */
  async initializeSalesforce() {
    try {
      this.salesforceConn = new jsforce.Connection({
        loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
      });
      await this.salesforceConn.login(
        process.env.SALESFORCE_USERNAME,
        process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN
      );
      return {
        success: true,
        message: 'Salesforce connection established',
        instanceUrl: this.salesforceConn.instanceUrl
      };
    } catch (error) {
      console.error('❌ Salesforce connection failed:', error);
      throw error;
    }
  }

  /**
   * Sync transcript data to Salesforce
   * @param {Object} transcriptData - Transcript data to sync
   * @returns {Promise<Object>} Sync result
   */
  async syncToSalesforce(transcriptData) {
    try {
      if (!this.salesforceConn) {
        await this.initializeSalesforce();
      }

      // Create Task record
      const taskData = {
        Subject: `Meeting Summary - ${transcriptData.hcpName || 'Unknown HCP'}`,
        Description: this.formatTaskDescription(transcriptData),
        Status: 'Completed',
        Priority: 'Normal',
        Type: 'Meeting',
        ActivityDate: transcriptData.meetingDate ? new Date(transcriptData.meetingDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        WhatId: transcriptData.hcpId || null,
        WhoId: transcriptData.hcpId || null,
        Custom_Meeting_Duration__c: transcriptData.meetingDuration || 0,
        Custom_Sentiment_Score__c: transcriptData.sentimentAnalysis?.sentimentScore || transcriptData.sentimentAnalysis?.score || 0,
        Custom_Overall_Sentiment__c: transcriptData.sentimentAnalysis?.overallSentiment || transcriptData.sentimentAnalysis?.overall || 'Unknown',
        Custom_Key_Insights__c: JSON.stringify(transcriptData.keyInsights || []),
        Custom_Action_Items__c: JSON.stringify(transcriptData.actionItems || []),
        Custom_Executive_Summary__c: transcriptData.executiveSummary?.summary || transcriptData.executiveSummary || ''
      };

      let result;
      try {
        result = await this.salesforceConn.sobject('Task').create(taskData);
      } catch (createError) {
        console.warn('❌ Full Task create failed, trying minimal fields:', createError.message);
        // Fallback to minimal fields
        const minimalTaskData = {
          Subject: `Meeting Summary - ${transcriptData.hcpName || 'Unknown HCP'}`,
          Description: this.formatTaskDescription(transcriptData),
          Status: 'Completed',
          ActivityDate: new Date().toISOString().split('T')[0]
        };
        result = await this.salesforceConn.sobject('Task').create(minimalTaskData);
      }

      if (result.success) {
        // Verify the record was created
        try {
          const verifyResult = await this.salesforceConn.sobject('Task').retrieve(result.id);
          return {
            success: true,
            taskId: result.id,
            message: 'Task created successfully in Salesforce',
            taskData: verifyResult
          };
        } catch (verifyError) {
          console.warn('⚠️ Record verification failed:', verifyError.message);
          return {
            success: true,
            taskId: result.id,
            message: 'Task created but verification failed',
            warning: verifyError.message
          };
        }
      } else {
        console.error('❌ Salesforce create failed:', result.errors);
        throw new Error(`Salesforce create failed: ${JSON.stringify(result.errors)}`);
      }
    } catch (error) {
      console.error('❌ Salesforce sync failed:', error);
      throw error;
    }
  }

  /**
   * Search for HCP in Salesforce
   * @param {string} hcpName - HCP name to search
   * @returns {Promise<Object>} Search result
   */
  async searchHCP(hcpName) {
    try {
      if (!this.salesforceConn) {
        await this.initializeSalesforce();
      }

      const query = `
        SELECT Id, Name, Title, Department, Email, Phone, Account.Name, Account.Industry
        FROM Contact
        WHERE Name LIKE '%${hcpName}%'
        OR Account.Name LIKE '%${hcpName}%'
        LIMIT 10
      `;

      const result = await this.salesforceConn.query(query);
      
      if (result.records.length > 0) {
        return {
          success: true,
          hcps: result.records,
          totalSize: result.totalSize
        };
      } else {
        return {
          success: true,
          hcps: [],
          totalSize: 0,
          message: 'No HCPs found'
        };
      }
    } catch (error) {
      console.error('❌ Salesforce HCP search failed:', error);
      throw error;
    }
  }

  /**
   * Get sync status for a transcript
   * @param {string} transcriptId - Transcript ID
   * @returns {Promise<Object>} Status result
   */
  async getSyncStatus(transcriptId) {
    try {
      if (!this.salesforceConn) {
        await this.initializeSalesforce();
      }

      const query = `
        SELECT Id, Subject, Status, CreatedDate, Custom_Meeting_Duration__c, Custom_Sentiment_Score__c
        FROM Task
        WHERE Subject LIKE '%${transcriptId}%'
        OR Description LIKE '%${transcriptId}%'
        ORDER BY CreatedDate DESC
        LIMIT 1
      `;

      const result = await this.salesforceConn.query(query);
      
      if (result.records.length > 0) {
        const task = result.records[0];
        return {
          success: true,
          synced: true,
          taskId: task.Id,
          subject: task.Subject,
          status: task.Status,
          createdDate: task.CreatedDate,
          meetingDuration: task.Custom_Meeting_Duration__c,
          sentimentScore: task.Custom_Sentiment_Score__c
        };
      } else {
        return {
          success: true,
          synced: false,
          message: 'No sync record found'
        };
      }
    } catch (error) {
      console.error('Salesforce status check failed:', error);
      throw error;
    }
  }

  /**
   * Format task description for Salesforce
   * @param {Object} transcriptData - Transcript data
   * @returns {string} Formatted description
   */
  formatTaskDescription(transcriptData) {
    const parts = [];
    
    parts.push(`Meeting with: ${transcriptData.hcpName || 'Unknown HCP'}`);
    parts.push(`Date: ${transcriptData.meetingDate || 'Unknown'}`);
    parts.push(`Duration: ${transcriptData.meetingDuration || 0} minutes`);
    
    if (transcriptData.sentimentAnalysis) {
      const sentiment = transcriptData.sentimentAnalysis;
      parts.push(`Sentiment: ${sentiment.overallSentiment || sentiment.overall || 'Unknown'} (Score: ${sentiment.sentimentScore || sentiment.score || 'N/A'})`);
    }
    
    if (transcriptData.keyInsights && transcriptData.keyInsights.length > 0) {
      parts.push(`Key Insights: ${transcriptData.keyInsights.length} identified`);
    }
    
    if (transcriptData.actionItems && transcriptData.actionItems.length > 0) {
      parts.push(`Action Items: ${transcriptData.actionItems.length} identified`);
    }
    
    if (transcriptData.executiveSummary) {
      const summary = transcriptData.executiveSummary.summary || transcriptData.executiveSummary;
      parts.push(`Executive Summary: ${summary.substring(0, 200)}${summary.length > 200 ? '...' : ''}`);
    }
    
    return parts.join('\n');
  }
}

module.exports = new CRMService(); 