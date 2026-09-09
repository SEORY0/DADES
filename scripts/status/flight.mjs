export function flightRecords(html) {
  if (typeof html !== 'string') throw new Error('Response is not HTML.');
  const chunks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].flatMap(([, script]) => {
    const match = /^self\.__next_f\.push\(([\s\S]+)\);?$/.exec(script.trim());
    if (!match) return [];
    const push = JSON.parse(match[1]);
    return push[0] === 1 && typeof push[1] === 'string' ? [push[1]] : [];
  });
  const records = new Map();
  for (const line of chunks.join('').split('\n')) {
    const match = /^([\da-f]+):(\[.*|\{.*)$/.exec(line);
    if (!match) continue;
    try {
      records.set(match[1], JSON.parse(match[2]));
    } catch {
      // React's stream also contains transport records; only JSON records are data.
    }
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
