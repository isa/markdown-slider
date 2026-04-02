import { useState, useEffect, type CSSProperties } from 'react';
import { Code } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { SlideMarkdownBody } from './SlideMarkdown';
import { SourceEditor } from './SourceEditor';
import type { ResolvedSlideTheme } from '../slideThemes';

interface WorkingAreaProps {
  htmlContent?: string;
  workingAreaType?: 'md' | 'html';
  /** When false, toolbar and preview chrome match light theme (slides). */
  isDarkMode?: boolean;
  /** Resolved palette + font for the current slide (matches main slide card). */
  slideTheme?: ResolvedSlideTheme;
  deckId?: string;
  slideFolderId?: string;
  onContentChange?: (content: string) => void;
  onSourceToggle?: (open: boolean) => void;
  /** Dev server: persist working-area source to disk. */
  persistenceEnabled?: boolean;
  onSaveWorkingArea?: () => void | Promise<void>;
  saveWorkingAreaPending?: boolean;
  /** PDF/automation: hide toolbar and edit controls. */
  chromeless?: boolean;
}

/** Same font stylesheet as `index.html` so iframe previews resolve --slide-font-* stacks. */
const IFRAME_FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Libre+Franklin:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Lustria&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700&family=Lusitana:wght@400;700&family=Manrope:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Mulish:wght@400;500;600;700&family=Nunito:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Oswald:wght@400;500;600;700&family=Ovo&family=Raleway:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Roboto+Serif:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
`;

function serializeSlideCssVarsForIframe(vars: CSSProperties | undefined): string {
  if (!vars) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined || value === null) continue;
    if (!key.startsWith('--')) continue;
    parts.push(`${key}: ${String(value)}`);
  }
  return parts.join('; ');
}

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

function injectSlideVarsAndFonts(html: string, vars: CSSProperties | undefined): string {
  const serialized = serializeSlideCssVarsForIframe(vars);
  const needFonts = !/<link[^>]+fonts\.googleapis\.com/i.test(html);
  const fontBlock = needFonts ? IFRAME_FONT_LINKS : '';
  const varBlock = serialized
    ? `<style data-wa-slide-theme>:root,html{${serialized}}</style>`
    : '';
  const injection = `${fontBlock}${varBlock}`;
  if (!injection) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${injection}`);
  }
  return `${injection}${html}`;
}

function prepareWorkingAreaIframeDoc(html: string, isDark: boolean, vars: CSSProperties | undefined): string {
  const out = injectIframeTheme(html, isDark);
  return injectSlideVarsAndFonts(out, vars);
}

function buildDefaultWorkingAreaHtml(isDark: boolean): string {
  const theme = isDark ? 'dark' : 'light';
  return `<!DOCTYPE html>
<html data-theme="${theme}">
<head><meta charset="utf-8" /><style>
body{margin:0;padding:2rem;font-family:var(--slide-font-body,system-ui,sans-serif);font-size:var(--slide-font-size-body,1rem);line-height:var(--slide-line-height-body,1.5);background:var(--slide-bg,#fafafa);color:var(--slide-text,#18181b);}
h2{font-family:var(--slide-font-heading);font-size:var(--slide-font-size-h2,1.5rem);font-weight:var(--slide-heading-weight-2,600);color:var(--slide-heading-color);margin:0 0 0.75rem;}
p{margin:0;font-size:var(--slide-font-size-body,1rem);color:var(--slide-text-muted,var(--slide-text));}
</style></head>
<body><h2>HTML Preview</h2><p>No working area content for this slide.</p></body></html>`;
}

export function WorkingArea({
  htmlContent,
  workingAreaType,
  isDarkMode = false,
  slideTheme,
  deckId,
  slideFolderId,
  onContentChange,
  onSourceToggle,
  persistenceEnabled = false,
  onSaveWorkingArea,
  saveWorkingAreaPending = false,
  chromeless = false,
}: WorkingAreaProps) {
  const [showSource, setShowSource] = useState(false);

  const hasContent = !!htmlContent;
  const contentType = workingAreaType ?? 'html';
  const themeVars = slideTheme?.cssVariables;

  useEffect(() => {
    const onToggleSource = () => {
      if (!hasContent) return;
      setShowSource((prev) => {
        const next = !prev;
        onSourceToggle?.(next);
        return next;
      });
    };
    window.addEventListener('markdown-slider:toggle-source', onToggleSource);
    return () => window.removeEventListener('markdown-slider:toggle-source', onToggleSource);
  }, [hasContent, onSourceToggle]);

  const previewPill = isDarkMode
    ? 'bg-zinc-700 text-white'
    : 'bg-white text-zinc-900 shadow-sm border border-zinc-200';

  const iframeSrcDoc = prepareWorkingAreaIframeDoc(
    hasContent ? htmlContent! : buildDefaultWorkingAreaHtml(isDarkMode),
    isDarkMode,
    themeVars,
  );

  return (
    <div
      className={`h-full w-full flex flex-col overflow-hidden shadow-xl relative ${
        isDarkMode ? 'bg-zinc-900' : 'bg-zinc-50'
      }`}
    >
      {/* Toolbar */}
      {!chromeless ? (
        <div
          className={`flex items-center justify-between px-4 py-2 border-b z-10 ${
            isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'
          }`}
        >
          <div className="flex gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${previewPill}`}
            >
              <Code className="w-4 h-4" />
              {contentType === 'md' ? 'Markdown' : 'HTML'} Preview
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasContent && (
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

      {/* Content — inherits slide palette + font via CSS variables */}
      <div
        className="flex-1 overflow-hidden relative flex min-h-0"
        style={themeVars as CSSProperties | undefined}
      >
        {contentType === 'md' && htmlContent ? (
          <div className="flex-1 min-w-0 h-full overflow-auto">
            <div
              className="slide-root slide-prose slide-root--vcenter min-h-full px-8 py-8"
              data-color-mode={isDarkMode ? 'dark' : 'light'}
              style={themeVars as CSSProperties | undefined}
            >
              <div className="slide-content-stack">
                <div className="slide-deck-body">
                  <SlideMarkdownBody markdown={htmlContent} deckId={deckId} slideFolderId={slideFolderId} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <iframe
            srcDoc={iframeSrcDoc}
            className="flex-1 min-w-0 h-full border-0"
            title="Working Area Preview"
            sandbox="allow-scripts"
          />
        )}

        {/* Source editor sidebar */}
        <AnimatePresence>
          {showSource && hasContent && !chromeless && (
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
