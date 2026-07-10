import {NoteTypeSchema} from '../config/types';
import {CoreRuleOptions} from '../rule';

/**
 * The integrator threads config['note-types'][ctx.noteType] into rule options
 * as `schema`. Rules no-op when it is absent or malformed.
 */
export function schemaFrom(options: CoreRuleOptions): NoteTypeSchema | null {
  const schema = options['schema'];
  if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
    return schema as NoteTypeSchema;
  }
  return null;
}

export function keyOrderFrom(schema: NoteTypeSchema): string[] {
  const order = schema['key-order'];
  return Array.isArray(order) ? order.filter((key): key is string => typeof key === 'string') : [];
}
