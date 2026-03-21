import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "./i18n/context";
import { AVAILABLE_ENGINES } from "./i18n/languages";

const EngineSelector: React.FC = () => {
  const { engine, setEngine } = useLanguage();

  return (
    <Select value={engine} onValueChange={(v) => setEngine(v as "sqlite" | "postgresql")}>
      <SelectTrigger className="w-[140px] text-base">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AVAILABLE_ENGINES.map(e => (
          <SelectItem key={e.type} value={e.type}>
            {e.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default EngineSelector;
