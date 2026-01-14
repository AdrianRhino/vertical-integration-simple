/**
 * The ONE door - routes all supplier requests
 * UI calls this with: supplierKey, env, action, payload
 * 
 * Available actions for all suppliers: login, getPricing, order
 * 
 * Examples:
 * { supplierKey: "ABC", env: "sandbox", action: "login", payload: {} }
 * { supplierKey: "ABC", env: "prod", action: "getPricing", payload: { fullOrder: {...} } }
 * { supplierKey: "ABC", env: "sandbox", action: "order", payload: { fullOrder: {...} } }
 */

const abc = require("./suppliers/abc");
const srs = require("./suppliers/srs");
const beacon = require("./suppliers/beacon");

const suppliers = {
  ABC: abc,
  SRS: srs,
  BEACON: beacon,
};

exports.main = async (context = {}) => {
  try {
    const { supplierKey, env, action, payload } = context.parameters || {};

    // Check we have what we need
    if (!supplierKey || !env || !action) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: "Missing supplierKey, env, or action",
        },
      };
    }

    // Find the supplier
    const supplier = suppliers[supplierKey.toUpperCase()];
    if (!supplier) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: `Unknown supplier: ${supplierKey}. Available: ABC, SRS, BEACON`,
        },
      };
    }

    // Check the action exists
    if (typeof supplier[action] !== "function") {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: `Unknown action: ${action} for ${supplierKey}`,
        },
      };
    }

    // Call the supplier action
    const result = await supplier[action](env, payload);

    // Check for error status in response body (e.g., ABC returns 200 but status.code === "Error")
    if (result?.data?.lines) {
      const errorLine = result.data.lines.find(line => line.status?.code === "Error");
      if (errorLine) {
        return {
          statusCode: 400,
          body: {
            success: false,
            error: errorLine.status.message || "Pricing error",
          },
        };
      }
    }

    return {
      statusCode: 200,
      body: result,
    };
  } catch (error) {
    console.error("supplierProxy error:", error);
    
    // Extract status code from error message if present (e.g., "error (500): ...")
    const errorMessage = error.message || String(error);
    const statusMatch = errorMessage.match(/\((\d+)\)/);
    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    
    return {
      statusCode: statusCode,
      body: {
        success: false,
        error: errorMessage,
      },
    };
  }
};
