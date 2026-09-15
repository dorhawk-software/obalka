// Bespoke ISDS XSD -> TypeScript model generator (dev-time only).
//
// Reads the vendored official schemas in src/services/isds/schema/v20/ and emits plain TypeScript
// types into src/services/isds/generated/isdsTypes.ts. No runtime SOAP client, no runtime deps in
// the output. Run with: `npm run codegen:isds`. Handles the constructs these schemas actually use:
// simpleType (enum -> string-literal union; restriction -> primitive alias), complexType (interface),
// complexContent/extension (interface extends), simpleContent/extension (value + attributes),
// named group refs (inlined), attributeGroup refs (inlined), choice (members optional), nested
// sequences, nillable (| null), minOccurs=0 (optional), maxOccurs>1/unbounded (array), and xs:any.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const SCHEMA_DIR = 'src/services/isds/schema/v20';
const FILES = ['dmBaseTypes.xsd', 'dbTypes.xsd'];
const OUT_DIR = 'src/services/isds/generated';
const OUT = `${OUT_DIR}/isdsTypes.ts`;

const parser = new XMLParser({
  ignoreAttributes: false,
  preserveOrder: true,
  attributeNamePrefix: '@_',
  trimValues: true,
});

// --- preserveOrder node helpers --------------------------------------------
const tagOf = n => Object.keys(n).find(k => k !== ':@');
const attrs = n => n[':@'] || {};
const kids = n => n[tagOf(n)] || [];
const childrenByTag = (n, tag) => kids(n).filter(c => tagOf(c) === tag);
const localName = q => (q && q.includes(':') ? q.split(':').pop() : q);
const isUnbounded = v => v === 'unbounded' || (v != null && Number(v) > 1);
// XSD NCNames allow characters (e.g. '-') that are illegal in TS identifiers; sanitize type names
// consistently for both declarations and references.
const tsName = s => (s || '').replace(/[^A-Za-z0-9_$]/g, '_');

// --- primitive mapping ------------------------------------------------------
const PRIM = {
  string: 'string',
  normalizedString: 'string',
  token: 'string',
  anyURI: 'string',
  dateTime: 'string',
  date: 'string',
  time: 'string',
  base64Binary: 'string',
  hexBinary: 'string',
  duration: 'string',
  language: 'string',
  NMTOKEN: 'string',
  boolean: 'boolean',
  int: 'number',
  integer: 'number',
  long: 'number',
  short: 'number',
  byte: 'number',
  decimal: 'number',
  double: 'number',
  float: 'number',
  unsignedInt: 'number',
  unsignedLong: 'number',
  unsignedShort: 'number',
  unsignedByte: 'number',
  nonNegativeInteger: 'number',
  positiveInteger: 'number',
};
function mapType(q) {
  if (!q) {
    return 'string';
  }
  if (q.startsWith('xs:')) {
    return PRIM[q.slice(3)] || 'string';
  }
  return tsName(localName(q)); // tns:Foo -> Foo (a generated type)
}

// --- registries -------------------------------------------------------------
const groups = new Map();
const attrGroups = new Map();
const simpleTypes = [];
const complexTypes = [];
const topElements = [];

for (const f of FILES) {
  const doc = parser.parse(readFileSync(`${SCHEMA_DIR}/${f}`, 'utf8'));
  const schema = doc.find(n => tagOf(n) === 'xs:schema');
  for (const n of kids(schema)) {
    const t = tagOf(n);
    const name = attrs(n)['@_name'];
    if (t === 'xs:group') {
      groups.set(name, n);
    } else if (t === 'xs:attributeGroup') {
      attrGroups.set(name, n);
    } else if (t === 'xs:simpleType') {
      simpleTypes.push(n);
    } else if (t === 'xs:complexType') {
      complexTypes.push(n);
    } else if (t === 'xs:element') {
      topElements.push(n);
    }
  }
}

