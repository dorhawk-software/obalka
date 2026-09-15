// What is allowed to leave the phone in a crash report - and nothing else.
//
// This app carries legally binding government mail. Its FAQ tells users, in Czech, that scanned
// document text "neopouští telefon", that attachments are "nikam neodesíláme", and that a backup
// "nikam se neposílá nezašifrovaná". Crash reporting does not contradict any of that - but only for
// as long as a report cannot carry the things those sentences are about.
//
// So this module is an ALLOW-LIST, deliberately, and it is the inverse of `logging/logger.ts`.
// The logger redacts a deny-list of credential-shaped keys (`password`, `cookie`, `token`) and
// passes everything else through, which is right for a console log that never leaves the device.
// A report that DOES leave the device cannot work that way: a deny-list is a list of the leaks
// somebody already thought of, and the leak that matters is the one nobody did.
//
// Two mechanisms, because there are two kinds of danger:
//
//   1. STRUCTURED context we attach ourselves - dropped unless its key is on `ALLOWED_KEYS`.
//      Cheap and total.
//
//   2. FREE TEXT we do not control - an exception message from `fast-xml-parser`, op-sqlite or the
//      ISDS SOAP layer, which may quote the document it choked on. This is the real risk, and
//      pattern-matching alone cannot catch a Czech sender's name or a subject line.
//
// The answer to (2) is that the app already KNOWS its own secrets. It holds the box IDs, login
// names and owner names for every account on the device, so the scrubber is seeded with those exact
// strings and removes them literally, wherever they appear and however they got there. That is far
// stronger than guessing at shapes - and the shape rules below are only the second line, for the
// identifiers the app does not hold (a birth number quoted in a parser error, an e-mail address).
//
// The floor: if in doubt, drop it. A report missing a detail costs a slower diagnosis. A report
// carrying a citizen's mail costs their privacy, and cannot be taken back.

/**
 * The literal strings that must never appear in a report, seeded from the accounts on this device.
 *
 * Rebuilt whenever accounts change. Empty is a valid state (no boxes added yet) and simply means
 * the shape rules below are doing all the work.
 */
export interface RedactionSet {
  /** Box IDs, login names, owner names and aliases - everything the app knows identifies a user. */
  readonly literals: readonly string[];
}

export const NO_REDACTIONS: RedactionSet = { literals: [] };

/**
 * Context keys allowed through, and why each is safe.
 *
 * Every one is either a constant of the app, a value from a fixed enumeration, or a number. None
 * is derived from message content, and none identifies a person. Adding a key here is a decision
 * about what leaves someone's phone - it deserves the same thought as adding a permission.
 */
export const ALLOWED_KEYS: readonly string[] = [
  // Which operation failed
  'op', // 'isds.listReceived' - our own name, from a fixed set
  'stage', // 'parse' | 'transport' | 'persist'
  'errorClass', // the constructor name, e.g. 'TypeError'
  // ISDS's own answer, which is the single most useful thing for debugging and says nothing personal
  'faultCode', // SOAP fault code
  'dmStatusCode', // e.g. '1281'
  'httpStatus', // 404, 500
  'host', // an environment label - the Host enum ('production' | 'czebox') or 'other' - never an address
  'authMethod', // 'password' | 'otp_totp' | 'mobile_key'
  // Shape, never content
  'attempt',
  'retryCount',
  'byteSize',
  'itemCount',
  'durationMs',
  'attachmentCount',
  'folder', // 'received' | 'sent'
  'endpoint', // '/DS/dz' - matched against a fixed list of service paths, never a URL
  // What the person chose at an OS prompt, from a fixed set: 'declined'. A decision, not a fault, and
  // saying so is what keeps a cancel button out of the failure reports (2026-09-15).
  'outcome',
  // The app and the device class
  'appVersion',
  'schemaVersion',
  'osVersion',
  'platform',
  'isEmulator',
  'reduceMotion',
  'fontScale',
  'themeMode',
  'locale',
] as const;

const ALLOWED = new Set(ALLOWED_KEYS);

/**
 * Which `event.contexts` sections survive, and which keys inside them.
 *
 * The SDK merges the NATIVE device context into every event wholesale - `deviceContextIntegration`
 * assigns whatever iOS and Android hand it, and that is a payload neither this file nor its tests
 * control. On iOS `device.name` is frequently the owner's own name ("Ondřej's iPhone"), so the
 * section is enumerated key by key rather than trusted: `name` is absent below, deliberately, and a
 * key the platform adds in a future SDK version is dropped until somebody decides otherwise.
 */
