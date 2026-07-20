import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { arch, platform } from "@tauri-apps/plugin-os";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRIVACY_URL =
  "https://github.com/copybrainapp/copybrainapp/blob/main/PRIVACY.md";

const PLATFORM_LABELS: Record<string, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
  ios: "iOS",
  android: "Android",
  freebsd: "FreeBSD",
  dragonfly: "DragonFly BSD",
  netbsd: "NetBSD",
  openbsd: "OpenBSD",
  solaris: "Solaris",
};

const ARCH_LABELS: Record<string, string> = {
  x86_64: "x64",
  aarch64: "ARM64",
  x86: "x86",
  arm: "ARM",
};

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, [open]);

  const platformName = platform();
  const archName = arch();
  const platformLabel = PLATFORM_LABELS[platformName] ?? platformName;
  const archLabel = ARCH_LABELS[archName] ?? archName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="sr-only">About CopyBrain</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <img
            src="/app-icon.png"
            alt="CopyBrain"
            className="size-16 rounded-2xl shadow-sm"
          />
          <div>
            <p className="font-heading text-base font-semibold">CopyBrain</p>
            <p className="mt-1 max-w-56 text-sm text-muted-foreground">
              Your second brain for everything you copy
            </p>
          </div>
          <div className="mt-2 flex flex-col items-center gap-0.5 text-xs text-muted-foreground">
            <span>Version {version ?? "…"}</span>
            <span>
              {platformLabel} · {archLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={() => openUrl(PRIVACY_URL)}
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <ShieldCheck className="size-3.5" />
            100% private, secure &amp; open source
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
