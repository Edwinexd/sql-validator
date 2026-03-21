import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useLanguage } from "./i18n/context";

// Keep static imports as fallback for Swedish (backwards compat with existing SVGs)
import dbLayoutDarkFallback from "./db_layout_dark.svg";
import dbLayoutLightFallback from "./db_layout_light.svg";
import dbLayoutLightPngFallback from "./db_layout_light_bg.png";

const DatabaseLayoutDialog = ({ isDarkMode }: { isDarkMode: () => boolean }) => {
  const { lang, engine, t } = useLanguage();
  const [open, setOpen] = useState(false);

  // Use engine-specific ERD path (PostgreSQL ERDs are in {lang}-pg/)
  const basePath = engine === "postgresql" ? `/languages/${lang}-pg` : `/languages/${lang}`;
  const darkSrc = `${basePath}/db_layout_dark.svg`;
  const lightSrc = `${basePath}/db_layout_light.svg`;
  const lightPngSrc = `${basePath}/db_layout_light_bg.png`;

  // Use fallback for Swedish or if language-specific files don't exist
  const [useFallback, setUseFallback] = useState(false);

  const getDarkSrc = () => useFallback ? dbLayoutDarkFallback : darkSrc;
  const getLightSrc = () => useFallback ? dbLayoutLightFallback : lightSrc;
  const getLightPngSrc = () => useFallback ? dbLayoutLightPngFallback : lightPngSrc;

  const openDialog = () => {
    const isSmallScreen = window.matchMedia("(max-width: 48rem)").matches;

    if (isSmallScreen) {
      window.open(getLightPngSrc(), "_blank");
      return;
    }
    setOpen(true);
  };

  return (
    <div>
      <button
        onClick={openDialog}
        className="max-w-4xl w-full h-[45vh] border-none p-0 bg-transparent cursor-zoom-in"
        aria-label={t("openDatabaseLayout")}
      >
        <img
          src={isDarkMode() ? getDarkSrc() : getLightSrc()}
          alt={t("databaseLayout")}
          className="w-full h-full object-contain"
          onError={() => setUseFallback(true)}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border dark:border-slate-700 dark:bg-slate-950/90 bg-slate-50/90 [&>button]:hidden">
          <div className="relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-red-500 hover:text-red-700 z-10"
              aria-label={t("closeDialog")}
            >
              <X className="w-10 h-10" />
            </button>
            <img
              src={isDarkMode() ? getDarkSrc() : getLightSrc()}
              alt={t("databaseLayout")}
              className="max-w-full max-h-[90vh] object-contain cursor-zoom-out"
              onClick={() => setOpen(false)}
              onError={() => setUseFallback(true)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DatabaseLayoutDialog;
