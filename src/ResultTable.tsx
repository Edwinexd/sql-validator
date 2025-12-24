import React from "react";
import { Result } from "./utils";

interface ResultTableProps {
  result: Result;
  forceLight?: boolean;
  forceFixedSizes?: boolean;
}

const ResultTable: React.FC<ResultTableProps> = ({ result, forceLight, forceFixedSizes }) => {
  const maybeRemoveDark = (className: string) => {
    if (forceLight) {
      return "";
    }
    return className;
  };

  const maybeFixedSizes = (className: string): string => {
    if (className.includes(" ")) {
      return className.split(" ").map((c) => maybeFixedSizes(c.trim())).join(" ");
    }
    if (forceFixedSizes) {
      if (className === "text-sm") return "text-[14px] leading-[20px]";
      if (className === "px-3") return "px-[12px]";
      if (className === "py-2") return "py-[8px]";
      if (className === "whitespace-normal") return "whitespace-nowrap";
    }
    return className;
  };


  const columns = result.columns;
  let data = result.data;

  if (data.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-gray-400 italic">No results</div>;
  }
  let sliced = 0;
  // Dont display more than 100 rows
  if (data.length > 100) {
    sliced = data.length - 100;
    data = data.slice(0, 100);
  }
  return (
    <>
      <table className={`table-auto ${maybeFixedSizes("text-sm")} border-collapse`}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={col + "-" + i}
                className={`${maybeFixedSizes("px-3 py-2")} text-left font-semibold bg-gray-100 ${maybeRemoveDark("dark:bg-slate-700")} border-b border-gray-300 ${maybeRemoveDark("dark:border-slate-600")}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${maybeRemoveDark(i % 2 === 0 ? "dark:bg-slate-800" : "dark:bg-slate-700")}`}
            >
              {row.map((cell, j) => (
                <td
                  key={i + "-" + j}
                  className={`${maybeFixedSizes("px-3 py-2")} border-b border-gray-200 ${maybeRemoveDark("dark:border-slate-700")} ${maybeFixedSizes("whitespace-normal")}`}
                >
                  {cell !== null ? <span>{cell}</span> : <span className="italic text-gray-400" title="NULL: No value">NULL</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sliced !== 0 && (
        <p className="text-sm italic text-gray-500 dark:text-gray-400 mt-2">... and {sliced} more rows</p>
      )}
    </>
  );
};

export default ResultTable;

