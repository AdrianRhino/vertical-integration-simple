/**
 * Beacon Building Products Authentication
 * Gets session cookies for Beacon API calls
 */

const axios = require("axios");
const { getCredentials } = require("../config/getCredentials");
const { logContractFailure } = require("../../../utils/debugCheckLogger");

exports.main = async (context = {}) => {
  const { environment = null } = context.parameters || {};
  
  try {
    const credentials = getCredentials("BEACON", environment);
    
    if (!credentials.username || !credentials.password) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: "Beacon credentials missing (username or password)",
        }
      };
    }
    
    const loginResponse = await axios.post(
      `${credentials.apiBaseUrl}/v1/rest/com/becn/login`,
      {
        username: credentials.username,
        password: credentials.password,
        siteId: "homeSite",
        persistentLoginType: "RememberMe",
        userAgent: "desktop",
        apiSiteId: credentials.apiSiteId || "UAT"
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    
    // Extract cookies from response
    const cookies = loginResponse.headers['set-cookie']?.join('; ') || "";
    
    if (!cookies) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: "No cookies received from Beacon login",
        }
      };
    }
    
    // Return in HubSpot serverless function format
    return {
      statusCode: 200,
      body: {
        success: true,
        cookies: cookies,
        data: loginResponse.data
      }
    };
  } catch (error) {
    logContractFailure({
      contractId: "C-003",
      message: "Beacon Building Products authentication failed",
      expected: { success: true, cookies: "string" },
      actual: {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      },
      system: "Beacon Building Products",
      integration: "BeaconAdapter",
      operation: "AUTHENTICATE",
      trace: ["beaconLogin", "sessionLogin"],
      nextCheck: "Check Beacon credentials (username/password) and API endpoint availability",
    });
    return {
      statusCode: error.response?.status || 500,
      body: {
        success: false,
        error: error.response?.data?.message || error.message,
        status: error.response?.status
      }
    };
  }
};

