export const ROUTES = {
  ROOT: "/",
  ATTACHMENTS: "/attachments",
  INBOX: "/inbox",
  ARCHIVED: "/archived",
  SETTING: "/setting",
  TODOS: "/todos",
  EXPLORE: "/explore",
  AUTH: "/auth",
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
