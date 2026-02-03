export const ROUTES = {
  ROOT: "/",
  HOME: "/home",
  ATTACHMENTS: "/attachments",
  INBOX: "/inbox",
  ARCHIVED: "/archived",
  SETTING: "/setting",
  TODOS: "/todos",
  LOANS: "/loans",
  EXPLORE: "/explore",
  AUTH: "/auth",
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
