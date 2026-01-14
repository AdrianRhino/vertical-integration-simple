/**
 * SRS Distribution - How SRS works
 * 
 * Actions: login, getPricing, order
 */

const axios = require("axios");
const { getSupplierConfig } = require("./config");

async function getToken(config) {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "ALL",
  });
  
  const response = await axios.post(config.authUrl, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  
  const token = response.data.access_token;
  if (!token) {
    throw new Error("SRS: No token returned from login");
  }
  
  return token;
}

async function getPricing(env, payload) {
  const config = getSupplierConfig("SRS", env);
  const token = await getToken(config);
  
  const { fullOrder } = payload || {};
  if (!fullOrder || !fullOrder.fullOrderItems) {
    throw new Error("SRS: Missing fullOrder");
  }
  
  const formattedItems = fullOrder.fullOrderItems.map((item) => ({
    productId: item.productId || item.sku,
    quantity: Number(item.qty) || 1,
    uom: String(item.uom || "EA").toUpperCase(),
  }));
  
  const response = await axios.post(
    `${config.baseUrl}/products/v2/price`,
    {
      lines: formattedItems,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  
  return {
    success: true,
    data: response.data,
    environment: config.environment,
  };
}

async function login(env, payload) {
  const config = getSupplierConfig("SRS", env);
  const token = await getToken(config);
  
  return {
    success: true,
    access_token: token,
    environment: config.environment,
  };
}

async function order(env, payload) {
  const config = getSupplierConfig("SRS", env);
  const { fullOrder, orderBody } = payload || {};
  
  // Use orderBody if provided, otherwise use fullOrder
  const orderData = orderBody || fullOrder;
  
  if (!orderData) {
    throw new Error("SRS: Missing order data (fullOrder or orderBody)");
  }
  
  // TODO: Implement full SRS order submission logic
  // For now, return stub response matching existing pattern
  console.log("SRS Order submission - stub implementation");
  console.log("Order data:", JSON.stringify(orderData, null, 2));
  
  return {
    success: true,
    message: "SRS order submitted successfully (stub)",
    confirmationNumber: `SRS-${Date.now()}`,
    orderId: orderData?.orderId || null,
    environment: config.environment,
  };
}

module.exports = {
  login,
  getPricing,
  order,
};
