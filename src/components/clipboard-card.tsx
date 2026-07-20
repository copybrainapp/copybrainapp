import { Check, Copy, Eye, EyeOff, FolderPlus, Star, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ItemDetailDialog } from "@/components/item-detail-dialog"
import { useAddToCollection, useCollections } from "@/hooks/use-clipboard-data"
import { getContentTypeMeta } from "@/lib/content-type-meta"
import { maskSecret, timeLabel } from "@/lib/format"
import { getQuickActions } from "@/lib/quick-actions"
import { detectSocialPlatform } from "@/lib/social-platform"
import { cn } from "@/lib/utils"
import type { ClipboardItem } from "@/types"

const LONG_CONTENT_THRESHOLD = 180
const SECRET_REVEAL_MS = 8000

interface ClipboardCardProps {
  item: ClipboardItem
  selected?: boolean
  onCopy: (text: string) => void
  onToggleFavorite: (id: string) => void
  onDelete: (id: string) => void
  onSelect?: (id: string) => void
}

export function ClipboardCard({
  item,
  selected = false,
  onCopy,
  onToggleFavorite,
  onDelete,
  onSelect
}: ClipboardCardProps) {
  const [copied, setCopied] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const meta = getContentTypeMeta(item.content_type)
  const social = item.content_type === "social" ? detectSocialPlatform(item.content) : null
  const Icon = social?.icon ?? meta.icon
  const { data: collections } = useCollections()
  const addToCollection = useAddToCollection()

  const isSecret = item.content_type === "secret"
  const isLong = item.content.length > LONG_CONTENT_THRESHOLD || item.content.split("\n").length > 3
  const quickActions = getQuickActions(item, onCopy)

  // Secrets re-mask themselves after a few seconds instead of staying
  // revealed indefinitely, so a card left open on screen doesn't leak a
  // password long after the user looked away.
  useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setRevealed(false), SECRET_REVEAL_MS)
    return () => clearTimeout(timer)
  }, [revealed])

  function handleCopy() {
    onCopy(item.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "group relative flex gap-3 rounded-lg border px-3 py-2.5 transition-colors cursor-default",
        selected ? "border-primary/40 bg-accent" : "border-transparent hover:border-border hover:bg-accent/50"
      )}
      onClick={() => onSelect?.(item.id)}
      onDoubleClick={handleCopy}
    >
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground",
            isSecret && !revealed && "select-none tracking-widest",
            item.content_type === "code" && "font-mono text-xs"
          )}
        >
          {isSecret && !revealed ? maskSecret() : item.content}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{timeLabel(item.created_at)}</span>
          <span className="text-border">·</span>
          <span>{social?.label ?? meta.label}</span>
          <span className="text-border">·</span>
          <span>{item.char_count} chars</span>

          {item.app_name && (
            <>
              <span className="text-border">·</span>
              <span className="truncate">{item.app_name}</span>
            </>
          )}
        </div>
      </div>

      {isSecret && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setRevealed((r) => !r)
                }}
              />
            }
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </TooltipTrigger>
          <TooltipContent>{revealed ? "Hide" : "Reveal"}</TooltipContent>
        </Tooltip>
      )}

      <div
        className={cn(
          "flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
          (item.is_favorite || selected) && "opacity-100"
        )}
      >
        {isLong && (
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => setDetailOpen(true)} />}>
              <Eye className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>View full content</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={handleCopy} />}>
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>

        {quickActions.map((action) => (
          <Tooltip key={action.label}>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    action.run()
                  }}
                />
              }
            >
              {action.swatch ? (
                <span
                  className="size-3.5 rounded-full border border-border"
                  style={{ backgroundColor: action.swatch }}
                />
              ) : (
                <action.icon className="size-3.5" />
              )}
            </TooltipTrigger>
            <TooltipContent>{action.label}</TooltipContent>
          </Tooltip>
        ))}

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => onToggleFavorite(item.id)} />}>
            <Star className={cn("size-3.5", item.is_favorite && "fill-amber-400 text-amber-400")} />
          </TooltipTrigger>
          <TooltipContent>{item.is_favorite ? "Unfavorite" : "Favorite"}</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Add to collection" />}>
            <FolderPlus className="size-3.5" />
          </DropdownMenuTrigger>
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
                        itemId: item.id
                      })
                    }
                  >
                    {c.name}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No collections yet</DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => onDelete(item.id)} />}>
            <Trash2 className="size-3.5 text-destructive" />
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>

      <ItemDetailDialog
        item={item}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onCopy={onCopy}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDelete}
      />
    </div>
  )
}
