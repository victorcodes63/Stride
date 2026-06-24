import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML for safe rendering. Use before dangerouslySetInnerHTML.
 * Uses DOMPurify default allowlist (includes ul, ol, li, p, strong, etc.)
 * so rich text structure is preserved. Scripts and unsafe elements remain blocked.
 */
export function sanitizeJobContent(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html);
}

/**
 * Sanitize and wrap job list content in a scoped container to prevent
 * structure from bleeding into adjacent sections (e.g. unclosed lists).
 * Each section is parsed as its own fragment, so malformed HTML in one
 * section won't pull in content from the next.
 */
export function sanitizeAndScopeJobSection(html: string, section: string): string {
  const sanitized = sanitizeJobContent(html);
  if (!sanitized) return '';
  // Wrap in scoping div - creates clear boundary so unclosed ul/ol/li
  // from one section don't affect the next
  return `<div class="job-section-body" data-section="${section}">${sanitized}</div>`;
}

/**
 * Prepare job list item content for display. Supports:
 * - HTML from rich text editor (Tiptap)
 * - Legacy **bold** markdown-style
 * - Plain text
 */
export function prepareJobItemContent(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const withBold = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return sanitizeJobContent(withBold);
}