// --- simpleType -> { ts } ---------------------------------------------------
function simpleTypeToTs(stNode) {
  const restr = childrenByTag(stNode, 'xs:restriction')[0];
  if (!restr) {
    return 'string';
  } // xs:union / xs:list -> fallback
  const enums = childrenByTag(restr, 'xs:enumeration').map(
    e => attrs(e)['@_value'],
  );
  if (enums.length) {
    return enums.map(v => JSON.stringify(v)).join(' | ');
  }
  return mapType(attrs(restr)['@_base']);
}

// --- field collection -------------------------------------------------------
function attributeField(node) {
  const a = attrs(node);
  if (a['@_ref']) {
    return { name: localName(a['@_ref']), tsType: 'string', optional: true };
  }
  return {
    name: a['@_name'],
    tsType: mapType(a['@_type'] || 'xs:string'),
    optional: a['@_use'] !== 'required',
  };
}

function inlineAttributeGroup(refNode, fields) {
  const ag = attrGroups.get(localName(attrs(refNode)['@_ref']));
  if (ag) {
    for (const ac of childrenByTag(ag, 'xs:attribute')) {
      fields.push(attributeField(ac));
    }
  }
}

function elementField(node, seqArray, inChoice) {
  const a = attrs(node);
  let name, tsType;
  if (a['@_ref']) {
    name = localName(a['@_ref']);
    tsType = tsName(localName(a['@_ref']));
  } else {
    name = a['@_name'];
    if (a['@_type']) {
      tsType = mapType(a['@_type']);
    } else {
      const ist = childrenByTag(node, 'xs:simpleType')[0];
      const ict = childrenByTag(node, 'xs:complexType')[0];
      if (ist) {
        tsType = simpleTypeToTs(ist);
      } else if (ict) {
        tsType = inlineComplexType(ict);
      } else {
        tsType = 'string';
      }
    }
  }
  return {
    name,
    tsType,
    optional: a['@_minOccurs'] === '0' || inChoice,
    nullable: a['@_nillable'] === 'true',
    array: isUnbounded(a['@_maxOccurs']) || seqArray,
  };
}

// Walk a sequence/choice/all container, returning a flat field list.
function collectFromContainer(container, inheritedArray = false) {
  const t = tagOf(container);
  const a = attrs(container);
  const seqArray = inheritedArray || isUnbounded(a['@_maxOccurs']);
  const inChoice = t === 'xs:choice';
  let fields = [];
  for (const c of kids(container)) {
    const ct = tagOf(c);
    if (ct === 'xs:element') {
      fields.push(elementField(c, seqArray, inChoice));
    } else if (ct === 'xs:group') {
      const g = groups.get(localName(attrs(c)['@_ref']));
      if (g) {
        const inner = kids(g).find(x =>
          ['xs:sequence', 'xs:choice', 'xs:all'].includes(tagOf(x)),
        );
        if (inner) {
          fields = fields.concat(collectFromContainer(inner, seqArray));
        }
      }
    } else if (['xs:sequence', 'xs:choice', 'xs:all'].includes(ct)) {
      const inner = collectFromContainer(c, seqArray);
      fields = fields.concat(
        inChoice ? inner.map(f => ({ ...f, optional: true })) : inner,
      );
    } else if (ct === 'xs:attribute') {
      fields.push(attributeField(c));
    } else if (ct === 'xs:attributeGroup') {
      inlineAttributeGroup(c, fields);
    } else if (ct === 'xs:any') {
      fields.push({ any: true });
    }
  }
  if (inChoice) {
    fields = fields.map(f => (f.any ? f : { ...f, optional: true }));
  }
  return fields;
}

