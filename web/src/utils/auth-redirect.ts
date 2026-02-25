import { getInstanceConfig } from "@/instance-config";
import { ROUTES } from "@/router/routes";

const PUBLIC_ROUTES = [
  ROUTES.AUTH, // Authentication pages
  "/u/", // User profile pages (dynamic)
  "/memos/", // Individual memo detail pages (dynamic)
] as const;

const AUTH_REQUIRED_ENTRY_ROUTES = [ROUTES.ROOT, ROUTES.EXPLORE] as const;
const PRIVATE_ROUTES = [ROUTES.HOME, ROUTES.ATTACHMENTS, ROUTES.INBOX, ROUTES.ARCHIVED, ROUTES.SETTING] as const;

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

function isPrivateRoute(path: string): boolean {
  return PRIVATE_ROUTES.includes(path as (typeof PRIVATE_ROUTES)[number]);
}

function isAuthRequiredEntryRoute(path: string): boolean {
  return AUTH_REQUIRED_ENTRY_ROUTES.includes(path as (typeof AUTH_REQUIRED_ENTRY_ROUTES)[number]);
}

export function redirectOnAuthFailure(): void {
  const currentPath = window.location.pathname;
  const disallowPublicVisibility = getInstanceConfig().memoRelatedSetting.disallowPublicVisibility;

  // Explore page is only public when public visibility is allowed.
  if (!disallowPublicVisibility && currentPath.startsWith(ROUTES.EXPLORE)) {
    return;
  }

  // Don't redirect if it's a public route
  if (isPublicRoute(currentPath)) {
    return;
  }

  const target = disallowPublicVisibility ? ROUTES.AUTH : ROUTES.EXPLORE;

  // Only redirect if it's a private route or disallowPublicVisibility is enabled
  if (disallowPublicVisibility || isPrivateRoute(currentPath)) {
    window.location.replace(target);
  }
}
