import { open, save } from "@tauri-apps/plugin-dialog";
import { Download, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  useClearHistory,
  useExportHistory,
  useImportHistory,
} from "@/hooks/use-clipboard-data";
import { getAutostart, setAutostart } from "@/lib/tauri";

const CLEAR_CONFIRM_TIMEOUT_MS = 5000;

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open: isOpen, onOpenChange }: SettingsDialogProps) {
  const [autostart, setAutostartState] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [keepFavorites, setKeepFavorites] = useState(true);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const exportHistory = useExportHistory();
  const importHistory = useImportHistory();
  const clearHistory = useClearHistory();

  useEffect(() => {
    if (!confirmingClear) return;
    const timer = setTimeout(
      () => setConfirmingClear(false),
      CLEAR_CONFIRM_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [confirmingClear]);

  useEffect(() => {
    if (!isOpen) return;
    getAutostart()
      .then(setAutostartState)
      .catch(() => setAutostartState(false));
  }, [isOpen]);

  async function handleAutostartChange(checked: boolean) {
    setAutostartState(checked);
    try {
      await setAutostart(checked);
    } catch {
      setAutostartState(!checked);
    }
  }

  async function handleExport() {
    setStatusMessage(null);
    const path = await save({
      title: "Export clipboard history",
      defaultPath: "copybrain-export.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const count = await exportHistory.mutateAsync(path);
    setStatusMessage(`Exported ${count} item${count === 1 ? "" : "s"}.`);
  }

  async function handleImport() {
    setStatusMessage(null);
    const path = await open({
      title: "Import clipboard history",
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path || Array.isArray(path)) return;
    const count = await importHistory.mutateAsync(path);
    setStatusMessage(`Imported ${count} item${count === 1 ? "" : "s"}.`);
  }

  async function handleClear() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    setConfirmingClear(false);
    setStatusMessage(null);
    await clearHistory.mutateAsync(keepFavorites);
    setStatusMessage("Clipboard history cleared.");
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Launch at startup</p>
              <p className="text-xs text-muted-foreground">
                Open CopyBrain automatically when you log in.
              </p>
            </div>
            <Switch
              checked={autostart ?? false}
              disabled={autostart === null}
              onCheckedChange={handleAutostartChange}
            />
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium">Backup</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleExport}
                disabled={exportHistory.isPending}
              >
                <Download className="size-3.5" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleImport}
                disabled={importHistory.isPending}
              >
                <Upload className="size-3.5" />
                Import
              </Button>
            </div>
            {statusMessage && (
              <p className="mt-2 text-xs text-muted-foreground">
                {statusMessage}
              </p>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-1 text-sm font-medium text-destructive">
              Danger zone
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              Permanently deletes clipboard history. Export a backup first if
              you might need it later.
            </p>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Keep favorites</p>
              <Switch
                checked={keepFavorites}
                onCheckedChange={setKeepFavorites}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={handleClear}
                disabled={clearHistory.isPending}
              >
                <Trash2 className="size-3.5" />
                {confirmingClear ? "Click again to confirm" : "Clear history"}
              </Button>
              {confirmingClear && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmingClear(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
