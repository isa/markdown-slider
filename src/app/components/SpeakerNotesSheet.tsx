import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { SlideMarkdownBody } from './SlideMarkdown';
import { cn } from './ui/utils';

export type SpeakerNotesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  slideId: string;
  markdown: string | undefined;
  isDarkMode: boolean;
};

export function SpeakerNotesSheet({
  open,
  onOpenChange,
  deckId,
  slideId,
  markdown,
  isDarkMode,
}: SpeakerNotesSheetProps) {
  const hasContent = markdown != null && markdown.trim().length > 0;
  const pathHint = `decks/${deckId}/${slideId}/speaker.md`;

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[95] flex flex-col justify-end pointer-events-none"
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
              'relative pointer-events-auto max-h-[min(44vh,480px)] w-full rounded-t-2xl border shadow-2xl flex flex-col min-h-0',
              isDarkMode ? 'bg-zinc-900 border-zinc-600 text-zinc-100' : 'bg-white border-zinc-300 text-zinc-900',
            )}
          >
            <div
              className={cn(
                'shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b',
                isDarkMode ? 'border-zinc-700' : 'border-zinc-200',
              )}
            >
              <h2 id="speaker-notes-title" className="text-sm font-semibold tracking-tight">
                Speaker notes
              </h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className={cn(
                  'shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border transition-colors outline-none',
                  isDarkMode
                    ? 'border-zinc-600 hover:bg-zinc-800 text-zinc-200'
                    : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700',
                )}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 text-sm">
              {hasContent ? (
                <div
                  className={cn(
                    'speaker-notes-md max-w-none',
                    isDarkMode ? '[&_.slide-p]:text-zinc-300' : '[&_.slide-p]:text-zinc-700',
                  )}
                >
                  <SlideMarkdownBody markdown={markdown!.trim()} />
                </div>
              ) : (
                <p className={cn('text-sm leading-relaxed', isDarkMode ? 'text-zinc-400' : 'text-zinc-500')}>
                  No speaker notes for this slide. Add markdown at{' '}
                  <code
                    className={cn(
                      'text-xs px-1 py-0.5 rounded',
                      isDarkMode ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-800',
                    )}
                  >
                    {pathHint}
                  </code>{' '}
                  (view-only in the app; edit in your editor).
                </p>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
