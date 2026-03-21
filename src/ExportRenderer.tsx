import React from "react";
import { format } from "sql-formatter";
import { Result } from "./utils";
import ResultTable from "./ResultTable";
import { Question } from "./QuestionSelector";
import { View } from "./ViewsTable";
import { useLanguage } from "./i18n/context";
import { renderRAPreview } from "./ra-engine/RAPreview";
import SqlEditor from "./SqlEditor";

interface ExportRendererProps {
  query?: {
    question: Question;
    isCorrect: boolean;
    code: string;
    result: Result;
    mode?: "sql" | "ra";
  };
  view?: {
    view: View;
    result: Result;
  };
}

const ExportRenderer = React.forwardRef<HTMLDivElement, ExportRendererProps>(({ query, view }, ref) => {
  const { t, engine } = useLanguage();
  const formatterLang = engine === "postgresql" ? "postgresql" : "sqlite";

  if (!query && !view) {
    return null;
  }
  if (query && view) {
    return null;
  }

  return (
  // intentionally fixed width since we render a png of it
    <div style={{ backgroundColor: "#efefef", color: "#313131" }} className="flex flex-col items-center p-[64px] w-[1024px]" ref={ref}>
      {query &&
                <>
                  <div className="flex my-3 text-xl font-semibold space-x-4">
                    <span className="text-gray-700">{t("exportQuestionLabel")}</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{query.question.category.display_number}</span>
                    <span className="text-gray-700">{t("exportVariantLabel")}</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{query.question.display_sequence}</span>
                  </div>
                  <h2 className="text-3xl font-semibold">{query.question.description}</h2>
                  <p className="break-words max-w-4xl mb-4 font-semibold text-left text-xl p-2 italic">{t("exportCodeLabel", { id: `${query.question.category.display_number}${query.question.display_sequence}` })}</p>
                </>
      }
      {view &&
                <>
                  <h2 className="text-3xl font-semibold mb-3.5">{t("viewLabel")} <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{view.view.name}</span></h2>
                  <p className="break-words max-w-4xl mb-4 font-semibold text-left text-xl p-2 italic">{t("exportViewCodeLabel", { name: view.view.name })}</p>
                </>
      }
      {query?.mode === "ra" ? (
        <div
          className="font-mono text-2xl text-left w-full bg-white text-gray-900 max-w-4xl min-h-40 my-2 p-3 rounded border border-gray-300"
          dangerouslySetInnerHTML={{ __html: renderRAPreview(query.code, true) }}
        />
      ) : (
        <div className="w-full max-w-4xl my-2 rounded bg-slate-200 overflow-hidden">
          <SqlEditor
            value={format(
              query ? query.code : view!.view.query, {
                language: formatterLang,
                tabWidth: 2,
                useTabs: false,
                keywordCase: "upper",
                dataTypeCase: "upper",
                functionCase: "upper",
              })}
            readOnly={true}
            engine={engine}
            isDarkMode={false}
            className="font-mono text-xl bg-slate-200"
          />
        </div>
      )}
      {query &&
                <p className="break-words max-w-4xl mb-4 font-semibold text-left text-xl p-2 italic">{t("exportResultLabel")}</p>
      }
      {view &&
                <p className="break-words max-w-4xl mb-4 font-semibold text-left text-xl p-2 italic">{t("exportViewResultLabel", { name: view.view.name })}</p>
      }
      <div className="max-w-full mb-[16px]">
        <ResultTable result={
          query ? query.result : view!.result
        } forceLight={true} forceFixedSizes={true}
        />
      </div>
      {query &&
                <p className="break-words max-w-4xl mb-4 font-semibold text-left text-xl p-2 italic">... which <span className={query.isCorrect ? "text-green-600" : "text-red-500"}>{query.isCorrect ? t("exportMatches") : t("exportDoesNotMatch")}</span> the expected result!</p>
      }
      <p className="text-xl font-semibold p-2">{t("generatedBy", { timestamp: new Date().toISOString() })}</p>
    </div>
  );
});

ExportRenderer.displayName = "ExportRenderer";

export default ExportRenderer;
