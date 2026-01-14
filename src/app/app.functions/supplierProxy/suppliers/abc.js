/**
 * ABC Supply - How ABC works
 * 
 * Actions: login, getPricing, order
 */

const axios = require("axios");
const { getSupplierConfig } = require("./config");

// Step 1: Get token (login)
async function getToken(config) {
  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const authUrl = config.authUrl.split("?")[0];
  
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("scope", "product.read pricing.read location.read account.read order.write");
  
  const response = await axios.post(authUrl, params.toString(), {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  
  const token = response.data.access_token;
  if (!token) {
    throw new Error("ABC: No token returned from login");
  }
  
  return token;
}

// Step 2: Get pricing
async function getPricing(env, payload) {
  const config = getSupplierConfig("ABC", env);
  const token = await getToken(config);
  
  const { fullOrder } = payload || {};
  if (!fullOrder || !fullOrder.fullOrderItems) {
    throw new Error("ABC: Missing fullOrder");
  }

  
  const formattedItems = fullOrder.fullOrderItems.map((item) => ({
    id: item.id || String(Math.random()),
    itemNumber: String(item.itemNumber || item.sku || "").trim(),
    quantity: Number(item.quantity || item.qty || 1),
    uom: String(item.uom || "EA").toUpperCase().trim(),
  })).filter((item) => item.itemNumber);

  if (formattedItems.length === 0) {
    throw new Error("ABC: No valid items to price");
  }
  
  const pricingUrl = `${config.baseUrl}/api/pricing/v2/prices`;
  const requestData = {
    branchNumber: "461",
    shipToNumber: "2063975-2",
    requestId: `Pricing-${Date.now()}`,
    purpose: "estimating",
    lines: formattedItems,
  };
  
  try {
    const response = await axios.post(
      pricingUrl,
      requestData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    
    return {
      success: true,
      data: response.data,
      environment: config.environment,
    };
  } catch (error) {
    // Extract ABC's error message from response
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.message || 
                        error.response?.statusText || 
                        error.message;
    
    // Throw error with ABC's actual message
    throw new Error(`ABC Pricing API error (${error.response?.status || 'unknown'}): ${errorMessage}`);
  }
}

// Step 3: Login action (returns token)
async function login(env, payload) {
  const config = getSupplierConfig("ABC", env);
  const token = await getToken(config);
  
  return {
    success: true,
    access_token: token,
    environment: config.environment,
  };
}

// Step 4: Submit order
async function order(env, payload) {
  const config = getSupplierConfig("ABC", env);
  const token = await getToken(config);
  
  const { fullOrder, orderBody } = payload || {};
  const orderData = orderBody || fullOrder;
  
  if (!orderData || !orderData.fullOrderItems) {
    throw new Error("ABC: Missing order data (fullOrder or orderBody with fullOrderItems)");
  }
  
  // Format lines according to API: orderedQty: { value, uom }
  const lines = orderData.fullOrderItems.map((item) => ({
    id: parseInt(item.id) || Math.floor(Math.random() * 1000000),
    itemNumber: String(item.itemNumber || item.sku || "").trim(),
    orderedQty: {
      value: Number(item.quantity || item.qty || 1),
      uom: String(item.uom || "EA").toUpperCase().trim(),
    },
  })).filter((item) => item.itemNumber);
  
  if (lines.length === 0) {
    throw new Error("ABC: No valid items to order");
  }
  
  // Build request according to API docs
  const requestData = {
    requestId: `Order-${Date.now()}`,
    branchNumber: "461",
    typeCode: "SO",
    deliveryService: "OTG",
    shipTo: {
      number: "855712", //2063975-2
      name: "ABC Supply",
      address: {
        line1: "123 Main St",
        city: "Anytown",
        state: "CA",
        postal: "12345",
      },
      contacts: [{
        name: "John Doe",
        functionCode: "SM",
        email: "john.doe@example.com",
        phones: [{
          number: "1234567890",
          type: "MOBILE",
        }],
      }],
    },
    lines: lines,
  };
  
  try {
    const response = await axios.post(
      `${config.baseUrl}/api/order/v2/orders`,
      requestData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    
    return {
      success: true,
      data: response.data,
      environment: config.environment,
    };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.message || 
                        error.response?.statusText || 
                        error.message;
    
    throw new Error(`ABC Order API error (${error.response?.status || 'unknown'}): ${errorMessage}`);
  }
}

module.exports = {
  login,
  getPricing,
  order,
};
