import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Sun, Moon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { SlidePresenter } from './components/SlidePresenter';
import { WorkingArea } from './components/WorkingArea';
import { loadSlides, SlideData } from './slideLoader';

const initialSlides = loadSlides();

function App() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showWorkingArea, setShowWorkingArea] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [slidesData, setSlidesData] = useState<SlideData[]>(initialSlides);
  const [slideSourceOpen, setSlideSourceOpen] = useState(false);
  const [workingSourceOpen, setWorkingSourceOpen] = useState(false);

  const totalSlides = slidesData.length;
  const currentSlideData = slidesData[currentSlide];
  const hasWorkingArea = !!currentSlideData?.workingArea;

  const updateSlideContent = useCallback((slideIndex: number, content: string) => {
    setSlidesData((prev) => prev.map((s, i) =>
      i === slideIndex ? { ...s, content } : s
    ));
  }, []);

  const updateWorkingAreaContent = useCallback((slideIndex: number, content: string) => {
    setSlidesData((prev) => prev.map((s, i) =>
      i === slideIndex && s.workingArea ? { ...s, workingArea: { ...s.workingArea, content } } : s
    ));
  }, []);

  // Auto-flip back to slide view when navigating to a slide without a working area
  useEffect(() => {
    if (!hasWorkingArea && showWorkingArea) {
      setShowWorkingArea(false);
    }
  }, [currentSlide, hasWorkingArea, showWorkingArea]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleView = useCallback(() => {
    if (hasWorkingArea) {
      setShowWorkingArea((prev) => !prev);
    }
  }, [hasWorkingArea]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in an editor
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (hasWorkingArea) toggleView();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, toggleView, toggleTheme, hasWorkingArea]);

  // Determine glow color based on current state
  const getCardGlow = (): { className: string; style: React.CSSProperties } => {
    if (!showWorkingArea && slideSourceOpen) return {
      className: 'border-red-500/30',
      style: { boxShadow: '0 4px 24px rgba(0,0,0,0.2), 0 0 20px rgba(239,68,68,0.3), 0 0 40px rgba(239,68,68,0.1)', transition: 'box-shadow 0.5s, border-color 0.5s' }
    };
    if (!showWorkingArea) return {
      className: 'border-amber-500/30',
      style: { boxShadow: '0 4px 24px rgba(0,0,0,0.2), 0 0 20px rgba(245,158,11,0.3), 0 0 40px rgba(245,158,11,0.1)', transition: 'box-shadow 0.5s, border-color 0.5s' }
    };
    if (showWorkingArea && workingSourceOpen) return {
      className: 'border-red-500/30',
      style: { boxShadow: '0 4px 24px rgba(0,0,0,0.2), 0 0 20px rgba(239,68,68,0.3), 0 0 40px rgba(239,68,68,0.1)', transition: 'box-shadow 0.5s, border-color 0.5s' }
    };
    return {
      className: 'border-blue-500/30',
      style: { boxShadow: '0 4px 24px rgba(0,0,0,0.2), 0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.1)', transition: 'box-shadow 0.5s, border-color 0.5s' }
    };
  };

  const cardGlow = getCardGlow();

  return (
    <div className={`h-screen w-screen flex items-center justify-center p-6 transition-colors duration-300 ${isDarkMode ? 'bg-zinc-950' : 'bg-zinc-200'}`}>
      {/* Outer container - the "device frame" */}
      <div className={`w-full h-full rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.3)] border flex flex-col overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-zinc-900 border-zinc-800/60' : 'bg-white border-zinc-300'}`}>
        {/* Title bar */}
        <div className="shrink-0 px-8 py-4 flex items-center justify-between">
          <div className="w-20" />
          <div className="text-center">
            <h1 className={`text-2xl ${isDarkMode ? 'text-white' : 'text-zinc-800'}`} style={{ fontFamily: 'Georgia, serif' }}>
              ✦ Markdown Slides ✦
            </h1>
            <p className={`text-xs tracking-widest uppercase mt-0.5 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
              ─── A Modern Presentation Tool ───
            </p>
          </div>
          <div className="flex items-center gap-2 w-20 justify-end">
            <button
              onClick={toggleTheme}
              className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all duration-200 outline-none ${isDarkMode ? 'bg-zinc-800/70 border-zinc-600/50 hover:bg-zinc-700 text-white' : 'bg-amber-100 border-amber-300 text-amber-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-amber-200'}`}
              title={isDarkMode ? 'Switch to light mode (T)' : 'Switch to dark mode (T)'}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleView}
              disabled={!hasWorkingArea}
              className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all duration-200 outline-none disabled:opacity-30 disabled:pointer-events-none ${isDarkMode ? 'bg-zinc-800/70 border-zinc-600/50 hover:bg-zinc-700 text-white' : showWorkingArea ? 'bg-blue-100 border-blue-300 text-blue-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-blue-200' : 'bg-white/70 border-zinc-300 hover:bg-zinc-200 text-zinc-700'}`}
              title={!hasWorkingArea ? 'No working area for this slide' : showWorkingArea ? 'Show slides (F)' : 'Show working area (F)'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inner content area - flips as a whole */}
        <div className="flex-1 min-h-0 px-4 pb-4" style={{ perspective: '1500px' }}>
          <AnimatePresence mode="wait">
            {!showWorkingArea ? (
              <motion.div
                key="slide"
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="w-full h-full flex items-center gap-3"
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              >
                {/* Previous arrow */}
                <button
                  onClick={prevSlide}
                  disabled={currentSlide === 0}
                  className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border transition-colors outline-none disabled:opacity-20 disabled:pointer-events-none ${isDarkMode ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-white' : 'border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Slide card */}
                <div
                  className={`flex-1 h-full rounded-2xl border overflow-hidden ${isDarkMode ? cardGlow.className : 'border-zinc-200'}`}
                  style={isDarkMode ? cardGlow.style : { boxShadow: '0 4px 24px rgba(0,0,0,0.1)', transition: 'box-shadow 0.5s, border-color 0.5s' }}
                >
                  <SlidePresenter slideContent={currentSlideData?.content ?? '# No content'} slideType={currentSlideData?.type ?? 'md'} currentSlide={currentSlide} isDarkMode={isDarkMode} onContentChange={(content) => updateSlideContent(currentSlide, content)} onSourceToggle={setSlideSourceOpen} />
                </div>

                {/* Next arrow */}
                <button
                  onClick={nextSlide}
                  disabled={currentSlide === totalSlides - 1}
                  className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border transition-colors outline-none disabled:opacity-20 disabled:pointer-events-none ${isDarkMode ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-white' : 'border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="working"
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className={`w-full h-full rounded-2xl border overflow-hidden ${isDarkMode ? cardGlow.className : 'border-zinc-200'}`}
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden', ...(isDarkMode ? cardGlow.style : { boxShadow: '0 4px 24px rgba(0,0,0,0.1)', transition: 'box-shadow 0.5s, border-color 0.5s' }) }}
              >
                <WorkingArea htmlContent={currentSlideData?.workingArea?.content} workingAreaType={currentSlideData?.workingArea?.type} onContentChange={(content) => updateWorkingAreaContent(currentSlide, content)} onSourceToggle={setWorkingSourceOpen} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer dots */}
        <div className="shrink-0 pb-4 px-8 flex items-center justify-between">
          <span className={`text-[10px] ${isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}`}>← → nav · F flip · T theme</span>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {currentSlide + 1} / {totalSlides}
            </span>
            <div className="flex gap-1.5">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-1.5 rounded-full transition-all outline-none ${
                    i === currentSlide
                      ? `w-6 ${isDarkMode ? 'bg-white' : 'bg-zinc-800'}`
                      : `w-1.5 ${isDarkMode ? 'bg-zinc-600 hover:bg-zinc-500' : 'bg-zinc-300 hover:bg-zinc-400'}`
                  }`}
                />
              ))}
            </div>
          </div>
          <span className={`text-[10px] ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
            ☻ Presented by You · ◈ March 31, 2026
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;