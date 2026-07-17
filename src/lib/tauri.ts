import { invoke } from "@tauri-apps/api/core";
import type { ClipboardItem, Collection, ContentType, Stats } from "@/types";

export interface TimelineParams {
  cursor?: number;
  limit: number;
  contentType?: ContentType;
  favoritesOnly?: boolean;
}

export function getTimeline(params: TimelineParams) {
  return invoke<ClipboardItem[]>("get_timeline", {
    cursor: params.cursor ?? null,
    limit: params.limit,
    contentType: params.contentType ?? null,
    favoritesOnly: params.favoritesOnly ?? false,
  });
}

export function searchItems(query: string, limit = 100) {
  return invoke<ClipboardItem[]>("search_items", { query, limit });
}

export function toggleFavorite(id: string) {
  return invoke<boolean>("toggle_favorite", { id });
}

export function deleteItem(id: string) {
  return invoke<void>("delete_item", { id });
}

export function clearHistory(keepFavorites: boolean) {
  return invoke<void>("clear_history", { keepFavorites });
}

export function copyToClipboard(text: string) {
  return invoke<void>("copy_to_clipboard", { text });
}

export function getStats() {
  return invoke<Stats>("get_stats");
}

export function listCollections() {
  return invoke<Collection[]>("list_collections");
}

export function createCollection(name: string, color?: string) {
  return invoke<Collection>("create_collection", { name, color: color ?? null });
}

export function deleteCollection(collectionId: string) {
  return invoke<void>("delete_collection", { collectionId });
}

export function addToCollection(collectionId: string, itemId: string) {
  return invoke<void>("add_to_collection", { collectionId, itemId });
}

export function removeFromCollection(collectionId: string, itemId: string) {
  return invoke<void>("remove_from_collection", { collectionId, itemId });
}

export function getCollectionItems(collectionId: string) {
  return invoke<ClipboardItem[]>("get_collection_items", { collectionId });
}

export function setAutostart(enabled: boolean) {
  return invoke<void>("set_autostart", { enabled });
}

export function getAutostart() {
  return invoke<boolean>("get_autostart");
}
