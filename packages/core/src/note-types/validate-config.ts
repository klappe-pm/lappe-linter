import {ConfigError, LinterConfig} from '../config/types';

function isFlatScalar(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isFlatList(value: unknown): boolean {
  return Array.isArray(value) && value.every(isFlatScalar);
}

/**
 * Loader-side validation of the note-types section (spec R4): managed keys
 * carry flat scalars and flat lists only; nested maps are a validation error.
 */
export function validateNoteTypes(config: LinterConfig): ConfigError[] {
  const errors: ConfigError[] = [];
  const types = config['note-types'] ?? {};
  for (const [name, schema] of Object.entries(types)) {
    const base = `note-types.${name}`;
    if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
      errors.push({path: base, message: 'note-type schema must be a map'});
      continue;
    }
    const raw = schema as Record<string, unknown>;

    const required = raw['required'];
    if (required !== undefined) {
      if (required === null || typeof required !== 'object' || Array.isArray(required)) {
        errors.push({path: `${base}.required`, message: 'required must be a map of key to default'});
      } else {
        for (const [key, defaultValue] of Object.entries(required as Record<string, unknown>)) {
          if (defaultValue === null || isFlatScalar(defaultValue) || isFlatList(defaultValue)) {
            continue;
          }
          errors.push({
            path: `${base}.required.${key}`,
            message: 'default must be a flat scalar, a flat list, or null; nested maps are not allowed',
          });
        }
      }
    }

    const values = raw['values'];
    if (values !== undefined) {
      if (values === null || typeof values !== 'object' || Array.isArray(values)) {
        errors.push({path: `${base}.values`, message: 'values must be a map of key to allowed list'});
      } else {
        for (const [key, allowed] of Object.entries(values as Record<string, unknown>)) {
          if (!isFlatList(allowed)) {
            errors.push({
              path: `${base}.values.${key}`,
              message: 'allowed values must be a list of flat scalars',
            });
          }
        }
      }
    }

    const keyOrder = raw['key-order'];
    if (keyOrder !== undefined &&
        !(Array.isArray(keyOrder) && keyOrder.every((key) => typeof key === 'string'))) {
      errors.push({path: `${base}.key-order`, message: 'key-order must be a list of key names'});
    }

    const dateKeys = raw['date-keys'];
    if (dateKeys !== undefined) {
      if (dateKeys === null || typeof dateKeys !== 'object' || Array.isArray(dateKeys)) {
        errors.push({path: `${base}.date-keys`, message: 'date-keys must be a map with created and revised'});
      } else {
        for (const field of ['created', 'revised']) {
          const value = (dateKeys as Record<string, unknown>)[field];
          if (value !== undefined && typeof value !== 'string') {
            errors.push({path: `${base}.date-keys.${field}`, message: `${field} must be a key name string`});
          }
        }
      }
    }
  }
  return errors;
}
