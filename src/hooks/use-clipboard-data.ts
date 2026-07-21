import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import * as api from "@/lib/tauri";
import type { ViewFilter } from "@/store/ui-store";

const SEARCH_DEBOUNCE_MS = 100;

const PAGE_SIZE = 50;

function timelineParamsFor(view: ViewFilter) {
  if (view === "all") return {};
  if (view === "favorites") return { favoritesOnly: true };
  return { contentType: view };
}

export function useTimeline(view: ViewFilter) {
  const params = timelineParamsFor(view);
  return useInfiniteQuery({
    queryKey: ["timeline", view],
    queryFn: ({ pageParam }) =>
      api.getTimeline({ ...params, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1]?.created_at,
  });
}

export function useCollectionItems(collectionId: string | null) {
  return useQuery({
    queryKey: ["collection-items", collectionId],
    queryFn: () => api.getCollectionItems(collectionId as string),
    enabled: !!collectionId,
  });
}

export function useSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  return useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => api.fuzzySearchItems(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: api.listCollections,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: api.getStats,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.toggleFavorite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["collection-items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["day-items"] });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["collection-items"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["day-items"] });
      queryClient.invalidateQueries({ queryKey: ["activity-counts"] });
    },
  });
}

export function useCopyToClipboard() {
  return useMutation({
    mutationFn: api.copyToClipboard,
  });
}

export function useClearHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.clearHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) =>
      api.createCollection(name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useAddToCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, itemId }: { collectionId: string; itemId: string }) =>
      api.addToCollection(collectionId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collection-items"] });
    },
  });
}

export function useActivityCounts(yearMonth: string) {
  return useQuery({
    queryKey: ["activity-counts", yearMonth],
    queryFn: () => api.getActivityCounts(yearMonth),
  });
}

export function useDayItems(date: string | null) {
  return useQuery({
    queryKey: ["day-items", date],
    queryFn: () => api.getItemsByDate(date as string),
    enabled: !!date,
  });
}

export function useExportHistory() {
  return useMutation({
    mutationFn: api.exportHistory,
  });
}

export function useImportHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.importHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity-counts"] });
      queryClient.invalidateQueries({ queryKey: ["day-items"] });
    },
  });
}
