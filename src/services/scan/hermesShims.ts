// The globals Hermes does not have and pdf.js assumes (010 US3).
//
// Every one of these was found by running the scan on a device, and none of them by a test: under
// Node and jest all four exist, so the whole feature passes its suite and then does nothing at all on
// a phone. They are installed lazily, at the moment scanning actually starts, so an app whose owner
// never turns the toggle on carries none of them.
//
//   Promise.withResolvers  pdf.js 4+ uses it throughout its worker transport.
//   TextDecoder/TextEncoder  needed the moment a string comes out of the WASM heap (see textCodec).
//   structuredClone        pdf.js clones the messages it passes to its worker - and in this
//                          environment the "worker" is the same JS context, so this is a deep copy
//                          between two halves of one program rather than a transfer between threads.
//   ReadableStream         pdf.js reads its input as a stream even when the input is already a byte
//                          array in memory. This one is delegated to `web-streams-polyfill`: the
//                          spec is far too large to reimplement for one caller.

import { installTextCodecs } from '../text/textCodec';

/** Deep-clone the plain data pdf.js passes across its worker boundary. */
function deepClone<T>(value: T, seen: WeakMap<object, unknown>): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const obj = value as unknown as object;
  const hit = seen.get(obj);
  if (hit !== undefined) {
    return hit as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as unknown as T;
  }
  if (value instanceof ArrayBuffer) {
    return value.slice(0) as unknown as T;
  }
  if (ArrayBuffer.isView(value)) {
    const view = value as unknown as {
      constructor: new (b: ArrayBuffer, o: number, l: number) => unknown;
      buffer: ArrayBuffer;
      byteOffset: number;
      byteLength: number;
      length?: number;
    };
    const buffer = view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength,
    );
    const Ctor = view.constructor as new (b: ArrayBuffer) => unknown;
    return new Ctor(buffer) as unknown as T;
  }
  if (value instanceof Map) {
    const out = new Map();
    seen.set(obj, out);
    value.forEach((v, k) => {
      out.set(deepClone(k, seen), deepClone(v, seen));
    });
    return out as unknown as T;
  }
  if (value instanceof Set) {
    const out = new Set();
    seen.set(obj, out);
    value.forEach(v => {
      out.add(deepClone(v, seen));
    });
    return out as unknown as T;
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(obj, out);
    for (const v of value) {
      out.push(deepClone(v, seen));
    }
    return out as unknown as T;
  }
  const out: Record<string, unknown> = {};
  seen.set(obj, out);
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepClone(v, seen);
  }
  return out as unknown as T;
}

/** `structuredClone`, for the subset of values that cross pdf.js's worker boundary. */
export function structuredCloneShim<T>(value: T): T {
  return deepClone(value, new WeakMap());
}

/** Install everything pdf.js needs. Idempotent; each shim defers to a real implementation. */
export function installHermesShims(): void {
  const g = globalThis as unknown as {
    structuredClone?: unknown;
    ReadableStream?: unknown;
    WritableStream?: unknown;
    TransformStream?: unknown;
  };
  const P = Promise as unknown as { withResolvers?: unknown };
  if (typeof P.withResolvers !== 'function') {
    P.withResolvers = function withResolvers<T>() {
      let resolve!: (v: T | PromiseLike<T>) => void;
      let reject!: (r?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
  if (typeof g.structuredClone !== 'function') {
    g.structuredClone = structuredCloneShim;
  }
  if (typeof g.ReadableStream !== 'function') {
    // A hand-written ReadableStream would be out of proportion to the rest of this file - the
    // streams spec is large and pdf.js drives it properly. `web-streams-polyfill` is the reference
    // implementation, and like everything else here it loads only once a scan starts.
    const streams = require('web-streams-polyfill') as {
      ReadableStream: unknown;
      WritableStream?: unknown;
      TransformStream?: unknown;
    };
    g.ReadableStream = streams.ReadableStream;
    if (typeof g.WritableStream !== 'function' && streams.WritableStream) {
      g.WritableStream = streams.WritableStream;
    }
    if (typeof g.TransformStream !== 'function' && streams.TransformStream) {
      g.TransformStream = streams.TransformStream;
    }
  }
  installTextCodecs();
}
