import { Select } from "@hubspot/ui-extensions";
import { useEffect, useState } from "react";
import { supplierOptions, templateOptions } from "../helperFunctions/appOptions";
import { logContractFailure } from "../helperFunctions/debugCheckLogger";

const PickSetup = ({ order, setOrder, context, runServerless, setCanGoNext }) => {
  const [tickets, setTickets] = useState([]);

  // Load tickets when page loads
  useEffect(() => {
    loadTickets();
  }, []);

  // Simple validation: check if all three fields are filled
  useEffect(() => {
    const hasTicket = order.ticket && order.ticket !== "";
    const hasSupplier = order.supplier && order.supplier !== "";
    const hasTemplate = order.template && order.template !== "";

    setCanGoNext(hasTicket && hasSupplier && hasTemplate);
  }, [order.ticket, order.supplier, order.template]);

  // Simple function to load tickets
  const loadTickets = async () => {
    try {
      const response = await runServerless({
        name: "getTickets",
        parameters: { context },
      });
      // Handle both response structures (response.response.body or response.body)
      const ticketsData = response?.response?.body?.tickets || response?.body?.tickets || [];
      setTickets(ticketsData);
    } catch (err) {
      logContractFailure({
        contractId: "C-002",
        message: "Failed to fetch tickets from HubSpot",
        expected: { success: true, tickets: "array" },
        actual: { message: err.message },
        system: "HubSpot",
        entityType: "Ticket",
        operation: "READ",
        trace: ["PickupSetup", "loadTickets"],
        nextCheck: "Check getTickets serverless function and HubSpot API",
      });
    }
  };

  return (
    <>
      <Select
        label="Ticket Selection List"
        options={tickets}
        value={order.ticket}
        onChange={(value) => {
          setOrder((prev) => ({ ...prev, ticket: value }));
        }}
      />
      <Select
        label="Select Supplier"
        options={supplierOptions}
        value={order.supplier}
        onChange={(value) => {
          setOrder((prev) => ({ ...prev, supplier: value }));
        }}
      />
      <Select
        label="Select Template"
        options={templateOptions}
        value={order.template}
        onChange={(value) => {
          // Find template items (simple search)
          let templateItems = [];
          for (let i = 0; i < templateOptions.length; i++) {
            if (templateOptions[i].value === value) {
              templateItems = templateOptions[i].items || [];
              break;
            }
          }

          setOrder((prev) => ({
            ...prev,
            template: value,
            templateItems: templateItems,
          }));
        }}
      />
    </>
  );
};

export default PickSetup;
