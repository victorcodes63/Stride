/**
 * Helpers for job list content (requirements, responsibilities, benefits).
 */

import { sanitizeJobContent } from './sanitize-html';

/** Normalize value to HTML string. */
export function toHtmlString(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

/** Normalize value for API - returns string for storage. */
export function forApi(value: unknown): string {
  return toHtmlString(value);
}

/** Extract first N list items from HTML as plain text (for previews). Handles ul/ol and nested p. */
export function htmlToListPreviewItems(html: string, maxItems = 2): string[] {
  if (!html || typeof html !== 'string') return [];
  const items: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = liRegex.exec(html)) !== null && items.length < maxItems) {
    const content = match[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (content) items.push(content);
  }
  return items;
}
