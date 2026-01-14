/**
 * Simple wrapper around getCredentials
 * Returns config with baseUrl and authUrl separate
 * 
 * This is the "address book" - one spot for credentials per supplier
 */

const { getCredentials } = require("../../suppliers/config/getCredentials");

function getSupplierConfig(supplierName, environment) {
  // Normalize: "prod" or null (null = use master config which is sandbox)
  const env = environment === "prod" ? "prod" : null;
  
  const credentials = getCredentials(supplierName, env);
  
  // Return simple format with baseUrl and authUrl separate
  return {
    baseUrl: credentials.apiBaseUrl,
    authUrl: credentials.authUrl,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    username: credentials.username,
    password: credentials.password,
    apiSiteId: credentials.apiSiteId,
    environment: credentials.environment,
  };
}

module.exports = { getSupplierConfig };
