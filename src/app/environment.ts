// Determine backend URL based on environment
// This function is safe for SSR - it checks for window before accessing it
function getBackendUrl(): string {
  // Check if we're in a browser environment (not SSR)
  // During SSR, window is undefined, so we default to production URL
  if (typeof window === 'undefined') {
    return 'https://susm-be-7c4h.shuttle.app';
  }
  
  try {
    const hostname = window.location.hostname;
    // Use localhost for local development, production URL otherwise
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return 'http://localhost:8080';
    }
  } catch (e) {
    // If accessing window.location fails, fall through to production URL
  }
  
  // Default to production URL
  return 'https://susm-be-7c4h.shuttle.app';
}

// Use a getter to make it lazy - only evaluated when accessed, not at module load
let _backendUrl: string | undefined;

export const environment = {
  get be(): string {
    if (_backendUrl === undefined) {
      _backendUrl = getBackendUrl();
    }
    return _backendUrl;
  },
  folderBase: '/uploads'
}