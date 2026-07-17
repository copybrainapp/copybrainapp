import { format, parseISO } from "date-fns";
import { ClipboardCard } from "@/components/clipboard-card";
import { EmptyState } from "@/components/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCopyToClipboard,
  useDayItems,
  useDeleteItem,
  useToggleFavorite,
} from "@/hooks/use-clipboard-data";

interface DayDetailDialogProps {
  date: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DayDetailDialog({ date, open, onOpenChange }: DayDetailDialogProps) {
  const { data: items, isLoading } = useDayItems(open ? date : null);
  const copyToClipboard = useCopyToClipboard();
  const toggleFavorite = useToggleFavorite();
  const deleteItem = useDeleteItem();

  if (!date) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-4">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-heading text-xl font-semibold">
            {format(parseISO(date), "EEEE, MMMM d, yyyy")}
          </DialogTitle>
          <DialogDescription>
            {items?.length
              ? `${items.length} item${items.length === 1 ? "" : "s"} copied that day`
              : "Nothing copied that day"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : !items || items.length === 0 ? (
          <EmptyState
            title="No activity"
            description="Nothing was copied on this day."
          />
        ) : (
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            <div className="space-y-0.5 pb-1">
              {items.map((item) => (
                <ClipboardCard
                  key={item.id}
                  item={item}
                  onCopy={(text) => copyToClipboard.mutate(text)}
                  onToggleFavorite={(id) => toggleFavorite.mutate(id)}
                  onDelete={(id) => deleteItem.mutate(id)}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
