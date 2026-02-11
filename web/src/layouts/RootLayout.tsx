import { useEffect, useMemo } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import usePrevious from "react-use/lib/usePrevious";
import MobileBottomNav from "@/components/MobileBottomNav";
import Navigation from "@/components/Navigation";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { redirectOnAuthFailure } from "@/utils/auth-redirect";

const RootLayout = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sm = useMediaQuery("sm");
  const currentUser = useCurrentUser();
  const { memoRelatedSetting } = useInstance();
  const { removeFilter } = useMemoFilterContext();
  const pathname = useMemo(() => location.pathname, [location.pathname]);
  const prevPathname = usePrevious(pathname);

  useEffect(() => {
    if (!currentUser && memoRelatedSetting.disallowPublicVisibility) {
      redirectOnAuthFailure();
    }
  }, [currentUser, memoRelatedSetting.disallowPublicVisibility]);

  useEffect(() => {
    // When the route changes and there is no filter in the search params, remove all filters
    if (prevPathname !== pathname && !searchParams.has("filter")) {
      removeFilter(() => true);
    }
  }, [prevPathname, pathname, searchParams, removeFilter]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    let raf = 0;
    const updateKeyboardOffset = () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      raf = requestAnimationFrame(() => {
        const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
        const visualHeight = viewport.height;
        const keyboardHeight = Math.max(0, layoutHeight - visualHeight - viewport.offsetTop);
        document.documentElement.style.setProperty("--keyboard-offset", `${keyboardHeight}px`);
      });
    };

    updateKeyboardOffset();
    viewport.addEventListener("resize", updateKeyboardOffset);
    viewport.addEventListener("scroll", updateKeyboardOffset);

    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      document.documentElement.style.removeProperty("--keyboard-offset");
      viewport.removeEventListener("resize", updateKeyboardOffset);
      viewport.removeEventListener("scroll", updateKeyboardOffset);
    };
  }, []);


  return (
    <div className="w-full min-h-full flex flex-row justify-center items-start sm:pl-16">
      {sm && (
        <div
          className={cn(
            "group flex flex-col justify-start items-start fixed top-0 left-0 select-none h-full bg-sidebar/95",
            "w-16 px-2",
            "border-r border-sidebar-border shadow-[inset_-1px_0_0_rgba(255,255,255,0.6),0_18px_40px_rgba(31,70,45,0.12)]",
          )}
        >
          <Navigation className="py-4 md:pt-6" collapsed={true} />
        </div>
      )}
      <div className="relative w-full min-h-[100vh]">
        <main className="w-full h-auto grow shrink flex flex-col justify-start items-center pb-20 sm:pb-0">
          <Outlet />
        </main>
        {!sm && <MobileBottomNav />}
      </div>
    </div>
  );
};

export default RootLayout;
