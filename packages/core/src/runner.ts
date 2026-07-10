import {CoreRule, CoreRuleContext, CoreRuleOptions, getRule, getRules} from './rule';

export interface RuleViolation {
  rule: string;
  message: string;
  line?: number;
  fixed: boolean;
}

export interface RunResult {
  text: string;
  violations: RuleViolation[];
  changed: boolean;
}

/**
 * Per-rule enablement plus options, as resolved from `linter.yaml` for one
 * file. `enabled: false` disables a rule for this scope regardless of defaults.
 */
export type ResolvedRuleConfig = Record<string, {enabled?: boolean; options?: CoreRuleOptions}>;

export interface RunOptions {
  /** Resolved per-rule config for this file. Absent => rule uses its defaults but stays disabled. */
  rules?: ResolvedRuleConfig;
  ctx?: CoreRuleContext;
  /** Restrict the run to these rule ids, in this order. Defaults to registry order. */
  only?: string[];
  /**
   * Reorder the enabled rules: ids listed here run first in this order, the
   * rest keep registry order. Enablement is unchanged (unlike `only`). Ignored
   * when `only` is set.
   */
  order?: string[];
}

/** Stable reorder: `order` ids first in that order, remaining rules keep their relative order. */
function applyOrder(rules: CoreRule[], order: string[] | undefined): CoreRule[] {
  if (!order || order.length === 0) {
    return rules;
  }
  const rank = new Map(order.map((id, index) => [id, index]));
  return rules
      .map((rule, index) => ({rule, index}))
      .sort((a, b) => {
        const ra = rank.has(a.rule.id) ? rank.get(a.rule.id)! : order.length + a.index;
        const rb = rank.has(b.rule.id) ? rank.get(b.rule.id)! : order.length + b.index;
        return ra - rb || a.index - b.index;
      })
      .map((entry) => entry.rule);
}

function optionsFor(rule: CoreRule, cfg: ResolvedRuleConfig): CoreRuleOptions {
  return {...(rule.defaultOptions ?? {}), ...(cfg[rule.id]?.options ?? {})};
}

function isEnabled(rule: CoreRule, cfg: ResolvedRuleConfig): boolean {
  return cfg[rule.id]?.enabled === true;
}

/**
 * Run the enabled rules over `text` in order. Pure and synchronous: identical
 * inputs yield identical output, which is what makes plugin/CLI parity provable.
 */
export function runRules(text: string, opts: RunOptions = {}): RunResult {
  const cfg = opts.rules ?? {};
  const rules = opts.only ?
    opts.only.map((id) => getRule(id)).filter((r): r is CoreRule => Boolean(r)) :
    applyOrder(getRules().filter((rule) => isEnabled(rule, cfg)), opts.order);

  const original = text;
  const violations: RuleViolation[] = [];
  let current = text;

  for (const rule of rules) {
    const options = optionsFor(rule, cfg);
    if (rule.reportOnly) {
      const next = rule.apply(current, options, opts.ctx);
      if (next !== current) {
        violations.push({rule: rule.id, message: rule.description, fixed: false});
      }
      continue;
    }
    const next = rule.apply(current, options, opts.ctx);
    if (next !== current) {
      violations.push({rule: rule.id, message: rule.description, fixed: true});
      current = next;
    }
  }

  return {text: current, violations, changed: current !== original};
}
