const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const TAG = Object.freeze({
  null: 0,
  false: 1,
  true: 2,
  number: 3,
  string: 4,
  array: 5,
  object: 6,
  bytes: 7,
});

const u32 = (value) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
};

const f64 = (value) => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, value, true);
  return out;
};

const concat = (chunks) => {
  const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const encodeValue = (value) => {
  if (value === null) return Uint8Array.of(TAG.null);
  if (value === false) return Uint8Array.of(TAG.false);
  if (value === true) return Uint8Array.of(TAG.true);
  if (typeof value === 'number') return concat([Uint8Array.of(TAG.number), f64(value)]);
  if (typeof value === 'string') {
    const bytes = textEncoder.encode(value);
    return concat([Uint8Array.of(TAG.string), u32(bytes.length), bytes]);
  }
  if (value instanceof Uint8Array) {
    return concat([Uint8Array.of(TAG.bytes), u32(value.length), value]);
  }
  if (Array.isArray(value)) {
    return concat([Uint8Array.of(TAG.array), u32(value.length), ...value.map(encodeValue)]);
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return concat([
      Uint8Array.of(TAG.object),
      u32(entries.length),
      ...entries.flatMap(([key, child]) => [encodeValue(key), encodeValue(child)]),
    ]);
  }
  throw new TypeError(`NVIS cannot encode ${typeof value}`);
};

const checksum = (bytes) => {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

export function encodeNvis(value) {
  const payload = encodeValue(value);
  const header = new Uint8Array(16);
  header.set(textEncoder.encode('NVIS'), 0);
  const view = new DataView(header.buffer);
  view.setUint16(4, 1, true);
  view.setUint16(6, 0, true);
  view.setUint32(8, payload.length, true);
  view.setUint32(12, checksum(payload), true);
  return concat([header, payload]);
}

export function decodeNvis(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (textDecoder.decode(bytes.subarray(0, 4)) !== 'NVIS') throw new Error('Not an NVIS visual program');
  const header = new DataView(bytes.buffer, bytes.byteOffset, 16);
  const version = header.getUint16(4, true);
  if (version !== 1) throw new Error(`Unsupported NVIS version ${version}`);
  const length = header.getUint32(8, true);
  const expected = header.getUint32(12, true);
  const payload = bytes.subarray(16);
  if (payload.length !== length) throw new Error(`NVIS payload is ${payload.length} bytes; expected ${length}`);
  if (checksum(payload) !== expected) throw new Error('NVIS checksum mismatch');

  let offset = 0;
  const takeU32 = () => {
    const value = new DataView(payload.buffer, payload.byteOffset + offset, 4).getUint32(0, true);
    offset += 4;
    return value;
  };
  const value = () => {
    const tag = payload[offset++];
    if (tag === TAG.null) return null;
    if (tag === TAG.false) return false;
    if (tag === TAG.true) return true;
    if (tag === TAG.number) {
      const number = new DataView(payload.buffer, payload.byteOffset + offset, 8).getFloat64(0, true);
      offset += 8;
      return number;
    }
    if (tag === TAG.string) {
      const length = takeU32();
      const string = textDecoder.decode(payload.subarray(offset, offset + length));
      offset += length;
      return string;
    }
    if (tag === TAG.bytes) {
      const length = takeU32();
      const child = payload.slice(offset, offset + length);
      offset += length;
      return child;
    }
    if (tag === TAG.array) return Array.from({ length: takeU32() }, value);
    if (tag === TAG.object) {
      const object = {};
      const length = takeU32();
      for (let index = 0; index < length; index++) object[value()] = value();
      return object;
    }
    throw new Error(`Unknown NVIS value tag ${tag} at byte ${offset - 1}`);
  };

  const decoded = value();
  if (offset !== payload.length) throw new Error(`${payload.length - offset} unread NVIS bytes`);
  return decoded;
}
