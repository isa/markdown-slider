import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Sun, Moon, Plus, FolderOpen, Copy, Check, Presentation } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { SlidePresenter } from './components/SlidePresenter';
import { WorkingArea } from './components/WorkingArea';
import { PresentationInkLayer } from './components/PresentationInkLayer';
import { loadDecks, getDefaultDeckId, SlideData } from './slideLoader';
import { getRegisteredThemeIds } from './slideThemes';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';

const decksCatalog = loadDecks();
const themeOptions = getRegisteredThemeIds();
const deckFromUrl = new URLSearchParams(window.location.search).get('deck');
const initialDeckId =
  (deckFromUrl && decksCatalog.some((d) => d.id === deckFromUrl) && deckFromUrl) ||
  getDefaultDeckId(decksCatalog);

function getFullscreenElement(): Element | null {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
  };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.mozFullScreenElement ?? null;
}

async function exitFullscreenDom(): Promise<void> {
  if (!getFullscreenElement()) return;
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
  };
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (doc.webkitExitFullscreen) await Promise.resolve(doc.webkitExitFullscreen());
    else if (doc.mozCancelFullScreen) await Promise.resolve(doc.mozCancelFullScreen());
  } catch {
    /* ignore */
  }
}

async function requestFullscreenDom(el: Element): Promise<void> {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
  };
  try {
    if (anyEl.requestFullscreen) await anyEl.requestFullscreen();
    else if (anyEl.webkitRequestFullscreen) await Promise.resolve(anyEl.webkitRequestFullscreen());
    else if (anyEl.mozRequestFullScreen) await Promise.resolve(anyEl.mozRequestFullScreen());
  } catch {
    /* ignore */
  }
}

