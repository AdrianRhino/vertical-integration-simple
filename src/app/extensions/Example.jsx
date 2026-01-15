import React, { useState, useEffect } from "react";
import {
  Divider,
  Button,
  ButtonRow,
  Tag,
  Text,
  Flex,
  hubspot,
} from "@hubspot/ui-extensions";
import { logContractFailure, logInvariantViolation } from "./helperFunctions/debugCheckLogger";

import OrderStart from "./pages/00-orderStart";
import PickSetup from "./pages/01-pickupSetup";
import PricingTable from "./pages/02-pricingTable";
import DeliveryForm from "./pages/03-deliveryForm";
import ReviewSubmit from "./pages/04-reviewSubmit";
import OrderSuccessPage from "./pages/05-successPage";
import API_Test_Page from "./pages/06-apiTestPage";


// Define the extension to be run within the Hubspot CRM
hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <Extension
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
    fetchCrmObjectProperties={actions.fetchCrmObjectProperties}
    refreshObjectProperties={actions.refreshObjectProperties}
  />
));

// Simple page numbers - just a list
const MAIN_PAGES = [0, 1, 2, 3, 4, 6];

// Define the Extension component, taking in runServerless, context, & sendAlert as props
const Extension = ({ context, runServerless, sendAlert, fetchCrmObjectProperties }) => {
    // Simple state - just one order object (like a list of key-value pairs)
    const [order, setOrder] = useState({
      // Basic info
      supplier: "",
      ticket: "",
      template: "",
      orderType: "",
      // Items (just an array)
      items: [],
      // Delivery (just an object with fields)
      delivery: {},
      // Status
      status: "Draft",
      // IDs
      orderId: "",
      selectedOrderId: "",
      // Other
      selectedOrder: null,
    });

     // Simple page number 
  const [currentPage, setCurrentPage] = useState(0);
  const [canGoNext, setCanGoNext] = useState(false);
  const [statusTag, setStatusTag] = useState({ type: "warning", text: "Draft" });


// Load address from deal when page loads
useEffect(() => {
  async function loadAddress() {
    try {
      const properties = await fetchCrmObjectProperties([
        "address_line_1",
        "city",
        "state",
        "zip_code",
      ]);

      // If order doesn't have address yet, use deal address
      if (properties && properties.address_line_1) {
        setOrder((prev) => {
          // Only update if address is not already set
          if (prev.delivery && prev.delivery.address_line_1) {
            return prev;
          }
          return {
            ...prev,
            delivery: {
              ...prev.delivery,
              address_line_1: properties.address_line_1 || "",
              city: properties.city || "",
              state: properties.state || "",
              zip_code: properties.zip_code || "",
            },
          };
        });
      }
    } catch (error) {
      logContractFailure({
        contractId: "C-002",
        message: "Failed to load address from CRM object properties",
        expected: { success: true, properties: "object" },
        actual: {
          message: error.message,
          stack: error.stack,
        },
        system: "HubSpot",
        entityType: "Deal",
        operation: "READ",
        trace: ["Example", "loadAddress", "fetchCrmObjectProperties"],
        nextCheck: "Check HubSpot API permissions and deal object properties",
      });
    }
  }
  loadAddress();
}, [fetchCrmObjectProperties]);

// Load draft order if one is selected
useEffect(() => {
  if (order.selectedOrder) {
    const orderData = order.selectedOrder.value?.properties?.payload_snapshot;
    if (orderData) {
      try {
        const loadedOrder = JSON.parse(orderData);
        // Simple: just copy the loaded order data
        // Handle both fullOrderItems (from draft) and items (current format)
        const loadedItems = loadedOrder.fullOrderItems || loadedOrder.items || [];
        setOrder((prev) => ({
          ...prev,
          supplier: loadedOrder.supplier || prev.supplier,
          ticket: loadedOrder.ticket || prev.ticket,
          template: loadedOrder.template || prev.template,
          items: loadedItems,
          delivery: loadedOrder.delivery || prev.delivery,
          status: loadedOrder.orderStatus || loadedOrder.status || "Draft",
          orderId: loadedOrder.orderId || prev.orderId,
          selectedOrderId: loadedOrder.orderId || loadedOrder.selectedOrderId || prev.selectedOrderId,
        }));
      } catch (error) {
        logInvariantViolation({
          invariantId: "I-002",
          message: "Failed to parse order data from payload snapshot",
          expected: { validJson: true, orderData: "object" },
          actual: {
            message: error.message,
            payloadData: orderData,
          },
          system: "HubSpot",
          entityType: "Order",
          operation: "PARSE",
          trace: ["Example", "loadDraftOrder", "parseOrderData"],
          nextCheck: "Check payload_snapshot format and JSON structure",
        });
      }
    }
  }
}, [order.selectedOrder]);

  // Simple function to set status tag
  const setStatus = (statusText) => {
    let tagType = "warning";
    if (statusText === "Submitted") {
      tagType = "success";
    } else if (statusText === "Placed") {
      tagType = "default";
    }
    setStatusTag({ type: tagType, text: statusText });
  };

    // Simple function to clear order
    const clearOrder = () => {
      setOrder({
        supplier: "",
        ticket: "",
        template: "",
        orderType: "",
        items: [],
        delivery: {},
        status: "Draft",
        orderId: "",
        selectedOrderId: "",
        selectedOrder: null,
      });
      setStatus("Draft");
    };

    // Simple function to show which page
  const showPage = (pageNumber) => {
    switch (pageNumber) {
      case 0:
        return (
          <OrderStart
            order={order}
            setOrder={setOrder}
            context={context}
            runServerless={runServerless}
            setStatus={setStatus}
            clearOrder={clearOrder}
            setCurrentPage={setCurrentPage}
            setCanGoNext={setCanGoNext}
          />
        );
      case 1:
        return (
          <PickSetup
            order={order}
            setOrder={setOrder}
            context={context}
            runServerless={runServerless}
            setCanGoNext={setCanGoNext}
          />
        );
      case 2:
        return (
          <PricingTable
            order={order}
            setOrder={setOrder}
            runServerless={runServerless}
            setCanGoNext={setCanGoNext}
          />
        );
      case 3:
        return (
          <DeliveryForm
            order={order}
            setOrder={setOrder}
            runServerless={runServerless}
            setCanGoNext={setCanGoNext}
            fetchCrmObjectProperties={fetchCrmObjectProperties}
          />
        );
      case 4:
        return (
          <ReviewSubmit
            order={order}
            setOrder={setOrder}
            context={context}
            fetchCrmObjectProperties={fetchCrmObjectProperties}
            runServerless={runServerless}
            sendAlert={sendAlert}
            setCurrentPage={setCurrentPage}
            setCanGoNext={setCanGoNext}
          />
        );
      case 5:
        return (
          <OrderSuccessPage
            title="Order Success"
            setCurrentPage={setCurrentPage}
            currentPage={currentPage}
            continueText="Back to Order Start"
            setCanGoNext={setCanGoNext}
          />
        );
        case 6:
        return (
          <API_Test_Page
          setOrder={setOrder}
          order={order}
          context={context}
          setStatus={setStatus}
          clearOrder={clearOrder}
          setCurrentPage={setCurrentPage}
          setCanGoNext={setCanGoNext}
          />
        );
      default:
        return <Text>Page not found</Text>;
    }
  };

  // Simple function to save draft
  const saveDraft = async () => {
    try {
      // Calculate total from items (simple loop)
      let total = 0;
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const qty = Number(item.qty) || 0;
        const price = Number(item.unitPrice) || 0;
        total = total + qty * price;
      }

      // Build simple order object (convert items to fullOrderItems for serverless function)
      const orderToSave = {
        ...order,
        fullOrderItems: order.items, // Serverless function expects fullOrderItems
        orderStatus: "Draft",
        orderTotal: total,
      };

      const response = await hubspot.serverless("sendDraftToHubspot", {
        parameters: {
          fullOrder: orderToSave,
          dealId: context.crm.objectId,
          orderObjectId: order.orderId || order.selectedOrderId || null,
        },
      });

      if (response.body?.ok === false || response.statusCode >= 400) {
        const errorMsg = response.body?.error || response.body?.message || "Failed to save draft";
        sendAlert({ message: `Failed to save draft: ${errorMsg}`, type: "danger" });
        return;
      }

      const newOrderId = response.body?.orderId;
      if (newOrderId) {
        setOrder((prev) => ({
          ...prev,
          orderId: newOrderId,
          selectedOrderId: newOrderId,
          orderStatus: "Draft",
        }));
        sendAlert({ message: "Order saved as draft", type: "success" });
        setStatus("Draft");
      } else {
        sendAlert({ message: "Draft saved but no order ID returned", type: "warning" });
      }
    } catch (error) {
      logContractFailure({
        contractId: "C-002",
        message: "Failed to save draft order to HubSpot",
        expected: { success: true, orderId: "string" },
        actual: {
          message: error.message,
          response: error.response?.body,
        },
        system: "HubSpot",
        entityType: "Order",
        operation: "CREATE",
        trace: ["Example", "saveDraft", "sendDraftToHubspot"],
        nextCheck: "Check HubSpot API connectivity and order object permissions",
      });
      sendAlert({ message: `Error saving draft: ${error.message || "Unknown error"}`, type: "danger" });
    }
  };

  // Simple: show save draft button on pages 0, 1, 2, 3 (not on review page 4, success page 5, or test page 6)
  const showSaveButton = currentPage !== 4 && currentPage !== 5 && currentPage !== 6;

  // Simple: check if we can go to next page
  const isLastPage = currentPage === 4;
  const canGoToNext = canGoNext && !isLastPage && MAIN_PAGES.includes(currentPage);
  
  // For page 6 (API test page), disable navigation buttons
  const isTestPage = currentPage === 6;



  return (
    <>
      {currentPage === 5 ? (
        <Tag variant="success">Submitted</Tag>
      ) : (
        <Tag variant={statusTag.type}>{statusTag.text}</Tag>
      )}

      {showPage(currentPage)}
      <Text></Text>

      {showSaveButton && (
        <Flex justify="end">
          <Button variant="secondary" onClick={saveDraft}>
            Save as Draft
          </Button>
        </Flex>
      )}

      <Divider />
      <Text></Text>
      <ButtonRow>
        {currentPage === 5 ? (
          <Button onClick={() => {
            clearOrder();
            setCurrentPage(0);
            setCanGoNext(false);
          }}>Back to Order Start</Button>
        ) : isTestPage ? (
          <Button onClick={() => {
            setCurrentPage(0);
            setCanGoNext(false);
          }}>Back to Order Start</Button>
        ) : (
          <>
            <Button
              disabled={currentPage === 0}
              onClick={() => {
                if (order.selectedOrder?.value?.properties?.status === "Submitted") {
                  setCurrentPage(0);
                } else {
                  setCurrentPage(currentPage - 1);
                }
              }}
            >
              Back
            </Button>
            <Button
              variant="primary"
              disabled={!canGoToNext}
              onClick={() => {
                if (order.selectedOrder?.value?.properties?.status === "Submitted") {
                  setCurrentPage(4);
                  return;
                }
                if (!isLastPage) {
                  setCurrentPage(currentPage + 1);
                }
              }}
            >
              Next
            </Button>
          </>
        )}
      </ButtonRow>
      <Text></Text>
      <Text></Text>
    </>
  );
};

export default Extension;
