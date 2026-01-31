import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { CheckCircle2Icon, CircleIcon, ClockIcon, FlameIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { getTodoDueRelativeLabel, isTodoOverdue } from "@/helpers/todo";
import { useDialog } from "@/hooks/useDialog";
import { useDeleteTodo, useUpdateTodo } from "@/hooks/useTodoQueries";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import type { Todo } from "@/types/proto/api/v1/todo_service_pb";
import { Todo_Priority, Todo_Status } from "@/types/proto/api/v1/todo_service_pb";
import { type Translations, useTranslate } from "@/utils/i18n";
import TodoEditDialog from "./TodoEditDialog";

interface Props {
  title: string;
  subtitle?: string;
  todos: Todo[];
  variant?: "overdue" | "today" | "upcoming" | "completed";
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

const getPriorityBadge = (priority: Todo_Priority, t: (key: Translations, params?: Record<string, unknown>) => string) => {
  switch (priority) {
    case Todo_Priority.HIGH:
      return { label: t("todo.priority.high"), className: "bg-destructive/15 text-destructive" };
    case Todo_Priority.MEDIUM:
      return { label: t("todo.priority.medium"), className: "bg-amber-500/15 text-amber-600" };
    case Todo_Priority.LOW:
      return { label: t("todo.priority.low"), className: "bg-emerald-500/15 text-emerald-600" };
    default:
      return { label: t("todo.priority.medium"), className: "bg-muted text-muted-foreground" };
  }
};

interface TodoListItemProps {
  todo: Todo;
  variant?: "overdue" | "today" | "upcoming" | "completed";
  onToggle: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

const TodoListItem = ({ todo, variant, onToggle, onDelete }: TodoListItemProps) => {
  const t = useTranslate();
  const editDialog = useDialog();
  const dueTime = todo.dueTime ? timestampDate(todo.dueTime) : undefined;
  const badge = getPriorityBadge(todo.priority, t);
  const isDone = todo.status === Todo_Status.DONE;
  const relativeLabel = dueTime ? getTodoDueRelativeLabel(dueTime, t) : undefined;
  const isOverdue = dueTime ? isTodoOverdue(dueTime) : false;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border/60 bg-background px-4 py-3 transition-all",
        isDone && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => onToggle(todo)}
            className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
            aria-label={t("todo.toggle")}
          >
            {isDone ? <CheckCircle2Icon className="w-5 h-5 text-primary" /> : <CircleIcon className="w-5 h-5" />}
          </button>
          <div>
            <p className={cn("text-sm font-medium text-foreground", isDone && "line-through text-muted-foreground")}>{todo.title}</p>
            {todo.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{todo.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={editDialog.open} aria-label={t("common.edit")}>
            <PencilIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(todo)} aria-label={t("common.delete")}>
            <Trash2Icon className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("px-2 py-0.5 rounded-full", badge.className)}>{badge.label}</span>
        <span className="flex items-center gap-1">
          <ClockIcon className="w-3.5 h-3.5" />
          {dueTime ? dayjs(dueTime).format("YYYY-MM-DD HH:mm") : t("todo.unknown-time")}
        </span>
        {relativeLabel && (
          <span className={cn("flex items-center gap-1", isOverdue ? "text-destructive" : "text-muted-foreground")}>
            {isOverdue ? <FlameIcon className="w-3.5 h-3.5" /> : null}
            {relativeLabel}
          </span>
        )}
        {variant === "overdue" && !relativeLabel && (
          <span className="flex items-center gap-1 text-destructive">
            <FlameIcon className="w-3.5 h-3.5" />
            {t("todo.overdue")}
          </span>
        )}
      </div>
      <TodoEditDialog
        open={editDialog.isOpen}
        onOpenChange={editDialog.setOpen}
        todoName={todo.name}
        initialTitle={todo.title}
        initialDescription={todo.description}
        initialDueTime={dueTime}
        initialPriority={todo.priority}
      />
    </div>
  );
};

const TodoListSection = ({
  title,
  subtitle,
  todos,
  variant,
  collapsible = false,
  defaultCollapsed = false,
  collapsed,
  onCollapseChange,
}: Props) => {
  const t = useTranslate();
  const { mutateAsync: updateTodo } = useUpdateTodo();
  const { mutateAsync: deleteTodo } = useDeleteTodo();
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsed ?? internalCollapsed;
  const setCollapsed = (next: boolean) => {
    if (collapsed === undefined) {
      setInternalCollapsed(next);
    }
    onCollapseChange?.(next);
  };

  const sortedTodos = useMemo(() => {
    return [...todos].sort((a, b) => {
      const aTime = a.dueTime ? timestampDate(a.dueTime) : undefined;
      const bTime = b.dueTime ? timestampDate(b.dueTime) : undefined;
      const aUnix = aTime ? dayjs(aTime).unix() : Number.POSITIVE_INFINITY;
      const bUnix = bTime ? dayjs(bTime).unix() : Number.POSITIVE_INFINITY;
      return aUnix - bUnix;
    });
  }, [todos]);

  const handleToggle = async (todo: Todo) => {
    const nextStatus = todo.status === Todo_Status.DONE ? Todo_Status.NORMAL : Todo_Status.DONE;
    try {
      await updateTodo({
        update: {
          name: todo.name,
          status: nextStatus,
        },
        updateMask: ["status"],
      });
    } catch (error) {
      handleError(error, toast.error, {
        context: "Update todo status",
      });
    }
  };

  const handleDelete = async (todo: Todo) => {
    try {
      await deleteTodo(todo.name);
    } catch (error) {
      handleError(error, toast.error, {
        context: "Delete todo",
      });
    }
  };

  const sectionTone =
    variant === "overdue"
      ? "border-destructive/30 bg-destructive/5"
      : variant === "today"
        ? "border-primary/30 bg-primary/5"
        : variant === "completed"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border bg-background";

  return (
    <section className={cn("w-full rounded-2xl border px-5 py-4 sm:px-6", sectionTone)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("todo.count", { count: todos.length })}</span>
          {collapsible && (
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(!isCollapsed)}>
              {isCollapsed ? t("common.expand") : t("common.collapse")}
            </Button>
          )}
        </div>
      </div>
      {!isCollapsed &&
        (sortedTodos.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">{t("todo.empty")}</div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedTodos.map((todo) => (
              <TodoListItem key={todo.name} todo={todo} variant={variant} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        ))}
    </section>
  );
};

export default TodoListSection;
