/**
 * Shape Language: Input → Filter → Transform → Store → Output → Loop
 * 
 * Input: Context with fullOrder parameter
 * Filter: Validates fullOrder exists and has supplier
 * Transform: Routes to appropriate supplier order function via registry
 * Store: N/A
 * Output: Order submission response from supplier API
 * Loop: Self-healing - validates supplier and routes correctly
 */

// Supplier order function registry
const ORDER_FUNCTIONS = {
  'abc': require('./abcOrder'),
  'srs': require('./srsOrder'),
  'beacon': require('./beaconOrder'),
};

exports.main = async (context = {}) => {
  try {
    const { fullOrder, parsedOrder, environment, dealId } = context.parameters || {};
    
    // Filter: Validate fullOrder exists
    if (!fullOrder) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Missing fullOrder parameter',
          error: 'fullOrder is required to place an order'
        }
      };
    }
    
    // Transform: Prepare unified order (simple merge - fullOrder takes precedence)
    const unifiedOrder = {
      ...(parsedOrder || {}),
      ...fullOrder,
      supplier: fullOrder.supplier || parsedOrder?.supplier || '',
      fullOrderItems: fullOrder.fullOrderItems || parsedOrder?.fullOrderItems || [],
      delivery: {
        ...(parsedOrder?.delivery || {}),
        ...(fullOrder.delivery || {}),
      },
    };
    
    // Filter: Validate supplier exists
    const supplier = unifiedOrder.supplier?.toLowerCase();
    if (!supplier) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Missing supplier in order',
          error: 'Order supplier is required to route to correct supplier'
        }
      };
    }
    
    console.log(`Routing order to supplier: ${supplier}`);
    console.log(`Items: ${(unifiedOrder.fullOrderItems || []).length}, Total: $${(unifiedOrder.orderTotal || 0).toFixed(2)}`);
    
    // Transform: Get appropriate order function from registry
    const orderFunction = ORDER_FUNCTIONS[supplier];
    if (!orderFunction) {
      const availableSuppliers = Object.keys(ORDER_FUNCTIONS).join(', ');
      return {
        statusCode: 400,
        body: {
          success: false,
          message: `Unknown supplier: ${supplier}`,
          error: `Available suppliers: ${availableSuppliers}`
        }
      };
    }
    
    // Transform: Prepare context for supplier order function
    const supplierContext = {
      parameters: {
        orderBody: unifiedOrder,
        environment: environment || null,
      }
    };
    
    // Output: Call supplier-specific order function
    const result = await orderFunction.main(supplierContext);
    
    console.log(`Order submission result for ${supplier}:`, {
      success: result.success,
      message: result.message,
      confirmationNumber: result.confirmationNumber,
    });
    
    // Return in proper serverless function format
    return {
      statusCode: 200,
      body: result
    };
    
  } catch (error) {
    console.error('Error in sendOrderToSupplier:', {
      message: error.message,
      stack: error.stack,
      parameters: context.parameters
    });
    
    return {
      statusCode: 500,
      body: {
        success: false,
        message: 'Failed to send order to supplier',
        error: error.message || 'Unknown error occurred'
      }
    };
  }
};
