/**
 * ABC Supply Authentication
 * Gets OAuth access token for ABC API calls
 */

const axios = require("axios");
const { getCredentials } = require("../config/getCredentials");
const { logContractFailure } = require("../../../utils/debugCheckLogger");

exports.main = async (context = {}) => {
  const { environment = null } = context.parameters || {};
  
  try {
    const credentials = getCredentials("ABC", environment);
    
    if (!credentials.clientId || !credentials.clientSecret) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: "ABC credentials missing (clientId or clientSecret)",
        }
      };
    }
    
    const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
    
    // Build URL without query parameters (in case authUrl has them)
    const authUrl = credentials.authUrl.split('?')[0];
    
    // Use URLSearchParams to properly format the body and avoid duplicates
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'product.read pricing.read');
    
    const response = await axios.post(
      authUrl,
      params.toString(),
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
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
      message: "ABC Supply authentication failed",
      expected: { success: true, access_token: "string" },
      actual: {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      },
      system: "ABC Supply",
      integration: "ABCAdapter",
      operation: "AUTHENTICATE",
      trace: ["abcLogin", "oauthTokenRequest"],
      nextCheck: "Check ABC credentials (clientId/clientSecret) and API endpoint availability",
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