const ALLOWED_CONTEXTS: Readonly<Record<string, readonly string[]>> = {
  trace: ['op', 'span_id', 'trace_id', 'parent_span_id', 'status', 'origin'],
  app: [
    'app_version',
    'app_build',
    'app_identifier',
    'app_name',
    'app_start_time',
    'in_foreground',
  ],
  os: ['name', 'version', 'build', 'kernel_version', 'rooted'],
  device: [
    // NOT `name` - on iOS that is usually a person's own name.
    'family',
    'model',
    'model_id',
    'arch',
    'manufacturer',
    'brand',
    'simulator',
    'memory_size',
    'free_memory',
    'usable_memory',
    'low_memory',
    'storage_size',
    'free_storage',
    'screen_width_pixels',
    'screen_height_pixels',
    'screen_density',
    'screen_dpi',
    'orientation',
    'battery_level',
    'charging',
    'processor_count',
    'processor_frequency',
    'locale',
    'timezone',
  ],
  runtime: ['name', 'version', 'raw_description'],
  culture: ['locale', 'timezone', 'calendar', 'display_name'],
  react_native_context: [
    'js_engine',
    'turbo_module',
    'fabric',
    'react_native_version',
    'hermes_version',
    'hermes_debug_info',
    'expo',
    'component_stack',
  ],
};

/** Longest free-text fragment kept from any foreign message. Beyond this, truncated. */
const MAX_TEXT = 300;

const PLACEHOLDER = '[redacted]';

/**
 * Shape rules, for identifiers the app does not hold literally.
 *
 * Deliberately conservative about DIGITS: an ISDS `dmStatusCode` is four digits and an HTTP status
 * is three, and both are the most useful things in the report - so only runs of six or more are
 * removed. That still covers a rodné číslo (9–10), an IČO (8) and a phone number (9), which are the
 * numbers that actually identify somebody.
 */
const SHAPES: readonly [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]'],
  [/\b\d{6,}\b/g, '[number]'], // rodné číslo, IČO, phone - never a status code
  [/(?:file|content):\/\/\S+/gi, '[uri]'],
  // Any http(s) URL, whole. ISDS's own endpoints carry no box id and no login name, so this is not
  // about them - it is about the URLs that arrive from somewhere else: a redirect, a file-provider
  // URI, an OEM error quoting whatever it was fetching. A URL is free text from an unknown source,
  // which is the exact category this module exists to refuse.
  [/\bhttps?:\/\/\S+/gi, '[url]'],
  [/\/(?:data|var|Users|storage)\/\S+/g, '[path]'], // sandbox paths carry attachment filenames
  [/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, '[blob]'], // base64 - a ZFO, an attachment, a key
];

/** Escape a literal for use inside a RegExp. */
function escapeLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove everything identifying from a piece of free text.
 *
 * Literals first (the app's own known identifiers), then shapes, then a length cap. Case-insensitive
 * on the literals because a sender's name may arrive in any casing from ISDS.
 */
export function scrubText(text: string, redactions: RedactionSet): string {
  let out = text;
  for (const literal of redactions.literals) {
    // A one- or two-character "identifier" would match half the alphabet; ignore those rather than
    // shred the message. Nothing shorter than three characters identifies anybody anyway.
    if (literal.length < 3) {
      continue;
    }
    out = out.replace(new RegExp(escapeLiteral(literal), 'gi'), PLACEHOLDER);
  }
  for (const [pattern, replacement] of SHAPES) {
    out = out.replace(pattern, replacement);
  }
  return out.length > MAX_TEXT ? `${out.slice(0, MAX_TEXT)}…` : out;
}

/**
 * Keep only the allow-listed keys, with only primitive values.
 *
 * Objects and arrays are dropped whole rather than walked: a nested object is exactly where an
 * envelope, a row or a parsed document ends up, and there is no allow-listed key whose value is
 * legitimately a structure.
 */
export function scrubContext(
  context: Readonly<Record<string, unknown>>,
  redactions: RedactionSet,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(context)) {
    if (!ALLOWED.has(key)) {
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (typeof value === 'string') {
      out[key] = scrubText(value, redactions);
    }
    // null / undefined / object / function: dropped.
  }
  return out;
}

/**
 * Keep only the allow-listed sections of `event.contexts`, and only the allow-listed keys in each.
 *
 * Separate from `scrubContext` because this is two levels deep and because its allow-list is a
 * different one: these are the platform's own fields, not ours.
 */
export function scrubContexts(
  contexts: Readonly<Record<string, unknown>>,
  redactions: RedactionSet,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [section, allowedKeys] of Object.entries(ALLOWED_CONTEXTS)) {
    const value = contexts[section];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const kept: Record<string, string | number | boolean> = {};
    for (const key of allowedKeys) {
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === 'number' || typeof v === 'boolean') {
        kept[key] = v;
      } else if (typeof v === 'string') {
        kept[key] = scrubText(v, redactions);
      }
    }
    if (Object.keys(kept).length > 0) {
      out[section] = kept;
    }
  }
  return out;
}

