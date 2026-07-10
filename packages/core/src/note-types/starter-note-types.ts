import {NoteTypeSchema} from '../config/types';

/** House frontmatter key order per the markdown-style guide. */
export const STARTER_KEY_ORDER = [
  'domain',
  'category',
  'sub-category',
  'date-created',
  'date-revised',
  'type',
  'status',
  'aliases',
  'tags',
];

export const STARTER_STATUS_VALUES = ['NEW', 'DRAFT', 'INPRG', 'REVIEW', 'DONE', 'ARCHIVED'];

function starterSchema(type: string): NoteTypeSchema {
  return {
    'required': {
      'domain': null,
      'category': null,
      'sub-category': null,
      type,
      'status': 'NEW',
      'aliases': [],
      'tags': [],
    },
    'key-order': [...STARTER_KEY_ORDER],
    'values': {
      type: [type],
      status: [...STARTER_STATUS_VALUES],
    },
    'date-keys': {created: 'date-created', revised: 'date-revised'},
    'match': {frontmatter: {type}},
  };
}

/** Six starter note types; users extend or override them in linter.yaml. */
export const starterNoteTypes: Record<string, NoteTypeSchema> = {
  project: starterSchema('project'),
  feature: starterSchema('feature'),
  epic: starterSchema('epic'),
  task: starterSchema('task'),
  daily: starterSchema('daily'),
  reference: starterSchema('reference'),
};
