/**
 * Beacon Building Products Authentication
 * Gets session cookies for Beacon API calls
 */

const axios = require("axios");
const { getCredentials } = require("../config/getCredentials");

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
    console.error("Beacon Login failed:", error.response?.data || error.message);
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

