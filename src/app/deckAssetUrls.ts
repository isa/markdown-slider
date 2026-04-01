/**
 * Bundled slide-folder images (Vite includes them at build time).
 * Bare filenames (no `http(s):` or leading `/`) resolve under `/decks/<deckId>/<slideId>/`
 * for `cornerImage`, `slideLogo`, `backgroundImage`, and markdown `<img>` sources.
 */
const deckSlideImageUrls = import.meta.glob<string>('/decks/**/*.{png,jpg,jpeg,gif,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Normalize a slide-relative path; rejects `..` and absolute paths. */
function safeSlideRelativePath(ref: string): string | undefined {
  const t = ref.trim().replace(/^\.?\//, '').replace(/\\/g, '/');
  if (!t || t.startsWith('/') || t.includes('..')) return undefined;
  return t;
}

/**
 * Resolve `cornerImage` (and similar) URLs: https, `/public` paths, or slide-relative filenames.
 */
export function resolveSlideFolderAssetUrl(
  ref: string,
  deckId: string | undefined,
  slideId: string | undefined,
): string {
  const t = ref.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('/')) return t;
  if (!deckId || !slideId) return t;
  const rel = safeSlideRelativePath(t);
  if (!rel) return t;
  const globKey = `/decks/${deckId}/${slideId}/${rel}`;
  const bundled = deckSlideImageUrls[globKey];
  if (bundled) return bundled;
  if (import.meta.env.DEV) {
    const segments = rel.split('/').map((s) => encodeURIComponent(s)).join('/');
    return `/__deck/asset/${encodeURIComponent(deckId)}/${encodeURIComponent(slideId)}/${segments}`;
  }
  return t;
}
