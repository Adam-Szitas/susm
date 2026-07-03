/** Middle-ellipsis for compact select labels: "Start…end". */
export function truncateSelectLabel(text: string, maxLength = 24): string {
  const normalized = text.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const ellipsis = '...';
  const visible = maxLength - ellipsis.length;
  const head = Math.ceil(visible / 2);
  const tail = Math.floor(visible / 2);
  return `${normalized.slice(0, head)}${ellipsis}${normalized.slice(-tail)}`;
}
