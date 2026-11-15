export interface RichTextInlineToken {
  type: 'text' | 'code' | 'link' | 'strong';
  text: string;
  href?: string;
}

export interface RichTextBlock {
  type: 'paragraph' | 'codeblock' | 'list';
  language?: string;
  content?: string;
  items?: RichTextInlineToken[][];
  tokens?: RichTextInlineToken[];
}

export function isSafeExternalUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  // Reject control characters or leading protocol-relative URLs
  if (/[\u0000-\u001F\u007F]/.test(trimmed) || trimmed.startsWith('//')) {
    return false;
  }

  // Allow safe internal CTF artifact download links only
  if (/^\/api\/ctf\/\d+\/artifact$/.test(trimmed)) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function tokenizeInline(line: string): RichTextInlineToken[] {
  const tokens: RichTextInlineToken[] = [];
  // Matches: `code` | [label](url) | **bold** | bare https?://... URL
  const pattern = /(`[^`]+`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|https?:\/\/[^\s<>()]+)/g;
  let lastIndex = 0;

  for (const match of line.matchAll(pattern)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      tokens.push({ type: 'text', text: line.slice(lastIndex, idx) });
    }

    const full = match[0];
    if (full.startsWith('`') && full.endsWith('`') && full.length >= 2) {
      tokens.push({ type: 'code', text: full.slice(1, -1) });
    } else if (full.startsWith('[') && match[2] && match[3]) {
      const label = match[2];
      const href = match[3];
      if (isSafeExternalUrl(href)) {
        tokens.push({ type: 'link', text: label, href });
      } else {
        tokens.push({ type: 'text', text: label });
      }
    } else if (full.startsWith('**') && match[4]) {
      tokens.push({ type: 'strong', text: match[4] });
    } else if (/^https?:\/\//i.test(full)) {
      const cleaned = full.replace(/[.,;:!?]+$/, '');
      const trailing = full.slice(cleaned.length);
      if (isSafeExternalUrl(cleaned)) {
        tokens.push({ type: 'link', text: cleaned, href: cleaned });
      } else {
        tokens.push({ type: 'text', text: cleaned });
      }
      if (trailing) {
        tokens.push({ type: 'text', text: trailing });
      }
    } else {
      tokens.push({ type: 'text', text: full });
    }

    lastIndex = idx + full.length;
  }

  if (lastIndex < line.length) {
    tokens.push({ type: 'text', text: line.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', text: line }];
}

export function parseSafeRichText(input: string): RichTextBlock[] {
  if (!input || typeof input !== 'string') return [];
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const blocks: RichTextBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const language = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({
        type: 'codeblock',
        language: language || 'text',
        content: codeLines.join('\n'),
      });
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: RichTextInlineToken[][] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(tokenizeInline(lines[i].replace(/^\s*[-*]\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    // Paragraph (join contiguous non-empty, non-list, non-code lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trimStart().startsWith('```') &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({
      type: 'paragraph',
      tokens: tokenizeInline(paraLines.join(' ')),
    });
  }

  return blocks;
}
