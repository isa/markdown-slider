import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, Loader2, Pencil, Save, X } from 'lucide-react';
import { SlideMarkdownBody } from './SlideMarkdown';
import { cn } from './ui/utils';

export type SpeakerNotesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  slideId: string;
  /** Controlled markdown body (may be empty). */
  value: string;
  onChange: (value: string) => void;
  isDarkMode: boolean;
  persistenceEnabled?: boolean;
  onSave?: () => void | Promise<void>;
  savePending?: boolean;
};

export function SpeakerNotesSheet({
  open,
  onOpenChange,
  deckId,
  slideId,
  value,
  onChange,
  isDarkMode,
  persistenceEnabled = false,
  onSave,
  savePending = false,
}: SpeakerNotesSheetProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const pathHint = `decks/${deckId}/${slideId}/speaker.md`;
  const hasPreviewContent = value.trim().length > 0;
  const canSave = persistenceEnabled && onSave;

  useEffect(() => {
    setViewMode('preview');
  }, [slideId]);

  useEffect(() => {
    if (!open) {
      setViewMode('preview');
    }
  }, [open]);

  /** Esc in edit → preview first; Esc in preview still closes the sheet (handled in App). */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (viewMode !== 'edit') return;
      e.preventDefault();
      e.stopPropagation();
      setViewMode('preview');
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, viewMode]);

  /** App routes E to speaker notes when this sheet is open (not when typing in a field). */
  useEffect(() => {
    if (!open) return;
    const onEditRequest = () => setViewMode('edit');
    window.addEventListener('markdown-slider:speaker-notes-edit', onEditRequest);
    return () => window.removeEventListener('markdown-slider:speaker-notes-edit', onEditRequest);
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="absolute inset-0 z-[50] flex flex-col justify-end pointer-events-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="speaker-notes-title"
        >
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 pointer-events-auto bg-black/45 backdrop-blur-[2px] border-0 cursor-default"
            aria-label="Close speaker notes"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              'relative pointer-events-auto max-h-[min(55vh,560px)] w-full rounded-t-2xl border shadow-2xl flex flex-col min-h-0',
              isDarkMode ? 'bg-zinc-900 border-zinc-600 text-zinc-100' : 'bg-white border-zinc-300 text-zinc-900',
            )}
          >
            <div
              className={cn(
                'shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b',
                isDarkMode ? 'border-zinc-700' : 'border-zinc-200',
              )}
            >
              <h2 id="speaker-notes-title" className="text-sm font-semibold tracking-tight px-1">
                Speaker notes
              </h2>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setViewMode((m) => (m === 'preview' ? 'edit' : 'preview'))}
                  title={viewMode === 'preview' ? 'Edit speaker notes' : 'Back to preview'}
                  aria-label={viewMode === 'preview' ? 'Edit speaker notes' : 'Back to preview'}
                  aria-pressed={viewMode === 'edit'}
                  className={cn(
                    'shrink-0 w-9 h-9 flex items-center justify-center rounded-full border transition-colors outline-none',
                    viewMode === 'edit'
                      ? isDarkMode
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25'
                        : 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'
                      : isDarkMode
                        ? 'border-zinc-600 hover:bg-zinc-800 text-zinc-200'
                        : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700',
                  )}
                >
                  {viewMode === 'preview' ? (
                    <Pencil className="w-4 h-4" strokeWidth={2} aria-hidden />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={2} aria-hidden />
                  )}
                </button>
                {viewMode === 'edit' && canSave ? (
                  <button
                    type="button"
                    onClick={() => void onSave?.()}
                    disabled={savePending}
                    title={savePending ? 'Saving…' : 'Save to disk'}
                    aria-label={savePending ? 'Saving' : 'Save to disk'}
                    className={cn(
                      'shrink-0 w-9 h-9 flex items-center justify-center rounded-full border transition-colors outline-none',
                      savePending
                        ? isDarkMode
                          ? 'cursor-not-allowed border-zinc-700/90 bg-zinc-900/80 text-zinc-500'
                          : 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                        : isDarkMode
                          ? 'border-sky-500/40 bg-sky-500/12 text-sky-200 hover:border-sky-400/50 hover:bg-sky-500/22'
                          : 'border-sky-200/95 bg-sky-50 text-sky-800 hover:border-sky-300/90 hover:bg-sky-100/95',
                    )}
                  >
                    {savePending ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <Save className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'shrink-0 w-9 h-9 flex items-center justify-center rounded-full border transition-colors outline-none',
                    isDarkMode
                      ? 'border-zinc-600 hover:bg-zinc-800 text-zinc-200'
                      : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700',
                  )}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 text-sm flex flex-col">
              {viewMode === 'preview' ? (
                hasPreviewContent ? (
                  <div
                    className={cn(
                      'speaker-notes-md max-w-none',
                      isDarkMode ? '[&_.slide-p]:text-zinc-300' : '[&_.slide-p]:text-zinc-700',
                    )}
                  >
                    <SlideMarkdownBody markdown={value.trim()} />
                  </div>
                ) : (
                  <p className={cn('text-sm leading-relaxed', isDarkMode ? 'text-zinc-400' : 'text-zinc-500')}>
                    No speaker notes yet. Tap the <strong className="font-medium">pencil</strong> above to edit, or
                    create{' '}
                    <code
                      className={cn(
                        'text-xs px-1 py-0.5 rounded',
                        isDarkMode ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-800',
                      )}
                    >
                      {pathHint}
                    </code>
                    {canSave ? ' in the repo, then save from here.' : ' in your editor.'}
                  </p>
                )
              ) : (
                <textarea
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const ta = e.currentTarget;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const next = value.substring(0, start) + '  ' + value.substring(end);
                      onChange(next);
                      requestAnimationFrame(() => {
                        ta.selectionStart = ta.selectionEnd = start + 2;
                      });
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === 's' && canSave && viewMode === 'edit') {
                      e.preventDefault();
                      void onSave?.();
                    }
                  }}
                  spellCheck={false}
                  placeholder="Speaker notes (markdown)…"
                  className={cn(
                    'flex-1 min-h-[180px] w-full resize-y rounded-lg border border-dashed p-3 outline-none font-mono text-sm leading-relaxed selection:bg-blue-500/30',
                    isDarkMode
                      ? 'bg-zinc-950 border-zinc-600 text-zinc-200 placeholder:text-zinc-600'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-800 placeholder:text-zinc-400',
                  )}
                />
              )}
              {!persistenceEnabled && viewMode === 'edit' ? (
                <p
                  className={cn(
                    'mt-2 text-[11px] shrink-0',
                    isDarkMode ? 'text-zinc-500' : 'text-zinc-500',
                  )}
                >
                  Run{' '}
                  <code
                    className={cn(
                      'text-[10px] px-1 rounded',
                      isDarkMode ? 'bg-zinc-800/80 text-zinc-200' : 'bg-zinc-200 text-zinc-800',
                    )}
                  >
                    bun run dev
                  </code>{' '}
                  to save{' '}
                  <code
                    className={cn(
                      'text-[10px] px-1 rounded',
                      isDarkMode ? 'bg-zinc-800/80 text-zinc-200' : 'bg-zinc-200 text-zinc-800',
                    )}
                  >
                    speaker.md
                  </code>{' '}
                  to disk.
                </p>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
