import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "./i18n/context";
import { AVAILABLE_LANGUAGES } from "./i18n/languages";

const LanguageSelector: React.FC = () => {
  const { lang, setLang } = useLanguage();

  return (
    <Select value={lang} onValueChange={setLang}>
      <SelectTrigger className="w-[130px] text-base">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AVAILABLE_LANGUAGES.map(l => (
          <SelectItem key={l.code} value={l.code}>
            {l.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LanguageSelector;
