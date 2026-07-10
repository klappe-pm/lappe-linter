import {LinterConfig} from '../../src/config/types';
import {starterNoteTypes, validateNoteTypes} from '../../src/note-types';

const config = (noteTypes: unknown): LinterConfig =>
  ({version: 1, 'note-types': noteTypes} as LinterConfig);

describe('validateNoteTypes', () => {
  it('accepts the starter note types', () => {
    expect(validateNoteTypes(config(starterNoteTypes))).toEqual([]);
  });

  it('accepts a config with no note-types section', () => {
    expect(validateNoteTypes({version: 1})).toEqual([]);
  });

  it('rejects a nested map as a required default', () => {
    const errors = validateNoteTypes(config({
      task: {required: {status: {state: 'NEW'}}},
    }));
    expect(errors).toEqual([{
      path: 'note-types.task.required.status',
      message: 'default must be a flat scalar, a flat list, or null; nested maps are not allowed',
    }]);
  });

  it('rejects a list default containing a map', () => {
    const errors = validateNoteTypes(config({
      task: {required: {tags: ['ok', {bad: true}]}},
    }));
    expect(errors.map((e) => e.path)).toEqual(['note-types.task.required.tags']);
  });

  it('rejects non-list enum constraints and non-scalar enum members', () => {
    const errors = validateNoteTypes(config({
      task: {values: {status: 'NEW', type: [{nested: true}]}},
    }));
    expect(errors.map((e) => e.path).sort()).toEqual([
      'note-types.task.values.status',
      'note-types.task.values.type',
    ]);
  });

  it('rejects a malformed key-order and date-keys', () => {
    const errors = validateNoteTypes(config({
      task: {'key-order': 'domain', 'date-keys': {created: 42}},
    }));
    expect(errors.map((e) => e.path).sort()).toEqual([
      'note-types.task.date-keys.created',
      'note-types.task.key-order',
    ]);
  });

  it('rejects a schema that is not a map', () => {
    const errors = validateNoteTypes(config({task: ['not', 'a', 'map']}));
    expect(errors).toEqual([{path: 'note-types.task', message: 'note-type schema must be a map'}]);
  });
});
