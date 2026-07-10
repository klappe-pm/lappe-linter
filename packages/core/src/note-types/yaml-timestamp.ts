import {CoreRule} from '../rule';
import {noteTypeDateKeys} from './note-type-date-keys';

/**
 * Mandatory timestamp management (dec-005): date-created is set on first lint
 * when absent and date-revised bumps only when the run changed other content
 * (same churn guard as note-type-date-keys, whose engine this reuses). Dates
 * are ISO yyyy-MM-dd; the runner injects `today` and `originalText`. Runs on
 * every file with frontmatter, no note-type schema required.
 */
export const yamlTimestamp: CoreRule = {
  id: 'yaml-timestamp',
  category: 'frontmatter',
  description: 'Keep date-created and date-revised current (yyyy-MM-dd): created set on first lint, revised bumped only when other content changed.',
  defaultOptions: {
    schema: {'date-keys': {created: 'date-created', revised: 'date-revised'}},
  },
  apply: (text, options, ctx) => noteTypeDateKeys.apply(text, options, ctx),
  examples: [
    {
      description: 'First lint sets both date keys at their ranked positions',
      before: '---\ndomain: development\n---\nBody.\n',
      after: '---\ndomain: development\ndate-created: 2026-07-10\ndate-revised: 2026-07-10\n---\nBody.\n',
      options: {
        schema: {'date-keys': {created: 'date-created', revised: 'date-revised'}},
        today: '2026-07-10',
        originalText: '---\ndomain: development\n---\nBody.\n',
      },
    },
  ],
};
