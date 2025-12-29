/**
 * Simple function: Make a PDF from order data
 * Uses pdfkit library if available, otherwise returns empty buffer
 */

let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (error) {
  PDFDocument = null;
}

async function generateOrderPDF(fullOrder, orderResult) {
  // Check if pdfkit is available
  if (!PDFDocument) {
    // Return a simple empty PDF buffer as fallback
    const emptyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\ntrailer\n<<\n/Size 1\n/Root 1 0 R\n>>\nstartxref\n20\n%%EOF');
    console.log('PDF generation: Using fallback empty PDF (pdfkit not available)');
    return emptyPdf;
  }
  
  // Make sure fullOrder exists
  if (!fullOrder || typeof fullOrder !== 'object') {
    fullOrder = {};
  }
  
  // Make sure orderResult exists
  if (!orderResult || typeof orderResult !== 'object') {
    orderResult = {};
  }
  
  // Get order info
  const orderNumber = fullOrder.orderId || fullOrder.ticket || 'ORD-' + Date.now();
  const supplier = (fullOrder.supplier || 'UNKNOWN').toUpperCase();
  const items = fullOrder.fullOrderItems || [];
  const delivery = fullOrder.delivery || {};
  
  // Make a promise to build the PDF
  return new Promise((resolve, reject) => {
    try {
      // Create new PDF document
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      
      // Collect PDF data as it's created
      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      // When PDF is done, combine all chunks
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      
      // If error, reject
      doc.on('error', (err) => {
        reject(err);
      });
      
      // Write PDF content - very simple
      doc.fontSize(20).text('ORDER CONFIRMATION', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(12).text('Order Number: ' + orderNumber);
      doc.text('Supplier: ' + supplier);
      doc.text('Date: ' + new Date().toLocaleDateString());
      doc.moveDown();
      
      // Write items list
      if (items.length > 0) {
        doc.text('Items:', { underline: true });
        doc.moveDown(0.5);
        
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const sku = item.sku || item.itemNumber || 'N/A';
          const qty = item.qty || 0;
          const price = item.unitPrice || 0;
          const title = item.title || item.productName || item.name || '';
          if (title) {
            doc.text(`${i + 1}. ${title} - SKU: ${sku}, Qty: ${qty}, Price: $${price.toFixed(2)}`);
          } else {
            doc.text(`${i + 1}. SKU: ${sku}, Qty: ${qty}, Price: $${price.toFixed(2)}`);
          }
        }
        doc.moveDown();
      }
      
      // Write delivery address if available
      if (delivery.address_line_1) {
        doc.text('Delivery Address:', { underline: true });
        doc.moveDown(0.5);
        if (delivery.address_line_1) doc.text(delivery.address_line_1);
        if (delivery.city) doc.text(delivery.city);
        if (delivery.state && delivery.zip_code) {
          doc.text(delivery.state + ' ' + delivery.zip_code);
        }
        doc.moveDown();
      }
      
      // Write total
      const total = fullOrder.orderTotal || 0;
      doc.fontSize(14).text('Total: $' + total.toFixed(2), { align: 'right' });
      
      // Finish PDF
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateOrderPDF
};
