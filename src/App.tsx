import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/empty-state";
import { SearchBar } from "@/components/search-bar";
import { Sidebar } from "@/components/sidebar";
import { TimelineList } from "@/components/timeline-list";
import {
  useCollectionItems,
  useCollections,
  useCopyToClipboard,
  useDeleteItem,
  useSearch,
  useTimeline,
  useToggleFavorite,
} from "@/hooks/use-clipboard-data";
import { contentTypeMeta } from "@/lib/content-type-meta";
import { useUiStore } from "@/store/ui-store";

function App() {
  const { view, searchQuery, selectedCollectionId } = useUiStore();
  const queryClient = useQueryClient();

  const timeline = useTimeline(view);
  const search = useSearch(searchQuery);
  const collectionItems = useCollectionItems(selectedCollectionId);
  const { data: collections } = useCollections();

  const copyToClipboard = useCopyToClipboard();
  const toggleFavorite = useToggleFavorite();
  const deleteItem = useDeleteItem();

  useEffect(() => {
    const unlisten = listen("clipboard://new-item", () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  const isSearching = searchQuery.trim().length > 0;

  const items = useMemo(() => {
    if (isSearching) return search.data ?? [];
    if (selectedCollectionId) return collectionItems.data ?? [];
    return timeline.data?.pages.flat() ?? [];
  }, [isSearching, search.data, selectedCollectionId, collectionItems.data, timeline.data]);

  const headerTitle = isSearching
    ? `Results for "${searchQuery}"`
    : selectedCollectionId
      ? collections?.find((c) => c.id === selectedCollectionId)?.name ?? "Collection"
      : view === "all"
        ? "All Clipboard"
        : view === "favorites"
          ? "Favorites"
          : contentTypeMeta[view]?.label ?? "Timeline";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-3">
          <div>
            <h1 className="font-heading text-sm font-semibold">{headerTitle}</h1>
          </div>
          <SearchBar />
        </header>

        <div className="min-h-0 flex-1">
          {items.length === 0 ? (
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
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
