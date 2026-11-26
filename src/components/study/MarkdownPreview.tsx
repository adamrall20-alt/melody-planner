import React from 'react';

interface MarkdownPreviewProps {
  content: string;
}

function renderInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(text.slice(lastIdx, match.index));
    }
    const raw = match[0];
    if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push(
        <strong key={key++} className="font-extrabold text-[var(--text-main)]">
          {raw.slice(2, -2)}
        </strong>
      );
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push(
        <em key={key++} className="italic">
          {raw.slice(1, -1)}
        </em>
      );
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push(
        <code
          key={key++}
          className="rounded-md bg-[var(--pastel-sky)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-main)]"
        >
          {raw.slice(1, -1)}
        </code>
      );
    }
    lastIdx = match.index + raw.length;
  }

  if (lastIdx < text.length) {
    tokens.push(text.slice(lastIdx));
  }
  return tokens;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  lines.forEach((line, idx) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${idx}`}
            className="my-2 overflow-x-auto rounded-2xl border border-[var(--border-card)] bg-[var(--bg-subtle)] p-3 font-mono text-xs text-[var(--text-main)]"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={idx} className="mt-3 mb-1 text-sm font-extrabold text-[var(--text-main)]">
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={idx}
          className="mt-4 mb-1.5 border-b border-[var(--border-card)] pb-1 text-base font-extrabold text-[var(--text-main)]"
        >
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={idx} className="mt-2 mb-2 text-lg font-black text-[var(--text-main)]">
          {renderInline(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={idx}
          className="my-2 rounded-r-xl border-l-4 border-[var(--accent)] bg-[var(--pastel-sky)]/60 py-1.5 pr-3 pl-3 text-xs italic text-[var(--text-main)]"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
    } else if (/^- \[( |x|X)\] /.test(line)) {
      const checked = line[3].toLowerCase() === 'x';
      elements.push(
        <div key={idx} className="my-1 flex items-start gap-2 text-sm">
          <span
            className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
              checked
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-[var(--border-card)] bg-[var(--bg-card)]'
            }`}
          >
            {checked ? '✓' : ''}
          </span>
          <span className={checked ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]'}>
            {renderInline(line.slice(6))}
          </span>
        </div>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={idx} className="my-0.5 flex items-start gap-2 pl-1 text-sm text-[var(--text-main)]">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === '---') {
      elements.push(<hr key={idx} className="my-3 border-[var(--border-card)]" />);
    } else if (line.trim() === '') {
      elements.push(<div key={idx} className="h-2" />);
    } else {
      elements.push(
        <p key={idx} className="my-1 text-sm leading-relaxed text-[var(--text-main)]">
          {renderInline(line)}
        </p>
      );
    }
  });

  return <div className="space-y-0.5">{elements}</div>;
}
