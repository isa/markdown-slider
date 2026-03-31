import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { parseSlideSegments } from '../markdown/slideColumnSegments';
import type { SlideChartRow } from '../slideChartData';
import {
  SlideBarChartEmbed,
  SlideLineChartEmbed,
  SlidePieChartEmbed,
  type LineChartEndMarker,
  type PieChartLegendPosition,
} from './SlideChartEmbeds';
import { SlideMermaidEmbed, type MermaidNodeStyle } from './SlideMermaidEmbed';

const slideSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ['className', /^(?:slide-[\w-]+|align--(?:left|center|right))$/],
    ],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', /^slide-[\w-]+$/]],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', /^language-./],
      ['className', /^slide-[\w-]+$/],
    ],
  },
};

type HeadingProps = ComponentPropsWithoutRef<'h1'>;

function heading(level: 1 | 2 | 3, props: HeadingProps) {
  const { children, ...rest } = props;
  const Tag = `h${level}` as const;
  return (
    <Tag {...rest} className={`slide-heading slide-heading--${level}`}>
      {children}
    </Tag>
  );
}

function codeToString(children: ReactNode): string {
  if (typeof children === 'string') return children.replace(/\n$/, '');
  if (Array.isArray(children)) return children.map(codeToString).join('');
  return String(children ?? '');
}

/** Raw text from `code` children — do not strip trailing newline (needed to detect fenced vs inline). */
function codeToStringRaw(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(codeToStringRaw).join('');
  return String(children ?? '');
}

