import { Check, Copy, FolderPlus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAddToCollection, useCollections } from "@/hooks/use-clipboard-data";
import { contentTypeMeta } from "@/lib/content-type-meta";
import { timeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClipboardItem } from "@/types";

interface ClipboardCardProps {
  item: ClipboardItem;
  onCopy: (text: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ClipboardCard({
  item,
  onCopy,
  onToggleFavorite,
  onDelete,
}: ClipboardCardProps) {
  const [copied, setCopied] = useState(false);
  const meta = contentTypeMeta[item.content_type];
  const Icon = meta.icon;
  const { data: collections } = useCollections();
  const addToCollection = useAddToCollection();

  function handleCopy() {
    onCopy(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div
      className="group relative flex gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-accent/50 cursor-default"
      onDoubleClick={handleCopy}
    >
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
          {item.content}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{timeLabel(item.created_at)}</span>
          <span className="text-border">·</span>
          <span>{meta.label}</span>
          <span className="text-border">·</span>
          <span>{item.char_count} chars</span>
        </div>
      </div>

      <div
        className={cn(
          "flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
          item.is_favorite && "opacity-100"
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" onClick={handleCopy} />
            }
          >
            {copied ? (
              <Check className="size-3.5 text-primary" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onToggleFavorite(item.id)}
              />
            }
          >
            <Star
              className={cn(
                "size-3.5",
                item.is_favorite && "fill-amber-400 text-amber-400"
              )}
            />
          </TooltipTrigger>
          <TooltipContent>
            {item.is_favorite ? "Unfavorite" : "Favorite"}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" />}
                />
              }
            >
              <FolderPlus className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Add to collection</TooltipContent>
          </Tooltip>
          <DropdownMenuContent>
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
              <DropdownMenuItem disabled>No collections yet</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(item.id)}
              />
            }
          >
            <Trash2 className="size-3.5 text-destructive" />
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
