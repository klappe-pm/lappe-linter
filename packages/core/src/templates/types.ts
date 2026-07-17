import {TemplateFrontmatterValue} from '../config/types';

/**
 * The effective template for one file after global -> scoped inheritance and
 * toggles are applied. Pure data; `renderTemplate` turns it into note text.
 */
export interface ResolvedTemplate {
  /** The scoped template that matched, or null when only the global base applies. */
  name: string | null;
  /** Application chain: 'global' first, then the matched scoped template name. */
  chain: string[];
  /** Effective frontmatter seed after inheritance and toggles. */
  frontmatter: Record<string, TemplateFrontmatterValue>;
  /** Effective pinned (template-owned) keys after toggles. */
  pinnedKeys: string[];
  /** Effective frontmatter key order; empty means fall back to the house order. */
  keyOrder: string[];
  /** Effective markdown body scaffold. */
  body: string;
  /** Whether to emit a trailing age line when a render `today` is supplied. */
  ageLine: boolean;
}

/** Options for `renderTemplate`. `today` must be supplied to fill dates/age. */
export interface RenderTemplateOptions {
  /** Note title, substituted for `{{title}}` in the body and any frontmatter value. */
  title?: string;
  /**
   * ISO yyyy-MM-dd "today". Required to fill null-valued date-created/date-revised
   * keys and to emit the age line. Core never reads the clock; the caller supplies it.
   */
  today?: string;
  /** Frontmatter key treated as the created date. */
  dateCreatedKey?: string;
  /** Frontmatter key treated as the revised date. */
  dateRevisedKey?: string;
}
