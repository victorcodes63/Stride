/**
 * Renders a schema.org JSON-LD <script>. Server-safe; mirrors the pattern used
 * in the root layout so structured data ships in the initial HTML payload.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
