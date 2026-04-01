import { useMemo, type CSSProperties } from 'react';
import { cornerImageFilterCss, type SlideCornerDecoration as SlideCornerDecorationModel } from '../slideThemes';
import { resolveSlideFolderAssetUrl } from '../deckAssetUrls';

export function SlideCornerDecoration({
  decoration,
  deckId,
  slideId,
}: {
  decoration: SlideCornerDecorationModel;
  /** When set, slide-relative `cornerImage` (e.g. `logo.png`) resolves under `decks/<deckId>/<slideId>/`. */
  deckId?: string;
  slideId?: string;
}) {
  const { src: srcRaw, position, scale, filters, opacity, gradient, gradientRadius } = decoration;

  const maskCenter = (
    {
      'top-left': { x: '0%', y: '0%' },
      'top-right': { x: '100%', y: '0%' },
      'bottom-left': { x: '0%', y: '100%' },
      'bottom-right': { x: '100%', y: '100%' },
    } as const
  )[position];
  const src = useMemo(
    () => resolveSlideFolderAssetUrl(srcRaw, deckId, slideId),
    [srcRaw, deckId, slideId],
  );
  const filterCss = useMemo(() => cornerImageFilterCss(filters), [filters]);
  const positionClass = `slide-corner-decoration--${position}`;
  const gradientClass =
    gradient === 'linear'
      ? 'slide-corner-decoration--gradient-linear'
      : `slide-corner-decoration--gradient-${gradient}`;

  const style: CSSProperties = {
    '--slide-corner-scale': String(scale),
    opacity,
    ...(gradientRadius
      ? {
          '--slide-corner-mask-radius': gradientRadius,
          '--slide-corner-mask-x': maskCenter.x,
          '--slide-corner-mask-y': maskCenter.y,
        }
      : {}),
  } as CSSProperties;

  return (
    <div
      className={[
        'slide-corner-decoration',
        positionClass,
        gradientClass,
        gradientRadius ? 'slide-corner-decoration--custom-mask-radius' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden
    >
      <div className="slide-corner-decoration__mask">
        <img
          src={src}
          alt=""
          className="slide-corner-decoration__img"
          style={filterCss ? { filter: filterCss } : undefined}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}
