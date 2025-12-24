import "prismjs/components/prism-sql";
import "prismjs/themes/prism.css";
import React from "react";

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
            className={`text-left font-medium hover:underline ${
              currentlyQuriedView === view.name
                ? "text-blue-700 dark:text-blue-300"
                : "text-blue-600 dark:text-blue-400"
            }`}
          >
            {view.name}
          </button>
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => onViewExportRequest(view.name)}
              className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Export PNG
            </button>
            <button
              onClick={() => onRemoveView(view.name)}
              className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ViewsTable;

