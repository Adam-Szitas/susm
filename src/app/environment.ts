// Determine backend URL based on environment
function getBackendUrl(): string {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Use localhost for local development, production URL otherwise
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return 'http://localhost:8080';
    }
  }
  // Default to production URL
  return 'https://susm-be-7c4h.shuttle.app';
}

export const environment = {
  be: getBackendUrl(),
  folderBase: '/uploads'
}