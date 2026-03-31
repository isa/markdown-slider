import { useMemo, useState, useRef } from 'react';
import { Code } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SourceEditor } from './SourceEditor';
import { SlideMarkdown } from './SlideMarkdown';
import { parseSlideMarkdown } from '../slideThemes';

interface SlidePresenterProps {
  slideContent: string;
  slideType: 'md' | 'html';
  currentSlide: number;
  isDarkMode?: boolean;
  onContentChange?: (content: string) => void;
  onSourceToggle?: (open: boolean) => void;
}

export function SlidePresenter({
  slideContent,
  slideType,
  currentSlide,
  isDarkMode = true,
  onContentChange,
  onSourceToggle,
}: SlidePresenterProps) {
  const [showSource, setShowSource] = useState(false);
  const prevSlideRef = useRef(currentSlide);
  const prevSlideForSource = useRef(currentSlide);

  const { body, theme, title, subtitle } = useMemo(() => {
    if (slideType !== 'md') {
      return {
        body: '',
        theme: parseSlideMarkdown('', isDarkMode).theme,
        title: undefined,
        subtitle: undefined,
      };
    }
    return parseSlideMarkdown(slideContent, isDarkMode);
  }, [slideContent, slideType, isDarkMode]);

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

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '40%' : '-40%',
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-40%' : '40%',
      opacity: 0,
      scale: 0.95,
    }),
  };

  const rootClass = [
    'slide-root',
    'slide-prose',
    theme.rootClassName,
    theme.align && `slide-align--${theme.align}`,
    title && 'slide-root--deck-header',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`h-full w-full overflow-hidden flex transition-colors duration-300 ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-50'}`}
    >
      <div className="flex-1 min-w-0 h-full relative overflow-hidden" style={{ clipPath: 'inset(0 round 0)' }}>
        <button
          onClick={() => {
            const next = !showSource;
            setShowSource(next);
            onSourceToggle?.(next);
          }}
          className={`absolute top-2 right-2 z-30 flex items-center justify-center rounded-md border transition-all duration-200 outline-none ${
            showSource
              ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
              : isDarkMode
                ? 'bg-zinc-800/80 border-zinc-700/50 text-zinc-500 hover:text-white hover:bg-zinc-700'
                : 'bg-white/80 border-zinc-300 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200'
          }`}
          style={{ width: 28, height: 28 }}
          title={showSource ? 'Close editor (Esc)' : 'Edit source'}
        >
          <Code style={{ width: 14, height: 14 }} />
        </button>

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
            }}
            className={
              title
                ? 'absolute inset-0 flex justify-center items-stretch px-10 py-8 overflow-hidden min-h-0'
                : 'absolute inset-0 flex items-center justify-center px-10 py-8 overflow-hidden min-h-0'
            }
          >
            {slideType === 'html' ? (
              <iframe
                srcDoc={slideContent}
                className="w-full h-full border-0 rounded-lg"
                title={`Slide ${currentSlide + 1}`}
                sandbox="allow-scripts"
              />
            ) : (
              <div className={rootClass} style={theme.cssVariables}>
                {title ? (
                  <header className="slide-deck-header">
                    <div className="slide-deck-header__row">
                      <span className="slide-deck-header__title">{title}</span>
                      {subtitle ? (
                        <>
                          <span className="slide-deck-header__vsep" aria-hidden />
                          <span className="slide-deck-header__subtitle">{subtitle}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="slide-deck-header__rule" aria-hidden />
                  </header>
                ) : null}
                <div className="slide-deck-body">
                  <SlideMarkdown markdown={body} />
                </div>
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
