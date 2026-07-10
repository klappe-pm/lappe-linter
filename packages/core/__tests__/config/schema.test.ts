import {linterConfigJsonSchema} from '../../src/config/schema';

describe('linterConfigJsonSchema', () => {
  it('is a draft-07 object schema requiring version', () => {
    expect(linterConfigJsonSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(linterConfigJsonSchema.type).toBe('object');
    expect(linterConfigJsonSchema.required).toEqual(['version']);
  });

  it('covers every LinterConfig top-level key', () => {
    const properties = linterConfigJsonSchema.properties as Record<string, unknown>;
    expect(Object.keys(properties).sort()).toEqual(
        ['defaults', 'ignore', 'note-types', 'profiles', 'providers', 'rename', 'version'],
    );
  });

  it('tolerates unknown top-level keys, matching the loader warning behavior', () => {
    expect(linterConfigJsonSchema.additionalProperties).toBe(true);
  });

  it('pins version to the const 1', () => {
    const properties = linterConfigJsonSchema.properties as Record<string, {const?: unknown}>;
    expect(properties.version.const).toBe(1);
  });

  it('is JSON-serializable for editor consumption', () => {
    expect(() => JSON.stringify(linterConfigJsonSchema)).not.toThrow();
    expect(JSON.parse(JSON.stringify(linterConfigJsonSchema))).toEqual(linterConfigJsonSchema);
  });
});
