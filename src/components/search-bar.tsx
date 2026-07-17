import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUiStore } from "@/store/ui-store";

export function SearchBar() {
  const { searchQuery, setSearchQuery } = useUiStore();

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search clipboard history..."
        className="pl-8 pr-8"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
