import { useState, useRef } from 'react';
import { Code } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { SourceEditor } from './SourceEditor';

interface SlidePresenterProps {
  slideContent: string;
  slideType: 'md' | 'html';
  currentSlide: number;
  isDarkMode?: boolean;
  onContentChange?: (content: string) => void;
  onSourceToggle?: (open: boolean) => void;
}

export function SlidePresenter({ slideContent, slideType, currentSlide, isDarkMode = true, onContentChange, onSourceToggle }: SlidePresenterProps) {
  const [showSource, setShowSource] = useState(false);
  const prevSlideRef = useRef(currentSlide);
  const prevSlideForSource = useRef(currentSlide);

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

  return (
    <div className={`h-full w-full overflow-hidden flex transition-colors duration-300 ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-50'}`}>
      {/* Slide content - takes remaining space */}
      <div className="flex-1 min-w-0 h-full relative overflow-hidden" style={{ clipPath: 'inset(0 round 0)' }}>
        {/* Source toggle button */}
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
            className="absolute inset-0 flex items-center justify-center p-16"
          >
            {slideType === 'html' ? (
              <iframe
                srcDoc={slideContent}
                className="w-full h-full border-0 rounded-lg"
                title={`Slide ${currentSlide + 1}`}
                sandbox="allow-scripts"
              />
            ) : (
              <div className="prose prose-invert prose-lg max-w-4xl">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className={`text-5xl mb-8 text-center ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className={`text-4xl mb-6 text-center ${isDarkMode ? 'text-white' : 'text-zinc-800'}`}>{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className={`text-3xl mb-4 ${isDarkMode ? 'text-white' : 'text-zinc-800'}`}>{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className={`text-xl mb-4 leading-relaxed ${isDarkMode ? 'text-zinc-200' : 'text-zinc-600'}`}>{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className={`text-xl space-y-3 mb-6 ${isDarkMode ? 'text-zinc-200' : 'text-zinc-600'}`}>{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className={`text-xl space-y-3 mb-6 ${isDarkMode ? 'text-zinc-200' : 'text-zinc-600'}`}>{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed">{children}</li>
                    ),
                    code: ({ children, className }) => {
                      const isBlock = className?.includes('language-');
                      if (isBlock) {
                        return (
                          <pre className={`p-4 rounded-lg overflow-x-auto my-4 ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                            <code className={`text-sm ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>{children}</code>
                          </pre>
                        );
                      }
                      return (
                        <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-zinc-800 text-green-400' : 'bg-zinc-200 text-green-700'}`}>
                          {children}
                        </code>
                      );
                    },
                    blockquote: ({ children }) => (
                      <blockquote className={`border-l-4 border-blue-500 pl-4 italic my-4 ${isDarkMode ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {slideContent}
                </ReactMarkdown>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Source editor sidebar */}
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