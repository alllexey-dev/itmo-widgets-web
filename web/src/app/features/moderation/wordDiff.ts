export interface DiffPart {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

/** Words and whitespace runs, so joining the tokens gives the text back unchanged. */
function tokens(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

function push(parts: DiffPart[], kind: DiffPart['kind'], text: string) {
  const last = parts[parts.length - 1];
  if (last?.kind === kind) last.text += text;
  else parts.push({ kind, text });
}

/**
 * A word-level diff by the longest common subsequence. Whitespace is kept as its own
 * tokens; a replacement lists the removed part first. Texts are at most 3000 characters,
 * so the quadratic table stays small after the common prefix and suffix are cut off.
 */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const rows = endA - start;
  const columns = endB - start;
  const width = columns + 1;
  // lcs[i * width + j] is the common length of a[start + i..endA) and b[start + j..endB).
  const lcs = new Uint16Array((rows + 1) * width);
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        a[start + i] === b[start + j]
          ? (lcs[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(lcs[(i + 1) * width + j] ?? 0, lcs[i * width + j + 1] ?? 0);
    }
  }

  const parts: DiffPart[] = [];
  if (start > 0) push(parts, 'same', a.slice(0, start).join(''));
  let i = 0;
  let j = 0;
  while (i < rows || j < columns) {
    if (i < rows && j < columns && a[start + i] === b[start + j]) {
      push(parts, 'same', a[start + i] ?? '');
      i += 1;
      j += 1;
    } else if (
      j >= columns ||
      (i < rows && (lcs[(i + 1) * width + j] ?? 0) >= (lcs[i * width + j + 1] ?? 0))
    ) {
      push(parts, 'removed', a[start + i] ?? '');
      i += 1;
    } else {
      push(parts, 'added', b[start + j] ?? '');
      j += 1;
    }
  }
  if (endA < a.length) push(parts, 'same', a.slice(endA).join(''));
  return parts;
}
