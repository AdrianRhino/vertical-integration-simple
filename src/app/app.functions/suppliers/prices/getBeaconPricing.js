/**
 * Shape Language: Input → Filter → Transform → Store → Output → Loop
 * 
 * Input: Context with cookies, fullOrder, optional environment
 * Filter: Validates cookies and fullOrder exist
 * Transform: Gets API base URL from credentials config, formats line items
 * Store: N/A
 * Output: Pricing data from Beacon API
 * Loop: Self-healing - reads environment from order config if not provided
 */

const axios = require("axios");
const { getCredentials } = require("../config/getCredentials");

exports.main = async (context = {}) => {

    // Test SKU: 660455

    console.log("Beacon Pricing...");

    const { cookies, fullOrder, environment = null } = context.parameters || {};

    if (!cookies) {
        console.error("No cookies provided");
        return {
            success: false,
            message: "No cookies provided",
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
    const credentials = getCredentials("BEACON", environment);
    const apiBaseUrl = credentials.apiBaseUrl;

    // ✅ Normalize quantities and UOMs for accurate pricing
    const formattedLineItems = fullOrder.fullOrderItems.map(item => ({
        id: item.id || String(Math.random()),
        itemNumber: String(item.sku || "").trim(),
        quantity: Number(item.qty) || 1, // ✅ Ensure it's a number
        uom: String(item.uom || "EA").toUpperCase().trim(), // ✅ Normalize UOM
    })).filter(item => item.itemNumber); // ✅ Filter out items without SKU

    const config = {
        method: "get",
        url: `${apiBaseUrl}/v1/rest/com/becn/pricing`,
        headers: {
            Cookie: cookies,
        },
        params: {
            skuIds: formattedLineItems.map(item => item.itemNumber).join(","),
        },
    };

    try {
        const response = await axios(config);
        console.log("Beacon Pricing Response: ", response.data);
        return {
            success: true,
            message: `Beacon Pricing fetched successfully (${credentials.environment})`,
            data: response.data,
            environment: credentials.environment,
        };
    } catch (error) {
        console.error("Error in Beacon Pricing: ", error);
        return {
            success: false,
            message: "Error in Beacon Pricing",
            error: error.response?.data || error.message,
            status: error.response?.status,
        };
    }
}