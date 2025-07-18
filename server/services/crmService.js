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
      console.log('🔗 Initializing Salesforce connection...');
      this.salesforceConn = new jsforce.Connection({
        loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
      });
      await this.salesforceConn.login(
        process.env.SALESFORCE_USERNAME,
        process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN
      );
      console.log('✅ Salesforce connection established');
      return {
        success: true,
        message: 'Salesforce connection established',
        instanceUrl: this.salesforceConn.instanceUrl
      };
    } catch (error) {
      console.error('❌ Salesforce connection failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync transcript data to Salesforce
   * @param {Object} transcriptData - Transcript and analysis data
   * @returns {Promise<Object>} Sync result
   */
  async syncToSalesforce(transcriptData) {
    try {
      console.log('🔄 Syncing to Salesforce...');
      console.log('📋 Transcript data:', {
        id: transcriptData._id,
        hcpName: transcriptData.hcpName,
        hcpSpecialty: transcriptData.hcpSpecialty,
        meetingDate: transcriptData.meetingDate,
        hasTranscript: !!(transcriptData.editedTranscript || transcriptData.rawTranscript),
        hasInsights: !!(transcriptData.keyInsights && transcriptData.keyInsights.length > 0),
        hasActionItems: !!(transcriptData.actionItems && transcriptData.actionItems.length > 0)
      });
      
      if (!this.salesforceConn) {
        const initResult = await this.initializeSalesforce();
        if (!initResult.success) {
          throw new Error('Failed to initialize Salesforce connection');
        }
      }

      // Create a Task record (standard Salesforce object) for the meeting
      const taskRecord = {
        Subject: `Meeting with ${transcriptData.hcpName}`,
        Description: `HCP Name: ${transcriptData.hcpName}\nHCP Specialty: ${transcriptData.hcpSpecialty}\nMeeting Date: ${transcriptData.meetingDate}\n\nMeeting Transcript: ${transcriptData.editedTranscript || transcriptData.rawTranscript}\n\nKey Insights: ${transcriptData.keyInsights?.map(insight => insight.insight).join('; ') || 'None'}\nAction Items: ${transcriptData.actionItems?.map(item => item.item).join('; ') || 'None'}\n\nTranscript ID: ${transcriptData._id}`,
        Status: 'Completed'
      };
      
      // Only add ActivityDate if it's a valid date
      if (transcriptData.meetingDate && transcriptData.meetingDate !== 'Invalid Date') {
        taskRecord.ActivityDate = transcriptData.meetingDate;
      }

      // Try to insert the task
      let result;
      try {
        result = await this.salesforceConn.sobject('Task').create(taskRecord);
      } catch (createError) {
        console.warn('❌ Full Task create failed, trying minimal fields:', createError.message);
        
        // Fallback: try with only the most basic fields
        const minimalTaskRecord = {
          Subject: `Meeting with ${transcriptData.hcpName}`,
          Description: `Meeting Transcript: ${transcriptData.editedTranscript || transcriptData.rawTranscript}\n\nTranscript ID: ${transcriptData._id}`
        };
        
        result = await this.salesforceConn.sobject('Task').create(minimalTaskRecord);
      }
      
      if (result.success) {
        console.log('✅ Salesforce sync completed');
        console.log('📋 Created Task record:', {
          recordId: result.id,
          subject: taskRecord.Subject,
          description: taskRecord.Description?.substring(0, 100) + '...',
          createdDate: new Date().toISOString()
        });
        
        // Verify the record was actually created
        try {
          const verification = await this.salesforceConn.sobject('Task').retrieve(result.id);
          console.log('✅ Record verification successful:', {
            id: verification.Id,
            subject: verification.Subject,
            status: verification.Status,
            createdDate: verification.CreatedDate
          });
        } catch (verifyError) {
          console.warn('⚠️ Record verification failed:', verifyError.message);
        }
        
        return {
          success: true,
          recordId: result.id,
          message: 'Data synced to Salesforce successfully',
          details: {
            subject: taskRecord.Subject,
            createdDate: new Date().toISOString()
          }
        };
      } else {
        console.error('❌ Salesforce create failed:', result.errors);
        throw new Error(`Salesforce error: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('❌ Salesforce sync failed:', error);
      return {
        success: false,
        error: error.message || 'Unknown Salesforce error'
      };
    }
  }

  /**
   * Sync to CRM (Salesforce only)
   * @param {Object} transcriptData - Transcript and analysis data
   * @returns {Promise<Object>} Sync result
   */
  async syncToCRM(transcriptData) {
    return this.syncToSalesforce(transcriptData);
  }

  /**
   * Get HCP information from Salesforce
   * @param {string} hcpName - HCP name to search for
   * @returns {Promise<Object>} HCP data
   */
  async getHCPFromSalesforce(hcpName) {
    try {
      console.log(`🔍 Searching for HCP in Salesforce: ${hcpName}`);
      if (!this.salesforceConn) {
        const initResult = await this.initializeSalesforce();
        if (!initResult.success) {
          throw new Error('Failed to initialize Salesforce connection');
        }
      }
      const query = `
        SELECT Id, Name, Specialty__c, Email__c, Phone__c, Organization__c
        FROM HCP__c
        WHERE Name LIKE '%${hcpName}%'
        LIMIT 1
      `;
      const result = await this.salesforceConn.query(query);
      if (result.records.length > 0) {
        console.log('✅ HCP found in Salesforce');
        return {
          success: true,
          hcp: result.records[0]
        };
      } else {
        console.log('⚠️ HCP not found in Salesforce');
        return {
          success: false,
          message: 'HCP not found'
        };
      }
    } catch (error) {
      console.error('❌ Salesforce HCP search failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get sync status for a transcript (Salesforce only)
   * @param {string} transcriptId - Transcript ID
   * @returns {Promise<Object>} Sync status
   */
  async getSyncStatus(transcriptId) {
    try {
      console.log(`📊 Getting sync status for transcript: ${transcriptId}`);
      let status = { salesforce: { synced: false, recordId: null, lastSync: null } };
      if (this.salesforceConn) {
        try {
          const query = `
            SELECT Id, LastModifiedDate
            FROM Task
            WHERE Description LIKE '%Transcript ID: ${transcriptId}%'
            LIMIT 1
          `;
          const result = await this.salesforceConn.query(query);
          if (result.records.length > 0) {
            status.salesforce = {
              synced: true,
              recordId: result.records[0].Id,
              lastSync: result.records[0].LastModifiedDate
            };
          }
        } catch (error) {
          console.error('Salesforce status check failed:', error);
        }
      }
      return {
        success: true,
        status: status
      };
    } catch (error) {
      console.error('❌ Sync status check failed:', error);
      return { 
        success: false,
        error: error.message,
        status: { salesforce: { synced: false, error: error.message } }
      };
    }
  }
}

module.exports = new CRMService(); 