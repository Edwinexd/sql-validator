import { useState } from "react";
import dbLayoutDark from "./db_layout_dark.svg";
import dbLayoutLight from "./db_layout_light.svg";
import dbLayoutLightPng from "./db_layout_light_bg.png";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

const DatabaseLayoutDialog = ({ isDarkMode }: { isDarkMode: () => boolean }) => {
  const [open, setOpen] = useState(false);

  const openDialog = () => {
    const isSmallScreen = window.matchMedia("(max-width: 48rem)").matches;

    if (isSmallScreen) {
      window.open(dbLayoutLightPng, "_blank");
      return;
    }
    setOpen(true);
  };

  return (
    <div>
      <button
        onClick={openDialog}
        className="max-w-4xl w-full h-[45vh] border-none p-0 bg-transparent cursor-zoom-in"
        aria-label="Open Database Layout"
      >
        <img
          src={isDarkMode() ? dbLayoutDark : dbLayoutLight}
          alt="Database Layout"
          className="w-full h-full object-contain"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border dark:border-slate-700 dark:bg-slate-950/90 bg-slate-50/90 [&>button]:hidden">
          <div className="relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-red-500 hover:text-red-700 z-10"
              aria-label="Close dialog"
            >
              <X className="w-10 h-10" />
            </button>
            <img
              src={isDarkMode() ? dbLayoutDark : dbLayoutLight}
              alt="Database Layout"
              className="max-w-full max-h-[90vh] object-contain cursor-zoom-out"
              onClick={() => setOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DatabaseLayoutDialog;