function App() {
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initialDeckId);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showWorkingArea, setShowWorkingArea] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [slidesData, setSlidesData] = useState<SlideData[]>([]);
  const [slideSourceOpen, setSlideSourceOpen] = useState(false);
  const [workingSourceOpen, setWorkingSourceOpen] = useState(false);
  const [goToSlideOpen, setGoToSlideOpen] = useState(false);
  const [goToSlideValue, setGoToSlideValue] = useState('');
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [newDeckAuthor, setNewDeckAuthor] = useState('');
  const [newDeckTheme, setNewDeckTheme] = useState('default');
  const [copiedCreateCmd, setCopiedCreateCmd] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const goToSlideInputRef = useRef<HTMLInputElement>(null);
  const presentationContainerRef = useRef<HTMLDivElement>(null);

  const activeDeck = useMemo(
    () => decksCatalog.find((deck) => deck.id === activeDeckId) ?? null,
    [activeDeckId],
  );
  const totalSlides = slidesData.length;
  const currentSlideData = slidesData[currentSlide];
  const hasWorkingArea = !!currentSlideData?.workingArea;
  const activeDeckDefaultTheme = activeDeck?.meta.defaultTheme;

  const openDeck = useCallback((deckId: string) => {
    const deck = decksCatalog.find((d) => d.id === deckId);
    if (!deck) return;
    setSlidesData(
      deck.slides.map((slide) => ({
        ...slide,
        workingArea: slide.workingArea ? { ...slide.workingArea } : undefined,
      })),
    );
    setCurrentSlide(0);
    setShowWorkingArea(false);
    setSlideSourceOpen(false);
    setWorkingSourceOpen(false);
    setGoToSlideOpen(false);
    setGoToSlideValue('');
    setPresentationMode(false);
    void exitFullscreenDom();
    setActiveDeckId(deck.id);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('deck', deck.id);
    window.history.replaceState({}, '', nextUrl.toString());
  }, []);

  useEffect(() => {
    if (activeDeckId || !initialDeckId) return;
    setSelectedDeckId(initialDeckId);
  }, [activeDeckId]);

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
    if (totalSlides < 1) return;
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    if (totalSlides < 1) return;
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, [totalSlides]);

  const toggleView = useCallback(() => {
    if (hasWorkingArea) {
      setShowWorkingArea((prev) => !prev);
    }
  }, [hasWorkingArea]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const addSlideAfterCurrent = useCallback(() => {
    if (!activeDeckId) return;
    const insertionIndex = currentSlide + 1;
    const nextSlideId = `slide${String(insertionIndex + 1).padStart(2, '0')}`;
    const newSlide: SlideData = {
      index: insertionIndex,
      id: nextSlideId,
      deckId: activeDeckId,
      content: `---\ntitle: New Slide\n---\n\nAdd your content here.\n`,
      type: 'md',
    };
    setSlidesData((prev) => {
      const next = [...prev];
      next.splice(insertionIndex, 0, newSlide);
      return next.map((slide, idx) => ({ ...slide, index: idx }));
    });
    setCurrentSlide(insertionIndex);
    setShowWorkingArea(false);
  }, [activeDeckId, currentSlide]);

  const addWorkingAreaToCurrent = useCallback(() => {
    if (!activeDeckId || totalSlides < 1) return;
    setSlidesData((prev) =>
      prev.map((slide, idx) => {
        if (idx !== currentSlide || slide.workingArea) return slide;
        return {
          ...slide,
          workingArea: {
            type: 'md',
            content: `# Working Area\n\nUse this space for notes, drafts, or demo snippets.\n`,
          },
        };
      }),
    );
    setShowWorkingArea(true);
  }, [activeDeckId, totalSlides, currentSlide]);

  const closeGoToSlide = useCallback(() => {
    setGoToSlideOpen(false);
    setGoToSlideValue('');
  }, []);

  const submitGoToSlide = useCallback(() => {
    const n = parseInt(goToSlideValue.trim(), 10);
    if (Number.isNaN(n) || n < 1) {
      closeGoToSlide();
      return;
    }
    const idx = Math.min(n - 1, totalSlides - 1);
    setCurrentSlide(Math.max(0, idx));
    closeGoToSlide();
  }, [goToSlideValue, totalSlides, closeGoToSlide]);

  useEffect(() => {
    if (!goToSlideOpen) return;
    const id = requestAnimationFrame(() => goToSlideInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [goToSlideOpen]);

  const exitPresentation = useCallback(async () => {
    setPresentationMode(false);
    await exitFullscreenDom();
  }, []);

  const enterPresentation = useCallback(() => {
    setSlideSourceOpen(false);
    setWorkingSourceOpen(false);
    setPresentationMode(true);
  }, []);

  useEffect(() => {
    const sync = () => {
      if (!getFullscreenElement()) {
        setPresentationMode(false);
      }
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  useEffect(() => {
    if (!presentationMode) return;
    const id = requestAnimationFrame(() => {
      const el = presentationContainerRef.current;
      if (el) void requestFullscreenDom(el);
    });
    return () => cancelAnimationFrame(id);
  }, [presentationMode]);

  useEffect(() => {
    if (!activeDeckId) {
      setPresentationMode(false);
      void exitFullscreenDom();
    }
  }, [activeDeckId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const isGoToInput = target === goToSlideInputRef.current;

      if (goToSlideOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeGoToSlide();
          return;
        }
        if (!isGoToInput && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === ' ')) {
          e.preventDefault();
          return;
        }
        if (isGoToInput) return;
        return;
      }

      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (!activeDeckId) {
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          toggleTheme();
        }
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          if (presentationMode) {
            void exitPresentation();
          } else {
            enterPresentation();
          }
        }
        return;
      }

      if (presentationMode) {
        if (e.key === 'Escape') {
          e.preventDefault();
          void exitPresentation();
          return;
        }
        if (e.key === 'e' || e.key === 'E' || e.key === 'g' || e.key === 'G') {
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'Escape') {
        if (slideSourceOpen || workingSourceOpen) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('markdown-slider:toggle-source'));
        }
        return;
      }

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
      } else if (e.key === 'g' || e.key === 'G') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          setGoToSlideValue('');
          setGoToSlideOpen(true);
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('markdown-slider:toggle-source'));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    nextSlide,
    prevSlide,
    toggleView,
    toggleTheme,
    hasWorkingArea,
    goToSlideOpen,
    closeGoToSlide,
    slideSourceOpen,
    workingSourceOpen,
    activeDeckId,
    presentationMode,
    enterPresentation,
    exitPresentation,
  ]);

  // State-colored border + glow (same logic in light and dark; base shadow only differs)
  const getCardGlow = (isDark: boolean): { className: string; style: React.CSSProperties } => {
    const base = isDark ? '0 4px 24px rgba(0,0,0,0.2)' : '0 4px 24px rgba(0,0,0,0.1)';
    const t: React.CSSProperties = { transition: 'box-shadow 0.5s, border-color 0.5s' };
    if (!showWorkingArea && slideSourceOpen) {
      return {
        className: 'border-red-500/30',
        style: { boxShadow: `${base}, 0 0 14px rgba(239,68,68,0.22), 0 0 28px rgba(239,68,68,0.06)`, ...t },
      };
    }
    if (!showWorkingArea) {
      return {
        className: 'border-amber-500/30',
        style: { boxShadow: `${base}, 0 0 14px rgba(245,158,11,0.22), 0 0 28px rgba(245,158,11,0.06)`, ...t },
      };
    }
    if (showWorkingArea && workingSourceOpen) {
      return {
        className: 'border-red-500/30',
        style: { boxShadow: `${base}, 0 0 14px rgba(239,68,68,0.22), 0 0 28px rgba(239,68,68,0.06)`, ...t },
      };
    }
    return {
      className: 'border-blue-500/30',
      style: { boxShadow: `${base}, 0 0 14px rgba(59,130,246,0.22), 0 0 28px rgba(59,130,246,0.06)`, ...t },
    };
  };

  const cardGlow = getCardGlow(isDarkMode);

  const suggestedDeckId = useMemo(() => {
    if (!newDeckTitle.trim()) return '';
    return newDeckTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }, [newDeckTitle]);

  const createDeckCommand = useMemo(() => {
    if (!suggestedDeckId) return '';
    const parts = ['bun run deck:create', '--id', `"${suggestedDeckId}"`];
    if (newDeckTitle.trim()) parts.push('--title', `"${newDeckTitle.trim()}"`);
    if (newDeckAuthor.trim()) parts.push('--author', `"${newDeckAuthor.trim()}"`);
    const themeId = newDeckTheme.trim() || 'default';
    parts.push('--default-theme', `"${themeId}"`);
    return parts.join(' ');
  }, [suggestedDeckId, newDeckTitle, newDeckAuthor, newDeckTheme]);

  const createDeckCommandFallback = useMemo(() => {
    const themeId = newDeckTheme.trim() || 'default';
    return `bun run deck:create --id "my-deck" --title "My Deck" --default-theme "${themeId}"`;
  }, [newDeckTheme]);

  const copyCreateCommand = useCallback(async () => {
    const command = createDeckCommand || createDeckCommandFallback;
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCreateCmd(true);
      setTimeout(() => setCopiedCreateCmd(false), 1400);
    } catch {
      setCopiedCreateCmd(false);
    }
  }, [createDeckCommand, createDeckCommandFallback]);

  if (!activeDeckId) {
    const pickerSurface = isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-200 text-zinc-900';
    const pickerCard = isDarkMode
      ? 'bg-zinc-900 border-zinc-800/60 text-zinc-100'
      : 'bg-white border-zinc-300 text-zinc-900';
    const fieldClass = isDarkMode
      ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
      : 'bg-white border-zinc-300 text-zinc-900';
    const muted = isDarkMode ? 'text-zinc-300' : 'text-zinc-600';
    const faint = isDarkMode ? 'text-zinc-400' : 'text-zinc-500';

    return (
      <div
        className={`h-screen w-screen p-8 flex items-center justify-center ${pickerSurface}`}
      >
        <Card
          className={`relative w-full max-w-5xl rounded-3xl border shadow-[0_8px_40px_rgba(0,0,0,0.35)] px-10 py-9 md:px-12 md:py-11 ${pickerCard}`}
        >
          <Button
            onClick={toggleTheme}
            variant="outline"
            size="icon"
            className={`absolute top-5 right-5 rounded-full ${
              isDarkMode
                ? 'bg-zinc-800 border-zinc-600 text-white'
                : 'bg-amber-100 border-amber-300 text-amber-600'
            }`}
            title={isDarkMode ? 'Switch to light mode (T)' : 'Switch to dark mode (T)'}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <div>
            <h1 className="text-3xl font-semibold" style={{ fontFamily: 'Georgia, serif' }}>
              Choose a deck
            </h1>
            <p className={`text-base mt-2 ${muted}`}>
              Select an existing deck or scaffold a new one.
            </p>
          </div>

          <CardContent className="mt-10 px-0 pb-0">
            <div className="grid gap-10 md:gap-12 md:grid-cols-[1fr_auto_1fr] items-start">
              <section>
              <h2 className={`text-sm uppercase tracking-wide mb-2 ${faint}`}>Open deck</h2>
              {decksCatalog.length ? (
                <>
                  <Select
                    value={selectedDeckId ?? undefined}
                    onValueChange={(value) => setSelectedDeckId(value || null)}
                  >
                    <SelectTrigger className={`h-10 ${fieldClass}`}>
                      <SelectValue placeholder="Select a deck" />
                    </SelectTrigger>
                    <SelectContent className={isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}>
                      {decksCatalog.map((deck) => (
                        <SelectItem key={deck.id} value={deck.id}>
                          {deck.meta.title} ({deck.slides.length} slides)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-2 text-xs space-y-1">
                    <p className={muted}>
                      {decksCatalog.find((d) => d.id === selectedDeckId)?.meta.description ||
                        'No description'}
                    </p>
                    <p className={faint}>
                      Author:{' '}
                      {decksCatalog.find((d) => d.id === selectedDeckId)?.meta.author || 'Unknown'}
                    </p>
                  </div>
                  <Button
                    onClick={() => selectedDeckId && openDeck(selectedDeckId)}
                    disabled={!selectedDeckId}
                    className="mt-5 h-10 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Open deck
                  </Button>
                </>
              ) : (
                <p className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  No decks discovered under `decks/`.
                </p>
              )}
              </section>

              <Separator
                orientation="vertical"
                className={`hidden md:block self-stretch ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`}
              />

              <section>
              <h2 className={`text-sm uppercase tracking-wide mb-2 ${faint}`}>Create new deck</h2>
              <div className="space-y-3">
                <Input
                  type="text"
                  value={newDeckTitle}
                  onChange={(e) => setNewDeckTitle(e.target.value)}
                  placeholder="Deck title"
                  className={`h-10 ${fieldClass}`}
                />
                <Input
                  type="text"
                  value={newDeckAuthor}
                  onChange={(e) => setNewDeckAuthor(e.target.value)}
                  placeholder="Author (optional)"
                  className={`h-10 ${fieldClass}`}
                />
                <Select value={newDeckTheme} onValueChange={setNewDeckTheme}>
                  <SelectTrigger className={`h-10 ${fieldClass}`}>
                    <SelectValue placeholder="default" />
                  </SelectTrigger>
                  <SelectContent className={isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}>
                    {themeOptions.map((themeId) => (
                      <SelectItem key={themeId} value={themeId}>
                        {themeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className={`text-xs mt-3 ${muted}`}>
                Run this in terminal, then restart dev server so Vite picks up new folders.
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] uppercase tracking-wide ${faint}`}>
                    Command
                  </span>
                  <Button
                    onClick={copyCreateCommand}
                    variant="outline"
                    size="sm"
                    className={
                      isDarkMode
                        ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                        : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-zinc-200'
                    }
                    title="Copy command"
                  >
                    {copiedCreateCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCreateCmd ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'border-zinc-600' : 'border-zinc-300'}`}>
                  <SyntaxHighlighter
                    language="bash"
                    style={oneDark}
                    customStyle={{
                      margin: 0,
                      padding: '0.75rem 0.9rem',
                      fontSize: '0.76rem',
                      lineHeight: 1.45,
                      background: isDarkMode ? '#09090b' : '#f4f4f5',
                    }}
                    codeTagProps={{
                      style: {
                        color: isDarkMode ? '#e4e4e7' : '#18181b',
                      },
                    }}
                  >
                    {createDeckCommand || createDeckCommandFallback}
                  </SyntaxHighlighter>
                </div>
              </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={`h-screen w-screen flex items-center justify-center transition-colors duration-300 ${isDarkMode ? 'bg-zinc-950' : 'bg-zinc-200'} ${presentationMode ? 'p-0' : 'p-8'}`}
    >
      {goToSlideOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="go-to-slide-label"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeGoToSlide();
          }}
        >
          <div
            className={`rounded-xl border px-5 py-4 shadow-xl min-w-[280px] ${isDarkMode ? 'bg-zinc-900 border-zinc-600' : 'bg-white border-zinc-300'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <label id="go-to-slide-label" htmlFor="go-to-slide-input" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-zinc-200' : 'text-zinc-800'}`}>
              Go to slide (1–{totalSlides})
            </label>
            <input
              id="go-to-slide-input"
              ref={goToSlideInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 5"
              value={goToSlideValue}
              onChange={(e) => setGoToSlideValue(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitGoToSlide();
                }
              }}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-zinc-950 border-zinc-600 text-white placeholder:text-zinc-500' : 'bg-zinc-50 border-zinc-300 text-zinc-900'}`}
            />
            <p className={`mt-2 text-[11px] ${isDarkMode ? 'text-zinc-500' : 'text-zinc-500'}`}>
              Enter to go · Esc to cancel
            </p>
          </div>
        </div>
      ) : null}
      {/* Outer container - the "device frame" */}
      <div
        className={`w-full h-full flex flex-col overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-zinc-900 border-zinc-800/60' : 'bg-white border-zinc-300'} ${presentationMode ? 'rounded-none border-0 shadow-none' : 'rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.3)] border'}`}
      >
        {/* Title bar */}
        {!presentationMode ? (
        <div className="shrink-0 px-10 py-5 flex items-center justify-between">
          <div className="w-20" />
          <div className="text-center">
            <h1 className={`text-2xl ${isDarkMode ? 'text-white' : 'text-zinc-800'}`} style={{ fontFamily: 'Georgia, serif' }}>
              ✦ {activeDeck?.meta.title ?? 'Markdown Slides'} ✦
            </h1>
            <p className={`text-xs tracking-widest uppercase mt-0.5 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
              ─── Deck Mode ───
            </p>
          </div>
          <div className="flex items-center gap-2 w-48 justify-end flex-wrap">
            <button
              type="button"
              onClick={() => {
                void exitPresentation();
                setActiveDeckId(null);
              }}
              className={`px-2 h-9 text-xs rounded-full border ${isDarkMode ? 'bg-zinc-800/70 border-zinc-600/50 hover:bg-zinc-700 text-white' : 'bg-white/70 border-zinc-300 hover:bg-zinc-200 text-zinc-700'}`}
              title="Back to deck picker"
            >
              Decks
            </button>
            <button
              type="button"
              onClick={() => enterPresentation()}
              className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all duration-200 outline-none ${isDarkMode ? 'bg-zinc-800/70 border-zinc-600/50 hover:bg-zinc-700 text-white' : 'bg-violet-100 border-violet-300 text-violet-700 hover:bg-violet-200'}`}
              title="Presentation mode (P)"
            >
              <Presentation className="w-4 h-4" />
            </button>
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
        ) : null}

        <div ref={presentationContainerRef} className="flex-1 min-h-0 flex flex-col relative min-h-0">
        {/* Inner content area - flips as a whole (perspective on flip layer only so slide nav stays flat / horizontal) */}
        <div className={`flex-1 min-h-0 flex flex-col min-h-0 ${presentationMode ? 'px-0 pb-0 pt-0' : 'px-6 pb-6 pt-1'}`}>
          <AnimatePresence mode="wait" initial={false}>
            {!showWorkingArea ? (
              <motion.div
                key="slide"
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                className={`w-full h-full flex items-center ${presentationMode ? 'gap-0' : 'gap-8 md:gap-10'}`}
                style={{
                  transformPerspective: 1600,
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                }}
              >
                {/* Previous arrow */}
                {!presentationMode ? (
                <button
                  onClick={prevSlide}
                  disabled={currentSlide === 0}
                  className={`relative z-10 shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border transition-colors outline-none disabled:opacity-20 disabled:pointer-events-none ${isDarkMode ? 'border-zinc-700 bg-zinc-800/95 hover:bg-zinc-700 text-white shadow-sm' : 'border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                ) : null}

                {/* Slide card */}
                <div
                  className={`flex-1 h-full min-h-0 relative overflow-hidden ${presentationMode ? 'rounded-none border-0 shadow-none' : `rounded-2xl border ${cardGlow.className}`}`}
                  style={presentationMode ? undefined : cardGlow.style}
                >
                  <SlidePresenter
                    slideContent={currentSlideData?.content ?? '# No content'}
                    slideType={currentSlideData?.type ?? 'md'}
                    currentSlide={currentSlide}
                    deckDefaultTheme={activeDeckDefaultTheme}
                    isDarkMode={isDarkMode}
                    presentationMode={presentationMode}
                    onContentChange={(content) => updateSlideContent(currentSlide, content)}
                    onSourceToggle={setSlideSourceOpen}
                  />
                  {presentationMode ? <PresentationInkLayer isDarkMode={isDarkMode} /> : null}
                </div>

                {/* Next arrow */}
                {!presentationMode ? (
                <button
                  onClick={nextSlide}
                  disabled={currentSlide === totalSlides - 1}
                  className={`relative z-10 shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border transition-colors outline-none disabled:opacity-20 disabled:pointer-events-none ${isDarkMode ? 'border-zinc-700 bg-zinc-800/95 hover:bg-zinc-700 text-white shadow-sm' : 'border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                key="working"
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                className={`w-full h-full min-h-0 relative overflow-hidden ${presentationMode ? 'rounded-none border-0 shadow-none' : `rounded-2xl border ${cardGlow.className}`}`}
                style={{
                  transformPerspective: 1600,
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  ...(presentationMode ? {} : cardGlow.style),
                }}
              >
                <WorkingArea
                  htmlContent={currentSlideData?.workingArea?.content}
                  workingAreaType={currentSlideData?.workingArea?.type}
                  isDarkMode={isDarkMode}
                  presentationMode={presentationMode}
                  onContentChange={(content) => updateWorkingAreaContent(currentSlide, content)}
                  onSourceToggle={setWorkingSourceOpen}
                />
                {presentationMode ? <PresentationInkLayer isDarkMode={isDarkMode} /> : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>

        {/* Footer dots */}
        {!presentationMode ? (
        <div className="shrink-0 pb-6 px-10 pt-1 flex items-center justify-between">
          <span className={`text-[10px] ${isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}`}>← → nav · G go to · E source · Esc close · F flip · T theme · P present</span>
          <div className="flex items-center gap-3">
            <button
              onClick={addSlideAfterCurrent}
              className={`h-7 px-2 rounded border text-xs inline-flex items-center gap-1 ${isDarkMode ? 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
              title="Add slide after current (session-only)"
            >
              <Plus className="w-3 h-3" />
              Add Slide
            </button>
            <button
              onClick={addWorkingAreaToCurrent}
              disabled={hasWorkingArea}
              className={`h-7 px-2 rounded border text-xs inline-flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none ${isDarkMode ? 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
              title={hasWorkingArea ? 'Working area already exists for this slide' : 'Add working area to current slide (session-only)'}
            >
              <Plus className="w-3 h-3" />
              Add Working Area
            </button>
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
            {activeDeck?.meta.author ? `☻ ${activeDeck.meta.author}` : '☻ Markdown Slider'}
            {activeDeck?.meta.date ? ` · ◈ ${activeDeck.meta.date}` : ''}
          </span>
        </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;