/**
 * JSON Schema (draft-07) for linter.yaml, mirroring LinterConfig in types.ts.
 * Intended for editor validation (yaml-language-server, VS Code). The loader
 * in loader.ts is the runtime authority; keep the two aligned.
 */

const scalar = {type: ['string', 'number', 'boolean']};

const scalarOrList = {
  oneOf: [scalar, {type: 'array', items: scalar}],
};

const ruleConfig = {
  type: 'object',
  properties: {
    enabled: {type: 'boolean', description: 'Turn this rule on or off for this scope.'},
  },
  additionalProperties: true,
};

const rules = {
  type: 'object',
  description: 'Mapping of rule id to rule config.',
  additionalProperties: ruleConfig,
};

const match = {
  type: 'object',
  description: 'Matchers deciding whether this entry applies to a file.',
  properties: {
    path: {type: 'array', items: {type: 'string'}, description: 'Vault-relative path globs (picomatch).'},
    extension: {type: 'array', items: {type: 'string'}, description: 'File extensions without the dot.'},
    frontmatter: {
      type: 'object',
      description: 'Frontmatter key-value predicates: exact match or list-contains.',
      additionalProperties: scalarOrList,
    },
    tag: {type: 'array', items: {type: 'string'}, description: 'Tag predicates matched against frontmatter tags.'},
  },
  additionalProperties: false,
};

export const linterConfigJsonSchema: Record<string, unknown> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'lappe-linter configuration (linter.yaml)',
  description: 'Control-plane schema for linter.yaml, version 1. Canonical filename is linter.yaml; lappe-linter.yaml is an accepted alias.',
  type: 'object',
  required: ['version'],
  properties: {
    version: {const: 1, description: 'Config schema version. Only 1 is valid.'},
    defaults: {
      type: 'object',
      description: 'Rule configuration applied to every file unless a profile overrides it.',
      properties: {rules},
      additionalProperties: false,
    },
    profiles: {
      type: 'object',
      description: 'Named rule overrides applied when a file matches.',
      additionalProperties: {
        type: 'object',
        properties: {match, rules},
        additionalProperties: false,
      },
    },
    'note-types': {
      type: 'object',
      description: 'Frontmatter schemas per note type.',
      additionalProperties: {
        type: 'object',
        properties: {
          required: {
            type: 'object',
            description: 'Required keys; value is the default inserted when absent (null = no default).',
            additionalProperties: {
              oneOf: [scalar, {type: 'array', items: scalar}, {type: 'null'}],
            },
          },
          'key-order': {
            type: 'array',
            items: {type: 'string'},
            description: 'Key order; unlisted keys sort alphabetically after these.',
          },
          values: {
            type: 'object',
            description: 'Allowed value sets per key.',
            additionalProperties: {type: 'array', items: scalar},
          },
          'date-keys': {
            type: 'object',
            description: 'Keys managed as dates.',
            properties: {
              created: {type: 'string'},
              revised: {type: 'string'},
            },
            additionalProperties: false,
          },
          match,
        },
        additionalProperties: false,
      },
    },
    rename: {
      type: 'object',
      description: 'Filename rule behavior.',
      required: ['mode'],
      properties: {
        mode: {
          enum: ['off', 'flag', 'rename'],
          description: 'off = rule disabled, flag = report only, rename = fix with link updates.',
        },
      },
      additionalProperties: false,
    },
    ignore: {
      type: 'object',
      description: 'Paths the linter never touches.',
      properties: {
        folders: {type: 'array', items: {type: 'string'}},
        files: {type: 'array', items: {type: 'string'}},
      },
      additionalProperties: false,
    },
    providers: {
      type: 'object',
      description: 'Provider config namespaces; each mirrors defaults.',
      additionalProperties: {
        type: 'object',
        properties: {rules},
        additionalProperties: false,
      },
    },
  },
  additionalProperties: true,
};
