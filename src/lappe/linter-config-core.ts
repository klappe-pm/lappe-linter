/* eslint-disable no-control-regex -- ported module uses private-use (\u0000-\u0002) sentinel tokens as placeholders. */
export type HeadingCase =
  | 'kebab-case'
  | 'camelCase'
  | 'PascalCase'
  | 'sentence-case'
  | 'Title Case'
  | 'lowercase'
  | 'UPPERCASE'
  | 'unchanged';

export type BlankLineCount = 0 | 1 | 2;
export type EmphasisAction = 'keep' | 'normalize' | 'remove';
export type UnderscoreAction = 'keep' | 'convert-to-asterisk' | 'remove';
export type HighlightAction = 'keep' | 'remove';
export type ReflowMode = 'soft-wrap' | 'fixed-column';
export type OrderedMarker = 'sequential' | 'all-ones';
export type RuleSortMode = 'alphabetical' | 'manual';
export type StructuralAction = 'keep' | 'normalize' | 'remove';
export type PreviewMode = 'linter' | 'base';
export type ScopeType = 'domain' | 'category' | 'sub-category' | 'folder' | 'project' | 'tag';

export interface LinterRuleConfig {
  headingCaseByLevel: Record<1 | 2 | 3 | 4 | 5 | 6, HeadingCase>;
  blankLinesBeforeHeading: BlankLineCount;
  blankLinesAfterHeading: BlankLineCount;
  blankLinesBetweenParagraphs: BlankLineCount;
  blankLinesBetweenListItems: BlankLineCount;
  unorderedMarker: '-' | '*';
  orderedMarker: OrderedMarker;
  bold: EmphasisAction;
  italic: EmphasisAction;
  underscore: UnderscoreAction;
  highlight: HighlightAction;
  stripHardBreaks: boolean;
  stripHtmlBreaks: boolean;
  reflowMode: ReflowMode;
  columnWidth: number;
  ruleSortMode: RuleSortMode;
  codeBlocks: StructuralAction;
  blockQuotes: StructuralAction;
  tables: StructuralAction;
  callouts: StructuralAction;
  scopedRules: ScopeDefinition[];
}

export interface BaseTemplateConfig {
  name: string;
  scope: ScopeDefinition[];
  folder: string;
  domain: string;
  category: string;
  subCategory: string;
  project: string[];
  tags: string[];
  aliases: string[];
  templateBody: string;
  pinnedOverrideKeys: string[];
}

export interface ScopeDefinition {
  type: ScopeType;
  values: string[];
}

export interface LinterConfigPreviewSettings {
  linter: LinterRuleConfig;
  baseTemplate: BaseTemplateConfig;
}

export interface RenderPreviewInput {
  mode: PreviewMode;
  settings: LinterConfigPreviewSettings;
  today?: string;
}

export const DEFAULT_LINTER_CONFIG: LinterRuleConfig = {
  headingCaseByLevel: {
    1: 'Title Case',
    2: 'sentence-case',
    3: 'sentence-case',
    4: 'sentence-case',
    5: 'sentence-case',
    6: 'sentence-case',
  },
  blankLinesBeforeHeading: 1,
  blankLinesAfterHeading: 1,
  blankLinesBetweenParagraphs: 1,
  blankLinesBetweenListItems: 0,
  unorderedMarker: '-',
  orderedMarker: 'sequential',
  bold: 'normalize',
  italic: 'normalize',
  underscore: 'convert-to-asterisk',
  highlight: 'keep',
  stripHardBreaks: true,
  stripHtmlBreaks: true,
  reflowMode: 'soft-wrap',
  columnWidth: 80,
  ruleSortMode: 'manual',
  codeBlocks: 'keep',
  blockQuotes: 'keep',
  tables: 'keep',
  callouts: 'keep',
  scopedRules: [],
};

export const DEFAULT_BASE_TEMPLATE: BaseTemplateConfig = {
  name: 'Product note',
  scope: [{type: 'domain', values: ['product']}],
  folder: 'Product Management',
  domain: 'product',
  category: 'strategy',
  subCategory: 'discovery',
  project: ['product-management'],
  tags: [],
  aliases: [],
  templateBody: '# Product Note\n\n## Summary\n\nCapture the intent, decision, and next action.\n',
  pinnedOverrideKeys: [],
};

