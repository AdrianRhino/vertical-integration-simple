/**
 * Shape Language: Input → Filter → Transform → Store → Output → Loop
 * 
 * Input: Context with token, fullOrder, optional environment
 * Filter: Validates token and fullOrder exist
 * Transform: Gets API base URL from credentials config, formats line items
 * Store: N/A
 * Output: Pricing data from SRS API
 * Loop: Self-healing - reads environment from order config if not provided
 */

const axios = require("axios");
const { getCredentials } = require("../config/getCredentials");
const { logContractFailure, logInvariantViolation } = require("../../../utils/debugCheckLogger");

exports.main = async (context = {}) => {
    const { token, fullOrder, environment = null } = context.parameters || {};

    {/*
        Test Product
        {
            "productId": 186233,
            "productName": "AFCO Vinyl Stair Bracket Kit",
            "quantity": 1,
            "uom": "KIT"
        }
        */}

    if (!token) {
        logInvariantViolation({
          invariantId: "I-001",
          message: "SRS access token is required for pricing request",
          expected: { token: "string" },
          actual: { token: null },
          system: "SRS Distribution",
          operation: "GET_PRICING",
          trace: ["getSRSPricing", "validateToken"],
          nextCheck: "Ensure SRS authentication is called before pricing request",
        });
        return {
            success: false,
            message: "No access token provided",
        };
    }
    
    if (!fullOrder) {
        logInvariantViolation({
          invariantId: "I-004",
          message: "Full order is required for pricing request",
          expected: { fullOrder: "object" },
          actual: { fullOrder: null },
          system: "SRS Distribution",
          operation: "GET_PRICING",
          trace: ["getSRSPricing", "validateOrder"],
          nextCheck: "Ensure fullOrder is passed in context parameters",
        });
        return {
            success: false,
            message: "No full order provided",
        };
    }

    console.log("Full Order:", fullOrder);
    console.log("Token:", token);
    
    const orderItems = Array.isArray(fullOrder.fullOrderItems) ? fullOrder.fullOrderItems : [];

    const productList = orderItems
        .map(item => {
            const productIdentifier = item.productId ?? item.id ?? item.itemId;
            const parsedProductId = Number(productIdentifier);
            const hasNumericProductId = Number.isFinite(parsedProductId);

            const sku = item.sku || item.itemCode || item.productSku;
            if (!hasNumericProductId && !sku) {
                console.warn("Skipping line item without product identifier:", item);
                return null;
            }

            const rawOptions =
                Array.isArray(item.productOptions) && item.productOptions.length > 0
                    ? item.productOptions
                    : item.productOptions
                        ? [item.productOptions]
                        : item.variant
                            ? [item.variant]
                            : ["N/A"];

            const normalizedOptions = rawOptions
                .filter(option => option !== undefined && option !== null && `${option}`.trim() !== "")
                .map(option => `${option}`.trim());

            // ✅ Normalize quantities and UOMs for accurate pricing
            const payloadItem = {
                productId: hasNumericProductId ? parsedProductId : undefined,
                productName: item.title || item.productName || item.name || "",
                productOptions: normalizedOptions.length > 0 ? normalizedOptions : ["N/A"],
                quantity: Number(item.qty ?? item.quantity ?? 1) || 1, // ✅ Ensure it's a number
                uom: String(item.uom || item.unitOfMeasure || item.unitOfMeasurement || "PC").toUpperCase().trim(), // ✅ Normalize UOM
            };

            if (sku) {
                payloadItem.itemCode = `${sku}`.trim();
            }

            Object.keys(payloadItem).forEach(key => {
                if (payloadItem[key] === undefined) {
                    delete payloadItem[key];
                }
            });

            return payloadItem;
        })
        .filter(Boolean);

    if (productList.length === 0) {
        logInvariantViolation({
          invariantId: "I-004",
          message: "No valid product data found in order items",
          expected: { productListLength: "> 0" },
          actual: { productListLength: 0, orderItemsCount: orderItems.length },
          system: "SRS Distribution",
          operation: "GET_PRICING",
          trace: ["getSRSPricing", "validateProductList"],
          nextCheck: "Check order items have productId or sku fields populated",
        });
        return {
            success: false,
            message: "No valid product data found on full order items",
        };
    }

    const payload = {
        sourceSystem: fullOrder.sourceSystem || "RHINO",
        customerCode: fullOrder.customerCode || fullOrder.accountId || "RCO207",
        branchCode: fullOrder.branchCode || "SSSAN",
        transactionId: fullOrder.transactionId || "SPR-1",
        jobAccountNumber: Number(fullOrder.jobAccountNumber || fullOrder.jobNumber || 1) || 1,
        productList,
    };

    // Get API base URL from credentials config
    const credentials = getCredentials("SRS", environment);
    const apiBaseUrl = credentials.apiBaseUrl;

    const config = {
        method: "POST",
        url: `${apiBaseUrl}/products/v2/price`,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        data: payload,
    };

    console.log("SRS Pricing Request URL:", config.url);
    console.log("Request headers:", config.headers);
    console.log("Request payload:", payload);

    try {
        console.log("Making request to:", config.url);
        console.log("Request headers:", config.headers);
        console.log("Request data:", config.data);
        
        const response = await axios(config);
        console.log("SRS Pricing Response Status:", response.status);
        console.log("SRS Pricing Response Data:", response.data);
        
        return {
            success: true,
            message: `SRS Pricing fetched successfully (${credentials.environment})`,
            data: response.data,
            environment: credentials.environment,
        };
    }
    catch (error) {
        logContractFailure({
          contractId: "C-005",
          message: "SRS Distribution pricing API request failed",
          expected: { status: 200, data: "pricing object" },
          actual: {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
          },
          system: "SRS Distribution",
          integration: "SRSAdapter",
          operation: "GET_PRICING",
          trace: ["getSRSPricing", "pricingRequest"],
          nextCheck: "Check SRS access token validity, API endpoint, and request payload format",
        });
        
        return {
            success: false,
            status: error.response?.status,
            message: "SRS Pricing fetch failed",
            error: error.response?.data || error.message,
        };
    }
}