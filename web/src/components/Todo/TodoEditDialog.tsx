import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateTodo } from "@/hooks/useTodoQueries";
import { handleError } from "@/lib/error";
import { Todo_Priority, TodoSchema } from "@/types/proto/api/v1/todo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todoName?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialDueTime?: Date;
  initialPriority?: Todo_Priority;
}

const formatLocalDate = (date?: Date): string => {
  if (!date) return "";
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function TodoEditDialog({ open, onOpenChange, todoName, initialTitle, initialDescription, initialDueTime, initialPriority }: Props) {
  const t = useTranslate();
  const { mutateAsync: updateTodo } = useUpdateTodo();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [dueDate, setDueDate] = useState(formatLocalDate(initialDueTime));
  const [priority, setPriority] = useState<Todo_Priority>(initialPriority ?? Todo_Priority.MEDIUM);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle ?? "");
    setDescription(initialDescription ?? "");
    setDueDate(formatLocalDate(initialDueTime));
    setPriority(initialPriority ?? Todo_Priority.MEDIUM);
  }, [open, initialTitle, initialDescription, initialDueTime, initialPriority]);

  const isDirty = useMemo(() => {
    return (
      title.trim() !== (initialTitle ?? "") ||
      description.trim() !== (initialDescription ?? "") ||
      dueDate !== formatLocalDate(initialDueTime) ||
      priority !== (initialPriority ?? Todo_Priority.MEDIUM)
    );
  }, [title, description, dueDate, priority, initialTitle, initialDescription, initialDueTime, initialPriority]);

  const handleSave = async () => {
    if (!todoName) return;
    if (!title.trim() || !dueDate) {
      toast.error(t("todo.messages.fill-required"));
      return;
    }

    const parsedDueTime = new Date(dueDate);
    if (isNaN(parsedDueTime.getTime())) {
      toast.error(t("todo.messages.invalid-date"));
      return;
    }

    try {
      await updateTodo({
        update: create(TodoSchema, {
          name: todoName,
          title: title.trim(),
          description: description.trim(),
          dueTime: timestampFromDate(parsedDueTime),
          priority,
        }),
        updateMask: ["title", "description", "due_time", "priority"],
      });
      toast.success(t("todo.messages.updated"));
      onOpenChange(false);
    } catch (error) {
      handleError(error, toast.error, {
        context: "Update todo",
      });
    }
  };

  if (!todoName) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("common.edit")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="todo-edit-title">{t("todo.fields.title")}</Label>
            <Input
              id="todo-edit-title"
              value={title}
              placeholder={t("todo.placeholders.title")}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="todo-edit-description">{t("todo.fields.description")}</Label>
            <Textarea
              id="todo-edit-description"
              rows={3}
              value={description}
              placeholder={t("todo.placeholders.description")}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="todo-edit-due">{t("todo.fields.due-time")}</Label>
              <Input id="todo-edit-due" type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="todo-edit-priority">{t("todo.fields.priority")}</Label>
              <select
                id="todo-edit-priority"
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
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!isDirty}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TodoEditDialog;
