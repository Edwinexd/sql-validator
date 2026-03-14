import React, { useCallback, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Result } from "./utils";
import { useLanguage, QuestionCategory } from "./i18n/context";

export interface Category {
  id: number;
  display_number: string;
}

export interface Question {
  category: Category;
  id: number;
  description: string;
  display_sequence: string;
  result: {
    columns: string[];
    values: (string | number | null)[][];
  };
  evaluable_result: Result;
}

interface QuestionSelectorProps {
  onSelect: (question: Question) => void;
  writtenQuestions?: number[];
  correctQuestions?: number[];
  isDarkMode?: boolean;
  /** Externally-set question (e.g. from URL param) to sync selector state */
  activeQuestion?: Question;
}

interface HighlightProps {
  isCorrect: boolean;
  isWritten: boolean;
  children: React.ReactNode;
}

const HighlightWrapper: React.FC<HighlightProps> = ({ isCorrect, isWritten, children }) => {
  if (isCorrect) {
    return <span className="bg-green-200 bg-opacity-75 text-black px-2 p-0.5 rounded">{children}</span>;
  }
  if (isWritten) {
    return <span className="bg-yellow-200 bg-opacity-75 text-black px-2 p-0.5 rounded">{children}</span>;
  }
  return <span className="px-2 p-0.5">{children}</span>;
};


const useHighlightLogic = (
  dataValue: string,
  isCategory: boolean,
  category: number | undefined,
  questions: QuestionCategory[],
  correctQuestions?: number[],
  writtenQuestions?: number[]
) => {
  let isCorrect = false;
  let isWritten = false;

  if (isCategory) {
    const categoryObj = questions.find(q => q.category_id === Number(dataValue));
    if (categoryObj) {
      isCorrect = correctQuestions?.some(id => categoryObj.questions.some(q => q.id === id)) || false;
      isWritten = !isCorrect && (writtenQuestions?.some(id => categoryObj.questions.some(q => q.id === id)) || false);
    }
  } else if (category !== undefined) {
    const question = questions
      .find(q => q.category_id === category)
      ?.questions.find(q => q.display_sequence === dataValue);
    if (question) {
      isCorrect = correctQuestions?.includes(question.id) || false;
      isWritten = !isCorrect && (writtenQuestions?.includes(question.id) || false);
    }
  }

  return { isCorrect, isWritten };
};

const HighlightedSelectItem: React.FC<{
  value: string;
  isCategory: boolean;
  category?: number;
  questions: QuestionCategory[];
  correctQuestions?: number[];
  writtenQuestions?: number[];
  children: React.ReactNode;
}> = ({ value, isCategory, category, questions, correctQuestions, writtenQuestions, children }) => {
  const { isCorrect, isWritten } = useHighlightLogic(value, isCategory, category, questions, correctQuestions, writtenQuestions);

  return (
    <SelectItem value={value}>
      <HighlightWrapper isCorrect={isCorrect} isWritten={isWritten}>
        {children}
      </HighlightWrapper>
    </SelectItem>
  );
};

export const getQuestion = (id: number, questions: QuestionCategory[]): Question | undefined => {
  for (const category of questions) {
    const question = category.questions.find(q => q.id === id);
    if (question) {
      return { ...question, category: { id: category.category_id, display_number: String(category.display_number) }, evaluable_result: { columns: question.result.columns, data: question.result.values } };
    }
  }
  return undefined;
};

