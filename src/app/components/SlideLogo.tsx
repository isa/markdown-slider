import { useMemo, type CSSProperties } from 'react';
import { cornerImageFilterCss, type SlideCornerPosition, type SlideLogo as SlideLogoModel } from '../slideThemes';
import { resolveSlideFolderAssetUrl } from '../deckAssetUrls';

function logoInsetStyle(position: SlideCornerPosition, padding: string): Pick<
  CSSProperties,
  'top' | 'right' | 'bottom' | 'left'
> {
  const parts = padding.trim().split(/\s+/).filter(Boolean);
  const a = parts[0] ?? '1.25rem';
  const b = parts[1] ?? a;
  const auto = 'auto' as const;
  switch (position) {
    case 'top-right':
      return { top: a, right: b, bottom: auto, left: auto };
    case 'top-left':
      return { top: a, left: b, bottom: auto, right: auto };
    case 'bottom-right':
      return { bottom: a, right: b, top: auto, left: auto };
    case 'bottom-left':
      return { bottom: a, left: b, top: auto, right: auto };
    default:
      return { top: a, right: b, bottom: auto, left: auto };
  }
}

export function SlideLogo({
  logo,
  deckId,
  slideId,
}: {
  logo: SlideLogoModel;
  deckId?: string;
  slideId?: string;
}) {
  const { src: srcRaw, position, scale, padding, opacity, filters, alt } = logo;
  const src = useMemo(
    () => resolveSlideFolderAssetUrl(srcRaw, deckId, slideId),
    [srcRaw, deckId, slideId],
  );
  const filterCss = useMemo(() => cornerImageFilterCss(filters), [filters]);
  const positionClass = `slide-slide-logo--${position}`;
  const inset = useMemo(() => logoInsetStyle(position, padding), [position, padding]);

  const style: CSSProperties = {
    ...inset,
    '--slide-logo-scale': String(scale),
    opacity,
  } as CSSProperties;

  return (
    <div className={['slide-slide-logo', positionClass].join(' ')} style={style} aria-hidden={alt ? undefined : true}>
      <img
        src={src}
        alt={alt ?? ''}
        className="slide-slide-logo__img"
        style={filterCss ? { filter: filterCss } : undefined}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
