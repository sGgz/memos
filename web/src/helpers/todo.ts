import dayjs from "dayjs";
import { Todo_Priority, Todo_Status } from "@/types/proto/api/v1/todo_service_pb";
import type { Translations } from "@/utils/i18n";

type Translate = (key: Translations, params?: Record<string, unknown>) => string;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const getTodoPriorityName = (priority: Todo_Priority): string => {
  switch (priority) {
    case Todo_Priority.HIGH:
      return "HIGH";
    case Todo_Priority.MEDIUM:
      return "MEDIUM";
    case Todo_Priority.LOW:
      return "LOW";
    default:
      return "PRIORITY_UNSPECIFIED";
  }
};

export const getTodoStatusName = (status: Todo_Status): string => {
  switch (status) {
    case Todo_Status.DONE:
      return "DONE";
    case Todo_Status.NORMAL:
      return "NORMAL";
    default:
      return "STATUS_UNSPECIFIED";
  }
};

export const getTodoDueRelativeLabel = (dueTime: Date, t: Translate): string => {
  const now = new Date();
  const diffMs = dueTime.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);

  if (diffMs >= 0 && dayjs(dueTime).isSame(now, "day")) {
    return t("todo.due-today");
  }

  const minutes = Math.max(1, Math.ceil(absMs / MINUTE_MS));
  if (diffMs >= 0) {
    if (absMs >= DAY_MS) {
      return t("todo.due-in-days", { count: Math.ceil(absMs / DAY_MS) });
    }
    if (absMs >= HOUR_MS) {
      return t("todo.due-in-hours", { count: Math.ceil(absMs / HOUR_MS) });
    }
    return t("todo.due-in-minutes", { count: minutes });
  }

  if (absMs >= DAY_MS) {
    return t("todo.overdue-by-days", { count: Math.ceil(absMs / DAY_MS) });
  }
  if (absMs >= HOUR_MS) {
    return t("todo.overdue-by-hours", { count: Math.ceil(absMs / HOUR_MS) });
  }
  return t("todo.overdue-by-minutes", { count: minutes });
};

export const isTodoOverdue = (dueTime: Date): boolean => dueTime.getTime() < Date.now();

export const getTodoDueLabel = (dueTime: Date, t: Translate): string => {
  return t("todo.notification.due-relative", {
    time: dayjs(dueTime).format("YYYY-MM-DD HH:mm"),
    relative: getTodoDueRelativeLabel(dueTime, t),
  });
};
