export function productThumbnailUrl(url: string): string {
  return url.replace(/-800\.webp(?=$|[?#])/i, '-400.webp');
}
