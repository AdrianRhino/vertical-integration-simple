import {
  Text,
  Button,
  ButtonRow,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  StepperInput,
  Input,
  Flex,
  Divider,
  Panel,
  PanelSection,
  PanelBody,
  PanelFooter,
  Heading,
  Select,
  StatusTag,
  hubspot,
  Tile,
} from "@hubspot/ui-extensions";
import { useState, useEffect } from "react";
import { units } from "../helperFunctions/helper";
import { moneyFormatter, toSentenceCase } from "../helperFunctions/helper";
import { logContractFailure, logInvariantViolation } from "../helperFunctions/debugCheckLogger";

const PricingTable = ({
  order,
  setOrder,
  runServerless,
  setCanGoNext,
}) => {
  // Simple state - just arrays and objects
  const [items, setItems] = useState([]); // Array of items
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]); // Array of products from search
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchCursor, setSearchCursor] = useState(null);
  
  // Simple draft item for manual entry
  const [draftItem, setDraftItem] = useState({
    qty: "",
    uom: "EA",
    sku: "",
    title: "",
    unitPrice: "",
  });

  // Load items from order when page loads
  useEffect(() => {
    if (order.items && order.items.length > 0) {
      // Normalize UOM for items loaded from order (e.g., from templates or drafts)
      // If item has "EA" but title suggests a different UOM, infer the correct UOM
      const normalizedItems = order.items.map(item => {
        // If UOM is "EA" but title suggests a different UOM, update it
        if (item.uom === "EA" && item.title) {
          const titleUpper = item.title.toUpperCase();
          
          // Check for common roofing UOM patterns in title
          if (titleUpper.includes("/SQ") || titleUpper.includes("PER SQ") || titleUpper.includes("PER SQUARE")) {
            return {
              ...item,
              uom: "SQ",
              uoms: item.uoms && item.uoms.includes("SQ") ? item.uoms : (item.uoms || []).concat(["SQ"]).filter((v, i, a) => a.indexOf(v) === i)
            };
          }
          if (titleUpper.includes("/BD") || titleUpper.includes("PER BD") || titleUpper.includes("PER BUNDLE") || titleUpper.includes("BUNDLE")) {
            return {
              ...item,
              uom: "BNDL",
              uoms: item.uoms && item.uoms.includes("BNDL") ? item.uoms : (item.uoms || []).concat(["BNDL"]).filter((v, i, a) => a.indexOf(v) === i)
            };
          }
          if (titleUpper.includes("ROLL") || titleUpper.includes("/RL")) {
            return {
              ...item,
              uom: "RL",
              uoms: item.uoms && item.uoms.includes("RL") ? item.uoms : (item.uoms || []).concat(["RL"]).filter((v, i, a) => a.indexOf(v) === i)
            };
          }
          if (titleUpper.includes("LINEAR") || titleUpper.includes("/LF")) {
            return {
              ...item,
              uom: "LF",
              uoms: item.uoms && item.uoms.includes("LF") ? item.uoms : (item.uoms || []).concat(["LF"]).filter((v, i, a) => a.indexOf(v) === i)
            };
          }
          if (titleUpper.includes("BOX") || titleUpper.includes("/BX")) {
            return {
              ...item,
              uom: "BX",
              uoms: item.uoms && item.uoms.includes("BX") ? item.uoms : (item.uoms || []).concat(["BX"]).filter((v, i, a) => a.indexOf(v) === i)
            };
          }
        }
        
        // If item doesn't have uoms array, ensure it has at least the current UOM
        if (!item.uoms || item.uoms.length === 0) {
          return {
            ...item,
            uoms: [item.uom || "EA"]
          };
        }
        
        return item;
      });
      
      setItems(normalizedItems);
    } else if (order.templateItems && order.templateItems.length > 0) {
      // If no items but templateItems exist, load template items
      setItems(order.templateItems);
    }
  }, []);

  // Save items back to order whenever items change
  useEffect(() => {
    setOrder((prev) => ({ ...prev, items: items }));
    setCanGoNext(items.length > 0);
  }, [items]);

  // Automatic pricing fetch when items are added/changed (AccuLynx behavior)
  useEffect(() => {
    const supplier = (order.supplier || "").toLowerCase();
    
    // Only auto-fetch for ABC supplier
    if (supplier !== "abc") return;
    
    // Only fetch if there are items
    if (!items || items.length === 0) return;
    
    // Check if any items need pricing
    const needsPricing = items.some(item => !item.pricingFetched && !item.pricingError);
    
    if (!needsPricing) return;
    
    // Debounce: wait 500ms after last change before fetching
    const timeoutId = setTimeout(() => {
      console.log("🔄 Auto-fetching pricing for ABC items (AccuLynx behavior)");
      getPricing();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [items, order.supplier]);

  // Simple function to search products
  const searchProducts = async (query) => {
    if (!order.supplier) {
      setSearchResults([]);
      setSearchError("Please select a supplier first");
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const supplierKey = (order.supplier || "").toUpperCase();
      const response = await runServerless({
        name: "supplierProducts",
        parameters: {
          supplier: supplierKey,
          q: query ? query.trim() : "", // Allow empty query for "all products"
          pageSize: 50,
        },
      });
      
      console.log("Search response:", response); // Debug log

      // Extract items from response - handle HubSpot's response wrapper
      let body;
      if (response?.response) {
        // HubSpot wraps: { response: { body: { statusCode, body: {...} } } }
        const responseBody = response.response;
        if (responseBody.body) {
          // Check if body has nested body structure
          if (responseBody.body.body) {
            body = responseBody.body.body;
          } else {
            // Direct body structure
            body = responseBody.body;
          }
        } else {
          body = responseBody;
        }
      } else if (response?.body) {
        body = response.body;
      } else {
        body = response || {};
      }

      console.log("Extracted body:", body); // Debug log
      const products = body.items || body.products || [];
      console.log("Products found:", products.length); // Debug log
      
      if (!body.success && body.error) {
        setSearchError(body.error);
        setSearchResults([]);
      } else {
        // Sort by priority: live results (priority 1) first, then cached (priority 0)
        const sortedProducts = products.sort((a, b) => {
          const priorityA = a._priority || 0;
          const priorityB = b._priority || 0;
          return priorityB - priorityA; // Higher priority first
        });
        
        // Remove internal metadata before displaying
        const cleanedProducts = sortedProducts.map(product => {
          const { _source, _priority, ...cleanProduct } = product;
          return cleanProduct;
        });
        
        console.log(`📊 Results: ${cleanedProducts.length} total (${products.filter(p => p._priority === 1).length} live, ${products.filter(p => p._priority === 0).length} cached)`);
        
        setSearchResults(cleanedProducts);
        setSearchCursor(body.nextCursor || null);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchError(error.message || "Search failed");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Simple function to load more results
  const loadMoreResults = async () => {
    if (!searchCursor || !order.supplier || !searchQuery) return;

    setIsSearching(true);
    try {
      const supplierKey = (order.supplier || "").toUpperCase();
      const response = await runServerless({
        name: "supplierProducts",
        parameters: {
          supplier: supplierKey,
          q: searchQuery.trim(),
          pageSize: 50,
          cursor: JSON.stringify(searchCursor),
        },
      });

      // Extract items from response - handle HubSpot's response wrapper
      let body;
      if (response?.response?.body) {
        const responseBody = response.response.body;
        if (responseBody.body) {
          body = responseBody.body;
        } else {
          body = responseBody;
        }
      } else if (response?.body) {
        body = response.body;
      } else {
        body = response || {};
      }

      const newProducts = body.items || body.products || [];

      // Sort by priority and clean metadata
      const sortedNewProducts = newProducts.sort((a, b) => {
        const priorityA = a._priority || 0;
        const priorityB = b._priority || 0;
        return priorityB - priorityA;
      });
      
      const cleanedNewProducts = sortedNewProducts.map(product => {
        const { _source, _priority, ...cleanProduct } = product;
        return cleanProduct;
      });

      // Simple: add new products to existing list
      setSearchResults((prev) => {
        // Re-sort combined list to maintain priority order
        const combined = [...prev, ...cleanedNewProducts];
        return combined;
      });
      setSearchCursor(body.nextCursor || null);
    } catch (error) {
      console.error("Load more error:", error);
      setSearchError(error.message || "Failed to load more");
    } finally {
      setIsSearching(false);
    }
  };

  // Simple function to get product title (check all possible name fields)
  const getProductTitle = (product) => {
    if (!product || typeof product !== "object") {
      return "Unnamed Product";
    }

    // Get supplier-specific priority fields based on config
    const supplier = (order.supplier || "").toUpperCase();
    let priorityFields = [];
    
    if (supplier === "ABC") {
      priorityFields = ["familyname", "itemdescription", "familyName", "itemDescription", "item_description"];
    } else if (supplier === "SRS") {
      // For SRS, prioritize productName and title fields, EXCLUDE description fields
      priorityFields = ["productName", "product_name", "title", "name", "familyName", "family_name", "baseProductName", "base_product_name"];
    } else if (supplier === "BEACON") {
      priorityFields = ["marketingdescription", "familyname", "itemdescription", "description", "marketingDescription", "familyName", "itemDescription", "marketing_description", "family_name", "item_description"];
    }

    // Check priority fields first (supplier-specific)
    for (let i = 0; i < priorityFields.length; i++) {
      const field = priorityFields[i];
      const value = product[field];
      // ✅ Only use string values, skip arrays/objects/JSON strings
      if (value && typeof value === "string" && value.trim() !== "" && 
          !Array.isArray(value) && typeof value !== "object" &&
          !value.trim().startsWith("[") && !value.trim().startsWith("{")) {
        return value.trim();
      }
    }

    // Check common fields (case-insensitive) - but exclude description for SRS
    const commonFields = ["title", "productName", "product_name", "familyName", "family_name", "baseProductName", "name"];
    
    // Only add description fields if NOT SRS
    if (supplier !== "SRS") {
      commonFields.push("description", "itemdescription", "item_description", "marketingDescription", "marketing_description", "productDescription", "product_description");
    }
    
    for (let i = 0; i < commonFields.length; i++) {
      const field = commonFields[i];
      const value = product[field];
      // ✅ Only use string values, skip arrays/objects/JSON strings
      if (value && typeof value === "string" && value.trim() !== "" && 
          !Array.isArray(value) && typeof value !== "object" &&
          !value.trim().startsWith("[") && !value.trim().startsWith("{")) {
        return value.trim();
      }
    }

    // Check all product keys dynamically (case-insensitive match)
    const productKeys = Object.keys(product);
    // For SRS, exclude description patterns; for others, include them
    const namePatterns = supplier === "SRS" 
      ? ["name", "title", "family"]  // Exclude "description" for SRS
      : ["name", "title", "description", "family"];
    
    for (let i = 0; i < productKeys.length; i++) {
      const key = productKeys[i];
      const lowerKey = key.toLowerCase();
      const value = product[key];
      
      // Check if key contains name/title/description patterns
      // ✅ Only use string values, skip arrays/objects/JSON strings
      if (value && typeof value === "string" && value.trim() !== "" && 
          !Array.isArray(value) && typeof value !== "object" &&
          !value.trim().startsWith("[") && !value.trim().startsWith("{")) {
        for (let j = 0; j < namePatterns.length; j++) {
          if (lowerKey.includes(namePatterns[j]) && !lowerKey.includes("sku") && !lowerKey.includes("id") && !lowerKey.includes("number")) {
            // For SRS, explicitly exclude description fields and option/variant fields
            if (supplier === "SRS") {
              if (lowerKey.includes("description")) {
                continue; // Skip description fields for SRS
              }
              // Skip variant/option fields that might contain arrays
              if (lowerKey.includes("variant") || lowerKey.includes("option") || lowerKey.includes("productoption")) {
                continue;
              }
            }
            return value.trim();
          }
        }
      }
    }

    // Last resort: return first non-empty string value that's not a SKU/ID
    for (let i = 0; i < productKeys.length; i++) {
      const key = productKeys[i];
      const lowerKey = key.toLowerCase();
      const value = product[key];
      
      // ✅ Only use string values, skip arrays/objects/JSON strings and variant/option fields
      if (value && typeof value === "string" && value.trim() !== "" && 
          !Array.isArray(value) && typeof value !== "object" &&
          !value.trim().startsWith("[") && !value.trim().startsWith("{") &&
          !lowerKey.includes("sku") && !lowerKey.includes("id") && 
          !lowerKey.includes("number") && !lowerKey.includes("price") &&
          !lowerKey.includes("supplier") && !lowerKey.includes("created") &&
          !lowerKey.includes("updated") && 
          !lowerKey.includes("variant") && !lowerKey.includes("option") &&
          value.trim().length > 3) {
        return value.trim();
      }
    }

    // Debug: log product keys if no name found
    console.warn("No product name found, available keys:", productKeys);
    return "Unnamed Product";
  };

  // Simple function to get product SKU
  const getProductSku = (product) => {
    const fields = ["sku", "itemNumber", "productId", "product_id"];
    for (let i = 0; i < fields.length; i++) {
      const value = product[fields[i]];
      if (value) {
        return String(value).trim();
      }
    }
    return "";
  };

  // Helper function to extract UOM from product data
  const getProductUom = (product) => {
    // Try direct UOM fields first
    const uomFields = ["uom", "unitOfMeasure", "unit_of_measure", "defaultUom", "defaultUOM"];
    for (let i = 0; i < uomFields.length; i++) {
      const value = product[uomFields[i]];
      if (value && typeof value === "string" && value.trim()) {
        return value.trim().toUpperCase();
      }
    }
    
    // Try to infer from product title (e.g., "3 BD/SQ" → "SQ" or "BD")
    const title = getProductTitle(product);
    if (title) {
      const titleUpper = title.toUpperCase();
      
      // Check for common roofing UOM patterns
      if (titleUpper.includes("/SQ") || titleUpper.includes("PER SQ") || titleUpper.includes("PER SQUARE")) {
        return "SQ";
      }
      if (titleUpper.includes("/BD") || titleUpper.includes("PER BD") || titleUpper.includes("PER BUNDLE") || titleUpper.includes("BUNDLE")) {
        return "BNDL";
      }
      if (titleUpper.includes("ROLL") || titleUpper.includes("/RL")) {
        return "RL";
      }
      if (titleUpper.includes("LINEAR") || titleUpper.includes("/LF")) {
        return "LF";
      }
      if (titleUpper.includes("BOX") || titleUpper.includes("/BX")) {
        return "BX";
      }
    }
    
    // Default to EA
    return "EA";
  };

  // Helper function to get available UOMs from product data
  const getProductUoms = (product) => {
    // Try to get available UOMs array
    const uomsFields = ["uoms", "availableUoms", "availableUOMs", "unitOfMeasures", "unitsOfMeasure"];
    for (let i = 0; i < uomsFields.length; i++) {
      const value = product[uomsFields[i]];
      if (Array.isArray(value) && value.length > 0) {
        return value.map(u => String(u).toUpperCase().trim()).filter(Boolean);
      }
    }
    
    // If no array found, use the default UOM
    const defaultUom = getProductUom(product);
    return [defaultUom, "EA"].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
  };

  // Simple function to add product to items
  const addProduct = (product) => {
    const title = getProductTitle(product);
    const sku = getProductSku(product);
    
    if (!sku) {
      console.error("Cannot add product: no SKU found");
      return;
    }

    // Simple: check if item already exists (by SKU)
    let foundIndex = -1;
    for (let i = 0; i < items.length; i++) {
      if (String(items[i].sku).toLowerCase() === String(sku).toLowerCase()) {
        foundIndex = i;
        break;
      }
    }

    // Extract UOM information from product
    const defaultUom = getProductUom(product);
    const availableUoms = getProductUoms(product);
    
    console.log(`📦 Adding product ${sku}: defaultUom=${defaultUom}, availableUoms=`, availableUoms);

    const newItem = {
      qty: 1,
      uom: defaultUom,
      sku: sku,
      title: title,
      unitPrice: 0,
      linePrice: 0,
      uoms: availableUoms.length > 0 ? availableUoms : ["EA"],
      pricingFetched: false,
      pricingError: null,
    };

    if (foundIndex >= 0) {
      // Item exists - just increase quantity
      const updatedItems = [...items];
      updatedItems[foundIndex] = {
        ...updatedItems[foundIndex],
        qty: (Number(updatedItems[foundIndex].qty) || 0) + 1,
      };
      setItems(updatedItems);
    } else {
      // New item - add to list
      setItems([...items, newItem]);
    }
  };

  // Simple function to update item quantity
  const updateQuantity = (index, newQty) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      qty: newQty,
      linePrice: (Number(newQty) || 0) * (Number(updatedItems[index].unitPrice) || 0),
    };
    setItems(updatedItems);
  };

  // Simple function to update item UOM
  const updateUom = (index, newUom) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      uom: newUom,
    };
    setItems(updatedItems);
  };

  // Simple function to remove item
  const removeItem = (index) => {
    const updatedItems = [];
    for (let i = 0; i < items.length; i++) {
      if (i !== index) {
        updatedItems.push(items[i]);
      }
    }
    setItems(updatedItems);
  };

  // Simple function to add manual line item
  const addManualItem = () => {
    if (!draftItem.sku || Number(draftItem.qty) <= 0) {
      return;
    }

    const newItem = {
      qty: Number(draftItem.qty) || 1,
      uom: draftItem.uom || "EA",
      sku: draftItem.sku.trim(),
      title: draftItem.title.trim() || "Custom Item",
      unitPrice: Number(draftItem.unitPrice) || 0,
      linePrice: (Number(draftItem.qty) || 1) * (Number(draftItem.unitPrice) || 0),
      uoms: ["EA"],
      pricingFetched: false,
      pricingError: null,
    };

    // Check if SKU already exists
    let foundIndex = -1;
    for (let i = 0; i < items.length; i++) {
      if (String(items[i].sku).toLowerCase() === String(newItem.sku).toLowerCase()) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex >= 0) {
      // Merge quantities
      const updatedItems = [...items];
      updatedItems[foundIndex] = {
        ...updatedItems[foundIndex],
        qty: (Number(updatedItems[foundIndex].qty) || 0) + newItem.qty,
        unitPrice: newItem.unitPrice > 0 ? newItem.unitPrice : updatedItems[foundIndex].unitPrice,
        title: newItem.title || updatedItems[foundIndex].title,
      };
      updatedItems[foundIndex].linePrice = updatedItems[foundIndex].qty * updatedItems[foundIndex].unitPrice;
      setItems(updatedItems);
    } else {
      setItems([...items, newItem]);
    }

    // Clear draft
    setDraftItem({ qty: "", uom: "EA", sku: "", title: "", unitPrice: "" });
  };

  // Simple function to calculate total
  const calculateTotal = () => {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const qty = Number(item.qty) || 0;
      const price = Number(item.unitPrice) || 0;
      total = total + qty * price;
    }
    return total;
  };

  // Helper function to extract nested value from response (handles HubSpot wrapping)
  // Helper function to normalize SKU for accurate matching
  const normalizeSku = (sku) => {
    if (!sku) return "";
    return String(sku).trim().toUpperCase();
  };

  // Helper function to check if two SKUs match exactly
  const skuMatches = (sku1, sku2) => {
    if (!sku1 || !sku2) return false;
    return normalizeSku(sku1) === normalizeSku(sku2);
  };

  const extractNestedValue = (response, dataPath) => {
    if (!response) return undefined;
    
    // Try multiple response paths to handle different HubSpot wrapping patterns
    const paths = [
      `response.body.${dataPath}`,
      `response.${dataPath}`,
      `response.response.body.${dataPath}`,
      `response.response.${dataPath}`,
      `body.${dataPath}`,
      dataPath
    ];
    
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const parts = path.split('.');
      let value = response;
      let found = true;
      
      for (let j = 0; j < parts.length; j++) {
        if (value && typeof value === 'object' && parts[j] in value) {
          value = value[parts[j]];
        } else {
          found = false;
          break;
        }
      }
      
      if (found && value !== undefined && value !== null) {
        return value;
      }
    }
    
    return undefined;
  };

  // Helper function to extract price from item (tries multiple field names)
  const extractPrice = (item) => {
    if (!item || typeof item !== 'object') return null;
    
    const priceFields = [
      'unitPrice',
      'price',
      'unit_price',
      'unitPriceValue',
      'pricePerUnit',
      'listPrice',
      'salePrice'
    ];
    
    for (let i = 0; i < priceFields.length; i++) {
      const field = priceFields[i];
      const value = item[field];
      if (value !== undefined && value !== null) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0) {
          return numValue;
        }
      }
    }
    
    return null;
  };

  // Helper function to get ABC access token
  const getABCAccessToken = async (environment = null) => {
    try {
      // WORKAROUND: HubSpot runServerless seems to filter empty strings, so always pass a value
      // If environment is null/empty, pass "sandbox" as default, otherwise pass the actual value
      const envValue = environment && environment.trim() ? String(environment).trim() : "sandbox";
      // Try using both 'environment' and 'env' parameter names in case one is filtered
      const params = {
        environment: envValue,
        env: envValue, // Backup parameter name
        abcEnvironment: envValue // Another backup
      };
      console.log("🔍 getABCAccessToken - Input environment:", environment, "Passing envValue:", envValue, "Full params:", JSON.stringify(params));
      const response = await runServerless({
        name: "abcLogin",
        parameters: params
      });
      
      // Debug: Log full response structure
      console.log("🔍 ABC Login Response (full):", JSON.stringify(response, null, 2));
      
      // Check for error response first (HubSpot wraps as response.response.body)
      const error = extractNestedValue(response, 'response.body.error') ||
                    extractNestedValue(response, 'body.error') ||
                    extractNestedValue(response, 'error');
      
      const success = extractNestedValue(response, 'response.body.success') ||
                      extractNestedValue(response, 'body.success') ||
                      extractNestedValue(response, 'success');
      
      if (error || success === false) {
        logContractFailure({
          contractId: "C-003",
          message: "ABC Supply authentication failed in pricing table",
          expected: { success: true, access_token: "string" },
          actual: {
            error: error || "Unknown error",
            response: response?.response?.body || response?.body,
          },
          system: "ABC Supply",
          integration: "ABCAdapter",
          operation: "AUTHENTICATE",
          trace: ["PricingTable", "authenticateABC"],
          nextCheck: "Check ABC credentials and authentication serverless function",
        });
        return null;
      }
      
      // Try multiple paths to extract token (HubSpot wraps responses differently)
      const token = extractNestedValue(response, 'response.body.access_token') ||
                    extractNestedValue(response, 'response.body.data.access_token') ||
                    extractNestedValue(response, 'body.access_token') ||
                    extractNestedValue(response, 'body.data.access_token') ||
                    extractNestedValue(response, 'data.access_token') || 
                    extractNestedValue(response, 'access_token');
      
      if (!token) {
        logContractFailure({
          contractId: "C-006",
          message: "Failed to extract ABC access token from authentication response",
          expected: { access_token: "string" },
          actual: {
            responseStructure: Object.keys(response || {}),
            body: response?.body,
            responseBody: response?.response?.body,
          },
          system: "ABC Supply",
          integration: "ABCAdapter",
          operation: "AUTHENTICATE",
          trace: ["PricingTable", "authenticateABC", "extractToken"],
          nextCheck: "Check authentication response structure and token extraction logic",
        });
        return null;
      }
      
      console.log("✅ ABC access token obtained");
      // ✅ Debug: Log token info (without exposing full token)
      console.log("Token length:", token ? String(token).length : 0);
      console.log("Token preview:", token ? String(token).substring(0, 20) + "..." : "none");
      return token;
    } catch (error) {
      logContractFailure({
        contractId: "C-003",
        message: "Exception during ABC authentication",
        expected: { success: true, token: "string" },
        actual: {
          message: error.message,
          stack: error.stack,
        },
        system: "ABC Supply",
        integration: "ABCAdapter",
        operation: "AUTHENTICATE",
        trace: ["PricingTable", "authenticateABC"],
        nextCheck: "Check network connectivity and ABC authentication endpoint",
      });
      return null;
    }
  };

  // Helper function to get SRS access token
  const getSRSAccessToken = async () => {
    try {
      const response = await runServerless({
        name: "srsLogin",
        parameters: {}
      });
      
      // Debug: Log full response structure
      console.log("🔍 SRS Login Response (full):", JSON.stringify(response, null, 2));
      
      // Check for error response first
      const error = extractNestedValue(response, 'response.body.error') ||
                    extractNestedValue(response, 'body.error') ||
                    extractNestedValue(response, 'error');
      
      const success = extractNestedValue(response, 'response.body.success') ||
                      extractNestedValue(response, 'body.success');
      
      if (error || success === false) {
        logContractFailure({
          contractId: "C-003",
          message: "SRS Distribution authentication failed in pricing table",
          expected: { success: true, access_token: "string" },
          actual: {
            error: error || "Unknown error",
            response: response?.response?.body || response?.body,
          },
          system: "SRS Distribution",
          integration: "SRSAdapter",
          operation: "AUTHENTICATE",
          trace: ["PricingTable", "authenticateSRS"],
          nextCheck: "Check SRS credentials and authentication serverless function",
        });
        return null;
      }
      
      // Try multiple paths to extract token (HubSpot wraps responses differently)
      const token = extractNestedValue(response, 'response.body.access_token') ||
                    extractNestedValue(response, 'response.body.data.access_token') ||
                    extractNestedValue(response, 'body.access_token') ||
                    extractNestedValue(response, 'body.data.access_token') ||
                    extractNestedValue(response, 'data.access_token') || 
                    extractNestedValue(response, 'access_token');
      
      if (!token) {
        logContractFailure({
          contractId: "C-006",
          message: "Failed to extract SRS access token from authentication response",
          expected: { access_token: "string" },
          actual: {
            responseStructure: Object.keys(response || {}),
            responseBody: response?.response?.body,
          },
          system: "SRS Distribution",
          integration: "SRSAdapter",
          operation: "AUTHENTICATE",
          trace: ["PricingTable", "authenticateSRS", "extractToken"],
          nextCheck: "Check authentication response structure and token extraction logic",
        });
        return null;
      }
      
      console.log("✅ SRS access token obtained");
      return token;
    } catch (error) {
      logContractFailure({
        contractId: "C-003",
        message: "Exception during SRS authentication",
        expected: { success: true, token: "string" },
        actual: {
          message: error.message,
          stack: error.stack,
        },
        system: "SRS Distribution",
        integration: "SRSAdapter",
        operation: "AUTHENTICATE",
        trace: ["PricingTable", "authenticateSRS"],
        nextCheck: "Check network connectivity and SRS authentication endpoint",
      });
      return null;
    }
  };

  // Helper function to get Beacon cookies
  const getBeaconCookies = async () => {
    try {
      const response = await runServerless({
        name: "beaconLogin",
        parameters: {}
      });
      
      // Debug: Log full response structure
      console.log("🔍 Beacon Login Response (full):", JSON.stringify(response, null, 2));
      
      // Check for error response first
      const error = extractNestedValue(response, 'response.body.error') ||
                    extractNestedValue(response, 'body.error') ||
                    extractNestedValue(response, 'error');
      
      const success = extractNestedValue(response, 'response.body.success') ||
                      extractNestedValue(response, 'body.success');
      
      if (error || success === false) {
        logContractFailure({
          contractId: "C-003",
          message: "Beacon Building Products authentication failed in pricing table",
          expected: { success: true, cookies: "string" },
          actual: {
            error: error || "Unknown error",
            response: response?.response?.body || response?.body,
          },
          system: "Beacon Building Products",
          integration: "BeaconAdapter",
          operation: "AUTHENTICATE",
          trace: ["PricingTable", "authenticateBeacon"],
          nextCheck: "Check Beacon credentials and authentication serverless function",
        });
        return null;
      }
      
      // Try multiple paths to extract cookies (HubSpot wraps responses differently)
      const cookies = extractNestedValue(response, 'response.body.cookies') ||
                      extractNestedValue(response, 'response.body.data.cookies') ||
                      extractNestedValue(response, 'body.cookies') ||
                      extractNestedValue(response, 'body.data.cookies') ||
                      extractNestedValue(response, 'data.cookies') || 
                      extractNestedValue(response, 'cookies');
      
      if (!cookies) {
        logContractFailure({
          contractId: "C-006",
          message: "Failed to extract Beacon cookies from authentication response",
          expected: { cookies: "string" },
          actual: {
            responseStructure: Object.keys(response || {}),
            responseBody: response?.response?.body,
          },
          system: "Beacon Building Products",
          integration: "BeaconAdapter",
          operation: "AUTHENTICATE",
          trace: ["PricingTable", "authenticateBeacon", "extractCookies"],
          nextCheck: "Check authentication response structure and cookie extraction logic",
        });
        return null;
      }
      
      console.log("✅ Beacon cookies obtained");
      return cookies;
    } catch (error) {
      logContractFailure({
        contractId: "C-003",
        message: "Exception during Beacon authentication",
        expected: { success: true, cookies: "string" },
        actual: {
          message: error.message,
          stack: error.stack,
        },
        system: "Beacon Building Products",
        integration: "BeaconAdapter",
        operation: "AUTHENTICATE",
        trace: ["PricingTable", "authenticateBeacon"],
        nextCheck: "Check network connectivity and Beacon authentication endpoint",
      });
      return null;
    }
  };

  // Simple function to get pricing
  const getPricing = async () => {
    const supplier = (order.supplier || "").toLowerCase();
    if (!supplier) return;

    let response;
    try {
      if (supplier === "abc") {
        // ✅ TESTING: Use production environment for pricing test
        const TEST_PRODUCTION = true; // Set to true to test production
        const authEnvironment = TEST_PRODUCTION ? "prod" : null;
        console.log("🔍 TEST_PRODUCTION:", TEST_PRODUCTION, "authEnvironment:", authEnvironment);
        
        // WORKAROUND: Get token with environment, but also pass it via fullOrder
        const abcAccessToken = await getABCAccessToken(authEnvironment);
        
        // Transform order structure: pricing functions expect fullOrder.fullOrderItems
        // WORKAROUND: Embed environment in fullOrder since HubSpot parameter passing doesn't work
        const fullOrder = {
          ...order,
          fullOrderItems: order.items || [],
          _environment: TEST_PRODUCTION ? "prod" : "sandbox" // Embed environment in order object
        };
        if (!abcAccessToken) {
          console.error("❌ Cannot get pricing: ABC authentication failed");
          // Mark all items with authentication error
          const updatedItems = items.map(item => ({
            ...item,
            pricingError: "Authentication failed - please try again",
          }));
          setItems(updatedItems);
          return;
        }
        
        // WORKAROUND: HubSpot runServerless seems to filter empty strings, so always pass a value
        // If authEnvironment is null/empty, pass "sandbox" as default, otherwise pass the actual value
        const envValue = authEnvironment && authEnvironment.trim() ? String(authEnvironment).trim() : "sandbox";
        // Try using both 'environment' and 'env' parameter names in case one is filtered
        const pricingParams = {
          fullOrder: fullOrder,
          abcAccessToken: abcAccessToken,
          environment: envValue, // Pass prod environment to pricing function
          env: envValue, // Backup parameter name
          abcEnvironment: envValue // Another backup
        };
        console.log("🔍 Calling abcPricing - Input authEnvironment:", authEnvironment, "Passing envValue:", envValue, "Full params:", JSON.stringify(pricingParams));
        response = await runServerless({
          name: "abcPricing",
          parameters: pricingParams
        });
        updatePricesFromABC(response);
      } else if (supplier === "srs") {
        // ✅ Authenticate first
        const srsToken = await getSRSAccessToken();
        if (!srsToken) {
          console.error("❌ Cannot get pricing: SRS authentication failed");
          // Mark all items with authentication error
          const updatedItems = items.map(item => ({
            ...item,
            pricingError: "Authentication failed - please try again",
          }));
          setItems(updatedItems);
          return;
        }
        
        response = await runServerless({
          name: "srsPricing",
          parameters: { 
            fullOrder: fullOrder,
            token: srsToken
          },
        });
        updatePricesFromSRS(response);
      } else if (supplier === "beacon") {
        // ✅ Authenticate first
        const beaconCookies = await getBeaconCookies();
        if (!beaconCookies) {
          console.error("❌ Cannot get pricing: Beacon authentication failed");
          // Mark all items with authentication error
          const updatedItems = items.map(item => ({
            ...item,
            pricingError: "Authentication failed - please try again",
          }));
          setItems(updatedItems);
          return;
        }
        
        response = await runServerless({
          name: "beaconPricing",
          parameters: { 
            fullOrder: fullOrder,
            cookies: beaconCookies
          },
        });
        updatePricesFromBeacon(response);
      }
    } catch (error) {
      logContractFailure({
        contractId: "C-005",
        message: "Pricing fetch failed for supplier",
        expected: { success: true, pricing: "object" },
        actual: {
          message: error?.message || String(error) || "Unknown error",
          supplier: order.supplier,
        },
        system: order.supplier,
        operation: "GET_PRICING",
        trace: ["PricingTable", "getPricing"],
        nextCheck: "Check supplier authentication and pricing API availability",
      });
      // Mark all items with error
      const updatedItems = items.map(item => ({
        ...item,
        pricingError: error.message || "Pricing request failed",
      }));
      setItems(updatedItems);
    }
  };

  // Simple function to update prices from ABC response
  const updatePricesFromABC = (response) => {
    // Debug: Log full response structure
    console.log("🔍 ABC Pricing Response (full):", JSON.stringify(response, null, 2));
    
    // Try multiple response paths to extract price data
    const priceData = extractNestedValue(response, 'response.body.data.lines') ||
                      extractNestedValue(response, 'response.data.lines') ||
                      extractNestedValue(response, 'data.lines') || 
                      extractNestedValue(response, 'body.data.lines') ||
                      extractNestedValue(response, 'lines') || 
                      [];
    
    console.log("📊 Extracted priceData:", priceData);
    console.log("📊 PriceData length:", priceData.length);
    console.log("📊 Requested items count:", items.length);
    
    // Validate response structure
    if (!Array.isArray(priceData)) {
      console.error("❌ ABC response priceData is not an array:", typeof priceData);
      const updatedItems = items.map(item => ({
        ...item,
        pricingError: "Invalid response structure",
      }));
      setItems(updatedItems);
      return;
    }
    
    if (priceData.length > 0) {
      console.log("📊 First price item structure:", JSON.stringify(priceData[0], null, 2));
      console.log("📊 First price item keys:", Object.keys(priceData[0] || {}));
    }

    // Create a map for O(1) lookup by normalized SKU (like Beacon does)
    const priceMap = new Map();
    for (let j = 0; j < priceData.length; j++) {
      const priceItem = priceData[j];
      const sku = normalizeSku(priceItem.itemNumber || priceItem.sku || "");
      if (sku) {
        // Store with original item for reference, but key by normalized SKU
        if (!priceMap.has(sku)) {
          priceMap.set(sku, []);
        }
        priceMap.get(sku).push(priceItem);
      }
    }
    
    console.log("📊 Created priceMap with", priceMap.size, "unique SKUs");

    const updatedItems = [];
    const matchedSkus = new Set();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const normalizedItemSku = normalizeSku(item.sku);
      let found = false;

      // Use direct lookup (like Beacon) instead of array iteration
      const matchingPriceItems = priceMap.get(normalizedItemSku) || [];
      
      if (matchingPriceItems.length > 0) {
        // If multiple matches, prefer exact ID match, otherwise use first
        let priceItem = matchingPriceItems[0];
        
        // If we have an item.id, try to find exact ID match
        if (item.id && matchingPriceItems.length > 1) {
          const idMatch = matchingPriceItems.find(p => 
            p.id === item.id || String(p.id) === String(item.id)
          );
          if (idMatch) {
            priceItem = idMatch;
          }
        }
        
        found = true;
        matchedSkus.add(normalizedItemSku);
        console.log(`✅ Found match for SKU ${item.sku} (normalized: ${normalizedItemSku}):`, JSON.stringify(priceItem, null, 2));
          
        // Check for error status
        if (priceItem.status && priceItem.status.code === "Error") {
          console.log(`❌ Error status for SKU ${item.sku}:`, priceItem.status.message);
          updatedItems.push({
            ...item,
            pricingError: priceItem.status.message,
          });
        } else {
          // Try to extract price using multiple field names
          const extractedPrice = extractPrice(priceItem);
          
          if (extractedPrice !== null && extractedPrice > 0) {
            // ✅ Validate UOM match
            const responseUom = (priceItem.uom || priceItem.unitOfMeasure || priceItem.unit_of_measure || "").toUpperCase().trim();
            const requestedUom = (item.uom || "").toUpperCase().trim();
            const uomMatches = !responseUom || responseUom === requestedUom;
            
            if (!uomMatches) {
              console.warn(`⚠️ UOM mismatch for SKU ${item.sku}: requested "${requestedUom}", got "${responseUom}"`);
              // Still use the price, but log the mismatch - supplier may have corrected the UOM
            }
            
            const finalUom = responseUom || requestedUom;
            
            // ✅ Validate quantity matches (for quantity-based pricing)
            const responseQty = priceItem.quantity || priceItem.qty;
            const requestedQty = Number(item.qty) || 1;
            if (responseQty && Number(responseQty) !== requestedQty) {
              console.warn(`⚠️ Quantity mismatch for SKU ${item.sku}: requested ${requestedQty}, priced for ${responseQty}`);
            }
            
            console.log(`💰 Price found for SKU ${item.sku} (UOM ${finalUom}, Qty ${requestedQty}): $${extractedPrice}`);
            
            // Update available UOMs if response provides them
            let availableUoms = item.uoms || ["EA"];
            if (priceItem.availableUoms && Array.isArray(priceItem.availableUoms)) {
              availableUoms = priceItem.availableUoms.map(u => String(u).toUpperCase().trim());
            } else if (responseUom && !availableUoms.includes(finalUom)) {
              availableUoms = [...availableUoms, finalUom];
            }
            
            updatedItems.push({
              ...item,
              unitPrice: extractedPrice,
              uom: finalUom, // Use UOM from response if available
              uoms: availableUoms,
              linePrice: requestedQty * extractedPrice,
              pricingError: null,
              pricingFetched: true,
            });
          } else {
            console.log(`⚠️ No valid price found for SKU ${item.sku}, priceItem:`, JSON.stringify(priceItem, null, 2));
            updatedItems.push({
              ...item,
              pricingError: "Price unavailable",
            });
          }
        }
      }

      if (!found) {
        console.log(`❌ SKU ${item.sku} (normalized: ${normalizedItemSku}) not found in priceData`);
        updatedItems.push({
          ...item,
          pricingError: "SKU not found",
        });
      }
    }

    // Validation: Check if all requested SKUs were matched
    const unmatchedCount = items.length - matchedSkus.size;
    if (unmatchedCount > 0) {
      console.warn(`⚠️ ${unmatchedCount} requested SKU(s) were not found in ABC response`);
    }
    
    console.log("✅ Updated items:", updatedItems.length, `(${matchedSkus.size} matched, ${unmatchedCount} unmatched)`);
    setItems(updatedItems);
  };

  // Simple function to update prices from SRS response
  const updatePricesFromSRS = (response) => {
    console.log("🔍 SRS Pricing Response (full):", JSON.stringify(response, null, 2));
    
    // Try multiple response paths to extract price data
    const priceData = extractNestedValue(response, 'response.body.data.productList') ||
                      extractNestedValue(response, 'response.data.productList') ||
                      extractNestedValue(response, 'data.productList') || 
                      extractNestedValue(response, 'body.data.productList') ||
                      extractNestedValue(response, 'productList') || 
                      [];
    
    console.log("📊 Extracted priceData:", priceData);
    console.log("📊 PriceData length:", priceData.length);
    console.log("📊 Requested items count:", items.length);
    
    // Validate response structure
    if (!Array.isArray(priceData)) {
      console.error("❌ SRS response priceData is not an array:", typeof priceData);
      const updatedItems = items.map(item => ({
        ...item,
        pricingError: "Invalid response structure",
      }));
      setItems(updatedItems);
      return;
    }
    
    if (!priceData.length) {
      // Mark all as needing pricing
      const updatedItems = items.map(item => ({
        ...item,
        pricingError: "SKU not found - call for pricing",
      }));
      setItems(updatedItems);
      return;
    }

    // Create a map for O(1) lookup by normalized SKU (like Beacon does)
    // SRS can have itemCode or productId, so we need to index by both
    const priceMap = new Map();
    for (let j = 0; j < priceData.length; j++) {
      const priceItem = priceData[j];
      // Prioritize itemCode (which comes from sku), then productId
      const primarySku = normalizeSku(priceItem.itemCode || priceItem.sku || "");
      const secondarySku = priceItem.productId ? normalizeSku(String(priceItem.productId)) : null;
      
      if (primarySku) {
        if (!priceMap.has(primarySku)) {
          priceMap.set(primarySku, []);
        }
        priceMap.get(primarySku).push(priceItem);
      }
      
      // Also index by productId if it's different from itemCode
      if (secondarySku && secondarySku !== primarySku) {
        if (!priceMap.has(secondarySku)) {
          priceMap.set(secondarySku, []);
        }
        priceMap.get(secondarySku).push(priceItem);
      }
    }
    
    console.log("📊 Created priceMap with", priceMap.size, "unique SKUs");

    const updatedItems = [];
    const matchedSkus = new Set();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const normalizedItemSku = normalizeSku(item.sku);
      let found = false;

      // Use direct lookup (like Beacon) instead of array iteration
      const matchingPriceItems = priceMap.get(normalizedItemSku) || [];
      
      if (matchingPriceItems.length > 0) {
        // Use first match (SRS typically returns one item per SKU)
        const priceItem = matchingPriceItems[0];
        found = true;
        matchedSkus.add(normalizedItemSku);
        console.log(`✅ Found match for SKU ${item.sku} (normalized: ${normalizedItemSku}):`, JSON.stringify(priceItem, null, 2));
          
          if (priceItem.error || (priceItem.unitPrice === 0 && priceItem.message)) {
            updatedItems.push({
              ...item,
              pricingError: priceItem.message || "SKU not found - call for pricing",
            });
          } else {
            const extractedPrice = extractPrice(priceItem);
            
            if (extractedPrice !== null && extractedPrice > 0) {
              // ✅ Validate UOM match
              const responseUom = (priceItem.uom || priceItem.unitOfMeasure || "").toUpperCase().trim();
              const requestedUom = (item.uom || "").toUpperCase().trim();
              const uomMatches = !responseUom || responseUom === requestedUom;
              
              if (!uomMatches) {
                console.warn(`⚠️ UOM mismatch for SKU ${item.sku}: requested "${requestedUom}", got "${responseUom}"`);
              }
              
              const finalUom = responseUom || requestedUom;
              
              // ✅ Validate quantity
              const responseQty = priceItem.quantity || priceItem.qty;
              const requestedQty = Number(item.qty) || 1;
              if (responseQty && Number(responseQty) !== requestedQty) {
                console.warn(`⚠️ Quantity mismatch for SKU ${item.sku}: requested ${requestedQty}, priced for ${responseQty}`);
              }
              
              console.log(`💰 Price found for SKU ${item.sku} (UOM ${finalUom}, Qty ${requestedQty}): $${extractedPrice}`);
              
              updatedItems.push({
                ...item,
                unitPrice: extractedPrice,
                uom: finalUom,
                linePrice: requestedQty * extractedPrice,
                pricingError: null,
                pricingFetched: true,
              });
            } else {
              console.log(`⚠️ No valid price found for SKU ${item.sku}, priceItem:`, JSON.stringify(priceItem, null, 2));
              updatedItems.push({
                ...item,
                pricingError: "Price unavailable",
              });
            }
          }
        }
      }

      if (!found) {
        console.log(`❌ SKU ${item.sku} (normalized: ${normalizedItemSku}) not found in priceData`);
        updatedItems.push({
          ...item,
          pricingError: "SKU not found - call for pricing",
        });
      }
    }

    // Validation: Check if all requested SKUs were matched
    const unmatchedCount = items.length - matchedSkus.size;
    if (unmatchedCount > 0) {
      console.warn(`⚠️ ${unmatchedCount} requested SKU(s) were not found in SRS response`);
    }
    
    console.log("✅ Updated items:", updatedItems.length, `(${matchedSkus.size} matched, ${unmatchedCount} unmatched)`);
    setItems(updatedItems);
  };

  // Simple function to update prices from Beacon response
  const updatePricesFromBeacon = (response) => {
    console.log("🔍 Beacon Pricing Response (full):", JSON.stringify(response, null, 2));
    
    // Try multiple response paths to extract priceInfo (HubSpot wraps responses)
    const priceInfo = extractNestedValue(response, 'response.data.priceInfo') ||
                      extractNestedValue(response, 'data.priceInfo') ||
                      extractNestedValue(response, 'body.data.priceInfo') ||
                      extractNestedValue(response, 'priceInfo') ||
                      {};
    
    console.log("📊 Beacon priceInfo:", priceInfo);
    
    const updatedItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const baseSku = item.sku.split(" - ")[0].trim();
      
      // Try exact match, then base SKU
      let itemPriceInfo = priceInfo[item.sku] || priceInfo[baseSku];

      if (itemPriceInfo) {
        console.log(`✅ Found priceInfo for SKU ${item.sku}:`, itemPriceInfo);
        
        // Get all available UOMs from priceInfo (keys are UOM codes)
        const availableUoms = Object.keys(itemPriceInfo).filter(uom => {
          const price = itemPriceInfo[uom];
          return price !== undefined && price !== null && price !== "";
        });
        
        console.log(`📊 Available UOMs for SKU ${item.sku}:`, availableUoms);
        
        // Try exact UOM, then first available
        let unitPrice = itemPriceInfo[item.uom];
        let matchedUom = item.uom;

        if (!unitPrice || unitPrice === 0) {
          if (availableUoms.length > 0) {
            matchedUom = availableUoms[0];
            unitPrice = itemPriceInfo[matchedUom];
            console.log(`⚠️ UOM "${item.uom}" not found or price is 0, using "${matchedUom}" instead`);
          }
        }

        if (unitPrice && unitPrice > 0) {
          // ✅ Validate UOM match
          const requestedUom = (item.uom || "").toUpperCase().trim();
          if (matchedUom !== requestedUom) {
            console.warn(`⚠️ UOM mismatch for SKU ${item.sku}: requested "${requestedUom}", using "${matchedUom}" from supplier`);
          }
          
          // ✅ Validate quantity (Beacon may return quantity-specific pricing)
          const requestedQty = Number(item.qty) || 1;
          
          console.log(`💰 Price found for SKU ${item.sku} (UOM ${matchedUom}, Qty ${requestedQty}): $${unitPrice}`);
          updatedItems.push({
            ...item,
            unitPrice: unitPrice,
            uom: matchedUom,
            // Update available UOMs with what's actually available from pricing
            uoms: availableUoms.length > 0 ? availableUoms : item.uoms || ["EA"],
            linePrice: requestedQty * unitPrice,
            pricingError: null,
            pricingFetched: true,
          });
        } else {
          console.log(`⚠️ No valid price found for SKU ${item.sku}`);
          updatedItems.push({
            ...item,
            pricingError: "Price unavailable",
          });
        }
      } else {
        console.log(`❌ No priceInfo found for SKU ${item.sku} (tried ${item.sku} and ${baseSku})`);
        updatedItems.push({
          ...item,
          pricingError: "SKU not found - call for pricing",
        });
      }
    }

    console.log("✅ Updated items:", updatedItems.length);
    setItems(updatedItems);
  };

  // Search when query changes (with delay)
  useEffect(() => {
    if (!searchQuery || !order.supplier) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, order.supplier]);

  const totalPrice = calculateTotal();

  return (
    <>
      <Text>Price Table</Text>
      <Text></Text>
      <Table bordered={true} paginated={false}>
        <TableHead>
          <TableRow>
            <TableHeader width="min">Quantity</TableHeader>
            <TableHeader width="min">U/M</TableHeader>
            <TableHeader width="min">SKU</TableHeader>
            <TableHeader width="min">Title</TableHeader>
            <TableHeader width="min">Variant</TableHeader>
            <TableHeader width="min">Unit Price</TableHeader>
            <TableHeader width="min">Line Price</TableHeader>
            <TableHeader width="min">Status</TableHeader>
            <TableHeader width="min">Delete</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((line, idx) => (
            <TableRow key={idx}>
              <TableCell width="min">
                <StepperInput
                  min={1}
                  max={999}
                  label=""
                  name="itemField"
                  value={line.qty}
                  stepSize={1}
                  onChange={(value) => {
                    updateQuantity(idx, value);
                  }}
                />
              </TableCell>
              <TableCell width="min">
                <Select
                  value={line.uom}
                  options={(() => {
                    // Always show all available units from helper for maximum flexibility
                    const allUnits = Object.keys(units).map((code) => ({
                      label: units[code]?.label || code,
                      value: code,
                      tooltip: units[code]?.toolTip || code,
                    }));
                    
                    // Optionally prioritize product-specific UOMs by moving them to the top
                    const productUoms = line.uoms || [];
                    if (productUoms.length > 0) {
                      const productUnits = [];
                      const otherUnits = [];
                      
                      allUnits.forEach(unit => {
                        if (productUoms.includes(unit.value)) {
                          productUnits.push(unit);
                        } else {
                          otherUnits.push(unit);
                        }
                      });
                      
                      // Return product-specific units first, then others
                      return [...productUnits, ...otherUnits];
                    }
                    
                    return allUnits;
                  })()}
                  onChange={(newUom) => {
                    updateUom(idx, newUom);
                  }}
                />
              </TableCell>
              <TableCell width="min">
                <Text variant="microcopy">{line.sku}</Text>
              </TableCell>
              <TableCell width="min">
                <Text variant="microcopy">{line.title}</Text>
              </TableCell>
              <TableCell width="min">
                <Text variant="microcopy">{line.variant || "-"}</Text>
              </TableCell>
              <TableCell width="min">
                <Text variant="microcopy">
                  ${moneyFormatter("unitPrice", line.unitPrice)}/{line.qty}
                </Text>
              </TableCell>
              <TableCell width="min">
                <Text variant="microcopy">
                  ${moneyFormatter("linePrice", line.unitPrice, line.qty)}
                </Text>
              </TableCell>
              <TableCell width="min">
                {line.pricingError ? (
                  <StatusTag variant="danger">Call</StatusTag>
                ) : line.pricingFetched ? (
                  <StatusTag variant="success">Priced</StatusTag>
                ) : (
                  <StatusTag variant="default">Not yet priced</StatusTag>
                )}
              </TableCell>
              <TableCell width="min">
                <Button onClick={() => removeItem(idx)}>X</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Text></Text>
      <Divider />
      <Text></Text>
      <Flex direction={"row"} gap={"small"}>
        <Button variant="secondary" onClick={getPricing}>
          {`Get ${toSentenceCase(order.supplier || "")} Pricing`}
        </Button>
        <Flex justify="end" gap="xs">
          <Heading>Price: </Heading>
          <Heading>${totalPrice.toFixed(2)}</Heading>
        </Flex>
      </Flex>
      <Text></Text>
      <Text>Add Custom Line Item</Text>
      <Flex direction={"row"} gap={"small"}>
        <Input
          label="Quantity:"
          value={draftItem.qty}
          onChange={(value) => setDraftItem((prev) => ({ ...prev, qty: value }))}
        />
        <Select
          label="U/M:"
          value={draftItem.uom}
          options={Object.keys(units).map((code) => ({
            label: units[code]?.label || code,
            value: code,
            tooltip: units[code]?.toolTip || code,
          }))}
          onChange={(value) => setDraftItem((prev) => ({ ...prev, uom: value }))}
        />
        <Input
          label="SKU:"
          value={draftItem.sku}
          onChange={(value) => setDraftItem((prev) => ({ ...prev, sku: value }))}
        />
        <Input
          label="Title:"
          value={draftItem.title}
          onChange={(value) => setDraftItem((prev) => ({ ...prev, title: value }))}
        />
        <Input
          label="Unit Price:"
          value={draftItem.unitPrice}
          onChange={(value) => setDraftItem((prev) => ({ ...prev, unitPrice: value }))}
        />
      </Flex>
      <Text></Text>
      <Button variant="secondary" onClick={addManualItem}>
        + Add Line Item
      </Button>

      <Text></Text>
      <Divider />
      <Text></Text>

      <Text>Search Products</Text>
      <Text></Text>
      <Flex direction={"row"} gap={"small"}>
        <Button
          variant="secondary"
          onClick={() => {
            // Trigger search when button is clicked - show all products if no query
            if (!searchQuery || searchQuery.length < 2) {
              searchProducts(""); // Empty query shows recent products
            } else {
              searchProducts(searchQuery);
            }
          }}
          disabled={isSearching || !order.supplier}
          overlay={
            <Panel id="my-panel" title="Search Products">
              <PanelBody>
                <PanelSection>
                  <Text>Search for products from your supplier catalog:</Text>
                  <Input
                    label="Search Query"
                    value={searchQuery || ""}
                    onChange={(value) => setSearchQuery(value)}
                    placeholder="Enter SKU, product name, or keywords... (leave empty for all products)"
                  />
                  <Text></Text>
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (searchQuery && searchQuery.length >= 2) {
                        searchProducts(searchQuery);
                      } else {
                        searchProducts(""); // Show all/recent products
                      }
                    }}
                    disabled={isSearching || !order.supplier}
                  >
                    {isSearching ? "Searching..." : searchQuery && searchQuery.length >= 2 ? "Search" : "Show All Products"}
                  </Button>
                  <Text></Text>
                  {isSearching && <Text variant="microcopy">Searching...</Text>}
                  {searchError && (
                    <Text variant="microcopy" style={{ color: "#c0392b" }}>
                      {searchError}
                    </Text>
                  )}
                  {!isSearching && searchResults.length === 0 && (searchQuery || searchQuery === "") && (
                    <Text variant="microcopy">No products found. Try a different search.</Text>
                  )}

                  <Text></Text>
                  <Text>Results:</Text>
                  {searchResults.map((product, index) => {
                    const title = getProductTitle(product);
                    const sku = getProductSku(product);
                    const description = product.description || product.marketingDescription || "";

                    return (
                      <Tile key={product.id || index} compact={true}>
                        <Flex direction="row" justify="between">
                          <Flex direction="column" gap="xs">
                            <Text variant="microcopy">{title}</Text>
                            <Text variant="microcopy">{`SKU: ${sku}`}</Text>
                            {description && (
                              <Text variant="microcopy">
                                {description.length > 50 ? description.substring(0, 50) + "..." : description}
                              </Text>
                            )}
                          </Flex>
                          <Button onClick={() => addProduct(product)}>Add</Button>
                        </Flex>
                      </Tile>
                    );
                  })}
                  <Text></Text>
                  {searchCursor && (
                    <Button
                      variant="secondary"
                      onClick={loadMoreResults}
                      disabled={isSearching}
                    >
                      {isSearching ? "Loading…" : "Load more"}
                    </Button>
                  )}
                </PanelSection>
              </PanelBody>
              <PanelFooter></PanelFooter>
            </Panel>
          }
        >
          Search All Products
        </Button>
      </Flex>
      <Text></Text>
    </>
  );
};

export default PricingTable;
