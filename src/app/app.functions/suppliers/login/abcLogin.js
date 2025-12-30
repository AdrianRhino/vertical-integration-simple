/**
 * ABC Supply Authentication
 * Gets OAuth access token for ABC API calls
 */

const axios = require("axios");
const { getCredentials } = require("../config/getCredentials");
const { logContractFailure } = require("../../../utils/debugCheckLogger");

exports.main = async (context = {}) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'abcLogin.js:11',message:'ABC Login - Full context',data:{contextKeys:Object.keys(context),hasParameters:!!context.parameters,parametersKeys:context.parameters?Object.keys(context.parameters):[],fullParameters:JSON.stringify(context.parameters||{})},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  // Debug: Log FULL parameters object first
  console.log("🔍 ABC Login - RAW context.parameters:", JSON.stringify(context.parameters || {}, null, 2));
  console.log("🔍 ABC Login - context.parameters keys:", Object.keys(context.parameters || {}));
  console.log("🔍 ABC Login - context.parameters.environment value:", context.parameters?.environment, "type:", typeof context.parameters?.environment);
  
  // Handle environment - try multiple parameter names in case one is filtered
  // Note: For abcLogin, we can't use fullOrder workaround since it's not passed here
  const envParam = context.parameters?.environment || context.parameters?.env || context.parameters?.abcEnvironment;
  const environment = (envParam === "prod") ? "prod" : null; // null = use master config (sandbox)
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'abcLogin.js:21',message:'ABC Login started',data:{envParam,environment,environmentType:typeof environment,isProd:environment==="prod"},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  try {
    const credentials = getCredentials("ABC", environment);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'abcLogin.js:15',message:'Credentials retrieved',data:{credentialsEnv:credentials.environment,authUrl:credentials.authUrl,hasClientId:!!credentials.clientId,hasClientSecret:!!credentials.clientSecret,clientIdPreview:credentials.clientId?.substring(0,10)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'abcLogin.js:36',message:'Before auth request',data:{authUrl,isProductionAuth:authUrl.includes('auth.partners.abcsupply.com')&&!authUrl.includes('sandbox'),isSandboxAuth:authUrl.includes('sandbox')},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    const tokenIssuer = response.data.access_token ? (() => { try { const payload = JSON.parse(Buffer.from(response.data.access_token.split('.')[1], 'base64').toString()); return payload.iss || 'unknown'; } catch(e) { return 'parse_error'; } })() : 'no_token';
    fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'abcLogin.js:47',message:'Auth successful',data:{tokenIssuer,isProductionToken:!tokenIssuer.includes('sandbox'),isSandboxToken:tokenIssuer.includes('sandbox'),hasAccessToken:!!response.data.access_token},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
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

