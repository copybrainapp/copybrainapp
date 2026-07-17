import { create } from "zustand";
import type { ContentType } from "@/types";

export type ViewFilter = "all" | "favorites" | ContentType;

interface UiState {
  view: ViewFilter;
  selectedCollectionId: string | null;
  searchQuery: string;
  selectedItemId: string | null;
  setView: (view: ViewFilter) => void;
  setSelectedCollectionId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedItemId: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "all",
  selectedCollectionId: null,
  searchQuery: "",
  selectedItemId: null,
  setView: (view) => set({ view, selectedCollectionId: null }),
  setSelectedCollectionId: (id) => set({ selectedCollectionId: id, view: "all" }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedItemId: (id) => set({ selectedItemId: id }),
}));