/**
 * A Sentry event, reduced to the parts of it we can vouch for.
 *
 * Typed structurally rather than against Sentry's own `Event`, so this module stays pure and
 * testable with no SDK import - and so the safety property can be proven without a network stack
 * anywhere near it.
 */
export interface ScrubbableEvent {
  message?: unknown;
  /** Transaction events only: the transaction NAME (a route, or one of our own `Op` strings). */
  transaction?: unknown;
  /** Transaction events only: the spans under it, each with its own description and data. */
  spans?: {
    description?: unknown;
    op?: unknown;
    data?: unknown;
    [key: string]: unknown;
  }[];
  exception?: {
    values?: {
      type?: unknown;
      value?: unknown;
      stacktrace?: { frames?: { filename?: unknown; vars?: unknown }[] };
    }[];
  };
  breadcrumbs?: {
    category?: unknown;
    message?: unknown;
    data?: unknown;
    level?: unknown;
    type?: unknown;
  }[];
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  user?: unknown;
  request?: unknown;
  server_name?: unknown;
  [key: string]: unknown;
}

/**
 * The last thing that runs before an event leaves the device.
 *
 * Everything above is a helper; THIS is the guarantee. It is wired to Sentry's `beforeSend` and
 * `beforeBreadcrumb`, which is the single interception point every event must pass through - the
 * property that decided the provider, since the alternative offered no equivalent hook.
 */
export function scrubEvent<T extends ScrubbableEvent>(
  event: T,
  redactions: RedactionSet,
): T {
  const text = (v: unknown): string | undefined =>
    typeof v === 'string' ? scrubText(v, redactions) : undefined;

  if (typeof event.message === 'string') {
    event.message = scrubText(event.message, redactions);
  }

  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === 'string') {
      ex.value = scrubText(ex.value, redactions);
    }
    for (const frame of ex.stacktrace?.frames ?? []) {
      // Local variables per frame are a debugger's dream and a privacy hole - an ISDS envelope, a
      // decrypted row, a password in scope at the throw. Never sent.
      delete frame.vars;
      if (typeof frame.filename === 'string') {
        frame.filename = scrubText(frame.filename, redactions);
      }
    }
  }

  event.breadcrumbs = (event.breadcrumbs ?? []).map(b => ({
    category: typeof b.category === 'string' ? b.category : undefined,
    level: typeof b.level === 'string' ? b.level : undefined,
    type: typeof b.type === 'string' ? b.type : undefined,
    message: text(b.message),
    // Breadcrumb `data` is where the SDK puts HTTP bodies and navigation params. Allow-listed like
    // everything else, never passed through.
    data:
      b.data && typeof b.data === 'object'
        ? scrubContext(b.data as Record<string, unknown>, redactions)
        : undefined,
  }));

  // TRANSACTION EVENTS. These do not pass through `beforeSend` at all - the SDK routes them to
  // `beforeSendTransaction` instead (see `client.js`, which tests `isErrorEvent` before calling
  // `beforeSend`). Both hooks land here, so the same guarantee covers both kinds of event.
  if (typeof event.transaction === 'string') {
    event.transaction = scrubText(event.transaction, redactions);
  }
  for (const span of event.spans ?? []) {
    // A span description is the SDK's free text: for an automatic HTTP span it is the whole request
    // line, URL included. Automatic HTTP spans are switched off in `telemetry.ts`, and this is the
    // second line in case they are ever switched back on.
    if (typeof span.description === 'string') {
      span.description = scrubText(span.description, redactions);
    }
    span.data =
      span.data && typeof span.data === 'object'
        ? scrubContext(span.data as Record<string, unknown>, redactions)
        : undefined;
  }

  if (event.tags) {
    event.tags = scrubContext(event.tags, redactions);
  }
  if (event.extra) {
    event.extra = scrubContext(event.extra, redactions);
  }
  if (event.contexts) {
    event.contexts = scrubContexts(event.contexts, redactions);
  }

  // Identity and network context, removed outright. There is no version of this app in which a
  // report should carry who the user is or what they asked for.
  delete event.user;
  delete event.request;
  delete event.server_name;

  return event;
}
