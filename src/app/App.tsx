import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sun,
  Moon,
  FolderOpen,
  Copy,
  Check,
  Presentation,
  Pencil,
  Library,
  MessageSquare,
  FilePlus,
  PanelsTopLeft,
  Download,
} from 'lucide-react';
import { stringify as yamlStringify } from 'yaml';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { SlidePresenter } from './components/SlidePresenter';
import { WorkingArea } from './components/WorkingArea';
import { PresentationInkLayer } from './components/PresentationInkLayer';
import { SpeakerNotesSheet } from './components/SpeakerNotesSheet';
import { loadDecks, getDefaultDeckId, SlideData, DeckMeta } from './slideLoader';
import { formatDeckMetaDateDisplay } from './formatDeckMetaDateDisplay';
import {
  pingDeckDevApi,
  saveDeckFile,
  saveDeckMetadataToDisk,
  createSlideAfterDeck,
  createWorkingAreaOnDisk,
  relativePathForSlideFile,
  relativePathForWorkingAreaFile,
  relativePathForSpeakerNotes,
  fetchDeckFromDevApi,
} from './deckPersistence';
import {
  getRegisteredFontIds,
  getRegisteredPaletteIds,
  getRegisteredThemeIds,
  parseSlideMarkdown,
  type DeckSlideThemeDefaults,
} from './slideThemes';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { Label } from './components/ui/label';
import { cn } from './components/ui/utils';
import { Progress } from './components/ui/progress';
import { captureDeckFramesToPdf, downloadPdfBytes } from './browserPdfExport';

const DECK_META_OVERRIDES_KEY = 'markdown-slider:deck-meta-overrides';

