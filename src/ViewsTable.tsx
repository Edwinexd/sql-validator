import "prismjs/components/prism-sql";
import "prismjs/themes/prism.css";
import React from "react";
import WordBreakText from "./WordBreakText";

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
    <>
      <h2 className="text-2xl font-semibold mb-3.5">Views</h2>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-lg border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <thead className="bg-[#d7dde7] dark:bg-slate-800 text-slate-900 dark:text-slate-100">
            <tr>
              <th className="border-b dark:border-slate-700 px-4 py-2">Name</th>
              <th className="border-b dark:border-slate-700 px-4 py-2">Query and Result</th>
              <th className="border-b dark:border-slate-700 px-4 py-2">Export PNG</th>
              <th className="border-b dark:border-slate-700 px-4 py-2">Delete</th>
            </tr>
          </thead>
          <tbody>
            {views.map((view) => (
              <tr key={view.name} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800">
                <td className="border-b dark:border-slate-800 px-4 py-2"><WordBreakText text={view.name} /></td>
                <td className="border-b dark:border-slate-800 px-4 py-2">
                  {currentlyQuriedView === view.name ? (
                    <button className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-800 dark:text-slate-100 text-base font-semibold py-2 px-4 my-2 w-full max-w-40 rounded-md shadow-sm" onClick={() => {onViewHideRequest();}}>
                      Hide
                    </button>
                  ) : (
                    <button className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-800 dark:text-slate-100 text-base font-semibold py-2 px-4 my-2 w-full max-w-40 rounded-md shadow-sm" onClick={() => {
                      onViewRequest(view.name);
                    }}>Display</button>
                  )}
                </td>
                <td className="border-b dark:border-slate-800 px-4 py-2">
                  <button className="bg-[#36a36b] hover:bg-[#2e895a] text-white text-base font-semibold py-2 px-4 my-2 w-full max-w-40 rounded-md shadow-sm" onClick={() => {
                    onViewExportRequest(view.name);
                  }}>Export</button>
                </td>
                <td className="border-b dark:border-slate-800 px-4 py-2">
                  <button className="bg-red-600 hover:bg-red-700 text-white text-base font-semibold py-2 px-4 my-2 w-full max-w-40 rounded-md shadow-sm" onClick={() => {
                    onRemoveView(view.name);
                  }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default ViewsTable;
