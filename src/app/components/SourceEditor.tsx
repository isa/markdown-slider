import { useRef, useEffect } from 'react';
import { Code, Loader2, Save, X } from 'lucide-react';
import { motion } from 'motion/react';

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  language: 'md' | 'html';
  isDarkMode?: boolean;
  /** When set, shows a Save control (e.g. persist to disk in dev). */
  onSave?: () => void | Promise<void>;
  saveDisabled?: boolean;
  saving?: boolean;
}

export function SourceEditor({
  value,
  onChange,
  onClose,
  language,
  isDarkMode = false,
  onSave,
  saveDisabled = false,
  saving = false,
}: SourceEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }

    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: '38%', opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className={`h-full flex flex-col overflow-hidden border-l ${
        isDarkMode
          ? 'bg-zinc-950 border-zinc-700/50'
          : 'bg-zinc-100 border-zinc-300'
      }`}
    >
      {/* Editor header */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b shrink-0 ${
        isDarkMode ? 'border-zinc-700/50' : 'border-zinc-300'
      }`}>
        <div className={`flex items-center gap-2 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
          <Code className="w-3 h-3" />
          <span className="text-[10px] uppercase tracking-wider">
            {language === 'md' ? 'Markdown' : 'HTML'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onSave ? (
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saveDisabled || saving}
              title={saving ? 'Saving…' : 'Save to disk'}
              aria-label={saving ? 'Saving' : 'Save to disk'}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors outline-none ${
                saveDisabled || saving
                  ? isDarkMode
                    ? 'cursor-not-allowed border-zinc-700/90 bg-zinc-900/80 text-zinc-500'
                    : 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                  : isDarkMode
                    ? 'border-sky-500/40 bg-sky-500/12 text-sky-200 shadow-sm hover:border-sky-400/50 hover:bg-sky-500/22 hover:text-sky-100'
                    : 'border-sky-200/95 bg-sky-50 text-sky-800 shadow-sm hover:border-sky-300/90 hover:bg-sky-100/95 hover:text-sky-950'
              }`}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Save className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              )}
            </button>
          ) : null}
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className={
            isDarkMode
              ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-900/90 text-zinc-400 shadow-sm transition-colors hover:border-zinc-500 hover:bg-zinc-600 hover:text-white'
              : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-300/90 bg-white/90 text-zinc-500 shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'
          }
        >
          <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
        </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className={`flex-1 w-full resize-none bg-transparent p-3 outline-none font-mono text-sm leading-relaxed selection:bg-blue-500/30 ${
          isDarkMode ? 'text-zinc-200 placeholder:text-zinc-600' : 'text-zinc-800 placeholder:text-zinc-400'
        }`}
        placeholder={`Write your ${language === 'md' ? 'markdown' : 'HTML'} here...`}
      />
    </motion.div>
  );
}