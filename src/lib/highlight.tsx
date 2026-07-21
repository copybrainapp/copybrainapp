import type { ReactNode } from "react";

/** Wraps the characters at `indices` (as returned by the fuzzy search backend) in <mark>. */
export function highlightMatches(text: string, indices: number[] | undefined): ReactNode {
  if (!indices || indices.length === 0) return text;

  const indexSet = new Set(indices);
  const chars = Array.from(text);
  const nodes: ReactNode[] = [];
  let buffer = "";
  let bufferIsMatch = false;

  function flush() {
    if (!buffer) return;
    nodes.push(
      bufferIsMatch ? (
        <mark key={nodes.length} className="rounded-sm bg-primary/25 text-inherit">
          {buffer}
        </mark>
      ) : (
        <span key={nodes.length}>{buffer}</span>
      )
    );
    buffer = "";
  }

  chars.forEach((char, i) => {
    const isMatch = indexSet.has(i);
    if (isMatch !== bufferIsMatch) {
      flush();
      bufferIsMatch = isMatch;
    }
    buffer += char;
  });
  flush();

  return nodes;
}
