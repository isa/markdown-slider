import { useState, useEffect } from 'react';
import { Terminal } from './Terminal';
import { Code, Terminal as TerminalIcon } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { SourceEditor } from './SourceEditor';

type WorkingMode = 'content' | 'terminal';

interface WorkingAreaProps {
  htmlContent?: string;
  workingAreaType?: 'md' | 'html';
  /** When false, toolbar and preview chrome match light theme (slides). */
  isDarkMode?: boolean;
  /** Hides toolbar and source controls while presenting. */
  presentationMode?: boolean;
  onContentChange?: (content: string) => void;
  onSourceToggle?: (open: boolean) => void;
  /** Dev server: persist working-area source to disk. */
  persistenceEnabled?: boolean;
  onSaveWorkingArea?: () => void | Promise<void>;
  saveWorkingAreaPending?: boolean;
}

/** Empty preview: theme via `data-theme` + CSS variables (see injectIframeTheme). */
const DEFAULT_HTML = `<!DOCTYPE html>
<html data-theme="dark">
<head><meta charset="utf-8"><style>
html[data-theme="dark"] { --wa-bg:#1a1a1a; --wa-fg:#e5e5e5; }
html[data-theme="light"] { --wa-bg:#fafafa; --wa-fg:#18181b; }
body{margin:0;padding:2rem;font-family:sans-serif;background:var(--wa-bg);color:var(--wa-fg);}
</style></head>
<body><h2>HTML Preview</h2><p>No working area content for this slide.</p></body></html>`;

/** Sets <html data-theme="light|dark"> so embedded HTML can style per app theme. */
function injectIframeTheme(html: string, isDark: boolean): string {
  const theme = isDark ? 'dark' : 'light';
  if (/\bdata-theme\s*=\s*["'][^"']*["']/i.test(html)) {
    return html.replace(/\bdata-theme\s*=\s*["'][^"']*["']/i, `data-theme="${theme}"`);
  }
  return html.replace(/<html(\s[^>]*)?>/i, (match, attrs: string | undefined) => {
    if (/\bdata-theme\s*=/i.test(match)) return match;
    return `<html${attrs ?? ''} data-theme="${theme}">`;
  });
}

export function WorkingArea({
  htmlContent,
  workingAreaType,
  isDarkMode = false,
  presentationMode = false,
  onContentChange,
  onSourceToggle,
  persistenceEnabled = false,
  onSaveWorkingArea,
  saveWorkingAreaPending = false,
}: WorkingAreaProps) {
  const [mode, setMode] = useState<WorkingMode>('content');
  const [showSource, setShowSource] = useState(false);

  const hasContent = !!htmlContent;
  const contentType = workingAreaType ?? 'html';

  useEffect(() => {
    if (presentationMode && showSource) {
      setShowSource(false);
      onSourceToggle?.(false);
    }
  }, [presentationMode, showSource, onSourceToggle]);

  useEffect(() => {
    const onToggleSource = () => {
      if (presentationMode) return;
      if (mode !== 'content' || !hasContent) return;
      setShowSource((prev) => {
        const next = !prev;
        onSourceToggle?.(next);
        return next;
      });
    };
    window.addEventListener('markdown-slider:toggle-source', onToggleSource);
    return () => window.removeEventListener('markdown-slider:toggle-source', onToggleSource);
  }, [mode, hasContent, onSourceToggle, presentationMode]);

  const tabActive = isDarkMode
    ? 'bg-zinc-700 text-white'
    : 'bg-white text-zinc-900 shadow-sm border border-zinc-200';
  const tabIdle = isDarkMode
    ? 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/90';

  return (
    <div
      className={`h-full w-full flex flex-col overflow-hidden shadow-xl relative ${
        isDarkMode ? 'bg-zinc-900' : 'bg-zinc-50'
      }`}
    >
      {/* Toolbar */}
      {!presentationMode ? (
      <div
        className={`flex items-center justify-between px-4 py-2 border-b z-10 ${
          isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'
        }`}
      >
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode('content');
              setShowSource(false);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              mode === 'content' ? tabActive : tabIdle
            }`}
          >
            <Code className="w-4 h-4" />
            {contentType === 'md' ? 'Markdown' : 'HTML'} Preview
          </button>
          <button
            onClick={() => {
              setMode('terminal');
              setShowSource(false);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              mode === 'terminal' ? tabActive : tabIdle
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
                  ? isDarkMode
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                    : 'bg-blue-500/15 border-blue-500/40 text-blue-700'
                  : isDarkMode
                    ? 'bg-zinc-800/70 border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700'
                    : 'bg-white border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title={showSource ? 'Show preview (Esc)' : 'Edit source (E)'}
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )}
          <div className={`text-xs ${isDarkMode ? 'text-zinc-500' : 'text-zinc-500'}`}>Working Area</div>
        </div>
      </div>
      ) : null}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative flex">
        {mode === 'content' ? (
          contentType === 'md' && htmlContent ? (
            <div
              className={`flex-1 min-w-0 h-full overflow-auto p-8 ${
                isDarkMode ? '' : 'bg-zinc-50'
              }`}
            >
              <div
                className={`prose prose-lg max-w-none ${
                  isDarkMode ? 'prose-invert' : 'text-zinc-800'
                }`}
              >
                <ReactMarkdown>{htmlContent}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <iframe
              srcDoc={injectIframeTheme(hasContent ? htmlContent! : DEFAULT_HTML, isDarkMode)}
              className="flex-1 min-w-0 h-full border-0"
              title="Working Area Preview"
              sandbox="allow-scripts"
            />
          )
        ) : (
          <div className={`flex-1 min-w-0 h-full p-4 ${isDarkMode ? '' : 'bg-zinc-100'}`}>
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
              isDarkMode={isDarkMode}
              onSave={persistenceEnabled && onSaveWorkingArea ? onSaveWorkingArea : undefined}
              saving={saveWorkingAreaPending}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}