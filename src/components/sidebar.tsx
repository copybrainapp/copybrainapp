import {
  ClipboardList,
  FolderClosed,
  Plus,
  Star,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { CreateCollectionDialog } from "@/components/create-collection-dialog";
import { contentTypeMeta } from "@/lib/content-type-meta";
import { cn } from "@/lib/utils";
import { useCollections, useStats } from "@/hooks/use-clipboard-data";
import { useUiStore, type ViewFilter } from "@/store/ui-store";
import type { ContentType } from "@/types";

function NavRow({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <span className="flex size-4 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const { view, selectedCollectionId, setView, setSelectedCollectionId } =
    useUiStore();
  const { data: stats } = useStats();
  const { data: collections } = useCollections();
  const [createOpen, setCreateOpen] = useState(false);

  function select(v: ViewFilter) {
    setView(v);
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
          C
        </div>
        <span className="font-heading text-sm font-semibold">CopyBrain</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="mb-4 space-y-0.5">
          <NavRow
            active={view === "all" && !selectedCollectionId}
            icon={<ClipboardList className="size-4" />}
            label="All Clipboard"
            count={stats?.total}
            onClick={() => select("all")}
          />
          <NavRow
            active={view === "favorites"}
            icon={<Star className="size-4" />}
            label="Favorites"
            count={stats?.favorites}
            onClick={() => select("favorites")}
          />
        </div>

        <div className="mb-4">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Types
          </div>
          <div className="space-y-0.5">
            {(Object.keys(contentTypeMeta) as ContentType[]).map((ct) => {
              const meta = contentTypeMeta[ct];
              const Icon = meta.icon;
              const count = stats?.by_type.find(
                (t) => t.content_type === ct
              )?.count;
              return (
                <NavRow
                  key={ct}
                  active={view === ct}
                  icon={<Icon className="size-4" />}
                  label={meta.label}
                  count={count}
                  onClick={() => select(ct)}
                />
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Collections
            </span>
            <button
              onClick={() => setCreateOpen(true)}
              className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {collections?.length ? (
              collections.map((c) => (
                <NavRow
                  key={c.id}
                  active={selectedCollectionId === c.id}
                  icon={<FolderClosed className="size-4" />}
                  label={c.name}
                  count={c.item_count}
                  onClick={() => setSelectedCollectionId(c.id)}
                />
              ))
            ) : (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                No collections yet
              </p>
            )}
          </div>
        </div>
      </div>

      <CreateCollectionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </aside>
  );
}