// Resolve a complexType body to { baseType, fields }.
function resolveComplexBody(ctNode) {
  const children = kids(ctNode);
  const simpleContent = children.find(c => tagOf(c) === 'xs:simpleContent');
  const complexContent = children.find(c => tagOf(c) === 'xs:complexContent');

  if (simpleContent) {
    const ext = childrenByTag(simpleContent, 'xs:extension')[0];
    const value = {
      name: 'value',
      tsType: mapType(attrs(ext)['@_base']),
      optional: false,
    };
    return { baseType: null, fields: [value, ...collectFromContainer(ext)] };
  }

  if (complexContent) {
    const ext = childrenByTag(complexContent, 'xs:extension')[0];
    return {
      baseType: mapType(attrs(ext)['@_base']),
      fields: collectFromContainer(ext),
    };
  }

  // Base case: collect straight from the complexType's children. collectFromContainer handles a
  // top-level sequence/choice/all, a DIRECT group ref (e.g. tDbReqStatus), direct elements, and
  // attributes/attributeGroups - annotations are ignored.
  return { baseType: null, fields: collectFromContainer(ctNode) };
}

function inlineComplexType(ctNode) {
  const { baseType, fields } = resolveComplexBody(ctNode);
  const body = renderBody(fields);
  return baseType ? `${baseType} & ${body}` : body;
}

// --- rendering --------------------------------------------------------------
const isIdent = s => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s);

function renderField(f) {
  if (f.any) {
    return '  [key: string]: unknown;';
  }
  let t = f.tsType;
  if (f.array) {
    t = `${t}[]`;
  }
  if (f.nullable) {
    t = `${t} | null`;
  }
  const name = isIdent(f.name) ? f.name : JSON.stringify(f.name);
  return `  ${name}${f.optional ? '?' : ''}: ${t};`;
}

function dedupe(fields) {
  const seen = new Set();
  const out = [];
  for (const f of fields) {
    const key = f.any ? '__any' : f.name;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(f);
  }
  return out;
}

function renderBody(fields) {
  const lines = dedupe(fields).map(renderField);
  return lines.length ? `{\n${lines.join('\n')}\n}` : '{}';
}

function renderInterface(name, baseType, fields) {
  const ext = baseType ? ` extends ${baseType}` : '';
  return `export interface ${name}${ext} ${renderBody(fields)}`;
}

// --- emit -------------------------------------------------------------------
const emitted = new Set();
const out = [];
out.push(
  '// AUTO-GENERATED from src/services/isds/schema/v20/*.xsd - DO NOT EDIT.',
);
out.push('// Regenerate with: npm run codegen:isds');
out.push('/* eslint-disable */');
out.push('');

function emit(name, code) {
  if (!name || emitted.has(name)) {
    return;
  }
  emitted.add(name);
  out.push(code);
  out.push('');
}

for (const st of simpleTypes) {
  const name = tsName(attrs(st)['@_name']);
  emit(name, `export type ${name} = ${simpleTypeToTs(st)};`);
}

for (const ct of complexTypes) {
  const name = tsName(attrs(ct)['@_name']);
  const { baseType, fields } = resolveComplexBody(ct);
  emit(name, renderInterface(name, baseType, fields));
}

for (const el of topElements) {
  const a = attrs(el);
  const name = tsName(a['@_name']);
  if (a['@_type']) {
    emit(name, `export type ${name} = ${mapType(a['@_type'])};`);
  } else {
    const ict = childrenByTag(el, 'xs:complexType')[0];
    const ist = childrenByTag(el, 'xs:simpleType')[0];
    if (ict) {
      const { baseType, fields } = resolveComplexBody(ict);
      emit(name, renderInterface(name, baseType, fields));
    } else if (ist) {
      emit(name, `export type ${name} = ${simpleTypeToTs(ist)};`);
    } else {
      emit(name, `export type ${name} = unknown;`);
    }
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, out.join('\n'));
console.log(
  `Generated ${OUT}: ${emitted.size} types (${simpleTypes.length} simpleType, ${complexTypes.length} complexType, ${topElements.length} elements).`,
);
