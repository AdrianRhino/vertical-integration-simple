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

exports.main = async (context = {}) => {
    const { abcAccessToken, fullOrder, environment = null } = context.parameters || {};

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

    if (!abcAccessToken) {
        console.error("No ABC access token provided");
        return {
            success: false,
            message: "No ABC access token provided",
        };
    }

    if (!fullOrder) {
        console.error("No full order provided");
        return {
            success: false,
            message: "No full order provided",
        };
    }

    // Get API base URL from credentials config
    const credentials = getCredentials("ABC", environment);
    const apiBaseUrl = credentials.apiBaseUrl;

    // ✅ Normalize quantities and UOMs for accurate pricing
    const formattedLineItems = fullOrder.fullOrderItems.map(item => ({
        id: item.id || String(Math.random()),
        itemNumber: String(item.sku || "").trim(),
        quantity: Number(item.qty) || 1, // ✅ Ensure it's a number
        uom: String(item.uom || "EA").toUpperCase().trim(), // ✅ Normalize UOM
    })).filter(item => item.itemNumber); // ✅ Filter out items without SKU

    console.log("Formatted Line Items:", formattedLineItems);
    console.log(`Using ABC API (${credentials.environment}): ${apiBaseUrl}`);
    console.log(`Pricing URL: ${apiBaseUrl}/api/pricing/v2/prices`);

    const config = {
        method: "post",
        url: `${apiBaseUrl}/api/pricing/v2/prices`,
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
    
    // ✅ Debug: Log request details (without sensitive data)
    console.log("ABC Pricing Request URL:", config.url);
    console.log("ABC Pricing Request - Line items count:", formattedLineItems.length);
    console.log("ABC Pricing Request - Authorization header present:", !!config.headers.Authorization);
    
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
        console.error("❌ ABC Pricing Error Details:");
        console.error("  Status:", error.response?.status);
        console.error("  Status Text:", error.response?.statusText);
        console.error("  Error Message:", error.message);
        console.error("  Response Data:", error.response?.data);
        console.error("  Request URL:", error.config?.url);
        console.error("  Request Headers (Authorization present):", !!error.config?.headers?.Authorization);
        
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