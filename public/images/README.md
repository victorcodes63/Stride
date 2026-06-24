# Images directory

Static images for the HRIS demo (marketing, careers, UI). Organise by category as you add assets.

## Conventions

- Prefer **WebP** or **AVIF** for photos; **SVG** for logos and icons where possible.
- Use descriptive filenames (`hero-careers.webp`, not `img1.webp`).
- For logos referenced in code, prefer `public/brand/` and env-driven paths in `src/lib/brand.ts`.

## Accessibility

When embedding images in TSX, always set a meaningful `alt` text (or `alt=""` for decorative images only).
