/**
 * Simple function: Take fullOrder and parsedOrder, merge them together
 * fullOrder wins if both have the same field
 */

function prepareOrder(fullOrder, parsedOrder, environment) {
  // If fullOrder is missing, use empty object
  if (!fullOrder || typeof fullOrder !== 'object') {
    fullOrder = {};
  }
  
  // If parsedOrder is missing, use empty object
  if (!parsedOrder || typeof parsedOrder !== 'object') {
    parsedOrder = {};
  }
  
  // Make a new object starting with parsedOrder
  const result = {};
  
  // Copy all fields from parsedOrder first
  for (const key in parsedOrder) {
    if (parsedOrder.hasOwnProperty(key)) {
      result[key] = parsedOrder[key];
    }
  }
  
  // Copy all fields from fullOrder (this overwrites parsedOrder values)
  for (const key in fullOrder) {
    if (fullOrder.hasOwnProperty(key)) {
      result[key] = fullOrder[key];
    }
  }
  
  // Make sure supplier exists
  if (!result.supplier) {
    result.supplier = '';
  }
  
  // Make sure items array exists
  if (!result.fullOrderItems) {
    result.fullOrderItems = [];
  }
  
  // Make sure delivery object exists
  if (!result.delivery) {
    result.delivery = {};
  }
  
  // Add environment if provided
  if (environment) {
    result.environment = environment;
  }
  
  return result;
}

module.exports = {
  prepareOrder
};
