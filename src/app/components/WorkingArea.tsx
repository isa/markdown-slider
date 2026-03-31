import { useState } from 'react';
import { Terminal } from './Terminal';
import { Code, Terminal as TerminalIcon } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { SourceEditor } from './SourceEditor';

type WorkingMode = 'content' | 'terminal';

interface WorkingAreaProps {
  htmlContent?: string;
  workingAreaType?: 'md' | 'html';
  onContentChange?: (content: string) => void;
  onSourceToggle?: (open: boolean) => void;
}

const DEFAULT_HTML = '<html><body style="margin:0;padding:2rem;font-family:sans-serif;background:#1a1a1a;color:#e5e5e5;"><h2>HTML Preview</h2><p>No working area content for this slide.</p></body></html>';

export function WorkingArea({ htmlContent, workingAreaType, onContentChange, onSourceToggle }: WorkingAreaProps) {
  const [mode, setMode] = useState<WorkingMode>('content');
  const [showSource, setShowSource] = useState(false);

  const hasContent = !!htmlContent;
  const contentType = workingAreaType ?? 'html';

  return (
    <div className="h-full w-full flex flex-col bg-zinc-900 overflow-hidden shadow-xl relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700 z-10">
        <div className="flex gap-2">
          <button
            onClick={() => { setMode('content'); setShowSource(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              mode === 'content'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            <Code className="w-4 h-4" />
            {contentType === 'md' ? 'Markdown' : 'HTML'} Preview
          </button>
          <button
            onClick={() => { setMode('terminal'); setShowSource(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              mode === 'terminal'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            <TerminalIcon className="w-4 h-4" />
            Terminal
          </button>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'content' && hasContent && (
            <button
              onClick={() => {
                const next = !showSource;
                setShowSource(next);
                onSourceToggle?.(next);
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 outline-none ${
                showSource
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                  : 'bg-zinc-800/70 border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
              title={showSource ? 'Show preview (Esc)' : 'Edit source'}
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="text-xs text-zinc-500">Working Area</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative flex">
        {mode === 'content' ? (
          contentType === 'md' && htmlContent ? (
            <div className="flex-1 min-w-0 h-full overflow-auto p-8">
              <div className="prose prose-invert prose-lg max-w-none">
                <ReactMarkdown>{htmlContent}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <iframe
              srcDoc={hasContent ? htmlContent : DEFAULT_HTML}
              className="flex-1 min-w-0 h-full border-0"
              title="Working Area Preview"
              sandbox="allow-scripts"
            />
          )
        ) : (
          <div className="flex-1 min-w-0 h-full p-4">
            <Terminal />
          </div>
        )}

        {/* Source editor sidebar */}
        <AnimatePresence>
          {showSource && mode === 'content' && hasContent && (
            <SourceEditor
              value={htmlContent!}
              onChange={(val) => onContentChange?.(val)}
              onClose={() => {
                setShowSource(false);
                onSourceToggle?.(false);
              }}
              language={contentType}
              isDarkMode={true}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}