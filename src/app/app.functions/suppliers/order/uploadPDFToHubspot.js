/**
 * Simple function: Upload PDF file to HubSpot
 * Takes PDF buffer, filename, and uploads it
 */

const axios = require('axios');
const FormData = require('form-data');

async function uploadPDFToHubspot(pdfBuffer, fileName, orderId, dealId) {
  // Get API key
  const apiKey = process.env.HUBSPOT_API_KEY2;
  
  if (!apiKey) {
    throw new Error('HUBSPOT_API_KEY2 is not set');
  }
  
  // Check PDF buffer
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new Error('Invalid PDF buffer');
  }
  
  // Create form data
  const form = new FormData();
  
  // Add PDF file
  form.append('file', pdfBuffer, {
    filename: fileName,
    contentType: 'application/pdf'
  });
  
  // Add folder path
  form.append('folderPath', '/orders');
  
  // Add file name
  form.append('fileName', fileName);
  
  // Add options
  const options = JSON.stringify({
    access: 'PUBLIC_NOT_INDEXABLE'
  });
  form.append('options', options);
  
  // Upload to HubSpot
  const response = await axios.post('https://api.hubapi.com/files/v3/files', form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': 'Bearer ' + apiKey,
    },
  });
  
  // Get URL from response
  const fileUrl = response.data.url;
  const fileId = response.data.id;
  const folderId = response.data.folderId || '202125547541';
  
  if (!fileUrl) {
    throw new Error('No URL returned from HubSpot');
  }
  
  // Make app URL for HubSpot
  const portalId = process.env.HUBSPOT_PORTAL_ID || '21196760';
  const appUrl = `https://app.hubspot.com/files/${portalId}/?folderId=${folderId}&showDetails=${fileId}`;
  
  // Return result
  return {
    url: fileUrl,
    appUrl: appUrl,
    fileId: fileId,
    folderId: folderId,
    success: true
  };
}

module.exports = {
  uploadPDFToHubspot
};
