export function flightRecords(html) {
  if (typeof html !== 'string') throw new Error('Response is not HTML.');
  const chunks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].flatMap(([, script]) => {
    const match = /^self\.__next_f\.push\(([\s\S]+)\);?$/.exec(script.trim());
    if (!match) return [];
    const push = JSON.parse(match[1]);
    return push[0] === 1 && typeof push[1] === 'string' ? [push[1]] : [];
  });
  const stream = Buffer.from(chunks.join(''), 'utf8');
  const records = new Map();
  let position = 0;
  while (position < stream.length) {
    const colon = stream.indexOf(0x3a, position);
    const newline = stream.indexOf(0x0a, position);
    if (colon === -1) break;
    const lineEnd = newline === -1 ? stream.length : newline;
    const id = stream.toString('latin1', position, colon);
    if (lineEnd < colon || !/^[\da-f]+$/.test(id)) {
      position = lineEnd + 1;
      continue;
    }
    // Text rows declare a UTF-8 byte length and are not newline-terminated; the next row follows directly.
    const text = /^T([\da-f]+),/.exec(stream.toString('latin1', colon + 1, colon + 24));
    if (text) {
      const start = colon + 1 + text[0].length;
      const end = Math.min(start + parseInt(text[1], 16), stream.length);
      records.set(id, stream.toString('utf8', start, end));
      position = end;
      continue;
    }
    const body = stream.toString('utf8', colon + 1, lineEnd);
    if (body.startsWith('[') || body.startsWith('{')) {
      try {
        records.set(id, JSON.parse(body));
      } catch {
        // React's stream also contains transport records; only JSON records are data.
      }
    }
    position = lineEnd + 1;
  }
  return records;
}

export function findObject(value, predicate, depth = 0) {
  if (depth > 64 || value === null || typeof value !== 'object') return null;
  if (!Array.isArray(value) && predicate(value)) return value;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const found = findObject(child, predicate, depth + 1);
    if (found) return found;
  }
  return null;
}

export function findInRecords(records, predicate) {
  for (const record of records.values()) {
    const found = findObject(record, predicate);
    if (found) return found;
  }
  return null;
}
