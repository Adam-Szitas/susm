import { environment } from '../environment';

/** Build a backend URL that serves an uploaded file (local path or R2 URL). */
export function buildUploadImageUrl(path: string | undefined | null): string {
  if (!path || typeof path !== 'string') {
    return '';
  }

  let normalizedPath = path.replace(/^[.\\/]+/, '').replace(/\\/g, '/');
  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
    const encodedPath = encodeURIComponent(normalizedPath);
    return `${environment.be}${environment.folderBase}/${encodedPath}`;
  }
  if (normalizedPath.startsWith('uploads/')) {
    normalizedPath = normalizedPath.substring('uploads/'.length);
  }
  const pathSegments = normalizedPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));
  const encodedPath = pathSegments.join('/');
  return `${environment.be}${environment.folderBase}/${encodedPath}`;
}
