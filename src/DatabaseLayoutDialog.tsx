import { useRef, useState } from "react";
import dbLayoutDark from "./db_layout_dark.svg";
import dbLayoutLight from "./db_layout_light.svg";
import dbLayoutLightPng from "./db_layout_light_bg.png";
import { XMarkIcon } from "@heroicons/react/24/solid";

const DatabaseLayoutDialog = ({ isDarkMode }: { isDarkMode: () => boolean }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = () => {
    const isSmallScreen = window.matchMedia("(max-width: 48rem)").matches;

    if (isSmallScreen) {
      window.open(dbLayoutLightPng, "_blank");
      return;
    }
    dialogRef.current?.showModal();
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    dialogRef.current?.close();
    setIsDialogOpen(false);
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
          className="w-full h-full"
        />
      </button>

      <dialog
        ref={dialogRef}
        onClick={closeDialog}
        onCancel={closeDialog}
        // This is not a good solution (flex) but I spent too much time on this already / Edwin 2024-12-07
        className={`rounded-lg shadow-lg border item-center justify-center dark:border-slate-700 dark:bg-slate-950/90 bg-slate-50/90 ${isDialogOpen ? "flex" : ""}`}
      >
        <div className="relative">
          <button
            onClick={closeDialog}
            className="absolute top-4 right-4 text-red-500 hover:text-red-700"
            aria-label="Close dialog"
          >
            <XMarkIcon className="w-10 h-10" />
          </button>
          <img
            src={isDarkMode() ? dbLayoutDark : dbLayoutLight}
            alt="Database Layout"
            className="w-full h-full cursor-zoom-out"
          />
        </div>
      </dialog>
    </div>
  );
};

export default DatabaseLayoutDialog;
