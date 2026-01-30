import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchPath } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import { useView } from "@/contexts/ViewContext";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import { useInfiniteMemos } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { Routes } from "@/router";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import Empty from "../Empty";
import type { MemoRenderContext } from "../MasonryView";
import MasonryView from "../MasonryView";
import MemoEditor from "../MemoEditor";
import MemoFilters from "../MemoFilters";
import Skeleton from "../Skeleton";

interface Props {
  renderer: (memo: Memo, context?: MemoRenderContext) => JSX.Element;
  listSort?: (list: Memo[]) => Memo[];
  state?: State;
  orderBy?: string;
  filter?: string;
  pageSize?: number;
  showCreator?: boolean;
  enabled?: boolean;
}

function useAutoFetchWhenNotScrollable({
  hasNextPage,
  isFetchingNextPage,
  memoCount,
  onFetchNext,
}: {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  memoCount: number;
  onFetchNext: () => Promise<unknown>;
}) {
  const autoFetchTimeoutRef = useRef<number | null>(null);

  const isPageScrollable = useCallback(() => {
    const documentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    return documentHeight > window.innerHeight + 100;
  }, []);

  const checkAndFetchIfNeeded = useCallback(async () => {
    if (autoFetchTimeoutRef.current) {
      clearTimeout(autoFetchTimeoutRef.current);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    const shouldFetch = !isPageScrollable() && hasNextPage && !isFetchingNextPage && memoCount > 0;

    if (shouldFetch) {
      await onFetchNext();

      autoFetchTimeoutRef.current = window.setTimeout(() => {
        void checkAndFetchIfNeeded();
      }, 500);
    }
  }, [hasNextPage, isFetchingNextPage, memoCount, isPageScrollable, onFetchNext]);

  useEffect(() => {
    if (!isFetchingNextPage && memoCount > 0) {
      void checkAndFetchIfNeeded();
    }
  }, [memoCount, isFetchingNextPage, checkAndFetchIfNeeded]);

  useEffect(() => {
    return () => {
      if (autoFetchTimeoutRef.current) {
        clearTimeout(autoFetchTimeoutRef.current);
      }
    };
  }, []);
}

const PagedMemoList = (props: Props) => {
  const t = useTranslate();
  const { layout } = useView();
  const queryClient = useQueryClient();

  // Show memo editor only on the root route
  const showMemoEditor = Boolean(matchPath(Routes.ROOT, window.location.pathname));

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteMemos(
    {
      state: props.state || State.NORMAL,
      orderBy: props.orderBy || "display_time desc",
      filter: props.filter,
      pageSize: props.pageSize || DEFAULT_LIST_MEMOS_PAGE_SIZE,
    },
    { enabled: props.enabled ?? true },
  );

  // Flatten pages into a single array of memos
  const memos = useMemo(() => data?.pages.flatMap((page) => page.memos) || [], [data]);

  // Apply custom sorting if provided, otherwise use memos directly
  const sortedMemoList = useMemo(() => (props.listSort ? props.listSort(memos) : memos), [memos, props.listSort]);

  // Prefetch creators when new data arrives to improve performance
  useEffect(() => {
    if (!data?.pages || !props.showCreator) return;

    const lastPage = data.pages[data.pages.length - 1];
    if (!lastPage?.memos) return;

    const uniqueCreators = Array.from(new Set(lastPage.memos.map((memo) => memo.creator)));
    for (const creator of uniqueCreators) {
      void queryClient.prefetchQuery({
        queryKey: userKeys.detail(creator),
        queryFn: async () => {
          const user = await userServiceClient.getUser({ name: creator });
          return user;
        },
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [data?.pages, props.showCreator, queryClient]);

  // Auto-fetch hook: fetches more content when page isn't scrollable
  useAutoFetchWhenNotScrollable({
    hasNextPage,
    isFetchingNextPage,
    memoCount: sortedMemoList.length,
    onFetchNext: fetchNextPage,
  });

  // Infinite scroll: fetch more when user scrolls near bottom
  useEffect(() => {
    if (!hasNextPage) return;

    const handleScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (nearBottom && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const children = (
    <div className="flex flex-col justify-start items-stretch w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
      {/* Show skeleton loader during initial load */}
      {isLoading ? (
        <Skeleton showCreator={props.showCreator} count={4} />
      ) : (
        <>
          <MasonryView
            memoList={sortedMemoList}
            renderer={props.renderer}
            prefixElement={
              <>
                {showMemoEditor ? (
                  <MemoEditor className="mb-2" cacheKey="home-memo-editor" placeholder={t("editor.any-thoughts")} />
                ) : undefined}
                <MemoFilters />
              </>
            }
            listMode={layout === "LIST"}
          />

          {/* Loading indicator for pagination */}
          {isFetchingNextPage && <Skeleton showCreator={props.showCreator} count={2} />}

          {/* Empty state or back-to-top button */}
          {!isFetchingNextPage && (
            <>
              {!hasNextPage && sortedMemoList.length === 0 ? (
                <div className="w-full mt-16 mb-12 flex flex-col justify-center items-center italic text-center space-y-4">
                  <Empty />
                  <p className="text-muted-foreground">{t("message.no-data")}</p>
                </div>
              ) : (
                <div className="w-full flex flex-row justify-center items-center my-8">
                  <BackToTop />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );

  return children;
};

const BackToTop = () => {
  const t = useTranslate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const shouldShow = window.scrollY > 400;
      setIsVisible(shouldShow);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      onClick={scrollToTop}
      className="group relative inline-flex items-center gap-3 px-6 py-3 border border-border/60 rounded-full text-xs uppercase tracking-[0.4em] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all shadow-[0_15px_35px_rgba(0,0,0,0.2)]"
    >
      {t("router.back-to-top")}
      <ArrowUpIcon className="ml-1 w-4 h-auto group-hover:translate-y-[-2px] transition-all" />
      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 opacity-0 group-hover:opacity-100 blur-xl transition-all -z-10" />
    </Button>
  );
};

export default PagedMemoList;