export const DEFAULT_LINTER_PREVIEW_SETTINGS: LinterConfigPreviewSettings = {
  linter: DEFAULT_LINTER_CONFIG,
  baseTemplate: DEFAULT_BASE_TEMPLATE,
};

const PINNED_RULE_ORDER = ['emphasis', 'heading-casing', 'heading-spacing', 'paragraph-spacing', 'list-spacing', 'wrapping'];
const FRONTMATTER_ORDER = ['domain', 'category', 'sub-category', 'date-created', 'date-revised'];

export function mergeLinterPreviewSettings(
    loaded: Partial<LinterConfigPreviewSettings> | undefined,
): LinterConfigPreviewSettings {
  return {
    linter: {
      ...DEFAULT_LINTER_CONFIG,
      ...(loaded?.linter ?? {}),
      headingCaseByLevel: {
        ...DEFAULT_LINTER_CONFIG.headingCaseByLevel,
        ...(loaded?.linter?.headingCaseByLevel ?? {}),
      },
      scopedRules: loaded?.linter?.scopedRules ?? DEFAULT_LINTER_CONFIG.scopedRules,
    },
    baseTemplate: {
      ...DEFAULT_BASE_TEMPLATE,
      ...(loaded?.baseTemplate ?? {}),
      scope: loaded?.baseTemplate?.scope ?? DEFAULT_BASE_TEMPLATE.scope,
      project: loaded?.baseTemplate?.project ?? DEFAULT_BASE_TEMPLATE.project,
      tags: loaded?.baseTemplate?.tags ?? DEFAULT_BASE_TEMPLATE.tags,
      aliases: loaded?.baseTemplate?.aliases ?? DEFAULT_BASE_TEMPLATE.aliases,
      pinnedOverrideKeys: loaded?.baseTemplate?.pinnedOverrideKeys ?? DEFAULT_BASE_TEMPLATE.pinnedOverrideKeys,
    },
  };
}

export function renderConfigPreview(input: RenderPreviewInput): string {
  const seeded = renderBaseNote(input.settings.baseTemplate, input.today);
  if (input.mode === 'base') {
    return seeded;
  }
  return applyLinterConfig(sampleLinterNote(seeded), input.settings.linter);
}

export function renderBaseNote(config: BaseTemplateConfig, today = isoToday()): string {
  const created = previousIsoDate(today);
  const frontmatter = orderedFrontmatter({
    'domain': config.domain,
    'category': config.category,
    'sub-category': config.subCategory,
    'date-created': created,
    'date-revised': today,
    'folder': config.folder,
    'project': config.project,
    'aliases': config.aliases,
    'tags': config.tags,
    'template-binding': config.name,
    'template-scope': describeScopes(config.scope),
    'pinned-overrides': config.pinnedOverrideKeys,
  });
  return `${frontmatter}\n${config.templateBody.trim()}\n\n> age: ${ageBucket(created, today)}\n`;
}

export function applyLinterConfig(markdown: string, config: LinterRuleConfig): string {
  const frontmatter = markdown.match(/^---\n[\s\S]*?\n---(?=\n|$)/)?.[0] ?? '';
  const body = frontmatter ? markdown.slice(frontmatter.length) : markdown;
  let next = body;
  next = normalizeEmphasis(next, config);
  next = normalizeSpecialFormatting(next, config);
  const protectedCode = protectCodeBlocks(next);
  next = protectedCode.markdown;
  next = applyHeadingCasing(next, config);
  next = normalizeListMarkers(next, config);
  next = normalizeBlocks(next, config);
  next = applyWrapping(next, config);
  next = restoreCodeBlocks(next, protectedCode.blocks);
  const formatted = next.trim();
  return frontmatter ? `${frontmatter}\n${formatted}\n` : `${formatted}\n`;
}

