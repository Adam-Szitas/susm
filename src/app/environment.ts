import { isDevMode } from '@angular/core';

// Determine backend URL based on environment
// This function is safe for SSR - it checks for window before accessing it
function getBackendUrl(): string {
  // During SSR, window is undefined. `ng serve` still runs that path, and
  // local development must talk to the local API rather than the hosted one.
  if (typeof window === 'undefined') {
    if (isDevMode()) {
      return 'http://localhost:8080';
    }
    return 'https://susm-be.fly.dev';
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
  return 'https://susm-be.fly.dev';
}

// Use a getter to make it lazy - only evaluated when accessed, not at module load
let _backendUrl: string | undefined;

// Get the frontend base URL, handling proxy/cluster scenarios
function getFrontendUrl(): string {
  if (typeof window === 'undefined') {
    // SSR fallback - you may want to set this via environment variable
    return 'https://susm.vercel.app';
  }
  
  // In most cases, window.location.origin is correct
  // But in proxy/cluster scenarios, you might need to check headers
  // For now, we'll use location.origin which should work in most cases
  return window.location.origin;
}

export const environment = {
  get be(): string {
    if (_backendUrl === undefined) {
      _backendUrl = getBackendUrl();
    }
    return _backendUrl;
  },
  get frontend(): string {
    return getFrontendUrl();
  },
  folderBase: '/uploads'
}