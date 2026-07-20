import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FolderPlus,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAddToCollection, useCollections } from "@/hooks/use-clipboard-data";
import { getContentTypeMeta } from "@/lib/content-type-meta";
import { dateGroupLabel, maskSecret, timeLabel } from "@/lib/format";
import { detectSocialPlatform } from "@/lib/social-platform";
import { cn } from "@/lib/utils";
import type { ClipboardItem } from "@/types";

interface ItemDetailDialogProps {
  item: ClipboardItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: (text: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ItemDetailDialog({
  item,
  open,
  onOpenChange,
  onCopy,
  onToggleFavorite,
  onDelete,
}: ItemDetailDialogProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const { data: collections } = useCollections();
  const addToCollection = useAddToCollection();

  useEffect(() => {
    if (!open) setRevealed(false);
  }, [open]);

  if (!item) return null;

  const meta = getContentTypeMeta(item.content_type);
  const social =
    item.content_type === "social" ? detectSocialPlatform(item.content) : null;
  const Icon = social?.icon ?? meta.icon;
  const isSecret = item.content_type === "secret";

  function handleCopy() {
    if (!item) return;
    onCopy(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-4">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-3.5" />
              </span>
              {social?.label ?? meta.label}
            </span>
            {isSecret && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setRevealed((r) => !r)}
              >
                {revealed ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
                {revealed ? "Hide" : "Reveal"}
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {dateGroupLabel(item.created_at)} at {timeLabel(item.created_at)} ·{" "}
            {item.char_count.toLocaleString()} characters
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-muted/30">
          <p
            className={cn(
              "select-text whitespace-pre-wrap break-words p-4 text-sm leading-relaxed text-foreground",
              isSecret && !revealed && "select-none tracking-widest",
              item.content_type === "code" && "font-mono text-xs"
            )}
          >
            {isSecret && !revealed ? maskSecret() : item.content}
          </p>
        </div>

        <DialogFooter className="shrink-0 flex-row flex-wrap items-center justify-between gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="size-3.5 text-primary" />
              ) : (
                <Copy className="size-3.5" />
              )}
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleFavorite(item.id)}
            >
              <Star
                className={cn(
                  "size-3.5",
                  item.is_favorite && "fill-amber-400 text-amber-400"
                )}
              />
              {item.is_favorite ? "Unfavorite" : "Favorite"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    <FolderPlus className="size-3.5" />
                    Collection
                  </Button>
                }
              />
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Add to collection</DropdownMenuLabel>
                  {collections?.length ? (
                    collections.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() =>
                          addToCollection.mutate({
                            collectionId: c.id,
                            itemId: item.id,
                          })
                        }
                      >
                        {c.name}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      No collections yet
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onDelete(item.id);
              onOpenChange(false);
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
