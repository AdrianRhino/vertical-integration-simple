const { logContractFailure } = require("../utils/debugCheckLogger");

exports.main = async (context) => {
  const token = process.env.HUBSPOT_API_KEY2;

  const dealId = context.parameters.context.crm.objectId;

  try {
    const res = await fetch(
      `https://api.hubapi.com/crm/v4/objects/deals/${dealId}/associations/tickets`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    const data = await res.json();
    const ticketIds = (data.results || []).map((r) => r.toObjectId);

    const ticketInfo = await fetch(
      `https://api.hubapi.com/crm/v3/objects/tickets/batch/read`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: ticketIds.map((id) => ({ id: String(id) })),
          properties: ["job_type"],
        }),
      }
    );

    const ticketInfoData = await ticketInfo.json();

    const results = ticketInfoData.results || [];

    const tickets = results
      .map((r) => ({
        label: r.properties.job_type ?? "(No Job Type)",
        value: r.id,
      }))
      .filter((o) => o.value)
      .sort((a, b) => a.label.localeCompare(b.label));

    // console.log('Tickets:', tickets);

    return {
      statusCode: 200,
      body: { tickets },
      headers: { "Content-Type": "application/json" },
    };
  } catch (error) {
    logContractFailure({
      contractId: "C-002",
      message: "Failed to fetch tickets from HubSpot",
      expected: { ok: true, tickets: "array" },
      actual: {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      },
      system: "HubSpot",
      entityType: "Ticket",
      operation: "READ",
      trace: ["getTickets", "fetchAssociations", "batchRead"],
      nextCheck: "Check HubSpot API key, deal ID validity, and ticket associations",
    });
    return {
      statusCode: 500,
      body: { error: error.message },
    };
  }
};
