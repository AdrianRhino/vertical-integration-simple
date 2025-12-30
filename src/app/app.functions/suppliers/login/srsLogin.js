/**
 * SRS Distribution Authentication
 * Gets OAuth access token for SRS API calls
 */

const axios = require("axios");
const { getCredentials } = require("../config/getCredentials");
const { logContractFailure } = require("../../../utils/debugCheckLogger");

exports.main = async (context = {}) => {
  const { environment = null } = context.parameters || {};
  
  try {
    const credentials = getCredentials("SRS", environment);
    
    if (!credentials.clientId || !credentials.clientSecret) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: "SRS credentials missing (clientId or clientSecret)",
        }
      };
    }
    
    const authParams = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: "ALL"
    });
    
    const response = await axios.post(
      credentials.authUrl,
      authParams.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );
    
    // Return in HubSpot serverless function format
    return {
      statusCode: 200,
      body: {
        success: true,
        access_token: response.data.access_token,
        expires_in: response.data.expires_in,
        data: response.data
      }
    };
  } catch (error) {
    logContractFailure({
      contractId: "C-003",
      message: "SRS Distribution authentication failed",
      expected: { success: true, access_token: "string" },
      actual: {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      },
      system: "SRS Distribution",
      integration: "SRSAdapter",
      operation: "AUTHENTICATE",
      trace: ["srsLogin", "oauthTokenRequest"],
      nextCheck: "Check SRS credentials (clientId/clientSecret) and API endpoint availability",
    });
    return {
      statusCode: error.response?.status || 500,
      body: {
        success: false,
        error: error.response?.data?.error_description || error.message,
        status: error.response?.status
      }
    };
  }
};

