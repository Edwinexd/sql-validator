import React, { useCallback, useEffect } from "react";
import Select from "react-select";
import questions from "./questions.json";
import { Result } from "./utils";

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
    values: (string | number)[][];
  };
  evaluable_result: Result;
}

interface QuestionSelectorProps {
  onSelect: (question: Question) => void;
  writtenQuestions?: number[];
  correctQuestions?: number[];
  isDarkMode?: boolean;
}

interface HighlightProps {
  isCorrect: boolean;
  isWritten: boolean;
  children: React.ReactNode;
}

interface HighlightBaseProps {
  dataValue: string;
  isCategory: boolean;
  category?: number;
  correctQuestions?: number[];
  writtenQuestions?: number[];
  children: React.ReactNode;
  isDarkMode?: boolean;
}

interface HighlightedOptionProps extends HighlightBaseProps {
  className?: string;
  isDisabled?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
  innerProps?: React.HTMLAttributes<HTMLDivElement>;
}

type HighlightedSingleValueProps = HighlightBaseProps;

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

const HighlightedOption: React.FC<HighlightedOptionProps> = ({
  dataValue,
  isCategory,
  category,
  correctQuestions,
  writtenQuestions,
  children,
  className,
  isDisabled: _isDisabled,
  isFocused,
  isSelected,
  innerRef,
  innerProps,
  isDarkMode,
}) => {
  const { isCorrect, isWritten } = useHighlightLogic(dataValue, isCategory, category, correctQuestions, writtenQuestions);

  const baseColor = isDarkMode ? "text-slate-100" : "text-black";
  const focusedBg = isDarkMode ? "bg-slate-600" : "bg-blue-200";

  return (
    <div
      ref={innerRef}
      className={`${className} ${baseColor} ${isFocused && !isSelected ? focusedBg : ""} ${isSelected ? "bg-blue-500 focus:bg-blue-700 text-white" : ""} p-2`}
      {...innerProps}
    >
      <HighlightWrapper isCorrect={isCorrect} isWritten={isWritten}>
        {children}
      </HighlightWrapper>
    </div>
  );
};

const HighlightedSingleValue: React.FC<HighlightedSingleValueProps> = ({
  dataValue,
  isCategory,
  category,
  correctQuestions,
  writtenQuestions,
  children,
  isDarkMode,
}) => {
  const { isCorrect, isWritten } = useHighlightLogic(dataValue, isCategory, category, correctQuestions, writtenQuestions);

  return (
    <div className={`${isDarkMode ? "text-slate-100" : "text-black"} col-start-1 col-end-3 row-start-1 row-end-2`}>
      <HighlightWrapper isCorrect={isCorrect} isWritten={isWritten}>
        {children}
      </HighlightWrapper>
    </div>
  );
};

export const getQuestion = (id: number): Question | undefined => {
  for (const category of questions) {
    const question = category.questions.find(q => q.id === id);
    if (question) {
      return { ...question, category: { id: category.category_id, display_number: String(category.display_number) }, evaluable_result: { columns: question.result.columns, data: question.result.values } };
    }
  }
  return undefined;
};

const QuestionSelector: React.FC<QuestionSelectorProps> = ({ onSelect, writtenQuestions, correctQuestions, isDarkMode }) => {
  const [category, setCategory] = React.useState<number>();
  const [sequenceOptions, setSequenceOptions] = React.useState<{ value: string, label: string }[]>([]);
  const [sequence, setSequence] = React.useState<string>();
  const [question, setQuestion] = React.useState<Question>();

  const darkModeStyles = {
    control: (base: object) => ({
      ...base,
      backgroundColor: isDarkMode ? "#1e293b" : "#fff",
      borderColor: isDarkMode ? "#475569" : "#d1d5db",
    }),
    menu: (base: object) => ({
      ...base,
      backgroundColor: isDarkMode ? "#1e293b" : "#fff",
    }),
    singleValue: (base: object) => ({
      ...base,
      color: isDarkMode ? "#f1f5f9" : "#000",
    }),
    input: (base: object) => ({
      ...base,
      color: isDarkMode ? "#f1f5f9" : "#000",
    }),
    indicatorSeparator: (base: object) => ({
      ...base,
      backgroundColor: isDarkMode ? "#475569" : "#d1d5db",
    }),
    dropdownIndicator: (base: object) => ({
      ...base,
      color: isDarkMode ? "#94a3b8" : "#6b7280",
    }),
  };

  useEffect(() => {
    const categoryObj = questions.find(q => q.category_id === category);
    if (!categoryObj) {
      return;
    }
    setSequenceOptions(categoryObj.questions.map(q => { return { value: String(q.display_sequence), label: String(q.display_sequence) }; }).flat());
  }, [category]);

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
  }, [sequence, category, question, onSelect, writtenQuestions, correctQuestions]);

  // Chooses a) the first written question, b) the first correct question, or c) the first question in the category
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
  }, [writtenQuestions, correctQuestions]);

  const options = questions.map(q => { return { value: String(q.category_id), label: String(q.display_number) }; }).flat();

  return (
    <div className="flex flex-wrap my-3 text-xl font-semibold w-full max-w-4xl justify-center">
      <div className="flex items-center">
        <span className="mr-2">Question</span>
        <Select options={questions.map(q => { return { value: String(q.category_id), label: String(q.display_number) }; }).flat()}
          value={options.find(o => o.value === String(category))}
          onChange={(e) => {
            if (!e) {
              return;
            }
            setCategory(Number(e.value));
            setSequence(getInitialSequence(Number(e.value)));
          }}
          className="mr-3.5"
          styles={darkModeStyles}
          components={{
            Option: (props) => (
              <HighlightedOption
                {...props}
                // eslint-disable-next-line react/prop-types
                dataValue={props.data.value}
                isCategory={true}
                correctQuestions={correctQuestions}
                writtenQuestions={writtenQuestions}
                isDarkMode={isDarkMode}
              />
            ),
            SingleValue: (props) => (
              <HighlightedSingleValue
                {...props}
                // eslint-disable-next-line react/prop-types
                dataValue={props.data.value}
                isCategory={true}
                correctQuestions={correctQuestions}
                writtenQuestions={writtenQuestions}
                isDarkMode={isDarkMode}
              />
            ),
          }}
        />
      </div>
      <div className="flex items-center">
        <span className="mr-2">Variant</span>
        <Select options={sequenceOptions} value={sequenceOptions.find(o => o.value === sequence)} onChange={(e) => {
          if (!e) {
            return;
          }
          setSequence(e.value);
        }}
        styles={darkModeStyles}
        components={{
          Option: (props) => (
            <HighlightedOption
              {...props}
              // eslint-disable-next-line react/prop-types
              dataValue={props.data.value}
              isCategory={false}
              category={category}
              correctQuestions={correctQuestions}
              writtenQuestions={writtenQuestions}
              isDarkMode={isDarkMode}
            />
          ),
          SingleValue: (props) => (
            <HighlightedSingleValue
              {...props}
              // eslint-disable-next-line react/prop-types
              dataValue={props.data.value}
              isCategory={false}
              category={category}
              correctQuestions={correctQuestions}
              writtenQuestions={writtenQuestions}
              isDarkMode={isDarkMode}
            />
          ),
        }}
        />
      </div>
    </div>
  );

};
export default QuestionSelector;