export function ageBucket(dateCreated: string, today = isoToday()): string {
  const createdMs = Date.parse(`${dateCreated}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const diffDays = Number.isFinite(createdMs) && Number.isFinite(todayMs) ?
    Math.floor((todayMs - createdMs) / 86_400_000) :
    1;
  const days = Math.max(diffDays, 1);
  const n = Math.ceil(days / 5);
  return `${(n - 1) * 5 + 1}-${n * 5}`;
}

export function ruleExecutionOrder(config: LinterRuleConfig): string[] {
  const editable = ['code-blocks', 'quotes', 'tables', 'callouts'];
  const sorted = config.ruleSortMode === 'alphabetical' ? [...editable].sort() : editable;
  return [...PINNED_RULE_ORDER, ...sorted];
}

function sampleLinterNote(baseNote: string): string {
  const body = [
    '# **north star** ==launch vision==',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.',
    '# _second north star_',
    'This paragraph is intentionally hard',
    'wrapped so soft-wrap behavior is visible.',
    '## **strategy choice**',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    '## _second strategy choice_',
    'Lorem ipsum dolor sit amet.',
    '### ==opportunity space==',
    'Lorem ipsum dolor sit amet.',
    '### **second opportunity**',
    'Lorem ipsum dolor sit amet.',
    '#### _feature candidate_',
    'Lorem ipsum dolor sit amet.',
    '#### ==second feature candidate==',
    'Lorem ipsum dolor sit amet.',
    '##### **experiment plan**',
    'Lorem ipsum dolor sit amet.',
    '##### _second experiment plan_',
    'Lorem ipsum dolor sit amet.',
    '###### ==validation readout==',
    'Lorem ipsum dolor sit amet.',
    '###### **second validation readout**',
    'Lorem ipsum dolor sit amet.',
    '- first list item',
    '- second list item',
    '1. first ordered item',
    '2. second ordered item<br>',
    '> [!NOTE] a useful callout',
    '> supporting quoted context',
    '| signal | decision |',
    '| --- | --- |',
    '| clear | continue |',
    '```ts',
    'const nextStep = true;',
    '```',
  ].join('\n');
  return `${baseNote.trim()}\n\n${body}`;
}

function normalizeEmphasis(markdown: string, config: LinterRuleConfig): string {
  let next = markdown;
  if (config.highlight === 'remove') {
    next = next.replace(/==([^=\n]+)==/g, '$1');
  }
  if (config.bold === 'remove') {
    next = next.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  } else if (config.bold === 'normalize') {
    next = next.replace(/__([^_\n]+)__/g, '**$1**');
  }
  if (config.underscore === 'remove') {
    next = next.replace(/_([^_\n]+)_/g, '$1');
  } else if (config.underscore === 'convert-to-asterisk') {
    next = next.replace(/_([^_\n]+)_/g, '*$1*');
  }
  if (config.italic === 'remove') {
    next = next.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
  } else if (config.italic === 'normalize') {
    next = next.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '_$1_');
  }
  return next;
}

function normalizeSpecialFormatting(markdown: string, config: LinterRuleConfig): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    const fence = line.match(/^\s*(```|~~~)(.*)$/);
    if (fence) {
      if (config.codeBlocks === 'remove') {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (config.codeBlocks === 'normalize') {
        if (!inCodeBlock) {
          const language = fence[2].trim();
          output.push(language ? `\`\`\`${language}` : '```');
        } else {
          output.push('```');
        }
      } else {
        output.push(line);
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      output.push(line);
      continue;
    }

    const callout = line.match(/^\s*>\s*\[!([^\]\s]+)\]([+-])?\s*(.*)$/);
    if (callout && config.callouts !== 'keep') {
      const body = callout[3].trim();
      if (config.callouts === 'remove') {
        output.push(body ? `> ${body}` : '>');
      } else {
        const fold = callout[2] ?? '';
        output.push(`> [!${callout[1].toUpperCase()}]${fold}${body ? ` ${body}` : ''}`);
      }
      continue;
    }

    if (/^\s*>/.test(line) && config.blockQuotes !== 'keep') {
      if (config.blockQuotes === 'remove') {
        output.push(line.replace(/^\s*>\s?/, ''));
      } else {
        output.push(line.replace(/^\s*>\s?/, '> '));
      }
      continue;
    }

    if (isTableLike(line) && config.tables !== 'keep') {
      output.push(config.tables === 'remove' ? line.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim() : normalizeTableRow(line));
      continue;
    }
    output.push(line);
  }
  return output.join('\n');
}

