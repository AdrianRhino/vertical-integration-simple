/**
 * Tiny HTTP helpers
 * Simple functions for making GET and POST requests
 */

const axios = require("axios");

async function postJson(url, bodyObj, headers = {}) {
  const response = await axios.post(url, bodyObj, {
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
  
  if (response.status >= 400) {
    throw new Error(`POST ${url} failed: ${response.status}`);
  }
  
  return response.data;
}

async function getJson(url, headers = {}) {
  const response = await axios.get(url, {
    headers: {
      ...headers,
    },
  });
  
  if (response.status >= 400) {
    throw new Error(`GET ${url} failed: ${response.status}`);
  }
  
  return response.data;
}

module.exports = {
  postJson,
  getJson,
};
