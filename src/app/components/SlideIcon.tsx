import { resolveSlideIcon } from '../markdown/slideIconRegistry';

export type SlideIconProps = {
  className?: string;
  /** Some pipelines pass HTML `class` instead of `className` */
  class?: string;
  /** react-icons export name, e.g. FaStar */
  name?: string;
  /** react-icons subpackage, e.g. fa */
  pack?: string;
  /** Passed by react-markdown; unused */
  node?: unknown;
};

function mergeClassNames(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ').trim();
}

/**
 * Inline react-icons in markdown: `<icon class="fa-star red 2x" />` or
 * `<icon name="FaStar" pack="fa" class="red 2x" />`.
 */
export function SlideIcon({ className, class: classAttr, name, pack }: SlideIconProps) {
  const resolvedClass = className ?? classAttr;

  const extraFromClass = (() => {
    if (!resolvedClass?.trim()) return { key: undefined as string | undefined, extra: '' };
    const tokens = resolvedClass.trim().split(/\s+/);
    const key = tokens[0];
    const extra = tokens.slice(1).join(' ');
    return { key, extra };
  })();

  const explicitKey = name && pack ? `${pack}/${name}` : undefined;

  const registryKey = explicitKey ?? extraFromClass.key;
  const Icon = registryKey ? resolveSlideIcon(registryKey) : undefined;

  const extraClasses = explicitKey
    ? (resolvedClass?.trim() ?? '')
    : extraFromClass.extra;

  const merged = mergeClassNames('slide-icon', extraClasses);

  if (!Icon) {
    if (import.meta.env.DEV && registryKey) {
      return (
        <span
          className={mergeClassNames('slide-icon slide-icon--missing', resolvedClass)}
          title={`Unknown slide icon: ${registryKey}`}
          role="img"
          aria-label="Missing icon"
        >
          ?
        </span>
      );
    }
    return null;
  }

  /* Wrapper owns utility classes (red, 2x): react-icons sets fixed width/height + style on the
   * SVG, so sizing/color on the SVG element often does not apply as expected. Span inherits theme
   * color and font-size; SVG uses currentColor + 1em relative to inherited font-size. */
  return (
    <span className={merged}>
      <Icon
        aria-hidden
        focusable="false"
        size="1em"
        className="slide-icon__svg"
        style={{ color: 'inherit' }}
      />
    </span>
  );
}
