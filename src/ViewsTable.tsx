import "prismjs/components/prism-sql";
import "prismjs/themes/prism.css";
import React from "react";
import { Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface View {
  name: string;
  query: string;
}

interface ViewsTableProps {
  views: View[];
  currentlyQuriedView: string | null;
  onRemoveView: (name: string) => void;
  onViewRequest(name: string): void;
  onViewHideRequest(): void;
  onViewExportRequest(name: string): void;
}

const ViewsTable: React.FC<ViewsTableProps> = ({ views, currentlyQuriedView, onRemoveView, onViewRequest, onViewHideRequest, onViewExportRequest }) => {
  return (
    <div className="w-full">
      {views.map((view) => (
        <div
          key={view.name}
          className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-slate-700 last:border-b-0"
        >
          <button
            onClick={() => {
              if (currentlyQuriedView === view.name) {
                onViewHideRequest();
              } else {
                onViewRequest(view.name);
              }
            }}
            className={`text-left text-base font-medium hover:underline ${
              currentlyQuriedView === view.name
                ? "text-blue-700 dark:text-blue-300"
                : "text-blue-600 dark:text-blue-400"
            }`}
          >
            {view.name}
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onViewExportRequest(view.name)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
            >
              <Upload className="h-4 w-4 mr-1" />
              Export PNG
            </Button>
            <Button
              variant="ghost"
              onClick={() => onRemoveView(view.name)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ViewsTable;