function protectCodeBlocks(markdown: string): { markdown: string; blocks: string[] } {
  const blocks: string[] = [];
  const output: string[] = [];
  let current: string[] | null = null;
  let inCodeBlock = false;
  for (const line of markdown.split('\n')) {
    const fence = /^\s*(```|~~~)/.test(line);
    if (inCodeBlock) {
      current!.push(line);
      if (fence) {
        output.push(`\u0002${blocks.length}\u0002`);
        blocks.push(current!.join('\n'));
        current = null;
        inCodeBlock = false;
      }
    } else if (fence) {
      current = [line];
      inCodeBlock = true;
    } else {
      output.push(line);
    }
  }
  if (current) {
    output.push(`\u0002${blocks.length}\u0002`);
    blocks.push(current.join('\n'));
  }
  return {markdown: output.join('\n'), blocks};
}

function restoreCodeBlocks(markdown: string, blocks: string[]): string {
  return markdown.replace(/\u0002(\d+)\u0002/g, (_match, index: string) => blocks[Number(index)] ?? '');
}

function normalizeTableRow(line: string): string {
  const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());
  return `| ${cells.join(' | ')} |`;
}

function isTableLike(line: string): boolean {
  const trimmed = line.trim();
  const pipeCount = (trimmed.match(/\|/g) ?? []).length;
  return pipeCount >= 2 || trimmed.startsWith('|') || trimmed.endsWith('|');
}

function applyHeadingCasing(markdown: string, config: LinterRuleConfig): string {
  return markdown.replace(/^(#{1,6})\s+(.+)$/gm, (_match, hashes: string, text: string) => {
    const level = hashes.length as 1 | 2 | 3 | 4 | 5 | 6;
    return `${hashes} ${caseHeadingText(text, config.headingCaseByLevel[level])}`;
  });
}

function caseHeadingText(text: string, mode: HeadingCase): string {
  const tokens: string[] = [];
  const plain = text.replace(/(\*\*|__|==|_|`|\*)/g, (marker) => {
    tokens.push(marker);
    return `\u0000${tokens.length - 1}\u0000`;
  });
  const cased = casePlainText(plain, mode);
  return cased.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => tokens[Number(index)] ?? '');
}

