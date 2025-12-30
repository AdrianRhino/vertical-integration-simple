/**
 * Shape Language: Input → Filter → Transform → Store → Output → Loop
 * 
 * Input: Context with abcAccessToken, fullOrder, optional environment
 * Filter: Validates access token and fullOrder exist
 * Transform: Gets API base URL from credentials config, formats line items
 * Store: N/A
 * Output: Pricing data from ABC API
 * Loop: Self-healing - reads environment from order config if not provided
 */

const axios = require("axios");
const { getCredentials } = require("../config/getCredentials");
const { logContractFailure, logInvariantViolation } = require("../../../utils/debugCheckLogger");

exports.main = async (context = {}) => {
    // Debug: Log full context first
    console.log("🔍 ABC Pricing - Full context.parameters:", JSON.stringify(context.parameters || {}, null, 2));
    
    // Debug: Log FULL parameters object first
    console.log("🔍 ABC Pricing - RAW context.parameters:", JSON.stringify(context.parameters || {}, null, 2));
    console.log("🔍 ABC Pricing - context.parameters keys:", Object.keys(context.parameters || {}));
    console.log("🔍 ABC Pricing - context.parameters.environment value:", context.parameters?.environment, "type:", typeof context.parameters?.environment);
    
    // Handle environment - try multiple sources since HubSpot parameter passing is unreliable
    // 1. Try direct parameter (may be filtered by HubSpot)
    // 2. Try embedded in fullOrder object (workaround)
    const envParam = context.parameters?.environment || 
                     context.parameters?.env || 
                     context.parameters?.abcEnvironment ||
                     context.parameters?.fullOrder?._environment;
    const environment = (envParam === "prod") ? "prod" : null; // null = use master config (sandbox)
    const { abcAccessToken, fullOrder, pricingUrlOverride = null } = context.parameters || {};
    
    // Debug: Log received parameters
    console.log("🔍 ABC Pricing Parameters (destructured):", {
        hasToken: !!abcAccessToken,
        hasFullOrder: !!fullOrder,
        environment: environment,
        envParam: envParam,
        pricingUrlOverride: pricingUrlOverride,
        pricingUrlOverrideType: typeof pricingUrlOverride,
        pricingUrlOverrideValue: String(pricingUrlOverride)
    });

    {/*
        Test Product
        {
            "id": "1",
            "itemNumber": "26VPJ118CY",
            "quantity": 1,
            "uom": "EA"
        }
        */}

    // ✅ Debug: Log token presence (but not the actual token for security)
    console.log("ABC Pricing - Token provided:", !!abcAccessToken);
    console.log("ABC Pricing - Token length:", abcAccessToken ? String(abcAccessToken).length : 0);
    console.log("ABC Pricing - Token preview:", abcAccessToken ? String(abcAccessToken).substring(0, 20) + "..." : "none");
    // #region agent log
    const tokenIssuer = abcAccessToken ? (() => { try { const payload = JSON.parse(Buffer.from(abcAccessToken.split('.')[1], 'base64').toString()); return payload.iss || 'unknown'; } catch(e) { return 'parse_error'; } })() : 'no_token';
    fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getABCPricing.js:48',message:'Token issuer extracted from JWT',data:{tokenIssuer,isProductionToken:!tokenIssuer.includes('sandbox'),isSandboxToken:tokenIssuer.includes('sandbox')},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    if (!abcAccessToken) {
        logInvariantViolation({
          invariantId: "I-001",
          message: "ABC access token is required for pricing request",
          expected: { abcAccessToken: "string" },
          actual: { abcAccessToken: null },
          system: "ABC Supply",
          operation: "GET_PRICING",
          trace: ["getABCPricing", "validateToken"],
          nextCheck: "Ensure ABC authentication is called before pricing request",
        });
        return {
            success: false,
            message: "No ABC access token provided",
        };
    }

    if (!fullOrder) {
        logInvariantViolation({
          invariantId: "I-004",
          message: "Full order is required for pricing request",
          expected: { fullOrder: "object" },
          actual: { fullOrder: null },
          system: "ABC Supply",
          operation: "GET_PRICING",
          trace: ["getABCPricing", "validateOrder"],
          nextCheck: "Ensure fullOrder is passed in context parameters",
        });
        return {
            success: false,
            message: "No full order provided",
        };
    }

    // Get API base URL from credentials config
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getABCPricing.js:88',message:'Before getCredentials call - Full context',data:{contextKeys:Object.keys(context),hasParameters:!!context.parameters,parametersKeys:context.parameters?Object.keys(context.parameters):[],environment,environmentType:typeof environment},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const credentials = getCredentials("ABC", environment);
    const apiBaseUrl = credentials.apiBaseUrl;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getABCPricing.js:90',message:'After getCredentials call',data:{credentialsEnvironment:credentials.environment,apiBaseUrl,isProductionUrl:apiBaseUrl.includes('partners.abcsupply.com')&&!apiBaseUrl.includes('partners-sb'),isSandboxUrl:apiBaseUrl.includes('partners-sb')},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    // ✅ Normalize quantities and UOMs for accurate pricing
    const formattedLineItems = fullOrder.fullOrderItems.map(item => ({
        id: item.id || String(Math.random()),
        itemNumber: String(item.sku || "").trim(),
        quantity: Number(item.qty) || 1, // ✅ Ensure it's a number
        uom: String(item.uom || "EA").toUpperCase().trim(), // ✅ Normalize UOM
    })).filter(item => item.itemNumber); // ✅ Filter out items without SKU

    // Use override URL if provided (for testing), otherwise construct from apiBaseUrl
    // Check explicitly for truthy value and non-empty string
    const useOverride = pricingUrlOverride && String(pricingUrlOverride).trim().length > 0;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getABCPricing.js:107',message:'Before pricingUrl calculation',data:{useOverride,pricingUrlOverride,apiBaseUrl,constructedUrl:`${apiBaseUrl}/api/pricing/v2/prices`},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const pricingUrl = useOverride ? String(pricingUrlOverride).trim() : `${apiBaseUrl}/api/pricing/v2/prices`;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getABCPricing.js:109',message:'After pricingUrl calculation',data:{pricingUrl,usedOverride:useOverride,usedApiBaseUrl:!useOverride,isProductionUrl:pricingUrl.includes('partners.abcsupply.com')&&!pricingUrl.includes('partners-sb'),isSandboxUrl:pricingUrl.includes('partners-sb')},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    console.log("Formatted Line Items:", formattedLineItems);
    console.log(`Using ABC API (${credentials.environment}): ${apiBaseUrl}`);
    console.log(`pricingUrlOverride received:`, pricingUrlOverride);
    console.log(`useOverride flag:`, useOverride);
    if (useOverride) {
        console.log(`⚠️⚠️⚠️ USING OVERRIDE PRICING URL: ${pricingUrl} ⚠️⚠️⚠️`);
    } else {
        console.log(`Using default pricing URL: ${pricingUrl}`);
    }

    const config = {
        method: "post",
        url: pricingUrl,
        headers: {
            Authorization: `Bearer ${abcAccessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        data: {
            branchNumber: "461",
            shipToNumber: "2063975-2",
            requestId: `Pricing-${Date.now()}`,
            purpose: "estimating",
            lines: formattedLineItems,
        },
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getABCPricing.js:141',message:'Request config created',data:{finalUrl:config.url,isProductionUrl:config.url.includes('partners.abcsupply.com')&&!config.url.includes('partners-sb'),isSandboxUrl:config.url.includes('partners-sb'),authHeaderPresent:!!config.headers.Authorization,authHeaderPrefix:config.headers.Authorization?.substring(0,7),shipToNumber:config.data.shipToNumber},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // ✅ Debug: Log request details (without sensitive data)
    console.log("🔍 ABC Pricing Request URL (FINAL):", config.url);
    console.log("🔍 ABC Pricing Request - Line items count:", formattedLineItems.length);
    console.log("🔍 ABC Pricing Request - Authorization header present:", !!config.headers.Authorization);
    console.log("🔍 ABC Pricing Request - Override was provided:", !!pricingUrlOverride);
    
    try {
        const response = await axios(config);
        console.log("ABC Pricing Response Status:", response.status);
        console.log("ABC Pricing Response Data:", response.data);
        return {
            success: true,
            message: `ABC Pricing fetched successfully (${credentials.environment})`,
            data: response.data,
            environment: credentials.environment,
        };
    } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b131dc2d-5624-4f61-98fb-efc543f7726a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'getABCPricing.js:163',message:'Error caught in pricing request',data:{errorStatus:error.response?.status,statusText:error.response?.statusText,errorMessage:error.response?.data?.error,errorData:error.response?.data,requestUrl:error.config?.url,isProductionUrl:error.config?.url?.includes('partners.abcsupply.com')&&!error.config?.url?.includes('partners-sb'),isSandboxUrl:error.config?.url?.includes('partners-sb'),credentialsEnv:credentials.environment},timestamp:Date.now(),sessionId:'debug-session',runId:'prod-test',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        logContractFailure({
          contractId: "C-005",
          message: "ABC Supply pricing API request failed",
          expected: { status: 200, data: "pricing object" },
          actual: {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
            url: error.config?.url,
            hasAuth: !!error.config?.headers?.Authorization,
          },
          system: "ABC Supply",
          integration: "ABCAdapter",
          operation: "GET_PRICING",
          trace: ["getABCPricing", "pricingRequest"],
          nextCheck: "Check ABC access token validity, API endpoint, and request payload format",
        });
        
        // ✅ Return more detailed error information
        return {
            success: false,
            message: "ABC Pricing fetch failed",
            error: error.response?.data?.error || error.response?.data?.message || error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            details: error.response?.data,
        };
    }

}