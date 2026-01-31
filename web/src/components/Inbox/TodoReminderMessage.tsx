import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema, timestampDate } from "@bufbuild/protobuf/wkt";
import { BellIcon, CheckIcon, TrashIcon, XIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { todoServiceClient, userServiceClient } from "@/connect";
import { getTodoDueLabel } from "@/helpers/todo";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import type { Todo } from "@/types/proto/api/v1/todo_service_pb";
import { UserNotification, UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  notification: UserNotification;
}

function TodoReminderMessage({ notification }: Props) {
  const t = useTranslate();
  const [todo, setTodo] = useState<Todo | undefined>(undefined);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useAsyncEffect(async () => {
    if (!notification.todoName) {
      setInitialized(true);
      return;
    }

    try {
      const fetched = await todoServiceClient.getTodo({ name: notification.todoName });
      setTodo(fetched);
      setInitialized(true);
    } catch (error) {
      handleError(error, () => {}, {
        context: "Failed to fetch todo",
        onError: () => setHasError(true),
      });
      setInitialized(true);
    }
  }, [notification.todoName]);

  const handleArchiveMessage = async (silence = false) => {
    await userServiceClient.updateUserNotification({
      notification: {
        name: notification.name,
        status: UserNotification_Status.ARCHIVED,
      },
      updateMask: create(FieldMaskSchema, { paths: ["status"] }),
    });
    if (!silence) {
      toast.success(t("message.archived-successfully"));
    }
  };

  const handleDeleteMessage = async () => {
    await userServiceClient.deleteUserNotification({
      name: notification.name,
    });
    toast.success(t("message.deleted-successfully"));
  };

  if (!initialized && !hasError) {
    return (
      <div className="w-full px-5 py-4 border-b border-border/60 last:border-b-0 bg-muted/10 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-muted/50 shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-muted/50 rounded-md w-1/3" />
            <div className="h-3 bg-muted/40 rounded-md w-2/3" />
            <div className="h-12 bg-muted/30 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full px-5 py-4 border-b border-border/60 last:border-b-0 bg-destructive/[0.04] group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0 ring-1 ring-destructive/20">
              <XIcon className="w-5 h-5 text-destructive" strokeWidth={2} />
            </div>
            <span className="text-sm text-destructive/80 font-medium">{t("inbox.failed-to-load")}</span>
          </div>
          <button
            onClick={handleDeleteMessage}
            className="p-1.5 hover:bg-destructive/15 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
            title={t("common.delete")}
          >
            <TrashIcon className="w-4 h-4 text-destructive/70 hover:text-destructive transition-colors" strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  const isUnread = notification.status === UserNotification_Status.UNREAD;
  const dueTime = todo?.dueTime ? timestampDate(todo.dueTime) : undefined;
  const dueLabel = dueTime ? getTodoDueLabel(dueTime, t) : t("todo.unknown-time");
  const reminderTitle = todo?.title || t("todo.title");

  return (
    <div
      className={cn(
        "w-full px-5 py-4 border-b border-border/60 last:border-b-0 transition-all duration-200 group relative",
        isUnread ? "bg-primary/[0.03] hover:bg-primary/[0.05]" : "hover:bg-muted/30",
      )}
    >
      {isUnread && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-primary/60" />}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
            <BellIcon className="w-5 h-5 text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-semibold text-sm text-foreground/95">{t("todo.notification.title")}</span>
              <span className="text-xs text-muted-foreground/60">
                {notification.createTime &&
                  timestampDate(notification.createTime)?.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                {notification.createTime &&
                  timestampDate(notification.createTime)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isUnread ? (
                <button
                  onClick={() => handleArchiveMessage()}
                  className="p-1.5 hover:bg-primary/10 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
                  title={t("common.archive")}
                >
                  <CheckIcon className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" strokeWidth={2} />
                </button>
              ) : (
                <button
                  onClick={handleDeleteMessage}
                  className="p-1.5 hover:bg-destructive/10 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
                  title={t("common.delete")}
                >
                  <TrashIcon className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-sm font-medium text-foreground">{t("inbox.todo-reminder", { title: reminderTitle })}</p>
            <p className="text-xs text-muted-foreground mt-1">{dueLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TodoReminderMessage;
