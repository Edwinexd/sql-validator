import { forwardRef, useImperativeHandle, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getQuestion } from "./QuestionSelector";

interface ExportSelectorModalProps {
  correctQuestions: number[];
  onExport: (include: number[]) => void;
}

export interface ExportSelectorModalHandle {
  openDialog: () => void;
  closeDialog: () => void;
}

const ExportSelectorModal = forwardRef<ExportSelectorModalHandle, ExportSelectorModalProps>(
  ({ correctQuestions, onExport }, ref) => {
    const [includeAll, setIncludeAll] = useState<boolean>(true);
    const [dontInclude, setDontInclude] = useState<number[]>([]);
    const [open, setOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      openDialog: () => setOpen(true),
      closeDialog: () => setOpen(false),
    }));

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Export Data</DialogTitle>
          </DialogHeader>
          <p className="text-left text-base font-medium mb-4">Choose to export all questions or only selected questions to a save file.</p>
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox
              id="include-all"
              checked={includeAll}
              onCheckedChange={(checked) => setIncludeAll(checked === true)}
            />
            <Label htmlFor="include-all" className="text-base cursor-pointer">Include all questions</Label>
          </div>
          {!includeAll && correctQuestions.length > 0 &&
          <>
            <p className="text-base font-medium mb-4">Only include ...</p>
            <div className="grid grid-cols-4 gap-4">
              {correctQuestions.map(questionId => getQuestion(questionId)!).sort((a, b) => a.display_sequence.localeCompare(b.display_sequence)).sort((a, b) => Number(a.category.display_number) - Number(b.category.display_number)).map(q => (
                <div key={q.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`q-${q.id}`}
                    checked={!dontInclude.includes(q.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setDontInclude(dontInclude.filter((i) => i !== q.id));
                      } else {
                        setDontInclude([...dontInclude, q.id]);
                      }
                    }}
                  />
                  <Label htmlFor={`q-${q.id}`} className="text-base cursor-pointer">
                    {q.category.display_number}{q.display_sequence}
                  </Label>
                </div>
              ))}
            </div>
          </>
          }
          {!includeAll && correctQuestions.length === 0 &&
          <p className="text-base font-medium text-red-500">No questions are completed - nothing to export as correct to file (partial answers are always included).</p>
          }
          <div className="mt-3.5 flex gap-3">
            <Button
              onClick={() => {
                if (includeAll) {
                  onExport(correctQuestions);
                } else {
                  onExport(correctQuestions.filter((q) => !dontInclude.includes(q)));
                }
                setOpen(false);
              }}
            >
              Export {includeAll ? "All" : "Selected"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setOpen(false)}
            >
              Abort
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  });

ExportSelectorModal.displayName = "ExportSelectorModal";
export default ExportSelectorModal;
