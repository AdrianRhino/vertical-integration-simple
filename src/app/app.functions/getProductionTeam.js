const { logContractFailure } = require("../utils/debugCheckLogger");

exports.main = async (context) => {
  try {
    const token = process.env.HUBSPOT_API_KEY2;

    const response = await fetch(`https://api.hubapi.com/crm/v3/owners`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    //console.log("Response status:", response.status);
    //console.log("Full response data:", data);

    // Check if response is successful
    if (!response.ok) {
      logContractFailure({
        contractId: "C-002",
        message: "HubSpot API request failed when fetching production team",
        expected: { status: 200, data: "array" },
        actual: {
          status: response.status,
          data: data,
        },
        system: "HubSpot",
        operation: "READ",
        trace: ["getProductionTeam", "fetchOwners"],
        nextCheck: "Check HubSpot API key and owners endpoint permissions",
      });
      return {
        statusCode: response.status,
        body: { error: data.message || "API request failed" },
      };
    }

    // Convert to array format if needed
    const ownersArray = Array.isArray(data) ? data : data.results || [];
    //console.log("Owners array:", ownersArray);
    console.log("First owner teams:", ownersArray[0].teams);
    console.log("First team name:", ownersArray[0].teams[0].name);

    // Filter owners who have the "9.0 - Director of Production" team
    const productionTeam = ownersArray.filter(
      (owner) =>
        owner.teams &&
        owner.teams.some(
          (team) =>
            team.name === "[9.0] Director of Production" ||
            team.name === "[9.4] Commercial Project Manager"
        )
    );
    console.log("Production team:", productionTeam);

    // I want to make an array of the production team with pairs of the id as the value, and the label as the first and last name
    const productionTeamArray = productionTeam.map((owner) => ({
      value: owner.id,
      label: `${owner.firstName} ${owner.lastName}`,
    }));
    //console.log("Production team array:", productionTeamArray);

    return {
      statusCode: 200,
      body: {
        data: productionTeamArray,
        total: productionTeamArray.length,
      },
    };
  } catch (error) {
    logContractFailure({
      contractId: "C-002",
      message: "Exception occurred while fetching production team",
      expected: { success: true, data: "array" },
      actual: {
        message: error.message,
        stack: error.stack,
      },
      system: "HubSpot",
      operation: "READ",
      trace: ["getProductionTeam"],
      nextCheck: "Check network connectivity and HubSpot API availability",
    });
    return {
      statusCode: 500,
      body: { error: error.message },
    };
  }
};
