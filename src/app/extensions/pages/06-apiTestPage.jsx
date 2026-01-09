import { useState, useEffect } from "react";
import {
  Text,
  Button,
  Flex,
  Heading,
  Divider,
  Panel,
  PanelSection,
  PanelBody,
  StatusTag,
} from "@hubspot/ui-extensions";
import { hubspot } from "@hubspot/ui-extensions";

// SHAPE: Input → Filter → Transform → Store → Output → Loop
// INPUT: order, context, setStatus, clearOrder, setCurrentPage, setCanGoNext
// FILTER: validate order has required fields
// TRANSFORM: convert to unified format, then to ABC format
// STORE: ABC request payload
// OUTPUT: send to sandbox API
// LOOP: display result, allow retry

const API_Test_Page = ({
  setOrder,
  order,
  context,
  setStatus,
  clearOrder,
  setCurrentPage,
  setCanGoNext,
}) => {
  const [testStatus, setTestStatus] = useState("idle");
  const [currentStep, setCurrentStep] = useState("");
  const [loginResult, setLoginResult] = useState(null);
  const [productResult, setProductResult] = useState(null);
  const [pricingResult, setPricingResult] = useState(null);
  const [error, setError] = useState(null);

  // Helper to extract response body (Handles HubSpot wrapping)
  const extractBody = (response) => {
    if (response?.response?.body?.body) {
      return response.response.body.body;
    }
    if (response?.response?.body) {
      return response.response.body;
    }
    if (response?.body) {
      return response.body;
    }
    return response || {};
  };

  // Step 1: Login to Sanbox ABC
  const testSandboxLogin = async () => {
    try {
      setCurrentStep("Logging into ABC Sandbox...");
      const response = await hubspot.serverless("abcLogin", {
        parameters: {
          // No Parameters Needed
        },
      });
      const body = extractBody(response);

      if (body.success && body.access_token) {
        setLoginResult({
          success: true,
          access_token: body.access_token.substring(0, 20) + "...",
          expires_in: body.expires_in,
          environment: "sandbox",
        });
        return body.access_token;
      } else {
        throw new Error(body.error || "Login failed");
      }
    } catch (error) {
      const errorMessage = error.message || "Login failed";
      setLoginResult({ success: false, error: errorMessage });
      throw new Error(`Login failed: ${errorMessage}`);
    }
  };

  // Step 2: Get ABC Product from Supabase
  const getProductsFromSupabase = async () => {
    try {
      setCurrentStep("Fetching ABC products from Supabase...");
      const response = await hubspot.serverless("supplierProducts", {
        parameters: {
          supplier: "ABC",
          q: "",
          pageSize: 1,
        },
      });

      const body = extractBody(response);
      if (body.success && body.items && body.items.length > 0) {
        setProductResult({
          success: true,
          product: {
            sku:
              product.itemnumber || product.sku || product.itemNumber || "N/A",
            title:
              product.itemdescription ||
              product.description ||
              product.title ||
              "N/A",
            supplier: product.supplier || "ABC",
          },
        });
        return product;
      } else {
        throw new Error("No products found in Supabase");
      }
    } catch (error) {
      const errorMessage = error.message || "Product fetch failed";
      setProductResult({ success: false, error: errorMessage });
      throw new Error(`Product fetch failed: ${errorMessage}`);
    }
  };

  // Step 3: Price the product
  const priceProduct = async (accessToken, product) => {
    try {
      setCurrentStep("Pricing product...");

      // Extract SKU and determine UOM
      const sku = product.itemnumber || product.sku || product.itemNumber || "";
      const uom = product.uom || product.unitOfMeasure || "EA";

      // Build fullOrder format expected by getABCPricing
      const fullOrder = {
        fullOrderItems: [
          {
            id: "1",
            sku: sku,
            qty: 1,
            uom: uom.toUpperCase(),
          },
        ],
      };

      const response = await hubspot.serverless("getABCPricing", {
        parameters: {
          abcAccessToken: accessToken,
          fullOrder: fullOrder,
          // No environment parameter = defaults to sandbox
        },
      });

      const body = extractBody(response);

      if (body.success && body.data) {
        setPricingResult({
          success: true,
          data: body.data,
          environment: body.environment || "sandbox",
        });
      } else {
        throw new Error(body.error || body.message || "Pricing failed");
      }
    } catch (err) {
      const errorMsg = err.message || "Pricing failed";
      setPricingResult({ success: false, error: errorMsg });
      throw new Error(`Pricing failed: ${errorMsg}`);
    }
  };

  // Run full test flow
  const runTest = async () => {
    setTestStatus("running");
    setCurrentStep("Starting test...");
    setError(null);
    setLoginResult(null);
    setProductResult(null);
    setPricingResult(null);

    try {
      // Step 1: Login
      const accessToken = await testSandboxLogin();

      // Step 2: Get product
      const product = await getProductFromSupabase();

      // Step 3: Price product
      await priceProduct(accessToken, product);

      setTestStatus("success");
      setCurrentStep("Test completed successfully!");
    } catch (err) {
      setTestStatus("error");
      setError(err.message);
      setCurrentStep(`Test failed: ${err.message}`);
    }
  };

  return (
    <Flex direction="column" gap="medium">
      <Heading>ABC Sandbox API Test</Heading>
      <Text>
        This test will: (1) Login to ABC Sandbox, (2) Get one product from
        Supabase, (3) Price that product
      </Text>

      <Divider />

      <Button
        onClick={runTest}
        disabled={testStatus === "running"}
        variant="primary"
      >
        {testStatus === "running" ? "Running Test..." : "Run Test"}
      </Button>

      {currentStep && (
        <Panel>
          <PanelSection>
            <Text format={{ fontWeight: "bold" }}>Current Step:</Text>
            <Text>{currentStep}</Text>
          </PanelSection>
        </Panel>
      )}

      {loginResult && (
        <Panel>
          <PanelSection>
            <Flex direction="row" justify="space-between" align="center">
              <Text format={{ fontWeight: "bold" }}>Step 1: Sandbox Login</Text>
              <StatusTag type={loginResult.success ? "success" : "error"}>
                {loginResult.success ? "Success" : "Failed"}
              </StatusTag>
            </Flex>
          </PanelSection>
          <PanelBody>
            {loginResult.success ? (
              <Flex direction="column" gap="small">
                <Text>Token: {loginResult.access_token}</Text>
                <Text>Expires in: {loginResult.expires_in}s</Text>
                <Text>Environment: {loginResult.environment}</Text>
              </Flex>
            ) : (
              <Text format={{ color: "error" }}>
                Error: {loginResult.error}
              </Text>
            )}
          </PanelBody>
        </Panel>
      )}

      {productResult && (
        <Panel>
          <PanelSection>
            <Flex direction="row" justify="space-between" align="center">
              <Text format={{ fontWeight: "bold" }}>
                Step 2: Get Product from Supabase
              </Text>
              <StatusTag type={productResult.success ? "success" : "error"}>
                {productResult.success ? "Success" : "Failed"}
              </StatusTag>
            </Flex>
          </PanelSection>
          <PanelBody>
            {productResult.success ? (
              <Flex direction="column" gap="small">
                <Text>SKU: {productResult.product.sku}</Text>
                <Text>Title: {productResult.product.title}</Text>
                <Text>Supplier: {productResult.product.supplier}</Text>
              </Flex>
            ) : (
              <Text format={{ color: "error" }}>
                Error: {productResult.error}
              </Text>
            )}
          </PanelBody>
        </Panel>
      )}

      {pricingResult && (
        <Panel>
          <PanelSection>
            <Flex direction="row" justify="space-between" align="center">
              <Text format={{ fontWeight: "bold" }}>Step 3: Price Product</Text>
              <StatusTag type={pricingResult.success ? "success" : "error"}>
                {pricingResult.success ? "Success" : "Failed"}
              </StatusTag>
            </Flex>
          </PanelSection>
          <PanelBody>
            {pricingResult.success ? (
              <Flex direction="column" gap="small">
                <Text>Environment: {pricingResult.environment}</Text>
                <Text format={{ fontWeight: "bold" }}>Pricing Data:</Text>
                <Text>{JSON.stringify(pricingResult.data, null, 2)}</Text>
              </Flex>
            ) : (
              <Text format={{ color: "error" }}>
                Error: {pricingResult.error}
              </Text>
            )}
          </PanelBody>
        </Panel>
      )}

      {error && testStatus === "error" && (
        <Panel>
          <PanelSection>
            <Text format={{ fontWeight: "bold", color: "error" }}>
              Test Error:
            </Text>
            <Text format={{ color: "error" }}>{error}</Text>
          </PanelSection>
        </Panel>
      )}
    </Flex>
  );
};

export default API_Test_Page;
