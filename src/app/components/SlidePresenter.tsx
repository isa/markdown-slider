import { useMemo, useState, useRef, useEffect, type CSSProperties, type ReactNode } from 'react';
import { Code } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SourceEditor } from './SourceEditor';
import { SlideMarkdown } from './SlideMarkdown';
import { parseSlideMarkdown, type DeckSlideThemeDefaults, type SlideLayout } from '../slideThemes';

interface SlidePresenterProps {
  slideContent: string;
  slideType: 'md' | 'html';
  currentSlide: number;
  deckThemeDefaults?: DeckSlideThemeDefaults;
  isDarkMode?: boolean;
  /** Hides edit control and ignores source toggle while presenting. */
  presentationMode?: boolean;
  onContentChange?: (content: string) => void;
  onSourceToggle?: (open: boolean) => void;
}

/** Wraps slide header + body so the block can be vertically centered in the slide when shorter than the viewport. */
function SlideContentStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['slide-content-stack', className].filter(Boolean).join(' ')}>{children}</div>;
}

export function SlidePresenter({
  slideContent,
  slideType,
  currentSlide,
  deckThemeDefaults,
  isDarkMode = true,
  presentationMode = false,
  onContentChange,
  onSourceToggle,
}: SlidePresenterProps) {
  const [showSource, setShowSource] = useState(false);
  const prevSlideRef = useRef(currentSlide);
  const prevSlideForSource = useRef(currentSlide);

  const {
    body,
    theme,
    title,
    subtitle,
    layout,
    coverBackgroundImage,
    imageLayoutMaxWidth,
    imageLayoutMaxHeight,
    imageCaption,
    lineChart,
    barChart,
    pieChart,
    pieChartLegendPosition,
    barChartStacked,
    lineChartArea,
    lineChartEndMarker,
    mermaidNodes,
  } = useMemo(() => {
    if (slideType !== 'md') {
      return {
        body: '',
        theme: parseSlideMarkdown('', isDarkMode, deckThemeDefaults).theme,
        title: undefined,
        subtitle: undefined,
        layout: 'content' as SlideLayout,
        coverBackgroundImage: undefined,
        imageLayoutMaxWidth: undefined,
        imageLayoutMaxHeight: undefined,
        imageCaption: undefined,
        lineChart: undefined,
        barChart: undefined,
        pieChart: undefined,
        pieChartLegendPosition: undefined,
        barChartStacked: undefined,
        lineChartArea: undefined,
        lineChartEndMarker: undefined,
        mermaidNodes: undefined,
      };
    }
    return parseSlideMarkdown(slideContent, isDarkMode, deckThemeDefaults);
  }, [slideContent, slideType, isDarkMode, deckThemeDefaults]);

  const imageSlideCssVars = useMemo((): CSSProperties => {
    if (layout !== 'image') return {};
    const v: Record<string, string> = {};
    if (imageLayoutMaxWidth) v['--slide-image-layout-max-width'] = imageLayoutMaxWidth;
    if (imageLayoutMaxHeight) v['--slide-image-layout-max-height'] = imageLayoutMaxHeight;
    return v as CSSProperties;
  }, [layout, imageLayoutMaxWidth, imageLayoutMaxHeight]);

  // Close source editor when slide changes
  if (currentSlide !== prevSlideForSource.current) {
    prevSlideForSource.current = currentSlide;
    if (showSource) {
      setShowSource(false);
      onSourceToggle?.(false);
    }
  }

  const direction = currentSlide >= prevSlideRef.current ? 1 : -1;
  prevSlideRef.current = currentSlide;

  useEffect(() => {
    if (presentationMode && showSource) {
      setShowSource(false);
      onSourceToggle?.(false);
    }
  }, [presentationMode, showSource, onSourceToggle]);

  useEffect(() => {
    const onToggleSource = () => {
      if (presentationMode) return;
      setShowSource((prev) => {
        const next = !prev;
        onSourceToggle?.(next);
        return next;
      });
    };
    window.addEventListener('markdown-slider:toggle-source', onToggleSource);
    return () => window.removeEventListener('markdown-slider:toggle-source', onToggleSource);
  }, [onSourceToggle, presentationMode]);

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '40%' : '-40%',
      y: 0,
      opacity: 0,
    }),
    center: {
      x: 0,
      y: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-40%' : '40%',
      y: 0,
      opacity: 0,
    }),
  };

  const isCover = layout === 'cover';
  const isImage = layout === 'image';
  const isQuote = layout === 'quote';
  const isDeckHeaderTop =
    (layout === 'content' || layout === 'infographic' || layout === 'quote') && Boolean(title);

  const rootClass = [
    'slide-root',
    'slide-prose',
    theme.rootClassName,
    theme.align &&
    (layout === 'content' ||
      layout === 'infographic' ||
      layout === 'cover' ||
      layout === 'image' ||
      layout === 'quote')
      ? `slide-align--${theme.align}`
      : null,
    isDeckHeaderTop && 'slide-root--deck-header',
    isCover && 'slide-root--cover',
    isCover && coverBackgroundImage && 'slide-root--cover--fullbleed',
    isImage && 'slide-root--image',
    isQuote && 'slide-root--quote',
    slideType === 'md' && 'slide-root--vcenter',
  ]
    .filter(Boolean)
    .join(' ');

  const coverHasBg = Boolean(isCover && coverBackgroundImage);

  const motionShellClass =
    coverHasBg
      ? 'absolute inset-0 flex justify-center items-stretch p-0 overflow-hidden min-h-0'
      : title || isCover || isImage || isQuote
        ? 'absolute inset-0 flex justify-center items-stretch px-10 py-8 overflow-hidden min-h-0'
        : 'absolute inset-0 flex items-center justify-center px-10 py-8 overflow-hidden min-h-0';

  return (
    <div
      className={`h-full w-full overflow-hidden flex transition-colors duration-300 ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-50'}`}
    >
      <div className="flex-1 min-w-0 h-full relative overflow-hidden" style={{ clipPath: 'inset(0 round 0)' }}>
        {!presentationMode ? (
          <button
            onClick={() => {
              const next = !showSource;
              setShowSource(next);
              onSourceToggle?.(next);
            }}
            className={`absolute top-4 right-4 z-30 flex items-center justify-center rounded-md border transition-all duration-200 outline-none ${
              showSource
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                : isDarkMode
                  ? 'bg-zinc-800/80 border-zinc-700/50 text-zinc-500 hover:text-white hover:bg-zinc-700'
                  : 'bg-white/80 border-zinc-300 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200'
            }`}
            style={{ width: 28, height: 28 }}
            title={showSource ? 'Close editor (Esc)' : 'Edit source (E)'}
          >
            <Code style={{ width: 14, height: 14 }} />
          </button>
        ) : null}

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: 0.2,
              ease: [0.25, 0.1, 0.25, 1],
              opacity: { duration: 0.18 },
            }}
            className={motionShellClass}
          >
            {slideType === 'html' ? (
              <iframe
                srcDoc={slideContent}
                className="w-full h-full border-0 rounded-lg"
                title={`Slide ${currentSlide + 1}`}
                sandbox="allow-scripts"
              />
            ) : isCover ? (
              <div className={rootClass} style={theme.cssVariables}>
                {coverBackgroundImage ? (
                  <>
                    <div
                      className="slide-cover-bg-layer"
                      aria-hidden
                      style={{
                        backgroundImage: `url(${JSON.stringify(coverBackgroundImage)})`,
                      }}
                    />
                    <div className="slide-cover-bg-overlay" aria-hidden />
                  </>
                ) : null}
                {title ? (
                  <SlideContentStack className="slide-content-stack--cover">
                    <header className="slide-deck-header slide-deck-header--cover">
                      <div className="slide-deck-header__row slide-deck-header__row--cover">
                        <span
                          className={`slide-deck-header__title${coverHasBg ? ' slide-deck-header__title--cover-on-photo' : ''}`}
                        >
                          {title}
                        </span>
                        {subtitle ? (
                          <span
                            className={`slide-deck-header__subtitle slide-deck-header__subtitle--cover${coverHasBg ? ' slide-deck-header__subtitle--cover-on-photo' : ''}`}
                          >
                            {subtitle}
                          </span>
                        ) : null}
                      </div>
                    </header>
                  </SlideContentStack>
                ) : null}
              </div>
            ) : isImage ? (
              <div
                className={rootClass}
                style={{ ...theme.cssVariables, ...imageSlideCssVars }}
              >
                <SlideContentStack>
                  <div className="slide-deck-body slide-deck-body--image">
                    <div className="slide-image-layout-stack">
                      <div className="slide-image-layout-figure">
                        <SlideMarkdown
                          markdown={body}
                          lineChartData={lineChart}
                          barChartData={barChart}
                          pieChartData={pieChart}
                          pieChartLegendPosition={pieChartLegendPosition}
                          barChartStacked={barChartStacked}
                          lineChartArea={lineChartArea}
                          lineChartEndMarker={lineChartEndMarker}
                          mermaidNodes={mermaidNodes}
                        />
                      </div>
                      {imageCaption ? (
                        <p className="slide-figure-caption">{imageCaption}</p>
                      ) : null}
                    </div>
                  </div>
                </SlideContentStack>
              </div>
            ) : isQuote ? (
              <div className={rootClass} style={theme.cssVariables}>
                <SlideContentStack className="slide-content-stack--quote">
                  {title ? (
                    <header className="slide-deck-header slide-deck-header--quote">
                      <div className="slide-deck-header__row slide-deck-header__row--quote">
                        <span className="slide-deck-header__title slide-deck-header__title--quote">
                          {title}
                        </span>
                      </div>
                      <div className="slide-deck-header__rule" aria-hidden />
                    </header>
                  ) : null}
                  <div className="slide-deck-body slide-deck-body--quote">
                    <div className="slide-quote-stack">
                      <SlideMarkdown
                        markdown={body}
                        lineChartData={lineChart}
                        barChartData={barChart}
                        pieChartData={pieChart}
                        pieChartLegendPosition={pieChartLegendPosition}
                        barChartStacked={barChartStacked}
                        lineChartArea={lineChartArea}
                        lineChartEndMarker={lineChartEndMarker}
                        mermaidNodes={mermaidNodes}
                      />
                      {subtitle ? (
                        <p className="slide-quote-attribution">{subtitle}</p>
                      ) : null}
                    </div>
                  </div>
                </SlideContentStack>
              </div>
            ) : (
              <div className={rootClass} style={theme.cssVariables}>
                <SlideContentStack>
                  {title ? (
                    <header className="slide-deck-header">
                      <div className="slide-deck-header__row slide-deck-header__row--stack">
                        <span className="slide-deck-header__title">{title}</span>
                        {subtitle ? (
                          <span className="slide-deck-header__subtitle">{subtitle}</span>
                        ) : null}
                      </div>
                      <div className="slide-deck-header__rule" aria-hidden />
                    </header>
                  ) : null}
                  <div className="slide-deck-body">
                    <SlideMarkdown
                      markdown={body}
                      lineChartData={lineChart}
                      barChartData={barChart}
                      pieChartData={pieChart}
                      pieChartLegendPosition={pieChartLegendPosition}
                      barChartStacked={barChartStacked}
                      lineChartArea={lineChartArea}
                      lineChartEndMarker={lineChartEndMarker}
                      mermaidNodes={mermaidNodes}
                    />
                  </div>
                </SlideContentStack>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSource && (
          <SourceEditor
            value={slideContent}
            onChange={(val) => onContentChange?.(val)}
            onClose={() => {
              setShowSource(false);
              onSourceToggle?.(false);
            }}
            language={slideType}
            isDarkMode={isDarkMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
