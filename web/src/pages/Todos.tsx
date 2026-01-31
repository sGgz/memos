import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { ClipboardListIcon, RotateCcwIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import MobileHeader from "@/components/MobileHeader";
import TodoCreateCard from "@/components/Todo/TodoCreateCard";
import TodoListSection from "@/components/Todo/TodoListSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useTodos } from "@/hooks/useTodoQueries";
import { cn } from "@/lib/utils";
import { Todo_Priority, Todo_Status } from "@/types/proto/api/v1/todo_service_pb";
import { useTranslate } from "@/utils/i18n";

const TODO_FILTER_STORAGE_KEY = "memos-todo-filters";
const DEFAULT_TODO_FILTERS = {
  priority: "all" as Todo_Priority | "all",
  hideCompleted: false,
  completedCollapsed: true,
};

const loadTodoFilters = () => {
  try {
    if (typeof localStorage === "undefined") {
      return DEFAULT_TODO_FILTERS;
    }
    const cached = localStorage.getItem(TODO_FILTER_STORAGE_KEY);
    if (!cached) {
      return DEFAULT_TODO_FILTERS;
    }
    const parsed = JSON.parse(cached) as Partial<typeof DEFAULT_TODO_FILTERS>;
    const priorityCandidates = [Todo_Priority.LOW, Todo_Priority.MEDIUM, Todo_Priority.HIGH];
    const parsedPriority =
      parsed.priority === "all" || priorityCandidates.includes(parsed.priority as Todo_Priority)
        ? (parsed.priority as Todo_Priority | "all")
        : DEFAULT_TODO_FILTERS.priority;
    return {
      priority: parsedPriority,
      hideCompleted: Boolean(parsed.hideCompleted),
      completedCollapsed:
        typeof parsed.completedCollapsed === "boolean" ? parsed.completedCollapsed : DEFAULT_TODO_FILTERS.completedCollapsed,
    };
  } catch {
    return DEFAULT_TODO_FILTERS;
  }
};

const Todos = () => {
  const t = useTranslate();
  const md = useMediaQuery("md");
  const currentUser = useCurrentUser();
  const { data } = useTodos({ pageSize: 200, showCompleted: true }, { enabled: !!currentUser });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<Todo_Priority | "all">(() => loadTodoFilters().priority);
  const [hideCompleted, setHideCompleted] = useState(() => loadTodoFilters().hideCompleted);
  const [completedCollapsed, setCompletedCollapsed] = useState(() => loadTodoFilters().completedCollapsed);

  const todos = data?.todos ?? [];
  const today = useMemo(() => dayjs().startOf("day"), []);

  useEffect(() => {
    try {
      localStorage.setItem(TODO_FILTER_STORAGE_KEY, JSON.stringify({ priority: selectedPriority, hideCompleted, completedCollapsed }));
    } catch {
      // Ignore localStorage errors
    }
  }, [selectedPriority, hideCompleted, completedCollapsed]);

  const canResetFilters = Boolean(
    searchQuery.trim() ||
      selectedPriority !== DEFAULT_TODO_FILTERS.priority ||
      hideCompleted !== DEFAULT_TODO_FILTERS.hideCompleted ||
      completedCollapsed !== DEFAULT_TODO_FILTERS.completedCollapsed,
  );

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedPriority(DEFAULT_TODO_FILTERS.priority);
    setHideCompleted(DEFAULT_TODO_FILTERS.hideCompleted);
    setCompletedCollapsed(DEFAULT_TODO_FILTERS.completedCollapsed);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const { overdue, todayList, upcoming, completed } = useMemo(() => {
    const overdue: typeof todos = [];
    const todayList: typeof todos = [];
    const upcoming: typeof todos = [];
    const completed: typeof todos = [];
    for (const todo of todos) {
      if (selectedPriority !== "all" && todo.priority !== selectedPriority) {
        continue;
      }
      if (normalizedQuery) {
        const haystack = `${todo.title} ${todo.description}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          continue;
        }
      }
      if (todo.status === Todo_Status.DONE) {
        if (!hideCompleted) {
          completed.push(todo);
        }
        continue;
      }
      if (!todo.dueTime) {
        upcoming.push(todo);
        continue;
      }
      const due = todo.dueTime ? dayjs(timestampDate(todo.dueTime)) : undefined;
      if (!due || !due.isValid()) {
        upcoming.push(todo);
        continue;
      }
      if (due.isBefore(today, "day")) {
        overdue.push(todo);
      } else if (due.isSame(today, "day")) {
        todayList.push(todo);
      } else {
        upcoming.push(todo);
      }
    }
    return { overdue, todayList, upcoming, completed };
  }, [todos, today, normalizedQuery, selectedPriority, hideCompleted]);

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && <MobileHeader />}
      <div className="w-full px-4 sm:px-6 space-y-6">
        <div className={cn("w-full flex items-center gap-2 text-muted-foreground")}>
          <ClipboardListIcon className="w-5 h-5" />
          <h1 className="text-xl font-semibold text-foreground">{t("todo.title")}</h1>
        </div>
        <TodoCreateCard />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              placeholder={t("common.search")}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSearchQuery("")}
                aria-label={t("common.clear")}
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedPriority === "all" ? "all" : String(selectedPriority)}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "all") {
                  setSelectedPriority("all");
                } else {
                  setSelectedPriority(Number(value) as Todo_Priority);
                }
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={t("todo.fields.priority")}
            >
              <option value="all">{t("common.all")}</option>
              <option value={Todo_Priority.LOW}>{t("todo.priority.low")}</option>
              <option value={Todo_Priority.MEDIUM}>{t("todo.priority.medium")}</option>
              <option value={Todo_Priority.HIGH}>{t("todo.priority.high")}</option>
            </select>
            <button
              type="button"
              onClick={() => setHideCompleted((prev) => !prev)}
              className={cn(
                "h-10 rounded-md border px-3 text-sm transition-colors",
                hideCompleted ? "border-primary/40 bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground",
              )}
            >
              {hideCompleted ? t("todo.filters.show-completed") : t("todo.filters.hide-completed")}
            </button>
            <Button variant="outline" size="sm" onClick={handleResetFilters} disabled={!canResetFilters}>
              <RotateCcwIcon className="mr-1 h-4 w-4" />
              {t("common.reset")}
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          <TodoListSection
            title={t("todo.sections.overdue")}
            subtitle={t("todo.sections.overdue-subtitle")}
            todos={overdue}
            variant="overdue"
          />
          <TodoListSection
            title={t("todo.sections.today")}
            subtitle={t("todo.sections.today-subtitle")}
            todos={todayList}
            variant="today"
          />
          <TodoListSection
            title={t("todo.sections.upcoming")}
            subtitle={t("todo.sections.upcoming-subtitle")}
            todos={upcoming}
            variant="upcoming"
          />
          {!hideCompleted && (
            <TodoListSection
              title={t("todo.sections.completed")}
              subtitle={t("todo.sections.completed-subtitle")}
              todos={completed}
              variant="completed"
              collapsible
              defaultCollapsed
              collapsed={completedCollapsed}
              onCollapseChange={setCompletedCollapsed}
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default Todos;
