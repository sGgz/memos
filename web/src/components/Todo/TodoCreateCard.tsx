import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTodo } from "@/hooks/useTodoQueries";
import { handleError } from "@/lib/error";
import { Todo_Priority, Todo_Status, TodoSchema } from "@/types/proto/api/v1/todo_service_pb";
import { useTranslate } from "@/utils/i18n";

const TodoCreateCard = () => {
  const t = useTranslate();
  const { mutateAsync: createTodo } = useCreateTodo();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Todo_Priority>(Todo_Priority.MEDIUM);

  const handleSubmit = async () => {
    if (!title.trim() || !dueDate) {
      toast.error(t("todo.messages.fill-required"));
      return;
    }

    const dueTime = new Date(dueDate);
    if (isNaN(dueTime.getTime())) {
      toast.error(t("todo.messages.invalid-date"));
      return;
    }

    try {
      await createTodo(
        create(TodoSchema, {
          title: title.trim(),
          description: description.trim(),
          dueTime: timestampFromDate(dueTime),
          priority,
          status: Todo_Status.NORMAL,
        }),
      );
      toast.success(t("todo.messages.created"));
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority(Todo_Priority.MEDIUM);
    } catch (error) {
      handleError(error, toast.error, {
        context: "Create todo",
      });
    }
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-[0_18px_45px_rgba(27,62,39,0.12)] p-5 sm:p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("todo.create.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("todo.create.subtitle")}</p>
      </div>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <label htmlFor="todo-title" className="text-sm font-medium text-foreground">
            {t("todo.fields.title")}
          </label>
          <Input
            id="todo-title"
            value={title}
            placeholder={t("todo.placeholders.title")}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="todo-description" className="text-sm font-medium text-foreground">
            {t("todo.fields.description")}
          </label>
          <Textarea
            id="todo-description"
            rows={3}
            value={description}
            placeholder={t("todo.placeholders.description")}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-end">
          <div className="grid gap-2">
            <label htmlFor="todo-due" className="text-sm font-medium text-foreground">
              {t("todo.fields.due-time")}
            </label>
            <Input id="todo-due" type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="todo-priority" className="text-sm font-medium text-foreground">
              {t("todo.fields.priority")}
            </label>
            <select
              id="todo-priority"
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value) as Todo_Priority)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value={Todo_Priority.LOW}>{t("todo.priority.low")}</option>
              <option value={Todo_Priority.MEDIUM}>{t("todo.priority.medium")}</option>
              <option value={Todo_Priority.HIGH}>{t("todo.priority.high")}</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSubmit}>{t("todo.create.submit")}</Button>
      </div>
    </div>
  );
};

export default TodoCreateCard;
