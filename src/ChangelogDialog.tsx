import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "./i18n/context";
import changelogRaw from "../CHANGELOG.md?raw";

interface ChangelogEntry {
  date: string;
  title: string;
  description: string;
}

function parseChangelog(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  for (const block of raw.split(/^## /m).slice(1)) {
    const [heading, ...rest] = block.split("\n");
    const match = heading.match(/^(\d{4}-\d{2}-\d{2})\s*-\s*(.+)$/);
    if (!match) continue;
    entries.push({
      date: match[1],
      title: match[2].trim(),
      description: rest.join("\n").trim(),
    });
  }
  return entries;
}

const CHANGELOG_VERSION_KEY = "changelog-last-seen";

const ChangelogDialog = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const entries = useMemo(() => parseChangelog(changelogRaw), []);

  useEffect(() => {
    if (entries.length === 0) return;
    const lastSeen = localStorage.getItem(CHANGELOG_VERSION_KEY);
    if (!lastSeen) {
      localStorage.setItem(CHANGELOG_VERSION_KEY, entries[0].date);
    } else if (lastSeen < entries[0].date) {
      setHasNew(true);
    }
  }, [entries]);

  const handleOpen = () => {
    setOpen(true);
    setHasNew(false);
    if (entries.length > 0) {
      localStorage.setItem(CHANGELOG_VERSION_KEY, entries[0].date);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer bg-transparent border-0 p-0 relative"
      >
        {t("changelog")}
        {hasNew && (
          <span className="absolute -top-1.5 -right-3 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full leading-tight">
            !
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{t("changelog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {entries.map((entry, i) => (
              <div key={i} className="border-b border-gray-200 dark:border-slate-700 pb-3 last:border-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{entry.date}</span>
                <h3 className="font-semibold text-base">{entry.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{entry.description}</p>
              </div>
            ))}
          </div>
          <div className="text-right mt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChangelogDialog;