function casePlainText(text: string, mode: HeadingCase): string {
  if (mode === 'unchanged') return text;
  const words = text
      .replace(/[-_]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  if (mode === 'kebab-case') return words.map((word) => word.toLowerCase()).join('-');
  if (mode === 'camelCase') return words.map((word, index) => index === 0 ? word.toLowerCase() : capitalize(word)).join('');
  if (mode === 'PascalCase') return words.map(capitalize).join('');
  if (mode === 'lowercase') return text.toLowerCase();
  if (mode === 'UPPERCASE') return text.toUpperCase();
  if (mode === 'Title Case') return words.map(capitalize).join(' ');
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function normalizeListMarkers(markdown: string, config: LinterRuleConfig): string {
  let ordered = 0;
  return markdown
      .split('\n')
      .map((line) => {
        const match = line.match(/^(\s*)([-*]|\d+\.)\s+/);
        if (!match) {
          if (!line.trim()) ordered = 0;
          return line;
        }
        const indent = match[1];
        const marker = match[2];
        if (marker === '-' || marker === '*') {
          ordered = 0;
          return line.replace(/^(\s*)([-*])\s+/, `${indent}${config.unorderedMarker} `);
        }
        ordered += 1;
        return line.replace(/^(\s*)\d+\.\s+/, `${indent}${config.orderedMarker === 'all-ones' ? 1 : ordered}. `);
      })
      .join('\n');
}

function normalizeBlocks(markdown: string, config: LinterRuleConfig): string {
  let next = config.stripHtmlBreaks ? markdown.replace(/<br\s*\/?>/gi, '') : markdown;
  next = next.replace(/[ \t]+$/gm, '');
  const lines = next.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const heading = /^(#{1,6})\s+/.test(line);
    if (heading) {
      trimBlankLines(out);
      pushBlankLines(out, config.blankLinesBeforeHeading);
      out.push(line);
      pushBlankLines(out, config.blankLinesAfterHeading);
    } else {
      out.push(line);
    }
  }
  return normalizeBlankLineRuns(out.join('\n'), config);
}

function normalizeBlankLineRuns(markdown: string, config: LinterRuleConfig): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (lines[index].trim() !== '') {
      out.push(lines[index]);
      index += 1;
      continue;
    }
    const start = index;
    while (index < lines.length && lines[index].trim() === '') index += 1;
    const previous = out.at(-1) ?? '';
    const next = lines[index] ?? '';
    const previousHeading = /^(#{1,6})\s+/.test(previous);
    const nextHeading = /^(#{1,6})\s+/.test(next);
    const previousList = /^\s*(?:[-*]|\d+\.)\s+/.test(previous);
    const nextList = /^\s*(?:[-*]|\d+\.)\s+/.test(next);
    const desired = previousHeading ?
      config.blankLinesAfterHeading :
      nextHeading ?
        config.blankLinesBeforeHeading :
        previousList && nextList ?
          config.blankLinesBetweenListItems :
          config.blankLinesBetweenParagraphs;
    if (out.length > 0 && next) {
      for (let blank = 0; blank < desired; blank += 1) out.push('');
    }
    if (start === 0 && out.length === 0) continue;
  }
  return out.join('\n');
}

function applyWrapping(markdown: string, config: LinterRuleConfig): string {
  if (config.stripHardBreaks || config.reflowMode === 'soft-wrap') {
    const protectedLines: string[] = [];
    let inCodeBlock = false;
    const tokenized = markdown
        .split('\n')
        .map((line) => {
          const fence = /^\s*(```|~~~)/.test(line);
          const table = isTableLike(line);
          if (inCodeBlock || fence || table) {
            const token = `\u0001${protectedLines.length}\u0001`;
            protectedLines.push(line);
            if (fence) inCodeBlock = !inCodeBlock;
            return token;
          }
          return line;
        })
        .join('\n');
    const wrapped = tokenized.replace(/([^\n])\n(?!\n|#{1,6}\s|[-*]\s|\d+\.\s|>|---|\u0001)/g, '$1 ');
    return wrapped.replace(/\u0001(\d+)\u0001/g, (_match, index: string) => protectedLines[Number(index)] ?? '');
  }
  if (config.reflowMode !== 'fixed-column') {
    return markdown;
  }
  const width = Math.max(40, Math.min(config.columnWidth, 140));
  return markdown
      .split(/\n{2,}/)
      .map((block) => (/^(#{1,6}\s|[-*]\s|\d+\.\s|>|---|```|~~~|\s*\|)/m.test(block) ? block : wrapText(block, width)))
      .join('\n\n');
}

function wrapText(text: string, width: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

function orderedFrontmatter(values: Record<string, string | string[]>): string {
  const keys = [
    ...FRONTMATTER_ORDER,
    ...Object.keys(values)
        .filter((key) => !FRONTMATTER_ORDER.includes(key) && key !== 'aliases' && key !== 'tags')
        .sort(),
    'aliases',
    'tags',
  ];
  const lines = ['---'];
  for (const key of keys) {
    const value = values[key];
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) lines.push(`  - ${quoteYaml(item)}`);
      }
    } else if (value !== undefined) {
      lines.push(`${key}: ${quoteYaml(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function describeScopes(scopes: ScopeDefinition[]): string[] {
  return scopes.map((scope) => `${scope.type}:${scope.values.join('|') || '*'}`);
}

function pushBlankLines(lines: string[], count: number): void {
  for (let index = 0; index < count; index += 1) {
    lines.push('');
  }
}

function trimBlankLines(lines: string[]): void {
  while (lines.at(-1) === '') {
    lines.pop();
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function quoteYaml(value: string): string {
  return value === '' || /[:#[\]{},"']|\s/.test(value) ? JSON.stringify(value) : value;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function previousIsoDate(date: string): string {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(timestamp) ?
    new Date(timestamp - 86_400_000).toISOString().slice(0, 10) :
    date;
}
