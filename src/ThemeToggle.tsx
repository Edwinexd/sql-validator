import React from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ThemeToggleProps {
  setTheme: (theme: "light" | "dark" | "system") => void;
  isDarkMode: () => boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ setTheme, isDarkMode }) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {setTheme(isDarkMode() ? "light" : "dark");}}
      className="text-blue-500 dark:text-yellow-500"
    >
      {isDarkMode() ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
};

export default ThemeToggle;
