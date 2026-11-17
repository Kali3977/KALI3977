import React from 'react';
import { ExternalLink } from 'lucide-react';
import {
  parseSafeRichText,
  type RichTextBlock,
  type RichTextInlineToken,
} from '../lib/domain/rich-text';

function renderTokens(tokens: RichTextInlineToken[], keyPrefix: string) {
  return tokens.map((tok, idx) => {
    const k = `${keyPrefix}-t-${idx}`;
    if (tok.type === 'code') {
      return (
        <code
          key={k}
          className="rounded bg-slate-100 dark:bg-[#0A0D12] px-1.5 py-0.5 font-mono text-[12px] text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-slate-800 [overflow-wrap:anywhere]"
        >
          {tok.text}
        </code>
      );
    }
    if (tok.type === 'strong') {
      return (
        <strong key={k} className="font-semibold text-slate-900 dark:text-slate-100 [overflow-wrap:anywhere]">
          {tok.text}
        </strong>
      );
    }
    if (tok.type === 'link' && tok.href) {
      const isInternalArtifact = tok.href.startsWith('/api/ctf/');
      return (
        <a
          key={k}
          href={tok.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1 font-medium text-cyan-600 dark:text-cyan-400 underline underline-offset-2 hover:text-cyan-500 break-all"
        >
          <span>{tok.text}</span>
          {!isInternalArtifact && <ExternalLink className="h-3 w-3 shrink-0 inline" />}
        </a>
      );
    }
    return <React.Fragment key={k}>{tok.text}</React.Fragment>;
  });
}

function renderBlock(block: RichTextBlock, idx: number) {
  const key = `blk-${idx}`;
  if (block.type === 'codeblock') {
    return (
      <pre
        key={key}
        className="w-full max-w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3 font-mono text-xs text-emerald-700 dark:text-emerald-300 whitespace-pre"
      >
        <code>{block.content || ''}</code>
      </pre>
    );
  }
  if (block.type === 'list') {
    return (
      <ul key={key} className="list-disc pl-5 space-y-1 text-sm text-slate-600 dark:text-slate-300 min-w-0">
        {(block.items || []).map((itemTokens, itemIdx) => (
          <li key={`${key}-li-${itemIdx}`} className="leading-relaxed [overflow-wrap:anywhere]">
            {renderTokens(itemTokens, `${key}-${itemIdx}`)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p key={key} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 [overflow-wrap:anywhere]">
      {renderTokens(block.tokens || [], key)}
    </p>
  );
}

export const SafeRichText: React.FC<{ content: string; className?: string }> = ({
  content,
  className = 'space-y-2.5 min-w-0',
}) => {
  const blocks = parseSafeRichText(content);
  return <div className={`${className} min-w-0 max-w-full`}>{blocks.map((b, i) => renderBlock(b, i))}</div>;
};
