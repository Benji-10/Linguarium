/**
 * Split a .sql file into individual statements, respecting PostgreSQL quoting.
 *
 * Handles dollar-quoted blocks ($$ ... $$), single-quoted strings (with ''
 * escapes), line comments (--) and block comments. Statement boundaries
 * are semicolons that appear outside any quoted context. Comments are dropped.
 *
 * Used by scripts/db-init.mjs (local initialization) and the /api/admin-seed
 * function (server-side population), so both always split SQL identically.
 */

export function splitSql(text) {
  const out = [];
  let current = '';
  let i = 0;
  const n = text.length;

  const isLineStart = () => current.length === 0 || /\s/.test(current[current.length - 1]);

  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];

    // Dollar-quoted block: everything until the closing $$ is literal.
    if (ch === '$' && next === '$') {
      let j = i + 2;
      while (j < n - 1 && !(text[j] === '$' && text[j + 1] === '$')) j += 1;
      const end = Math.min(j + 2, n); // include closing $$ (or run to EOF)
      current += text.slice(i, end);
      i = end;
      continue;
    }

    // Single-quoted string: '' is an escaped quote inside it.
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (text[j] === "'") {
          if (text[j + 1] === "'") {
            j += 2; // escaped quote, stay inside the string
          } else {
            break;
          }
        } else {
          j += 1;
        }
      }
      const end = Math.min(j + 1, n);
      current += text.slice(i, end);
      i = end;
      continue;
    }

    // Line comment (only outside quotes): dropped entirely.
    if (ch === '-' && next === '-' && isLineStart()) {
      while (i < n && text[i] !== '\n') i += 1;
      continue;
    }

    // Block comment: dropped entirely.
    if (ch === '/' && next === '*') {
      let j = i + 2;
      while (j < n - 1 && !(text[j] === '*' && text[j + 1] === '/')) j += 1;
      i = Math.min(j + 2, n);
      continue;
    }

    // Statement boundary.
    if (ch === ';') {
      const stmt = current.trim();
      if (stmt) out.push(stmt);
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}
