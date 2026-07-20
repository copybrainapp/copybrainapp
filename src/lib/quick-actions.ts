import { openUrl } from "@tauri-apps/plugin-opener";
import { Braces, ExternalLink, Mail, Palette } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { ClipboardItem } from "@/types";

export interface QuickAction {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  swatch?: string;
  run: () => void | Promise<void>;
}

const HEX_COLOR_RE = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function looksLikeJson(trimmed: string): boolean {
  if (
    !(trimmed.startsWith("{") && trimmed.endsWith("}")) &&
    !(trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/** Only offered when the JSON isn't already pretty — collapsing an already-formatted
 * block into "prettify" would be a no-op the user never asked for. */
function isAlreadyPretty(trimmed: string): boolean {
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2) === trimmed;
  } catch {
    return true;
  }
}

export function getQuickActions(
  item: ClipboardItem,
  onCopy: (text: string) => void
): QuickAction[] {
  const trimmed = item.content.trim();
  const actions: QuickAction[] = [];

  if (item.content_type === "url" || item.content_type === "social") {
    actions.push({
      label: "Open link",
      icon: ExternalLink,
      run: () => openUrl(trimmed),
    });
  }

  if (item.content_type === "email") {
    actions.push({
      label: "Compose email",
      icon: Mail,
      run: () => openUrl(`mailto:${trimmed}`),
    });
  }

  const hexMatch = trimmed.match(HEX_COLOR_RE);
  if (hexMatch) {
    const rgb = hexToRgb(hexMatch[1]);
    if (rgb) {
      actions.push({
        label: `Copy as rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
        icon: Palette,
        swatch: trimmed.startsWith("#") ? trimmed : `#${trimmed}`,
        run: () => onCopy(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`),
      });
    }
  }

  if (looksLikeJson(trimmed) && !isAlreadyPretty(trimmed)) {
    actions.push({
      label: "Copy prettified JSON",
      icon: Braces,
      run: () => onCopy(JSON.stringify(JSON.parse(trimmed), null, 2)),
    });
  }

  return actions;
}
