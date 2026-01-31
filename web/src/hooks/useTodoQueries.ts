import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema, timestampFromDate } from "@bufbuild/protobuf/wkt";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { todoServiceClient } from "@/connect";
import { getTodoPriorityName, getTodoStatusName } from "@/helpers/todo";
import type { ListTodosRequest, Todo } from "@/types/proto/api/v1/todo_service_pb";
import {
  CreateTodoRequestSchema,
  ListTodosRequestSchema,
  Todo_Priority,
  Todo_Status,
  TodoSchema,
} from "@/types/proto/api/v1/todo_service_pb";

export const todoKeys = {
  all: ["todos"] as const,
  lists: () => [...todoKeys.all, "list"] as const,
  list: (filters: Partial<ListTodosRequest>) => [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, "detail"] as const,
  detail: (name: string) => [...todoKeys.details(), name] as const,
};

export function useTodos(request: Partial<ListTodosRequest> = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: todoKeys.list(request),
    queryFn: async () => {
      const response = await todoServiceClient.listTodos(create(ListTodosRequestSchema, request as Record<string, unknown>));
      return response;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useInfiniteTodos(request: Partial<ListTodosRequest> = {}, options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: todoKeys.list(request),
    queryFn: async ({ pageParam }) => {
      const response = await todoServiceClient.listTodos(
        create(ListTodosRequestSchema, {
          ...request,
          pageToken: pageParam || "",
        } as Record<string, unknown>),
      );
      return response;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextPageToken || undefined,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
}

export function useTodo(name: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: todoKeys.detail(name),
    queryFn: async () => {
      const todo = await todoServiceClient.getTodo({ name });
      return todo;
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 30,
  });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (todoToCreate: Todo) => {
      const todo = await todoServiceClient.createTodo(create(CreateTodoRequestSchema, { todo: todoToCreate }));
      return todo;
    },
    onSuccess: (newTodo) => {
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
      queryClient.setQueryData(todoKeys.detail(newTodo.name), newTodo);
    },
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ update, updateMask }: { update: Partial<Todo>; updateMask: string[] }) => {
      const todo = await todoServiceClient.updateTodo({
        todo: create(TodoSchema, update as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
      return todo;
    },
    onSuccess: (updatedTodo) => {
      queryClient.setQueryData(todoKeys.detail(updatedTodo.name), updatedTodo);
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await todoServiceClient.deleteTodo({ name });
      return name;
    },
    onSuccess: (name) => {
      queryClient.removeQueries({ queryKey: todoKeys.detail(name) });
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() });
    },
  });
}

export const buildTodoDueFilter = (from: Date, to: Date) => {
  const startTimestamp = Math.floor(from.getTime() / 1000);
  const endTimestamp = Math.floor(to.getTime() / 1000);
  return `due_time >= ${startTimestamp} && due_time < ${endTimestamp}`;
};

export const buildTodoStatusFilter = (status: Todo_Status) => {
  return `status == "${getTodoStatusName(status)}"`;
};

export const buildTodoPriorityFilter = (priority: Todo_Priority) => {
  return `priority == "${getTodoPriorityName(priority)}"`;
};

export const toTodoTimestamp = (date: Date) => timestampFromDate(date);
