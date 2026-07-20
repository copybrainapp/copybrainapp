import { listen } from "@tauri-apps/api/event";
import { PanelLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/components/calendar-view";
import { EmptyState } from "@/components/empty-state";
import { MonitoringBanner } from "@/components/monitoring-banner";
import { MonitoringControls } from "@/components/monitoring-controls";
import { SearchBar } from "@/components/search-bar";
import { Sidebar } from "@/components/sidebar";
import { TimelineList } from "@/components/timeline-list";
import { useTheme } from "@/hooks/use-theme";
import {
  useCollectionItems,
  useCollections,
  useCopyToClipboard,
  useDeleteItem,
  useSearch,
  useTimeline,
  useToggleFavorite,
} from "@/hooks/use-clipboard-data";
import { useMonitoringState } from "@/hooks/use-monitoring-state";
import { contentTypeMeta } from "@/lib/content-type-meta";
import { useUiStore } from "@/store/ui-store";

const SIDEBAR_AUTOCOLLAPSE_WIDTH = 720;

function App() {
  useTheme();

  const {
    view,
    searchQuery,
    selectedCollectionId,
    selectedItemId,
    setSelectedItemId,
    toggleSidebar,
    setSidebarCollapsed,
    shortcutsOpen,
    setShortcutsOpen,
    setSearchQuery,
    activeSection,
    setAboutOpen,
  } = useUiStore();
  const queryClient = useQueryClient();

  const timeline = useTimeline(view);
  const search = useSearch(searchQuery);
  const collectionItems = useCollectionItems(selectedCollectionId);
  const { data: collections } = useCollections();

  const copyToClipboard = useCopyToClipboard();
  const toggleFavorite = useToggleFavorite();
  const deleteItem = useDeleteItem();
  const monitoring = useMonitoringState();

  useEffect(() => {
    const unlisten = listen("clipboard://new-item", () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  useEffect(() => {
    const unlisten = listen("clipboard://item-deleted", () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  useEffect(() => {
    const unlisten = listen("show-about", () => setAboutOpen(true));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setAboutOpen]);

  // Responsive: auto-collapse the sidebar when the window gets narrow.
  // Uses ResizeObserver (not window.innerWidth on mount) because the Tauri
  // webview's initial layout width can be momentarily unreliable, which
  // previously caused the sidebar to collapse permanently on launch.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (!width) return;
      setSidebarCollapsed(width < SIDEBAR_AUTOCOLLAPSE_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [setSidebarCollapsed]);

  const isSearching = searchQuery.trim().length > 0;

  const items = useMemo(() => {
    if (isSearching) return search.data ?? [];
    if (selectedCollectionId) return collectionItems.data ?? [];
    return timeline.data?.pages.flat() ?? [];
  }, [isSearching, search.data, selectedCollectionId, collectionItems.data, timeline.data]);

  const moveSelection = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      const currentIndex = items.findIndex((i) => i.id === selectedItemId);
      const nextIndex =
        currentIndex === -1
          ? 0
          : Math.min(Math.max(currentIndex + delta, 0), items.length - 1);
      setSelectedItemId(items[nextIndex].id);
    },
    [items, selectedItemId, setSelectedItemId]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
        return;
      }

      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (isTyping) {
        if (e.key === "Escape") {
          setShortcutsOpen(false);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          moveSelection(1);
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          moveSelection(-1);
          break;
        case "Enter": {
          const item = items.find((i) => i.id === selectedItemId);
          if (item) copyToClipboard.mutate(item.content);
          break;
        }
        case "f":
        case "F": {
          if (selectedItemId) toggleFavorite.mutate(selectedItemId);
          break;
        }
        case "Escape":
          if (shortcutsOpen) {
            setShortcutsOpen(false);
          } else if (searchQuery) {
            setSearchQuery("");
          } else {
            setSelectedItemId(null);
          }
          break;
        case "?":
          e.preventDefault();
          setShortcutsOpen(true);
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    items,
    selectedItemId,
    setSelectedItemId,
    moveSelection,
    copyToClipboard,
    toggleFavorite,
    searchQuery,
    setSearchQuery,
    shortcutsOpen,
    setShortcutsOpen,
    toggleSidebar,
  ]);

  const headerTitle =
    activeSection === "calendar"
      ? "Calendar"
      : isSearching
        ? `Results for "${searchQuery}"`
        : selectedCollectionId
          ? collections?.find((c) => c.id === selectedCollectionId)?.name ?? "Collection"
          : view === "all"
            ? "All Clipboard"
            : view === "favorites"
              ? "Favorites"
              : contentTypeMeta[view]?.label ?? "Timeline";

  return (
    <div
      ref={rootRef}
      className="flex h-screen w-screen overflow-hidden bg-background text-foreground"
    >
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              className="shrink-0"
            >
              <PanelLeft className="size-4" />
            </Button>
            <h1 className="truncate font-heading text-sm font-semibold">
              {headerTitle}
            </h1>
          </div>
          {activeSection === "timeline" && <SearchBar />}
          <MonitoringControls
            state={monitoring.state}
            onPause={monitoring.pause}
            onResume={monitoring.resume}
            onToggleIncognito={monitoring.toggleIncognito}
          />
        </header>

        <MonitoringBanner
          state={monitoring.state}
          onResume={monitoring.resume}
          onCancelIncognito={monitoring.toggleIncognito}
        />

        <div className="min-h-0 flex-1">
          {activeSection === "calendar" ? (
            <CalendarView />
          ) : items.length === 0 ? (
            <EmptyState
              title={isSearching ? "No matches found" : "Nothing here yet"}
              description={
                isSearching
                  ? "Try a different search term."
                  : "Copy something and it'll show up here automatically."
              }
            />
          ) : (
            <TimelineList
              items={items}
              hasNextPage={!isSearching && !selectedCollectionId && timeline.hasNextPage}
              isFetchingNextPage={timeline.isFetchingNextPage}
              onLoadMore={() => timeline.fetchNextPage()}
              onCopy={(text) => copyToClipboard.mutate(text)}
              onToggleFavorite={(id) => toggleFavorite.mutate(id)}
              onDelete={(id) => deleteItem.mutate(id)}
              selectedItemId={selectedItemId}
              onSelect={setSelectedItemId}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
