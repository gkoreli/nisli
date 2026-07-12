export interface QueryCodec<T> {
  parse(value: string | null): T;
  serialize(value: T): string | undefined;
  default(value: T): QueryCodec<T>;
}

function codec<T>(
  parse: (value: string | null) => T,
  serialize: (value: T) => string | undefined,
): QueryCodec<T> {
  return {
    parse,
    serialize,
    default(defaultValue) {
      return codec(
        (value) => value === null ? defaultValue : parse(value),
        (value) => Object.is(value, defaultValue) ? undefined : serialize(value),
      );
    },
  };
}

export function stringParam(): QueryCodec<string> {
  return codec(
    (value) => {
      if (value === null) throw new TypeError('Missing required string query parameter');
      return value;
    },
    (value) => value,
  );
}

export function numberParam(): QueryCodec<number> {
  return codec(
    (value) => {
      if (value === null || value.trim() === '') throw new TypeError('Missing required number query parameter');
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new TypeError(`Invalid number query parameter: ${value}`);
      return parsed;
    },
    (value) => {
      if (!Number.isFinite(value)) throw new TypeError(`Invalid number query value: ${value}`);
      return String(value);
    },
  );
}

export function booleanParam(): QueryCodec<boolean> {
  return codec(
    (value) => {
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      throw new TypeError(value === null ? 'Missing required boolean query parameter' : `Invalid boolean query parameter: ${value}`);
    },
    (value) => value ? 'true' : 'false',
  );
}

export function enumParam<const T extends readonly string[]>(values: T): QueryCodec<T[number]> {
  const allowed = new Set<string>(values);
  return codec(
    (value) => {
      if (value === null || !allowed.has(value)) throw new TypeError(`Expected one of: ${values.join(', ')}`);
      return value as T[number];
    },
    (value) => value,
  );
}

export function optional<T>(inner: QueryCodec<T>): QueryCodec<T | undefined> {
  return codec(
    (value) => value === null ? undefined : inner.parse(value),
    (value) => value === undefined ? undefined : inner.serialize(value),
  );
}
