// Local-only in-memory fixture implementing the SDK query surface used by the
// application. Data never persists; this is not the platform database.
export function createFakeDb() {
  const tables = new Map();
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  };
  const project = (row, cols) => {
    if (!cols || cols === '*') return { ...row };
    const out = {};
    for (const col of cols.split(',').map((c) => c.trim())) out[col] = row[col];
    return out;
  };

  class ReadQuery {
    constructor(name, cols) {
      this.name = name;
      this.cols = cols;
      this.filters = [];
      this.orders = [];
      this.max = null;
    }
    eq(key, value) { this.filters.push([key, value]); return this; }
    order(col, options = {}) { this.orders.push([col, options.ascending !== false]); return this; }
    limit(n) { this.max = n; return this; }
    then(resolve) {
      let found = table(this.name).filter((row) => this.filters.every(([k, v]) => row[k] === v));
      for (const [col, ascending] of this.orders.reverse()) {
        found = found.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (ascending ? 1 : -1));
      }
      if (this.max !== null) found = found.slice(0, this.max);
      resolve({ data: found.map((row) => project(row, this.cols)), error: null });
    }
  }

  class WriteQuery {
    constructor(name, mode, payload) {
      this.name = name;
      this.mode = mode;
      this.payload = payload;
      this.filters = [];
    }
    eq(key, value) { this.filters.push([key, value]); return this; }
    select(cols) {
      const rows = table(this.name);
      const matching = rows.filter((row) => this.filters.every(([k, v]) => row[k] === v));
      if (this.mode === 'update') {
        for (const row of matching) Object.assign(row, this.payload);
        return { data: matching.map((row) => project(row, cols)), error: null };
      }
      for (const row of matching) rows.splice(rows.indexOf(row), 1);
      return { data: matching.map((row) => project(row, cols)), error: null };
    }
  }

  return {
    from(name) {
      return {
        select(cols) { return new ReadQuery(name, cols); },
        update(payload) { return new WriteQuery(name, 'update', payload); },
        delete() { return new WriteQuery(name, 'delete'); },
        insertIfAbsent(payload, { onConflict }) {
          const rows = table(name);
          const keys = onConflict.split(',').map((c) => c.trim());
          const exists = rows.some((row) => keys.every((key) => row[key] === payload[key]));
          if (!exists) rows.push({ ...payload });
          return {
            select(cols) {
              return { data: exists ? [] : [project(payload, cols)], error: null };
            },
          };
        },
      };
    },
  };
}