import React from "react";
import Editor from "react-simple-code-editor";
import { format } from "sql-formatter";
// @ts-expect-error - No types available
import { highlight, languages } from "prismjs/components/prism-core";
import { Result } from "./utils";
import ResultTable from "./ResultTable";
import { Question } from "./QuestionSelector";
import { View } from "./ViewsTable";
import { useLanguage } from "./i18n/context";
import { renderRAPreview } from "./ra-engine/RAPreview";

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
  const { t } = useLanguage();

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
          className="font-serif text-xl w-full bg-slate-200 max-w-4xl min-h-40 my-2 p-3 rounded"
          dangerouslySetInnerHTML={{ __html: renderRAPreview(query.code) }}
        />
      ) : (
        <Editor
          readOnly={true}
          value={format(
            query ? query.code : view!.view.query, {
              language: "sqlite",
              tabWidth: 2,
              useTabs: false,
              keywordCase: "upper",
              dataTypeCase: "upper",
              functionCase: "upper",
            })}
          onValueChange={() => null}
          highlight={code => highlight(code, languages.sql)}
          padding={10}
          tabSize={4}
          className="font-mono text-xl w-full bg-slate-200 border-2 max-w-4xl min-h-40 border-none my-2"
        />
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
