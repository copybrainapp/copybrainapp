import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import { ClipboardCard } from "@/components/clipboard-card";
import { dateGroupLabel } from "@/lib/format";
import type { ClipboardItem } from "@/types";

type Row =
  | { kind: "header"; key: string; label: string }
  | { kind: "item"; key: string; item: ClipboardItem };

interface TimelineListProps {
  items: ClipboardItem[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onCopy: (text: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TimelineList({
  items,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onCopy,
  onToggleFavorite,
  onDelete,
}: TimelineListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    let lastLabel: string | null = null;
    for (const item of items) {
      const label = dateGroupLabel(item.created_at);
      if (label !== lastLabel) {
        result.push({ kind: "header", key: `h-${label}-${item.id}`, label });
        lastLabel = label;
      }
      result.push({ kind: "item", key: item.id, item });
    }
    return result;
  }, [items]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (rows[index]?.kind === "header" ? 36 : 84),
    overscan: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= rows.length - 1 && hasNextPage && !isFetchingNextPage) {
      onLoadMore?.();
    }
  }, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <div ref={parentRef} className="h-full overflow-y-auto px-2">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          return (
            <div
              key={row.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.kind === "header" ? (
                <div className="sticky top-0 z-10 flex items-center bg-background/95 px-3 pt-4 pb-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                  {row.label}
                </div>
              ) : (
                <ClipboardCard
                  item={row.item}
                  onCopy={onCopy}
                  onToggleFavorite={onToggleFavorite}
                  onDelete={onDelete}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
