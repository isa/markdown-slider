import { useRef, useEffect } from 'react';
import { Code, X } from 'lucide-react';
import { motion } from 'motion/react';

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  language: 'md' | 'html';
  isDarkMode?: boolean;
}

export function SourceEditor({ value, onChange, onClose, language, isDarkMode = false }: SourceEditorProps) {
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
        <button
          onClick={onClose}
          className={`w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700 transition-colors ${
            isDarkMode ? 'text-zinc-400 hover:text-white hover:bg-zinc-700' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          <X className="w-3 h-3" />
        </button>
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