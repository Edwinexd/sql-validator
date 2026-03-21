import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@radix-ui/react-checkbox";
import { Label } from "@radix-ui/react-label";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorSettings } from "./useEditorSettings";
import { useLanguage } from "./i18n/context";

interface EditorSettingsDialogProps {
  settings: EditorSettings;
  onSettingsChange: (partial: Partial<EditorSettings>) => void;
}

const EditorSettingsDialog: React.FC<EditorSettingsDialogProps> = ({ settings, onSettingsChange }) => {
  const { t } = useLanguage();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("editorSettings") || "Editor Settings"}>
          <Settings2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("editorSettings") || "Editor Settings"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <SettingToggle
            label={t("settingAutocomplete") || "Autocomplete"}
            checked={settings.autocomplete}
            onChange={v => onSettingsChange({ autocomplete: v })}
          />
          <SettingToggle
            label={t("settingLineNumbers") || "Line Numbers"}
            checked={settings.lineNumbers}
            onChange={v => onSettingsChange({ lineNumbers: v })}
          />
          <SettingToggle
            label={t("settingHighlightActiveLine") || "Highlight Active Line"}
            checked={settings.highlightActiveLine}
            onChange={v => onSettingsChange({ highlightActiveLine: v })}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

function SettingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="text-sm cursor-pointer">{label}</Label>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={v => onChange(v === true)}
        className="h-5 w-5 rounded border border-gray-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 flex items-center justify-center"
      >
        {checked && <span className="text-white text-xs">&#10003;</span>}
      </Checkbox>
    </div>
  );
}

export default EditorSettingsDialog;
