import { Glasses, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MonitoringState } from "@/types";

interface MonitoringControlsProps {
  state: MonitoringState | undefined;
  onPause: (minutes?: number) => void;
  onResume: () => void;
  onToggleIncognito: () => void;
}

export function MonitoringControls({
  state,
  onPause,
  onResume,
  onToggleIncognito,
}: MonitoringControlsProps) {
  if (!state) return null;

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(state.incognito_next && "text-primary")}
              onClick={onToggleIncognito}
            />
          }
        >
          <Glasses className="size-4" />
        </TooltipTrigger>
        <TooltipContent>
          {state.incognito_next
            ? "Incognito active — click to cancel"
            : "Incognito next copy — don't record what I copy next"}
        </TooltipContent>
      </Tooltip>

      {state.paused ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-primary"
                onClick={onResume}
              />
            }
          >
            <Play className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Resume monitoring</TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label="Pause monitoring" />}
          >
            <Pause className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Pause monitoring</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onPause(5)}>For 5 minutes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPause(30)}>For 30 minutes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPause(60)}>For 1 hour</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPause()}>Until I resume</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
