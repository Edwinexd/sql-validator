import React from "react";
import { Result } from "./utils";
import { useLanguage } from "./i18n/context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ResultTableProps {
  result: Result;
  forceLight?: boolean;
  forceFixedSizes?: boolean;
}

const ResultTable: React.FC<ResultTableProps> = ({ result, forceLight, forceFixedSizes }) => {
  const { t } = useLanguage();

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
    return <div className="text-sm text-gray-500 dark:text-gray-400 italic">{t("noResults")}</div>;
  }
  let sliced = 0;
  if (data.length > 100) {
    sliced = data.length - 100;
    data = data.slice(0, 100);
  }
  return (
    <>
      <Table className={`table-auto ${maybeFixedSizes("text-sm")} border-collapse`}>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead
                key={col + "-" + i}
                className={`${maybeFixedSizes("px-3 py-2")} text-left font-semibold bg-gray-100 ${maybeRemoveDark("dark:bg-slate-700")} border-b border-gray-300 ${maybeRemoveDark("dark:border-slate-600")}`}
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow
              key={i}
              className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${maybeRemoveDark(i % 2 === 0 ? "dark:bg-slate-800" : "dark:bg-slate-700")}`}
            >
              {row.map((cell, j) => (
                <TableCell
                  key={i + "-" + j}
                  className={`${maybeFixedSizes("px-3 py-2")} border-b border-gray-200 ${maybeRemoveDark("dark:border-slate-700")} ${maybeFixedSizes("whitespace-normal")}`}
                >
                  {cell !== null ? <span>{cell}</span> : <span className="italic text-gray-400" title={t("nullTooltip")}>NULL</span>}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {sliced !== 0 && (
        <p className="text-sm italic text-gray-500 dark:text-gray-400 mt-2">{t("moreRows", { count: sliced })}</p>
      )}
    </>
  );
};

export default ResultTable;
