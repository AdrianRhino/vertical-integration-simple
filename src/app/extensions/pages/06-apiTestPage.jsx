// SHAPE: Input → Filter → Transform → Store → Output → Loop
// INPUT: Config-driven API endpoints organized by supplier and environment
// FILTER: Enabled endpoints per supplier/environment
// TRANSFORM: Generate test UI for each endpoint
// STORE: Test results per endpoint
// OUTPUT: Organized display by supplier → environment → endpoint
// LOOP: Allow individual endpoint testing

import { useState } from "react";
import { Text, Heading, Button, Divider } from "@hubspot/ui-extensions";
import { hubspot } from "@hubspot/ui-extensions";

const API_Test_Page = ({
  setOrder,
  order,
  context,
  setStatus,
  clearOrder,
  setCurrentPage,
  setCanGoNext,
}) => {
  const [AbcAccessToken, setAbcAccessToken] = useState(null);
  const [SrsAccessToken, setSrsAccessToken] = useState(null);

  const testAbcLogin = async (env) => {
    const loginResponse = await hubspot.serverless("supplierProxy", {
      parameters: {
        supplierKey: "ABC",
        env: env === "prod" ? "prod" : "sandbox",
        action: "login",
        payload: {},
      },
    });
    console.log(loginResponse);
    setAbcAccessToken(loginResponse.body.access_token);
  };

  const testAbcPricing = async (env) => {
    const pricingResponse = await hubspot.serverless("supplierProxy", {
      parameters: {
        supplierKey: "ABC",
        env: env === "prod" ? "prod" : "sandbox",
        action: "getPricing",
        payload: {
          fullOrder: {
            fullOrderItems: [
              {
                id: "1",
                itemNumber: "0110004585",
                quantity: 10,
                uom: "EA",
              },
            ],
          },
        },
      },
    });
    console.log(pricingResponse);
  };

  const testAbcOrder = async (env) => {
    const orderResponse = await hubspot.serverless("supplierProxy", {
      parameters: {
        supplierKey: "ABC",
        env: env === "prod" ? "prod" : "sandbox",
        action: "order",
        payload: {
          fullOrder: {
            fullOrderItems: [
              {
                id: "1",
                itemNumber: "0110004585",
                quantity: 10,
                uom: "EA",
              },
            ],
          },
        },
      },
    });
    console.log("Full orderResponse:", JSON.stringify(orderResponse, null, 2));
    console.log("orderResponse.body.data:", orderResponse.body?.data);
  };

  const testSrsLogin = async (env) => {
    const loginResponse = await hubspot.serverless("supplierProxy", {
      parameters: {
        supplierKey: "SRS",
        env: env === "prod" ? "prod" : "sandbox",
        action: "login",
        payload: {},
      },
    });
    console.log(loginResponse);
    setSrsAccessToken(loginResponse.body.access_token);
  };

  const testSrsPricing = async (env) => {
    const pricingResponse = await hubspot.serverless("supplierProxy", {
      parameters: {
        supplierKey: "SRS",
        env: env === "prod" ? "prod" : "sandbox",
        action: "getPricing",
        payload: {
          fullOrder: {
            fullOrderItems: [
              {
                "productId": 186233,
                productName: "AFCO Vinyl Stair Bracket Kit",
                quantity: 10,
                "uom": "KIT",
              },
            ],
            accessToken: SrsAccessToken,
            sourceSystem: "RHINO",
            branchCode: "SSSAN",
            customerCode: "RCO207",
            transactionId: "SPR-1",
            jobAccountNumber: 1,
          },
        },
      },
    });
    console.log(pricingResponse);
  };

  const testSrsOrder = async (env) => {
    const orderResponse = await hubspot.serverless("supplierProxy", {
      parameters: {
        supplierKey: "SRS",
        env: env === "prod" ? "prod" : "sandbox",
        action: "order",
        payload: {
          fullOrder: {},
        },
      },
    });
    console.log("Full orderResponse:", JSON.stringify(orderResponse, null, 2));
    console.log("orderResponse.body.data:", orderResponse.body?.data);
  };

  return (
    <>
      <Heading>API Test Page</Heading>
      <Button onClick={() => testAbcLogin("prod")}>
        Production Login ABC Test
      </Button>
      <Text></Text>
      <Button onClick={() => testAbcPricing("prod")}>
        Production Pricing ABC Test
      </Button>
      <Text></Text>
      <Button onClick={() => testAbcOrder("sandbox")}>
        Sandbox Order ABC Test
      </Button>
      <Text></Text>
      <Divider />
      <Heading>SRS Test Page</Heading>
      <Button onClick={() => testSrsLogin("prod")}>
        Production Login SRS Test
      </Button>
      <Text></Text>
      <Button onClick={() => testSrsPricing("prod")}>
        Production Pricing SRS Test
      </Button>
      <Text></Text>
      <Button onClick={() => testSrsOrder("sandbox")}>
        Sandbox Order SRS Test
      </Button>
      <Text></Text>
      <Divider />
    </>
  );
};

export default API_Test_Page;
