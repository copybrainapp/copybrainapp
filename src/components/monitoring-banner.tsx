import { Button } from "@/components/ui/button";
import { remainingLabel } from "@/lib/format";
import type { MonitoringState } from "@/types";

interface MonitoringBannerProps {
  state: MonitoringState | undefined;
  onResume: () => void;
  onCancelIncognito: () => void;
}

export function MonitoringBanner({
  state,
  onResume,
  onCancelIncognito,
}: MonitoringBannerProps) {
  if (!state || (!state.paused && !state.incognito_next)) return null;

  const message = state.incognito_next
    ? "🕶 Incognito active — your next copy won't be recorded"
    : state.paused_indefinite
      ? "⏸ Monitoring paused"
      : `⏸ Monitoring paused (${remainingLabel(state.paused_until ?? Date.now())})`;

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-accent/50 px-3 py-1.5 text-xs sm:px-5">
      <span>{message}</span>
      <Button
        variant="ghost"
        size="xs"
        onClick={state.incognito_next ? onCancelIncognito : onResume}
      >
        {state.incognito_next ? "Cancel" : "Resume"}
      </Button>
    </div>
  );
}