/** Single markdown document (no @@@columns splitting) — used inside column cells. */
export function SlideMarkdownBody({
  markdown,
  lineChartData,
  barChartData,
  pieChartData,
  pieChartLegendPosition,
  barChartStacked,
  lineChartArea,
  lineChartEndMarker,
  mermaidNodes,
}: {
  markdown: string;
  lineChartData?: SlideChartRow[];
  barChartData?: SlideChartRow[];
  pieChartData?: SlideChartRow[];
  /** From YAML `pieChartLegendPosition:` */
  pieChartLegendPosition?: PieChartLegendPosition;
  /** From YAML `barChartStacked:` */
  barChartStacked?: boolean;
  /** From YAML `lineChartArea:` / `area:` */
  lineChartArea?: boolean;
  /** From YAML `lineChartEndMarker:` / `lineEndMarker:` */
  lineChartEndMarker?: LineChartEndMarker;
  /** From YAML `mermaidNodes:` */
  mermaidNodes?: MermaidNodeStyle;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, slideSanitizeSchema]]}
      components={{
        h1: (props) => heading(1, props),
        h2: (props) => heading(2, props),
        h3: (props) => heading(3, props),
        p: ({ children, ...rest }) => (
          <p {...rest} className="slide-p">
            {children}
          </p>
        ),
        ul: ({ children, ...rest }) => (
          <ul {...rest} className="slide-ul">
            {children}
          </ul>
        ),
        ol: ({ children, ...rest }) => (
          <ol {...rest} className="slide-ol">
            {children}
          </ol>
        ),
        li: ({ children, ...rest }) => (
          <li {...rest} className="slide-li">
            {children}
          </li>
        ),
        img: ({ alt, src, ...rest }) => (
          <img {...rest} alt={alt ?? ''} src={src} className="slide-img" loading="lazy" />
        ),
        code: ({ children, className }) => {
          const rawCode = codeToStringRaw(children);
          const codeString = codeToString(children);
          const langMatch = /language-([\w-]+)/.exec(className ?? '');
          const lang = langMatch?.[1];
          /* Fenced blocks: mdast ends with \n and/or multiple lines. Must use rawCode — codeString strips trailing \n so /\n$/ would always fail. */
          const isFencedBlock = Boolean(
            lang && (/\n$/.test(rawCode) || rawCode.includes('\n')),
          );

          if (lang === 'mermaid') {
            return (
              <SlideMermaidEmbed
                definition={rawCode.replace(/\n$/, '')}
                nodeStyle={mermaidNodes ?? 'filled'}
              />
            );
          }

          if (lang && isFencedBlock) {
            return (
              <pre className="slide-pre slide-pre--highlight">
                <SyntaxHighlighter
                  language={lang}
                  style={oneDark}
                  PreTag="div"
                  wrapLines={false}
                  wrapLongLines={false}
                  customStyle={{
                    margin: 0,
                    padding: '1.25rem 1.5rem 1.4rem',
                    background: 'transparent',
                    fontSize: '0.875rem',
                    textShadow: 'none',
                    textAlign: 'left',
                    fontFamily:
                      'var(--slide-font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontVariantLigatures: 'none',
                    fontFeatureSettings: '"liga" 0, "calt" 0',
                  }}
                  codeTagProps={{
                    className: 'slide-code-block-inner',
                    style: {
                      fontFamily:
                        'var(--slide-font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontVariantLigatures: 'none',
                      fontFeatureSettings: '"liga" 0, "calt" 0',
                    },
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </pre>
            );
          }

          if (lang && !isFencedBlock) {
            return (
              <SyntaxHighlighter
                language={lang}
                style={oneDark}
                PreTag="span"
                customStyle={{
                  display: 'inline',
                  margin: 0,
                  padding: '0.2em 0.45em',
                  borderRadius: '0.3rem',
                  fontSize: '0.9em',
                  verticalAlign: 'text-bottom',
                  background: 'var(--slide-code-bg)',
                  textShadow: 'none',
                }}
                codeTagProps={{ className: 'slide-code-inline-highlight' }}
              >
                {codeString.trimEnd()}
              </SyntaxHighlighter>
            );
          }

          return <code className="slide-code-inline">{children}</code>;
        },
        blockquote: ({ children, ...rest }) => (
          <blockquote {...rest} className="slide-blockquote">
            {children}
          </blockquote>
        ),
        table: ({ children, ...rest }) => (
          <div className="slide-table-wrap">
            <table {...rest} className="slide-table">
              {children}
            </table>
          </div>
        ),
        thead: ({ children, ...rest }) => (
          <thead {...rest} className="slide-thead">
            {children}
          </thead>
        ),
        tbody: ({ children, ...rest }) => (
          <tbody {...rest} className="slide-tbody">
            {children}
          </tbody>
        ),
        tr: ({ children, ...rest }) => (
          <tr {...rest} className="slide-tr">
            {children}
          </tr>
        ),
        th: ({ children, ...rest }) => (
          <th {...rest} className="slide-th">
            {children}
          </th>
        ),
        td: ({ children, ...rest }) => (
          <td {...rest} className="slide-td">
            {children}
          </td>
        ),
        a: ({ children, href, ...rest }) => (
          <a {...rest} href={href} className="slide-a" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        hr: (props) => <hr {...props} className="slide-hr" />,
        strong: ({ children, ...rest }) => (
          <strong {...rest} className="slide-strong">
            {children}
          </strong>
        ),
        em: ({ children, ...rest }) => (
          <em {...rest} className="slide-em">
            {children}
          </em>
        ),
        div: ({ className, children, ...rest }) => {
          if (className === 'slide-embed-line-chart')
            return (
              <SlideLineChartEmbed
                data={lineChartData}
                lineChartArea={lineChartArea}
                lineChartEndMarker={lineChartEndMarker}
              />
            );
          if (className === 'slide-embed-bar-chart')
            return <SlideBarChartEmbed data={barChartData} stacked={barChartStacked === true} />;
          if (className === 'slide-embed-pie-chart')
            return (
              <SlidePieChartEmbed data={pieChartData} legendPosition={pieChartLegendPosition} />
            );
          return (
            <div {...rest} className={className}>
              {children}
            </div>
          );
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function ColumnGrid({
  cells,
  lineChartData,
  barChartData,
  pieChartData,
  pieChartLegendPosition,
  barChartStacked,
  lineChartArea,
  lineChartEndMarker,
  mermaidNodes,
}: {
  cells: string[];
  lineChartData?: SlideChartRow[];
  barChartData?: SlideChartRow[];
  pieChartData?: SlideChartRow[];
  pieChartLegendPosition?: PieChartLegendPosition;
  barChartStacked?: boolean;
  lineChartArea?: boolean;
  lineChartEndMarker?: LineChartEndMarker;
  mermaidNodes?: MermaidNodeStyle;
}) {
  const n = Math.min(4, Math.max(1, cells.length));
  return (
    <div className={`slide-columns slide-columns--${n} slide-columns--ruled`}>
      {cells.map((cell, i) => (
        <div key={i} className="slide-columns__cell">
          <SlideMarkdownBody
            markdown={cell}
            lineChartData={lineChartData}
            barChartData={barChartData}
            pieChartData={pieChartData}
            pieChartLegendPosition={pieChartLegendPosition}
            barChartStacked={barChartStacked}
            lineChartArea={lineChartArea}
            lineChartEndMarker={lineChartEndMarker}
            mermaidNodes={mermaidNodes}
          />
        </div>
      ))}
    </div>
  );
}

interface SlideMarkdownProps {
  markdown: string;
  /** From slide YAML `lineChart:` — wired to `<div class="slide-embed-line-chart">` */
  lineChartData?: SlideChartRow[];
  /** From slide YAML `barChart:` — wired to `<div class="slide-embed-bar-chart">` */
  barChartData?: SlideChartRow[];
  /** From slide YAML `pieChart:` — wired to `<div class="slide-embed-pie-chart">` */
  pieChartData?: SlideChartRow[];
  /** From slide YAML `pieChartLegendPosition:` */
  pieChartLegendPosition?: PieChartLegendPosition;
  /** From slide YAML `barChartStacked: true` */
  barChartStacked?: boolean;
  /** From slide YAML `lineChartArea:` / `area:` */
  lineChartArea?: boolean;
  /** From slide YAML `lineChartEndMarker:` / `lineEndMarker:` */
  lineChartEndMarker?: LineChartEndMarker;
  /** From slide YAML `mermaidNodes:` */
  mermaidNodes?: MermaidNodeStyle;
}

export function SlideMarkdown({
  markdown,
  lineChartData,
  barChartData,
  pieChartData,
  pieChartLegendPosition,
  barChartStacked,
  lineChartArea,
  lineChartEndMarker,
  mermaidNodes,
}: SlideMarkdownProps) {
  const segments = useMemo(() => parseSlideSegments(markdown), [markdown]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <SlideMarkdownBody
            key={i}
            markdown={seg.content}
            lineChartData={lineChartData}
            barChartData={barChartData}
            pieChartData={pieChartData}
            pieChartLegendPosition={pieChartLegendPosition}
            barChartStacked={barChartStacked}
            lineChartArea={lineChartArea}
            lineChartEndMarker={lineChartEndMarker}
            mermaidNodes={mermaidNodes}
          />
        ) : (
          <ColumnGrid
            key={i}
            cells={seg.cells}
            lineChartData={lineChartData}
            barChartData={barChartData}
            pieChartData={pieChartData}
            pieChartLegendPosition={pieChartLegendPosition}
            barChartStacked={barChartStacked}
            lineChartArea={lineChartArea}
            lineChartEndMarker={lineChartEndMarker}
            mermaidNodes={mermaidNodes}
          />
        ),
      )}
    </>
  );
}
