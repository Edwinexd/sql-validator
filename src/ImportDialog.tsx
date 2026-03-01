import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
// @ts-expect-error - No types available
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-sql";
import { getQuestion } from "./QuestionSelector";
import {
  ParsedSaveData,
  MergeAnalysis,
  MergeConflict,
  ConflictResolution,
  getLocalData,
  buildMergedData,
} from "./mergeUtils";

export interface ImportDialogHandle {
  open: (analysis: MergeAnalysis) => void;
  close: () => void;
}

interface ImportDialogProps {
  importedData: ParsedSaveData | null;
  onOverwrite: () => void;
  onMergeApply: (merged: ParsedSaveData) => void;
}

function diffLines(local: string, imported: string): Set<number> {
  const localLines = local.split("\n");
  const importedLines = imported.split("\n");
  const changed = new Set<number>();
  for (let i = 0; i < importedLines.length; i++) {
    if (i >= localLines.length || importedLines[i] !== localLines[i]) {
      changed.add(i);
    }
  }
  return changed;
}

function highlightWithDiff(
  code: string,
  changedLines: Set<number>,
  diffClass: string
): string {
  const highlighted = highlight(code, languages.sql) as string;
  return highlighted
    .split("\n")
    .map((line, i) => {
      if (changedLines.has(i)) {
        return `<span class="${diffClass}">${line}</span>`;
      }
      return line;
    })
    .join("\n");
}

function SqlBlock({ code, changedLines, variant }: { code: string; changedLines?: Set<number>; variant?: "removed" | "added" }) {
  const diffClass = variant === "removed" ? "diff-removed-line" : "diff-added-line";
  const html = useMemo(
    () => changedLines ? highlightWithDiff(code, changedLines, diffClass) : highlight(code, languages.sql),
    [code, changedLines, diffClass]
  );
  return (
    <pre
      className="font-mono text-sm dark:bg-slate-800 bg-slate-100 rounded-md border dark:border-slate-600 border-gray-300 p-2 whitespace-pre-wrap break-words"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function getConflictLabel(conflict: MergeConflict): string {
  if (conflict.type === "view") {
    return `View "${conflict.key}"`;
  }
  const question = getQuestion(Number(conflict.key));
  return question
    ? `Question ${question.category.display_number}${question.display_sequence}`
    : `Question ${conflict.key}`;
}

const ImportDialog = forwardRef<ImportDialogHandle, ImportDialogProps>(
  ({ importedData, onOverwrite, onMergeApply }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<"choose" | "resolve">("choose");
    const [analysis, setAnalysis] = useState<MergeAnalysis | null>(null);
    const [resolutions, setResolutions] = useState<
      Record<string, ConflictResolution>
    >({});

    useImperativeHandle(ref, () => ({
      open: (a: MergeAnalysis) => {
        setAnalysis(a);
        setResolutions({});
        setStep("choose");
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }));

    const handleOverwrite = () => {
      onOverwrite();
      setIsOpen(false);
    };

    const handleMerge = () => {
      if (!importedData || !analysis) return;
      if (analysis.conflicts.length === 0) {
        const local = getLocalData();
        const merged = buildMergedData(local, importedData, analysis, {});
        onMergeApply(merged);
        setIsOpen(false);
      } else {
        setStep("resolve");
      }
    };

    const handleApplyMerge = () => {
      if (!importedData || !analysis) return;
      const local = getLocalData();
      const merged = buildMergedData(local, importedData, analysis, resolutions);
      onMergeApply(merged);
      setIsOpen(false);
    };

    const resolvedCount = analysis
      ? analysis.conflicts.filter(
        (c) => resolutions[`${c.type}:${c.key}`] !== undefined
      ).length
      : 0;
    const allResolved = analysis
      ? resolvedCount === analysis.conflicts.length
      : false;
    const addedCount = analysis
      ? Object.keys(analysis.addRawQueries).length +
        Object.keys(analysis.addCorrectQueries).length +
        analysis.addViews.length
      : 0;

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {analysis && (
          <DialogContent
            className={step === "resolve" ? "max-w-5xl max-h-[80vh] overflow-y-auto" : "max-w-lg"}
          >
            {step === "choose" && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl">Import Save File</DialogTitle>
                  <DialogDescription>
                    {addedCount > 0 && <>{addedCount} new, </>}
                    {analysis.identicalCount > 0 && <>{analysis.identicalCount} identical, </>}
                    {analysis.conflicts.length > 0 && <>{analysis.conflicts.length} conflicting, </>}
                    How would you like to import?
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-3 mt-2">
                  <Button onClick={handleOverwrite} variant="destructive">
                    Overwrite All
                  </Button>
                  <Button onClick={handleMerge}>Merge</Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Overwrite replaces all current data with the imported file.
                  {analysis.conflicts.length > 0
                    ? " Merge keeps your existing data and lets you resolve conflicts."
                    : " Merge adds new entries while keeping your existing data."}
                </p>
              </>
            )}

            {step === "resolve" && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl">
                    Import - Resolve Conflicts
                  </DialogTitle>
                  <DialogDescription>
                    {addedCount} added, {analysis.identicalCount} identical,{" "}
                    {analysis.conflicts.length} conflicts
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {analysis.conflicts.map((conflict) => {
                    const resKey = `${conflict.type}:${conflict.key}`;
                    return (
                      <div
                        key={resKey}
                        className="border rounded-lg p-4 dark:border-slate-700"
                      >
                        <h3 className="font-semibold text-base mb-3">
                          {getConflictLabel(conflict)}
                        </h3>
                        <RadioGroup
                          value={resolutions[resKey] || ""}
                          onValueChange={(value) =>
                            setResolutions((prev) => ({
                              ...prev,
                              [resKey]: value as ConflictResolution,
                            }))
                          }
                          className="grid grid-cols-2 gap-3"
                        >
                          <div className="space-y-2">
                            <span className="text-sm font-medium text-muted-foreground block">
                              Local
                            </span>
                            <SqlBlock
                              code={conflict.localValue}
                              changedLines={diffLines(conflict.importedValue, conflict.localValue)}
                              variant="removed"
                            />
                            <div className="flex items-center space-x-2 pt-1">
                              <RadioGroupItem value="local" id={`${resKey}-local`} />
                              <Label
                                htmlFor={`${resKey}-local`}
                                className="cursor-pointer"
                              >
                                Keep Local
                              </Label>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <span className="text-sm font-medium text-muted-foreground block">
                              Imported
                            </span>
                            <SqlBlock
                              code={conflict.importedValue}
                              changedLines={diffLines(conflict.localValue, conflict.importedValue)}
                              variant="added"
                            />
                            <div className="flex items-center space-x-2 pt-1">
                              <RadioGroupItem value="imported" id={`${resKey}-imported`} />
                              <Label
                                htmlFor={`${resKey}-imported`}
                                className="cursor-pointer"
                              >
                                Keep Imported
                              </Label>
                            </div>
                          </div>
                        </RadioGroup>
                      </div>
                    );
                  })}
                </div>

                <DialogFooter className="mt-4 sm:justify-between">
                  <Button variant="destructive" onClick={handleOverwrite}>
                    Overwrite All
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleApplyMerge} disabled={!allResolved}>
                      Apply Merge ({resolvedCount}/{analysis.conflicts.length}{" "}
                      resolved)
                    </Button>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        )}
      </Dialog>
    );
  }
);

ImportDialog.displayName = "ImportDialog";
export default ImportDialog;
