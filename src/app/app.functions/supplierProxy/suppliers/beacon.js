/**
 * Beacon Building Products - How BEACON works
 * 
 * Actions: login, getPricing, order
 */

const axios = require("axios");
const { getSupplierConfig } = require("./config");

async function getCookies(config) {
  const response = await axios.post(
    `${config.baseUrl}/v1/rest/com/becn/login`,
    {
      username: config.username,
      password: config.password,
      siteId: "homeSite",
      persistentLoginType: "RememberMe",
      userAgent: "desktop",
      apiSiteId: config.apiSiteId || "UAT",
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  
  const cookies = response.headers["set-cookie"]?.join("; ") || "";
  if (!cookies) {
    throw new Error("BEACON: No cookies returned from login");
  }
  
  return cookies;
}

async function getPricing(env, payload) {
  const config = getSupplierConfig("BEACON", env);
  const cookies = await getCookies(config);
  
  const { fullOrder } = payload || {};
  if (!fullOrder || !fullOrder.fullOrderItems) {
    throw new Error("BEACON: Missing fullOrder");
  }
  
  const formattedItems = fullOrder.fullOrderItems.map((item) => ({
    id: item.id || String(Math.random()),
    itemNumber: String(item.sku || "").trim(),
    quantity: Number(item.qty) || 1,
    uom: String(item.uom || "EA").toUpperCase().trim(),
  })).filter((item) => item.itemNumber);
  
  const skuIds = formattedItems.map((item) => item.itemNumber).join(",");
  
  const response = await axios.get(
    `${config.baseUrl}/v1/rest/com/becn/pricing`,
    {
      headers: {
        Cookie: cookies,
      },
      params: {
        skuIds: skuIds,
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
  const config = getSupplierConfig("BEACON", env);
  const cookies = await getCookies(config);
  
  return {
    success: true,
    cookies: cookies,
    environment: config.environment,
  };
}

async function order(env, payload) {
  const config = getSupplierConfig("BEACON", env);
  const { fullOrder, orderBody } = payload || {};
  
  // Use orderBody if provided, otherwise use fullOrder
  const orderData = orderBody || fullOrder;
  
  if (!orderData) {
    throw new Error("BEACON: Missing order data (fullOrder or orderBody)");
  }
  
  // TODO: Implement full BEACON order submission logic
  // For now, return stub response matching existing pattern
  console.log("BEACON Order submission - stub implementation");
  console.log("Order data:", JSON.stringify(orderData, null, 2));
  
  return {
    success: true,
    message: "BEACON order submitted successfully (stub)",
    confirmationNumber: `BEACON-${Date.now()}`,
    orderId: orderData?.orderId || null,
    environment: config.environment,
  };
}

module.exports = {
  login,
  getPricing,
  order,
};
