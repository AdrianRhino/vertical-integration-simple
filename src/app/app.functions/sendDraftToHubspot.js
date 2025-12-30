const axios = require("axios"); // Added axios for V4 associations
const { logContractFailure } = require("../utils/debugCheckLogger");

exports.main = async (context = {}) => {
  console.log("🚀 Saving draft...");

  const { fullOrder, dealId, orderObjectId } = context.parameters || {};

  if (!fullOrder) {
    return {
      statusCode: 400,
      body: { ok: false, error: "fullOrder is required" },
    };
  }

  if (!dealId) {
    return {
      statusCode: 400,
      body: { ok: false, error: "dealId is required for association" },
    };
  }

  const existingOrderId =
    orderObjectId ||
    fullOrder?.selectedOrderId ||
    fullOrder?.orderObjectId ||
    null;

  const orderNumber =
    fullOrder?.orderNumber ||
    fullOrder?.order_id ||
    fullOrder?.selectedOrder?.value?.properties?.order_id ||
    fullOrder?.parsedOrder?.order_id ||
    (existingOrderId ? undefined : `ORD-${Date.now()}`); // Only generate new number if creating new order

  // Calculate order total if not provided
  let orderTotal = fullOrder?.orderTotal;
  if (!orderTotal && fullOrder?.fullOrderItems) {
    orderTotal = fullOrder.fullOrderItems.reduce(
      (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
      0
    );
  }

  // Set the hubspot properties
  const hubspotProperties = {
    ...(orderNumber ? { order_id: orderNumber } : {}), // Only set order_id if we have one (don't overwrite on update)
    payload_snapshot: JSON.stringify(fullOrder),
    status: "Draft",
    ...(orderTotal !== undefined ? { total: orderTotal.toString() } : {}), // Only set total if we have a value
    last_saved_at: new Date().toISOString(),
    ...(fullOrder?.placed_order_address ? { placed_order_address: fullOrder.placed_order_address } : {}),
    ...(fullOrder?.pdfUrl || fullOrder?.order_url ? { order_url: fullOrder.pdfUrl || fullOrder.order_url } : {}),
  };
  
  // Remove undefined/null values to avoid API errors
  Object.keys(hubspotProperties).forEach(key => {
    if (hubspotProperties[key] === undefined || hubspotProperties[key] === null) {
      delete hubspotProperties[key];
    }
  });

  try {
    if (existingOrderId) {
      console.log(`Updating existing order: ${existingOrderId}`);
      console.log("Update properties:", JSON.stringify(hubspotProperties, null, 2));
      
      const updateConfig = {
        method: "PATCH",
        url: `https://api.hubapi.com/crm/v3/objects/2-22239999/${existingOrderId}`,
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY2}`,
          "Content-Type": "application/json",
        },
        data: {
          properties: hubspotProperties,
        },
      };

      try {
        const response = await axios(updateConfig);
        console.log("✅ Order updated successfully");

        return {
          statusCode: 200,
          body: {
            ok: true,
            message: "Draft updated successfully",
            orderId: existingOrderId,
            hubspotResponse: response.data,
          },
        };
      } catch (updateError) {
        logContractFailure({
          contractId: "C-002",
          message: "Failed to update HubSpot order object",
          expected: { statusCode: 200, orderId: existingOrderId },
          actual: {
            status: updateError.response?.status,
            data: updateError.response?.data,
            message: updateError.message,
          },
          system: "HubSpot",
          entityType: "Order",
          entityId: existingOrderId,
          operation: "UPDATE",
          trace: ["sendDraftToHubspot", "updateOrder"],
          nextCheck: "Check HubSpot API key, order object permissions, and order ID validity",
        });
        // If update fails, try to create a new one instead
        console.log("Update failed, attempting to create new order...");
        // Continue to create flow below
      }
    }

    // Ensure order_id is set when creating new order
    if (!hubspotProperties.order_id) {
      hubspotProperties.order_id = `ORD-${Date.now()}`;
    }
    
    console.log(`Creating new order with order_id: ${hubspotProperties.order_id}`);
    console.log("Create properties:", JSON.stringify(hubspotProperties, null, 2));
    
    const createConfig = {
      method: "POST",
      url: "https://api.hubapi.com/crm/v3/objects/2-22239999",
      headers: {
        Authorization: `Bearer ${process.env.HUBSPOT_API_KEY2}`,
        "Content-Type": "application/json",
      },
      data: {
        properties: hubspotProperties,
      },
    };

    const response = await axios(createConfig);
    const orderId = response.data.id;
    console.log("✅ Order created successfully with ID:", orderId);

    const associationConfig = {
      method: "POST",
      url: "https://api.hubapi.com/crm/v4/associations/2-22239999/deals/batch/associate/default",
      headers: {
        Authorization: `Bearer ${process.env.HUBSPOT_API_KEY2}`,
        "Content-Type": "application/json",
      },
      data: {
        inputs: [
          {
            from: { id: orderId },
            to: { id: dealId },
          },
        ],
      },
    };

    const associationResponse = await axios(associationConfig);

    console.log("Association Response:", associationResponse.data);

    return {
      statusCode: 200,
      body: {
        ok: true,
        message: "Draft saved successfully",
        orderId: orderId,
        hubspotResponse: response.data,
        associationResponse: associationResponse.data,
      },
    };
  } catch (error) {
    logContractFailure({
      contractId: "C-002",
      message: "HubSpot API request failed while saving draft order",
      expected: { success: true, orderId: "string" },
      actual: {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      },
      system: "HubSpot",
      entityType: "Order",
      operation: existingOrderId ? "UPDATE" : "CREATE",
      trace: ["sendDraftToHubspot", existingOrderId ? "updateOrder" : "createOrder"],
      nextCheck: "Check HubSpot API key, network connectivity, and API rate limits",
    });
    return {
      statusCode: 500,
      body: {
        ok: false,
        error: error.message,
        details: error.response?.data,
      },
    };
  }
};