const QuestionSelector: React.FC<QuestionSelectorProps> = ({ onSelect, writtenQuestions, correctQuestions, activeQuestion }) => {
  const { t, questions } = useLanguage();
  const [category, setCategory] = React.useState<number>();
  const [sequenceOptions, setSequenceOptions] = React.useState<{ value: string, label: string }[]>([]);
  const [sequence, setSequence] = React.useState<string>();
  const [question, setQuestion] = React.useState<Question>();

  // Sync selector state when an external question is set (e.g. from URL)
  const prevActiveRef = React.useRef<Question | undefined>(undefined);
  useEffect(() => {
    if (activeQuestion && activeQuestion !== prevActiveRef.current) {
      prevActiveRef.current = activeQuestion;
      setCategory(activeQuestion.category.id);
      setSequence(activeQuestion.display_sequence);
      setQuestion(activeQuestion);
    }
  }, [activeQuestion]);

  useEffect(() => {
    const categoryObj = questions.find(q => q.category_id === category);
    if (!categoryObj) {
      return;
    }
    setSequenceOptions(categoryObj.questions.map(q => { return { value: String(q.display_sequence), label: String(q.display_sequence) }; }).flat());
  }, [category, questions]);

  useEffect(() => {
    if (!category) {
      return;
    }

    if (question && question.display_sequence === sequence && question.category.id === category) {
      return;
    }
    const categoryObj = questions.find(q => q.category_id === category);
    if (!categoryObj) {
      return;
    }
    const rawQuestionObj = categoryObj.questions.find(q => q.display_sequence === sequence);
    if (!rawQuestionObj) {
      return;
    }

    const questionObj = {...rawQuestionObj, category: { id: category, display_number: String(category) }, evaluable_result: { columns: rawQuestionObj.result.columns, data: rawQuestionObj.result.values } };
    setQuestion(questionObj);
    onSelect(questionObj);
  }, [sequence, category, question, onSelect, writtenQuestions, correctQuestions, questions]);

  const getInitialSequence = useCallback((categoryId: number) => {
    const categoryObj = questions.find(q => q.category_id === categoryId)!;
    const written = categoryObj.questions.filter(q => writtenQuestions?.includes(q.id)).map(q => q.display_sequence).sort();
    const correct = categoryObj.questions.filter(q => correctQuestions?.includes(q.id)).map(q => q.display_sequence).sort();
    const diff = written.filter(w => !correct.includes(w));
    if (diff.length > 0) {
      return diff[0];
    }
    if (correct.length > 0) {
      return correct[0];
    }
    return "A";
  }, [writtenQuestions, correctQuestions, questions]);

  // Build selected value display with highlight
  const getCategoryHighlight = (catId: number | undefined) => {
    if (catId === undefined) return null;
    const { isCorrect, isWritten } = useHighlightLogic(String(catId), true, undefined, questions, correctQuestions, writtenQuestions);
    return (
      <HighlightWrapper isCorrect={isCorrect} isWritten={isWritten}>
        {String(catId)}
      </HighlightWrapper>
    );
  };

  const getSequenceHighlight = (seq: string | undefined) => {
    if (seq === undefined) return null;
    const { isCorrect, isWritten } = useHighlightLogic(seq, false, category, questions, correctQuestions, writtenQuestions);
    return (
      <HighlightWrapper isCorrect={isCorrect} isWritten={isWritten}>
        {seq}
      </HighlightWrapper>
    );
  };

  return (
    <div className="flex flex-wrap my-3 text-base font-semibold w-full max-w-4xl justify-center">
      <div className="flex items-center">
        <span className="mr-2">{t("question")}</span>
        <Select
          value={category !== undefined ? String(category) : undefined}
          onValueChange={(value) => {
            setCategory(Number(value));
            setSequence(getInitialSequence(Number(value)));
          }}
        >
          <SelectTrigger className="w-[100px] mr-3.5 text-base">
            {category !== undefined ? getCategoryHighlight(category) : <SelectValue placeholder="..." />}
          </SelectTrigger>
          <SelectContent>
            {questions.map(q => (
              <HighlightedSelectItem
                key={q.category_id}
                value={String(q.category_id)}
                isCategory={true}
                questions={questions}
                correctQuestions={correctQuestions}
                writtenQuestions={writtenQuestions}
              >
                {String(q.display_number)}
              </HighlightedSelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center">
        <span className="mr-2">{t("variant")}</span>
        <Select
          value={sequence}
          onValueChange={(value) => setSequence(value)}
        >
          <SelectTrigger className="w-[100px] text-base">
            {sequence !== undefined ? getSequenceHighlight(sequence) : <SelectValue placeholder="..." />}
          </SelectTrigger>
          <SelectContent>
            {sequenceOptions.map(opt => (
              <HighlightedSelectItem
                key={opt.value}
                value={opt.value}
                isCategory={false}
                category={category}
                questions={questions}
                correctQuestions={correctQuestions}
                writtenQuestions={writtenQuestions}
              >
                {opt.label}
              </HighlightedSelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

};
export default QuestionSelector;