function loadDeckMetaOverrides(): Record<string, Partial<DeckMeta>> {
  try {
    const raw = localStorage.getItem(DECK_META_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<DeckMeta>>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function mergeDeckMeta(base: DeckMeta, override: Partial<DeckMeta> | undefined): DeckMeta {
  if (!override) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

function buildMetadataYamlSnippet(meta: DeckMeta): string {
  const doc: Record<string, unknown> = {
    title: meta.title,
  };
  if (meta.subtitle !== undefined && meta.subtitle !== '') doc.subtitle = meta.subtitle;
  if (meta.author) doc.author = meta.author;
  if (meta.date) doc.date = meta.date;
  if (meta.defaultTheme) doc.defaultTheme = meta.defaultTheme;
  if (meta.defaultPalette) doc.defaultPalette = meta.defaultPalette;
  if (meta.defaultFont) doc.defaultFont = meta.defaultFont;
  if (meta.description) doc.description = meta.description;
  if (meta.tags?.length) doc.tags = meta.tags;
  const body = yamlStringify(doc).trimEnd();
  return `---\n${body}\n---\n`;
}

const INITIAL_DECKS = loadDecks();

/**
 * When `?pdfExport=1&deck=<id>` is present, open that deck synchronously on first paint.
 * Otherwise Playwright can run before `useEffect` auto-open, so `[data-ms-slide-frame]` never appears in time.
 */
function getInitialDeckStateForPdfExportUrl(): { activeDeckId: string | null; slidesData: SlideData[] } {
  if (typeof window === 'undefined') return { activeDeckId: null, slidesData: [] };
  const p = new URLSearchParams(window.location.search);
  if (p.get('pdfExport') !== '1') return { activeDeckId: null, slidesData: [] };
  const id = p.get('deck');
  if (!id || !INITIAL_DECKS.some((d) => d.id === id)) return { activeDeckId: null, slidesData: [] };
  const deck = INITIAL_DECKS.find((d) => d.id === id)!;
  return {
    activeDeckId: deck.id,
    slidesData: deck.slides.map((slide) => ({
      ...slide,
      workingArea: slide.workingArea ? { ...slide.workingArea } : undefined,
    })),
  };
}

const PDF_EXPORT_URL_BOOTSTRAP = getInitialDeckStateForPdfExportUrl();

const paletteOptions = getRegisteredPaletteIds();
const fontOptions = getRegisteredFontIds();
const themeOptions = getRegisteredThemeIds();
const deckFromUrl = new URLSearchParams(window.location.search).get('deck');
const initialDeckId =
  (deckFromUrl && INITIAL_DECKS.some((d) => d.id === deckFromUrl) && deckFromUrl) ||
  getDefaultDeckId(INITIAL_DECKS);

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
  const [decksCatalog, setDecksCatalog] = useState(INITIAL_DECKS);
  const [devPersistenceEnabled, setDevPersistenceEnabled] = useState(false);
  const [slideSavePending, setSlideSavePending] = useState(false);
  const [workingSavePending, setWorkingSavePending] = useState(false);
  const [speakerNotesSavePending, setSpeakerNotesSavePending] = useState(false);
  const [metaSavePending, setMetaSavePending] = useState(false);

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initialDeckId);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(() => PDF_EXPORT_URL_BOOTSTRAP.activeDeckId);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showWorkingArea, setShowWorkingArea] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [slidesData, setSlidesData] = useState<SlideData[]>(() => PDF_EXPORT_URL_BOOTSTRAP.slidesData);
  const [slideSourceOpen, setSlideSourceOpen] = useState(false);
  const [speakerNotesOpen, setSpeakerNotesOpen] = useState(false);
  const [workingSourceOpen, setWorkingSourceOpen] = useState(false);
  const [goToSlideOpen, setGoToSlideOpen] = useState(false);
  const [goToSlideValue, setGoToSlideValue] = useState('');
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [newDeckAuthor, setNewDeckAuthor] = useState('');
  const [newDeckPalette, setNewDeckPalette] = useState('default');
  const [newDeckFont, setNewDeckFont] = useState('libre-baskerville-franklin');
  const [copiedCreateCmd, setCopiedCreateCmd] = useState(false);
  const [deckMetaOverrides, setDeckMetaOverrides] = useState<Record<string, Partial<DeckMeta>>>(loadDeckMetaOverrides);
  const [deckMetaDialogOpen, setDeckMetaDialogOpen] = useState(false);
  const [deckMetaForm, setDeckMetaForm] = useState({
    title: '',
    subtitle: '',
    author: '',
    date: '',
    description: '',
    defaultTheme: '',
    defaultPalette: '',
    defaultFont: '',
  });
  const [copiedMetaYaml, setCopiedMetaYaml] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const goToSlideInputRef = useRef<HTMLInputElement>(null);
  const autoOpenedDeckFromUrlRef = useRef(false);
  /** PDF/Playwright export: full-viewport slide only (no chrome). Set via `?pdfExport=1`. */
  const [pdfExportMode] = useState(() => new URLSearchParams(window.location.search).get('pdfExport') === '1');
  /** In-browser PDF download from deck picker: same chromeless layout as URL `pdfExport=1`. */
  const [inAppPdfExport, setInAppPdfExport] = useState(false);
  const chromelessPdfExport = pdfExportMode || inAppPdfExport;
  /** Set when user starts an in-browser PDF export; cleared when done (not on Strict Mode abort so remount can run). */
  const [browserPdfExportIntent, setBrowserPdfExportIntent] = useState<{ deckId: string } | null>(null);
  const [browserPdfExportProgress, setBrowserPdfExportProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  useEffect(() => {
    void pingDeckDevApi().then(setDevPersistenceEnabled);
  }, []);

  /** PDF export automation: slide vs working-area when chrome is hidden (`?pdfExport=1`). */
  useEffect(() => {
    if (!chromelessPdfExport || !activeDeckId) {
      delete document.documentElement.dataset.msPdfExportView;
      return;
    }
    document.documentElement.dataset.msPdfExportView = showWorkingArea ? 'working' : 'slide';
  }, [chromelessPdfExport, activeDeckId, showWorkingArea]);

  useEffect(() => {
    if (!chromelessPdfExport) return;
    setSlideSourceOpen(false);
    setWorkingSourceOpen(false);
    setGoToSlideOpen(false);
    setSpeakerNotesOpen(false);
    setDeckMetaDialogOpen(false);
  }, [chromelessPdfExport]);

  const activeDeck = useMemo(
    () => decksCatalog.find((deck) => deck.id === activeDeckId) ?? null,
    [activeDeckId],
  );
  const effectiveDeckMeta = useMemo(() => {
    if (!activeDeck) return null;
    return mergeDeckMeta(activeDeck.meta, deckMetaOverrides[activeDeck.id]);
  }, [activeDeck, deckMetaOverrides]);

  const selectedDeckMergedMeta = useMemo(() => {
    if (!selectedDeckId) return null;
    const deck = decksCatalog.find((d) => d.id === selectedDeckId);
    if (!deck) return null;
    return mergeDeckMeta(deck.meta, deckMetaOverrides[deck.id]);
  }, [selectedDeckId, deckMetaOverrides]);

  /** Hide scaffold placeholder `New deck`; show real descriptions as italic + justified. */
  const openDeckDescriptionPreview = useMemo(() => {
    const raw = selectedDeckMergedMeta?.description?.trim() ?? '';
    if (!raw || raw.toLowerCase() === 'new deck') return null;
    return raw;
  }, [selectedDeckMergedMeta]);

  const openDeckDateLabel = useMemo(
    () => formatDeckMetaDateDisplay(selectedDeckMergedMeta?.date),
    [selectedDeckMergedMeta?.date],
  );

  const deckChromeDateLabel = useMemo(
    () => formatDeckMetaDateDisplay(effectiveDeckMeta?.date),
    [effectiveDeckMeta?.date],
  );

  const totalSlides = slidesData.length;
  const currentSlideData = slidesData[currentSlide];
  const hasWorkingArea = !!currentSlideData?.workingArea;

  const pdfExportGoToSlide = useCallback(
    (index1Based: number) => {
      if (!activeDeckId || totalSlides < 1) return;
      const idx = Math.max(0, Math.min(index1Based - 1, totalSlides - 1));
      setShowWorkingArea(false);
      setCurrentSlide(idx);
    },
    [activeDeckId, totalSlides],
  );

  useEffect(() => {
    if (!chromelessPdfExport || !activeDeckId) {
      delete (window as unknown as { __markdownSliderPdfExport?: unknown }).__markdownSliderPdfExport;
      return;
    }
    (window as unknown as { __markdownSliderPdfExport: { goToSlide: (n: number) => void } }).__markdownSliderPdfExport =
      { goToSlide: pdfExportGoToSlide };
    return () => {
      delete (window as unknown as { __markdownSliderPdfExport?: unknown }).__markdownSliderPdfExport;
    };
  }, [chromelessPdfExport, activeDeckId, pdfExportGoToSlide]);

  const activeDeckThemeDefaults = useMemo((): DeckSlideThemeDefaults | undefined => {
    if (!activeDeck) return undefined;
    const m = mergeDeckMeta(activeDeck.meta, deckMetaOverrides[activeDeck.id]);
    return {
      defaultTheme: m.defaultTheme,
      defaultPalette: m.defaultPalette,
      defaultFont: m.defaultFont,
    };
  }, [activeDeck, deckMetaOverrides]);

  /** Same palette/font/theme resolution as the main slide — used for working area preview. */
  const currentSlideResolvedTheme = useMemo(() => {
    const raw = currentSlideData?.type === 'md' ? (currentSlideData?.content ?? '') : '';
    return parseSlideMarkdown(raw, isDarkMode, activeDeckThemeDefaults).theme;
  }, [currentSlideData?.content, currentSlideData?.type, isDarkMode, activeDeckThemeDefaults]);

  useEffect(() => {
    try {
      localStorage.setItem(DECK_META_OVERRIDES_KEY, JSON.stringify(deckMetaOverrides));
    } catch {
      /* ignore quota / private mode */
    }
  }, [deckMetaOverrides]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const openDeckMetaDialog = useCallback(() => {
    if (!activeDeck) return;
    const m = mergeDeckMeta(activeDeck.meta, deckMetaOverrides[activeDeck.id]);
    setDeckMetaForm({
      title: m.title,
      subtitle: m.subtitle ?? '',
      author: m.author ?? '',
      date: m.date || new Date().toISOString().slice(0, 10),
      description: m.description ?? '',
      defaultTheme: m.defaultTheme ?? '',
      defaultPalette: m.defaultPalette ?? '',
      defaultFont: m.defaultFont ?? '',
    });
    setDeckMetaDialogOpen(true);
  }, [activeDeck, deckMetaOverrides]);

  const saveDeckMetaDialog = useCallback(async () => {
    if (!activeDeck) return;

    const mergedBase = mergeDeckMeta(activeDeck.meta, deckMetaOverrides[activeDeck.id]);
    const meta: DeckMeta = {
      ...mergedBase,
      id: activeDeck.id,
      title: deckMetaForm.title.trim() || activeDeck.meta.title,
      subtitle: deckMetaForm.subtitle.trim(),
      author: deckMetaForm.author.trim() || '',
      date: deckMetaForm.date.trim() || '',
      description: deckMetaForm.description.trim() || '',
      defaultTheme: deckMetaForm.defaultTheme.trim() || '',
      defaultPalette: deckMetaForm.defaultPalette.trim() || '',
      defaultFont: deckMetaForm.defaultFont.trim() || '',
    };

    if (devPersistenceEnabled) {
      setMetaSavePending(true);
      try {
        const deck = await saveDeckMetadataToDisk(activeDeck.id, meta);
        if (deck) {
          setDecksCatalog((prev) => prev.map((d) => (d.id === deck.id ? deck : d)));
        }
        setDeckMetaOverrides((prev) => {
          const next = { ...prev };
          delete next[activeDeck.id];
          return next;
        });
        setDeckMetaDialogOpen(false);
        toast.success('Saved to metadata.md');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save metadata');
      } finally {
        setMetaSavePending(false);
      }
      return;
    }

    setDeckMetaOverrides((prev) => ({
      ...prev,
      [activeDeck.id]: {
        title: deckMetaForm.title.trim() || activeDeck.meta.title,
        subtitle: deckMetaForm.subtitle.trim(),
        author: deckMetaForm.author.trim() || '',
        date: deckMetaForm.date.trim() || '',
        description: deckMetaForm.description.trim() || '',
        defaultTheme: deckMetaForm.defaultTheme.trim() || '',
        defaultPalette: deckMetaForm.defaultPalette.trim() || '',
        defaultFont: deckMetaForm.defaultFont.trim() || '',
      },
    }));
    setDeckMetaDialogOpen(false);
  }, [activeDeck, deckMetaForm, deckMetaOverrides, devPersistenceEnabled]);

  const resetDeckMetaToFile = useCallback(() => {
    if (!activeDeck) return;
    setDeckMetaOverrides((prev) => {
      const next = { ...prev };
      delete next[activeDeck.id];
      return next;
    });
    setDeckMetaDialogOpen(false);
  }, [activeDeck]);

  const copyDeckMetaYaml = useCallback(async () => {
    if (!activeDeck) return;
    const baseMerged = mergeDeckMeta(activeDeck.meta, deckMetaOverrides[activeDeck.id]);
    const preview: DeckMeta = deckMetaDialogOpen
      ? mergeDeckMeta(baseMerged, {
          title: deckMetaForm.title.trim() || activeDeck.meta.title,
          subtitle: deckMetaForm.subtitle.trim(),
          author: deckMetaForm.author.trim() || '',
          date: deckMetaForm.date.trim() || '',
          description: deckMetaForm.description.trim() || '',
        })
      : baseMerged;
    const text = buildMetadataYamlSnippet(preview);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMetaYaml(true);
      setTimeout(() => setCopiedMetaYaml(false), 2000);
    } catch {
      setCopiedMetaYaml(false);
    }
  }, [activeDeck, deckMetaDialogOpen, deckMetaForm, deckMetaOverrides]);

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
    setSpeakerNotesOpen(false);
    setPresentationMode(false);
    void exitFullscreenDom();
    setActiveDeckId(deck.id);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('deck', deck.id);
    window.history.replaceState({}, '', nextUrl.toString());
  }, [decksCatalog]);

  const handleDownloadDeckPdf = useCallback(() => {
    if (!selectedDeckId) return;
    const deck = decksCatalog.find((d) => d.id === selectedDeckId);
    if (!deck) return;
    setBrowserPdfExportIntent({ deckId: selectedDeckId });
    setBrowserPdfExportProgress({ current: 0, total: deck.slides.length });
    setInAppPdfExport(true);
    openDeck(selectedDeckId);
  }, [selectedDeckId, decksCatalog, openDeck]);

  /** When landing with `?deck=<id>`, open that deck once (automation + shareable links). PDF export may already hydrate from `PDF_EXPORT_URL_BOOTSTRAP`. */
  useEffect(() => {
    if (autoOpenedDeckFromUrlRef.current) return;
    const id = new URLSearchParams(window.location.search).get('deck');
    if (!id || !INITIAL_DECKS.some((d) => d.id === id)) {
      autoOpenedDeckFromUrlRef.current = true;
      return;
    }
    if (pdfExportMode && activeDeckId === id) {
      autoOpenedDeckFromUrlRef.current = true;
      return;
    }
    autoOpenedDeckFromUrlRef.current = true;
    openDeck(id);
  }, [openDeck, activeDeckId, pdfExportMode]);

  useEffect(() => {
    if (!browserPdfExportIntent || activeDeckId !== browserPdfExportIntent.deckId) return;
    if (totalSlides < 1) return;

    const ac = new AbortController();

    (async () => {
      try {
        const bytes = await captureDeckFramesToPdf({
          totalSlides,
          goToSlide: pdfExportGoToSlide,
          onProgress: (current, total) => {
            if (!ac.signal.aborted) setBrowserPdfExportProgress({ current, total });
          },
          shouldAbort: () => ac.signal.aborted,
        });
        if (ac.signal.aborted) return;
        const title = effectiveDeckMeta?.title ?? activeDeckId ?? 'deck';
        const base = title
          .replace(/[^\w\-]+/g, '-')
          .replace(/^-+|-+$/g, '');
        downloadPdfBytes(bytes, `${base || 'deck'}.pdf`);
        toast.success('PDF downloaded');
      } catch (e) {
        if (ac.signal.aborted) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        toast.error(e instanceof Error ? e.message : 'Could not build PDF');
      } finally {
        if (!ac.signal.aborted) {
          setInAppPdfExport(false);
          setBrowserPdfExportIntent(null);
          setBrowserPdfExportProgress(null);
        }
      }
    })();

    return () => ac.abort();
  }, [browserPdfExportIntent, activeDeckId, totalSlides, pdfExportGoToSlide]);

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

  const updateSpeakerNotesContent = useCallback((slideIndex: number, content: string) => {
    setSlidesData((prev) =>
      prev.map((s, i) => (i === slideIndex ? { ...s, speakerNotes: content } : s)),
    );
  }, []);

  const handleSaveSlideSource = useCallback(async () => {
    if (!activeDeckId || !currentSlideData || !devPersistenceEnabled) return;
    setSlideSavePending(true);
    try {
      const rel = relativePathForSlideFile(currentSlideData.id, currentSlideData.type);
      await saveDeckFile(activeDeckId, rel, currentSlideData.content);
      const deck = await fetchDeckFromDevApi(activeDeckId);
      if (deck) {
        setDecksCatalog((prev) => prev.map((d) => (d.id === deck.id ? deck : d)));
        setSlidesData(
          deck.slides.map((slide) => ({
            ...slide,
            workingArea: slide.workingArea ? { ...slide.workingArea } : undefined,
          })),
        );
      }
      toast.success('Slide saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save slide');
    } finally {
      setSlideSavePending(false);
    }
  }, [activeDeckId, currentSlideData, devPersistenceEnabled]);

  const handleSaveWorkingAreaSource = useCallback(async () => {
    if (!activeDeckId || !currentSlideData?.workingArea || !devPersistenceEnabled) return;
    setWorkingSavePending(true);
    try {
      const wa = currentSlideData.workingArea;
      const rel = relativePathForWorkingAreaFile(currentSlideData.id, wa.type);
      await saveDeckFile(activeDeckId, rel, wa.content);
      const deck = await fetchDeckFromDevApi(activeDeckId);
      if (deck) {
        setDecksCatalog((prev) => prev.map((d) => (d.id === deck.id ? deck : d)));
        setSlidesData(
          deck.slides.map((slide) => ({
            ...slide,
            workingArea: slide.workingArea ? { ...slide.workingArea } : undefined,
          })),
        );
      }
      toast.success('Working area saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save working area');
    } finally {
      setWorkingSavePending(false);
    }
  }, [activeDeckId, currentSlideData, devPersistenceEnabled]);

  const handleSaveSpeakerNotes = useCallback(async () => {
    if (!activeDeckId || !currentSlideData || !devPersistenceEnabled) return;
    setSpeakerNotesSavePending(true);
    try {
      const rel = relativePathForSpeakerNotes(currentSlideData.id);
      const content = currentSlideData.speakerNotes ?? '';
      await saveDeckFile(activeDeckId, rel, content);
      const deck = await fetchDeckFromDevApi(activeDeckId);
      if (deck) {
        setDecksCatalog((prev) => prev.map((d) => (d.id === deck.id ? deck : d)));
        setSlidesData(
          deck.slides.map((slide) => ({
            ...slide,
            workingArea: slide.workingArea ? { ...slide.workingArea } : undefined,
          })),
        );
      }
      toast.success('Speaker notes saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save speaker notes');
    } finally {
      setSpeakerNotesSavePending(false);
    }
  }, [activeDeckId, currentSlideData, devPersistenceEnabled]);

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

  const addSlideAfterCurrent = useCallback(async () => {
    if (!activeDeckId || totalSlides < 1) return;
    const afterSlide = slidesData[currentSlide];
    if (!afterSlide) return;

    if (!devPersistenceEnabled) {
      toast.error('Adding slides to disk requires the Vite dev server (bun run dev).');
      return;
    }

    try {
      const deck = await createSlideAfterDeck(activeDeckId, afterSlide.id);
      setDecksCatalog((prev) => prev.map((d) => (d.id === deck.id ? deck : d)));
      const newIndex = currentSlide + 1;
      setSlidesData(
        deck.slides.map((slide) => ({
          ...slide,
          workingArea: slide.workingArea ? { ...slide.workingArea } : undefined,
        })),
      );
      setCurrentSlide(Math.min(newIndex, deck.slides.length - 1));
      setShowWorkingArea(false);
      toast.success('New slide added on disk');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add slide');
    }
  }, [activeDeckId, currentSlide, devPersistenceEnabled, slidesData, totalSlides]);

  const addWorkingAreaToCurrent = useCallback(async () => {
    if (!activeDeckId || totalSlides < 1) return;
    const slide = slidesData[currentSlide];
    if (!slide || slide.workingArea) return;

    if (!devPersistenceEnabled) {
      toast.error('Adding a working area on disk requires the Vite dev server (bun run dev).');
      return;
    }

    try {
      const deck = await createWorkingAreaOnDisk(activeDeckId, slide.id);
      setDecksCatalog((prev) => prev.map((d) => (d.id === deck.id ? deck : d)));
      setSlidesData(
        deck.slides.map((s) => ({
          ...s,
          workingArea: s.workingArea ? { ...s.workingArea } : undefined,
        })),
      );
      setShowWorkingArea(true);
      toast.success('Working area created on disk');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add working area');
    }
  }, [activeDeckId, currentSlide, devPersistenceEnabled, slidesData, totalSlides]);

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

  const goToDeckPicker = useCallback(() => {
    void exitPresentation();
    setActiveDeckId(null);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('deck');
    window.history.replaceState({}, '', nextUrl.toString());
  }, [exitPresentation]);

  const enterPresentation = useCallback(() => {
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
      void requestFullscreenDom(document.documentElement);
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
      if (deckMetaDialogOpen) return;
      if (chromelessPdfExport && activeDeckId) return;

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

      if (speakerNotesOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setSpeakerNotesOpen(false);
          return;
        }
        if ((e.key === 'e' || e.key === 'E') && !e.metaKey && !e.ctrlKey && !e.altKey) {
          if (tag !== 'TEXTAREA' && tag !== 'INPUT') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('markdown-slider:speaker-notes-edit'));
          }
          return;
        }
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
          if (slideSourceOpen || workingSourceOpen) {
            window.dispatchEvent(new CustomEvent('markdown-slider:toggle-source'));
            return;
          }
          void exitPresentation();
          return;
        }
        if (e.key === 'n' || e.key === 'N') {
          if (!e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            setSpeakerNotesOpen((o) => !o);
          }
          return;
        }
      }

      if (e.key === 'n' || e.key === 'N') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          setSpeakerNotesOpen((o) => !o);
        }
        return;
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
    deckMetaDialogOpen,
    speakerNotesOpen,
    chromelessPdfExport,
    activeDeckId,
  ]);

  // State-colored border + glow (same logic in light and dark; base shadow only differs)
  const getCardGlow = (isDark: boolean): { className: string; style: React.CSSProperties } => {
    if (chromelessPdfExport) {
      return { className: '', style: {} };
    }
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
    const paletteId = newDeckPalette.trim() || 'default';
    const fontId = newDeckFont.trim() || 'libre-baskerville-franklin';
    parts.push('--default-palette', `"${paletteId}"`);
    parts.push('--default-font', `"${fontId}"`);
    return parts.join(' ');
  }, [suggestedDeckId, newDeckTitle, newDeckAuthor, newDeckPalette, newDeckFont]);

  const createDeckCommandFallback = useMemo(() => {
    const paletteId = newDeckPalette.trim() || 'default';
    const fontId = newDeckFont.trim() || 'libre-baskerville-franklin';
    return `bun run deck:create --id "my-deck" --title "My Deck" --default-palette "${paletteId}" --default-font "${fontId}"`;
  }, [newDeckPalette, newDeckFont]);

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
        className={`h-screen w-screen min-w-0 overflow-x-hidden p-4 sm:p-8 flex items-center justify-center ${pickerSurface}`}
      >
        <Card
          className={`relative w-full min-w-0 max-w-5xl rounded-3xl border shadow-[0_8px_40px_rgba(0,0,0,0.35)] px-6 py-8 sm:px-10 sm:py-9 md:px-12 md:py-11 ${pickerCard}`}
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

          <CardContent className="mt-10 min-w-0 px-0 pb-0">
            <div className="grid min-w-0 gap-10 md:gap-12 md:grid-cols-[minmax(0,0.66fr)_auto_minmax(0,1.34fr)] items-start">
              <section className="min-w-0 max-w-full">
              <h2 className={`text-sm uppercase tracking-wide mb-2 ${faint}`}>Open deck</h2>
              {decksCatalog.length ? (
                <>
                  <Select
                    value={selectedDeckId ?? undefined}
                    onValueChange={(value) => setSelectedDeckId(value || null)}
                  >
                    <SelectTrigger className={`h-10 w-full min-w-0 max-w-full ${fieldClass}`}>
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
                  <div className="mt-2 text-xs">
                    {openDeckDescriptionPreview ? (
                      <p
                        className={`${muted} italic text-justify leading-relaxed mt-3 mb-1.5`}
                      >
                        {openDeckDescriptionPreview}
                      </p>
                    ) : null}
                    <p className={`${faint} text-right`}>
                      Author:{' '}
                      {selectedDeckMergedMeta?.author || 'Unknown'}
                      {openDeckDateLabel ? ` · ${openDeckDateLabel}` : ''}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-row flex-nowrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDownloadDeckPdf}
                      disabled={!selectedDeckId || browserPdfExportProgress !== null}
                      size="lg"
                      className="gap-2 shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </Button>
                    <Button
                      onClick={() => selectedDeckId && openDeck(selectedDeckId)}
                      disabled={!selectedDeckId || browserPdfExportProgress !== null}
                      size="lg"
                      className="gap-2 shrink-0"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Open deck
                    </Button>
                  </div>
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

              <section className="min-w-0 max-w-full">
              <h2 className={`text-sm uppercase tracking-wide mb-2 ${faint}`}>Create new deck</h2>
              <div className="space-y-3 min-w-0">
                <Input
                  type="text"
                  value={newDeckTitle}
                  onChange={(e) => setNewDeckTitle(e.target.value)}
                  placeholder="Deck title"
                  className={`h-10 w-full min-w-0 max-w-full box-border ${fieldClass}`}
                />
                <Input
                  type="text"
                  value={newDeckAuthor}
                  onChange={(e) => setNewDeckAuthor(e.target.value)}
                  placeholder="Author (optional)"
                  className={`h-10 w-full min-w-0 max-w-full box-border ${fieldClass}`}
                />
                <Select value={newDeckPalette} onValueChange={setNewDeckPalette}>
                  <SelectTrigger className={`h-10 w-full min-w-0 max-w-full ${fieldClass}`}>
                    <SelectValue placeholder="Palette" />
                  </SelectTrigger>
                  <SelectContent className={isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}>
                    {paletteOptions.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newDeckFont} onValueChange={setNewDeckFont}>
                  <SelectTrigger className={`h-10 w-full min-w-0 max-w-full ${fieldClass}`}>
                    <SelectValue placeholder="Font pack" />
                  </SelectTrigger>
                  <SelectContent className={isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}>
                    {fontOptions.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
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
                <div
                  className={`rounded-lg border max-w-full min-w-0 overflow-hidden ${isDarkMode ? 'border-zinc-600' : 'border-zinc-300'}`}
                >
                  <SyntaxHighlighter
                    language="bash"
                    style={oneDark}
                    customStyle={{
                      margin: 0,
                      padding: '0.75rem 0.9rem',
                      fontSize: '0.76rem',
                      lineHeight: 1.45,
                      background: isDarkMode ? '#09090b' : '#f4f4f5',
                      minWidth: 0,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                    codeTagProps={{
                      style: {
                        color: isDarkMode ? '#e4e4e7' : '#18181b',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
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

  const speakerNotesSheet =
    activeDeckId && currentSlideData && !chromelessPdfExport ? (
      <SpeakerNotesSheet
        key={currentSlideData.id}
        open={speakerNotesOpen}
        onOpenChange={setSpeakerNotesOpen}
        deckId={activeDeckId}
        slideId={currentSlideData.id}
        value={currentSlideData.speakerNotes ?? ''}
        onChange={(content) => updateSpeakerNotesContent(currentSlide, content)}
        persistenceEnabled={devPersistenceEnabled}
        onSave={handleSaveSpeakerNotes}
        savePending={speakerNotesSavePending}
        isDarkMode={isDarkMode}
      />
    ) : null;

  return (
    <div
      className={`h-screen w-screen transition-colors duration-300 ${
        chromelessPdfExport
          ? 'p-0'
          : 'flex items-center justify-center p-8'
      } ${isDarkMode ? 'bg-zinc-950' : 'bg-zinc-200'}`}
    >
      {browserPdfExportProgress && inAppPdfExport ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className={`rounded-xl border px-6 py-5 shadow-xl w-[min(100%,22rem)] ${isDarkMode ? 'bg-zinc-900 border-zinc-600' : 'bg-white border-zinc-300'}`}
          >
            <p className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-zinc-100' : 'text-zinc-900'}`}>
              Exporting PDF…
            </p>
            <Progress
              value={
                browserPdfExportProgress.total > 0
                  ? (browserPdfExportProgress.current / browserPdfExportProgress.total) * 100
                  : 0
              }
              className="h-2"
            />
            <p className={`mt-2 text-xs tabular-nums ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
              {browserPdfExportProgress.current === browserPdfExportProgress.total
                ? 'Finishing…'
                : `Slide ${browserPdfExportProgress.current + 1} of ${browserPdfExportProgress.total}`}
            </p>
          </div>
        </div>
      ) : null}
      {goToSlideOpen && !chromelessPdfExport ? (
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
      <div
        className={`w-full h-full flex flex-col overflow-hidden transition-colors duration-300 ${
          chromelessPdfExport
            ? `rounded-none border-0 shadow-none ${isDarkMode ? 'bg-zinc-900' : 'bg-white'}`
            : `rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.3)] border ${isDarkMode ? 'bg-zinc-900 border-zinc-800/60' : 'bg-white border-zinc-300'}`
        }`}
      >
        {activeDeckId && chromelessPdfExport ? (
          <span id="ms-export-slide-meta" className="sr-only" aria-hidden>
            {currentSlide + 1} / {totalSlides}
          </span>
        ) : null}
        {/* Title bar — deck name uses same hue as chrome, stepped down with opacity (not flat gray) */}
        <div
          className={`shrink-0 px-6 py-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 ${chromelessPdfExport ? 'hidden' : ''}`}
        >
          <div
            className={`min-w-0 flex justify-start ${
              showWorkingArea
                ? ''
                : 'ml-[calc(theme(spacing.10)+theme(spacing.8))] md:ml-[calc(theme(spacing.10)+theme(spacing.10))]'
            }`}
          >
            <button
              type="button"
              onClick={openDeckMetaDialog}
              className={`shrink-0 p-2 rounded-full border transition-colors outline-none ${isDarkMode ? 'bg-zinc-800/70 border-zinc-600/50 hover:bg-zinc-700 text-white' : 'bg-white/70 border-zinc-300 hover:bg-zinc-200 text-zinc-700'}`}
              title="Edit deck metadata"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <div className="min-w-0 max-w-[min(100vw-10rem,42rem)] text-center justify-self-center px-2">
            <h1
              className={`text-3xl md:text-4xl font-normal leading-tight ${
                isDarkMode ? 'text-white/78' : 'text-zinc-950/78'
              }`}
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              {effectiveDeckMeta?.title ?? 'Markdown Slides'}
            </h1>
            {effectiveDeckMeta?.subtitle ? (
              <p
                className={`text-xs md:text-sm tracking-wide uppercase mt-1 ${
                  isDarkMode ? 'text-white/48' : 'text-zinc-950/55'
                }`}
              >
                ─── {effectiveDeckMeta.subtitle} ───
              </p>
            ) : null}
          </div>
          <div
            className={`min-w-0 flex items-center gap-2 justify-end justify-self-end flex-wrap ${
              showWorkingArea
                ? ''
                : 'mr-[calc(theme(spacing.10)+theme(spacing.8))] md:mr-[calc(theme(spacing.10)+theme(spacing.10))]'
            }`}
          >
            <button
              type="button"
              onClick={goToDeckPicker}
              className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all duration-200 outline-none ${isDarkMode ? 'bg-zinc-800/70 border-zinc-600/50 hover:bg-zinc-700 text-white' : 'bg-white/70 border-zinc-300 hover:bg-zinc-200 text-zinc-700'}`}
              title="Back to deck picker"
              aria-label="Back to deck picker"
            >
              <Library className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSpeakerNotesOpen((o) => !o)}
              className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all duration-200 outline-none ${
                speakerNotesOpen
                  ? isDarkMode
                    ? 'bg-emerald-900/80 border-emerald-500/50 text-emerald-100'
                    : 'bg-emerald-100 border-emerald-400 text-emerald-800'
                  : isDarkMode
                    ? 'bg-zinc-800/70 border-zinc-600/50 hover:bg-zinc-700 text-white'
                    : 'bg-white/70 border-zinc-300 hover:bg-zinc-200 text-zinc-700'
              }`}
              title={speakerNotesOpen ? 'Close speaker notes (Esc or N)' : 'Speaker notes (N)'}
              aria-label={speakerNotesOpen ? 'Close speaker notes' : 'Open speaker notes'}
              aria-pressed={speakerNotesOpen}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (presentationMode) void exitPresentation();
                else enterPresentation();
              }}
              className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all duration-200 outline-none ${isDarkMode ? 'bg-zinc-800/70 border-zinc-600/50 hover:bg-zinc-700 text-white' : 'bg-violet-100 border-violet-300 text-violet-700 hover:bg-violet-200'}`}
              title={presentationMode ? 'Exit presentation (Esc or P)' : 'Presentation mode (P)'}
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

        {/* Inner content area - flips as a whole (perspective on flip layer only so slide nav stays flat / horizontal) */}
        <div
          className={`flex-1 min-h-0 flex flex-col min-h-0 relative ${chromelessPdfExport ? 'p-0' : 'px-6 pb-6 pt-1'}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {!showWorkingArea ? (
              <motion.div
                key="slide"
                initial={chromelessPdfExport ? false : { rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={chromelessPdfExport ? { opacity: 1 } : { rotateY: 90, opacity: 0 }}
                transition={{ duration: chromelessPdfExport ? 0 : 0.32, ease: [0.4, 0, 0.2, 1] }}
                className={`w-full h-full flex items-center ${chromelessPdfExport ? 'gap-0' : 'gap-8 md:gap-10'}`}
                style={{
                  transformPerspective: 1600,
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                }}
              >
                {/* Previous arrow */}
                {!chromelessPdfExport ? (
                  <button
                    onClick={prevSlide}
                    disabled={currentSlide === 0}
                    className={`relative z-10 shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border transition-colors outline-none disabled:opacity-0 disabled:pointer-events-none ${isDarkMode ? 'border-zinc-700 bg-zinc-800/95 hover:bg-zinc-700 text-white shadow-sm' : 'border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                ) : null}

                {/* Slide card */}
                <div
                  data-ms-slide-frame
                  className={`flex-1 h-full min-w-0 min-h-0 relative overflow-hidden ${
                    chromelessPdfExport ? 'rounded-none border-0' : `rounded-2xl border ${cardGlow.className}`
                  }`}
                  style={chromelessPdfExport ? undefined : cardGlow.style}
                >
                  <SlidePresenter
                    slideContent={currentSlideData?.content ?? '# No content'}
                    slideType={currentSlideData?.type ?? 'md'}
                    currentSlide={currentSlide}
                    deckId={activeDeckId ?? undefined}
                    slideFolderId={currentSlideData?.id}
                    deckThemeDefaults={activeDeckThemeDefaults}
                    isDarkMode={isDarkMode}
                    onContentChange={(content) => updateSlideContent(currentSlide, content)}
                    onSourceToggle={setSlideSourceOpen}
                    persistenceEnabled={devPersistenceEnabled}
                    onSaveSlide={handleSaveSlideSource}
                    saveSlidePending={slideSavePending}
                    chromeless={chromelessPdfExport}
                  />
                  {presentationMode && !chromelessPdfExport ? <PresentationInkLayer key={`ink-slide-${currentSlide}`} /> : null}
                  {speakerNotesSheet}
                </div>

                {/* Next arrow */}
                {!chromelessPdfExport ? (
                  <button
                    onClick={nextSlide}
                    disabled={currentSlide === totalSlides - 1}
                    className={`relative z-10 shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border transition-colors outline-none disabled:opacity-0 disabled:pointer-events-none ${isDarkMode ? 'border-zinc-700 bg-zinc-800/95 hover:bg-zinc-700 text-white shadow-sm' : 'border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                key="working"
                data-ms-slide-frame
                initial={chromelessPdfExport ? false : { rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={chromelessPdfExport ? { opacity: 1 } : { rotateY: 90, opacity: 0 }}
                transition={{ duration: chromelessPdfExport ? 0 : 0.32, ease: [0.4, 0, 0.2, 1] }}
                className={`w-full h-full min-h-0 relative overflow-hidden ${
                  chromelessPdfExport ? 'rounded-none border-0' : `rounded-2xl border ${cardGlow.className}`
                }`}
                style={
                  chromelessPdfExport
                    ? {
                        transformPerspective: 1600,
                        transformStyle: 'preserve-3d',
                        backfaceVisibility: 'hidden',
                      }
                    : {
                        transformPerspective: 1600,
                        transformStyle: 'preserve-3d',
                        backfaceVisibility: 'hidden',
                        ...cardGlow.style,
                      }
                }
              >
                <WorkingArea
                  htmlContent={currentSlideData?.workingArea?.content}
                  workingAreaType={currentSlideData?.workingArea?.type}
                  isDarkMode={isDarkMode}
                  slideTheme={currentSlideResolvedTheme}
                  deckId={activeDeckId ?? undefined}
                  slideFolderId={currentSlideData?.id}
                  onContentChange={(content) => updateWorkingAreaContent(currentSlide, content)}
                  onSourceToggle={setWorkingSourceOpen}
                  persistenceEnabled={devPersistenceEnabled}
                  onSaveWorkingArea={handleSaveWorkingAreaSource}
                  saveWorkingAreaPending={workingSavePending}
                  chromeless={chromelessPdfExport}
                />
                {presentationMode && !chromelessPdfExport ? <PresentationInkLayer key={`ink-working-${currentSlide}`} /> : null}
                {speakerNotesSheet}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer: equal side columns so slide controls stay visually centered */}
        <div
          className={`shrink-0 pb-6 px-6 pt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-2 ${chromelessPdfExport ? 'hidden' : ''}`}
        >
          <span
            className={`text-[10px] min-w-0 justify-self-start text-left ${isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}`}
          >
            ← → nav · G go to · N notes · E source (notes when open) · Esc close · F flip · T theme · P present
          </span>
          <div className="flex items-center gap-2 justify-center shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void addSlideAfterCurrent()}
                disabled={!devPersistenceEnabled}
                className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all duration-200 outline-none disabled:opacity-30 disabled:pointer-events-none ${
                  isDarkMode
                    ? 'bg-indigo-950/50 border-indigo-800/55 text-indigo-300/95 hover:bg-indigo-900/55 hover:border-indigo-700/60'
                    : 'bg-indigo-50/95 border-indigo-200/90 text-indigo-800 hover:bg-indigo-100/95 hover:border-indigo-300'
                }`}
                title={
                  devPersistenceEnabled
                    ? 'Add slide after current (saved to disk)'
                    : 'Requires dev server (bun run dev) to save new slides'
                }
                aria-label="Add slide"
              >
                <FilePlus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void addWorkingAreaToCurrent()}
                disabled={hasWorkingArea || !devPersistenceEnabled}
                className={`w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all duration-200 outline-none disabled:opacity-30 disabled:pointer-events-none ${
                  isDarkMode
                    ? 'bg-sky-950/45 border-sky-800/50 text-sky-300/95 hover:bg-sky-900/50 hover:border-sky-700/55'
                    : 'bg-sky-50/95 border-sky-200/90 text-sky-800 hover:bg-sky-100/95 hover:border-sky-300'
                }`}
                title={
                  hasWorkingArea
                    ? 'Working area already exists for this slide'
                    : devPersistenceEnabled
                      ? 'Add working area to current slide (saved to disk)'
                      : 'Requires dev server (bun run dev) to create working area files'
                }
                aria-label="Add working area"
              >
                <PanelsTopLeft className="w-4 h-4" />
              </button>
            </div>
            <span className={`text-xs tabular-nums ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
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
          <span
            className={`text-[10px] min-w-0 justify-self-end text-right ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}
          >
            {effectiveDeckMeta?.author ? `☻ ${effectiveDeckMeta.author}` : '☻ Markdown Slider'}
            {deckChromeDateLabel ? ` · ◈ ${deckChromeDateLabel}` : ''}
          </span>
        </div>
      </div>

      <Dialog open={deckMetaDialogOpen && !chromelessPdfExport} onOpenChange={setDeckMetaDialogOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            requestAnimationFrame(() => {
              const el = document.getElementById('deck-meta-title') as HTMLInputElement | null;
              if (!el) return;
              el.focus();
              const len = el.value.length;
              el.setSelectionRange(len, len);
            });
          }}
          className={cn(
            'sm:max-w-4xl border shadow-lg',
            isDarkMode
              ? 'bg-zinc-900 border-zinc-600 text-zinc-100 [&>button]:text-zinc-400 [&>button]:hover:bg-zinc-800 [&>button]:hover:text-zinc-100'
              : 'bg-white border-zinc-300 text-zinc-900 shadow-zinc-950/10 [&>button]:text-zinc-500 [&>button]:hover:bg-zinc-100 [&>button]:hover:text-zinc-900',
          )}
        >
          <DialogHeader>
            <DialogTitle className={isDarkMode ? 'text-zinc-100' : 'text-zinc-900'}>Deck Settings</DialogTitle>
            <DialogDescription
              className={cn('text-sm', isDarkMode ? 'text-zinc-400' : 'text-zinc-600')}
            >
              Title and subtitle appear in the header.
              {devPersistenceEnabled ? (
                <>
                  {' '}
                  Save writes to{' '}
                  <code
                    className={cn(
                      'text-xs px-1 py-0.5 rounded',
                      isDarkMode ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-800',
                    )}
                  >
                    decks/…/metadata.md
                  </code>
                  . Copy YAML is still available for sharing outside the dev server.
                </>
              ) : (
                <>
                  {' '}
                  Changes are kept in this browser until you use Copy YAML to update{' '}
                  <code
                    className={cn(
                      'text-xs px-1 py-0.5 rounded',
                      isDarkMode ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-800',
                    )}
                  >
                    decks/…/metadata.md
                  </code>
                  . Run <code className="text-xs">bun run dev</code> to save from this dialog to disk.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.2fr)] gap-x-6 items-start py-2">
            {/* Left column — identity */}
            <div className="grid gap-3">
              <h3 className={cn('text-xs uppercase tracking-wide', isDarkMode ? 'text-zinc-500' : 'text-zinc-400')}>
                Identity
              </h3>
              <div className="grid gap-1.5">
                <Label htmlFor="deck-meta-title" className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>
                  Title
                </Label>
                <Input
                  id="deck-meta-title"
                  value={deckMetaForm.title}
                  onChange={(e) => setDeckMetaForm((f) => ({ ...f, title: e.target.value }))}
                  className={cn(
                    'h-10 min-h-10',
                    isDarkMode
                      ? 'bg-zinc-950 border-zinc-600 text-white placeholder:text-zinc-500 focus-visible:ring-amber-500/40'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-amber-500/50',
                  )}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="deck-meta-subtitle" className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>
                  Subtitle (Header Line)
                </Label>
                <Input
                  id="deck-meta-subtitle"
                  value={deckMetaForm.subtitle}
                  onChange={(e) => setDeckMetaForm((f) => ({ ...f, subtitle: e.target.value }))}
                  placeholder="e.g. DECK MODE"
                  className={cn(
                    'h-10 min-h-10',
                    isDarkMode
                      ? 'bg-zinc-950 border-zinc-600 text-white placeholder:text-zinc-500 focus-visible:ring-amber-500/40'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-amber-500/50',
                  )}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="deck-meta-author" className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>
                  Author
                </Label>
                <Input
                  id="deck-meta-author"
                  value={deckMetaForm.author}
                  onChange={(e) => setDeckMetaForm((f) => ({ ...f, author: e.target.value }))}
                  className={cn(
                    'h-10 min-h-10',
                    isDarkMode
                      ? 'bg-zinc-950 border-zinc-600 text-white placeholder:text-zinc-500 focus-visible:ring-amber-500/40'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-amber-500/50',
                  )}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="deck-meta-date" className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>
                  Date
                </Label>
                <Input
                  id="deck-meta-date"
                  value={deckMetaForm.date}
                  onChange={(e) => setDeckMetaForm((f) => ({ ...f, date: e.target.value }))}
                  placeholder="YYYY-MM-DD"
                  className={cn(
                    'h-10 min-h-10',
                    isDarkMode
                      ? 'bg-zinc-950 border-zinc-600 text-white placeholder:text-zinc-500 focus-visible:ring-amber-500/40'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-amber-500/50',
                  )}
                />
              </div>
            </div>

            {/* Separator */}
            <Separator
              orientation="vertical"
              className={cn('self-stretch', isDarkMode ? 'bg-zinc-700' : 'bg-zinc-200')}
            />

            {/* Right column — description + appearance defaults */}
            <div className="grid gap-3">
              <h3 className={cn('text-xs uppercase tracking-wide', isDarkMode ? 'text-zinc-500' : 'text-zinc-400')}>
                Description
              </h3>
              <div className="grid gap-1.5">
                <Label htmlFor="deck-meta-desc" className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>
                  Description (Deck Picker)
                </Label>
                <textarea
                  id="deck-meta-desc"
                  rows={4}
                  value={deckMetaForm.description}
                  onChange={(e) => setDeckMetaForm((f) => ({ ...f, description: e.target.value }))}
                  className={cn(
                    'min-h-28 w-full resize-y rounded-md border px-3 py-2.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-amber-500/50',
                    isDarkMode
                      ? 'bg-zinc-950 border-zinc-600 text-white placeholder:text-zinc-500'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400',
                  )}
                />
              </div>
              <h3 className={cn('text-xs uppercase tracking-wide mt-1', isDarkMode ? 'text-zinc-500' : 'text-zinc-400')}>
                Appearance Defaults
              </h3>
              <div className="grid gap-1.5">
                <Label className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>Default Theme</Label>
                <Select
                  value={deckMetaForm.defaultTheme || '__none__'}
                  onValueChange={(v) => setDeckMetaForm((f) => ({ ...f, defaultTheme: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger
                    className={cn(
                      'h-10 w-full',
                      isDarkMode
                        ? 'bg-zinc-950 border-zinc-600 text-white'
                        : 'bg-white border-zinc-300 text-zinc-900',
                    )}
                  >
                    <SelectValue placeholder="Inherit from slide" />
                  </SelectTrigger>
                  <SelectContent className={isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}>
                    <SelectItem value="__none__">
                      <span className={isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}>None (use palette &amp; font)</span>
                    </SelectItem>
                    {themeOptions.map((id) => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>Default Palette</Label>
                <Select
                  value={deckMetaForm.defaultPalette || '__none__'}
                  onValueChange={(v) => setDeckMetaForm((f) => ({ ...f, defaultPalette: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger
                    className={cn(
                      'h-10 w-full',
                      isDarkMode
                        ? 'bg-zinc-950 border-zinc-600 text-white'
                        : 'bg-white border-zinc-300 text-zinc-900',
                    )}
                  >
                    <SelectValue placeholder="Inherit" />
                  </SelectTrigger>
                  <SelectContent className={isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}>
                    <SelectItem value="__none__">
                      <span className={isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}>None</span>
                    </SelectItem>
                    {paletteOptions.map((id) => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>Default Font</Label>
                <Select
                  value={deckMetaForm.defaultFont || '__none__'}
                  onValueChange={(v) => setDeckMetaForm((f) => ({ ...f, defaultFont: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger
                    className={cn(
                      'h-10 w-full',
                      isDarkMode
                        ? 'bg-zinc-950 border-zinc-600 text-white'
                        : 'bg-white border-zinc-300 text-zinc-900',
                    )}
                  >
                    <SelectValue placeholder="Inherit" />
                  </SelectTrigger>
                  <SelectContent className={isDarkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}>
                    <SelectItem value="__none__">
                      <span className={isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}>None</span>
                    </SelectItem>
                    {fontOptions.map((id) => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2 flex-wrap sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={resetDeckMetaToFile}
              className={cn(
                isDarkMode
                  ? 'border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white'
                  : 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100',
              )}
            >
              Reset to file
            </Button>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyDeckMetaYaml()}
                className={cn(
                  isDarkMode
                    ? 'border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white'
                    : 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100',
                )}
              >
                {copiedMetaYaml ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedMetaYaml ? 'Copied' : 'Copy YAML'}
              </Button>
              <Button
                type="button"
                disabled={metaSavePending}
                onClick={() => void saveDeckMetaDialog()}
              >
                {metaSavePending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;