import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import CoverHeaderDialog from "@/components/CoverHeaderDialog";
import type { MemoRenderContext } from "@/components/MasonryView";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import UserAvatar from "@/components/UserAvatar";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";

const Explore = () => {
  const currentUser = useCurrentUser();
  useInstance();

  const MemoRow = ({ memo, context }: { memo: Memo; context?: MemoRenderContext }) => {
    const creator = useUser(memo.creator).data;
    const displayTime = memo.displayTime ? dayjs(timestampDate(memo.displayTime)) : null;
    const yearLabel = displayTime ? displayTime.format("YYYY") : "----";
    const dayLabel = displayTime ? displayTime.format("MM/DD") : "--/--";
    const timeLabel = displayTime ? displayTime.format("HH:mm") : "--:--";
    const dayKey = displayTime ? displayTime.format("YYYY-MM-DD") : "";
    const memoList = context?.memoList;
    const currentIndex = typeof context?.index === "number" ? context.index : -1;
    let showYear = true;
    let showDay = true;
    if (memoList && currentIndex > 0) {
      for (let i = currentIndex - 1; i >= 0; i -= 1) {
        const prevMemo = memoList[i];
        if (!prevMemo?.displayTime) {
          continue;
        }
        const prevTime = dayjs(timestampDate(prevMemo.displayTime));
        if (prevTime.format("YYYY") === yearLabel) {
          showYear = false;
        }
        if (prevTime.format("YYYY-MM-DD") === dayKey) {
          showDay = false;
        }
        if (!showYear && !showDay) {
          break;
        }
      }
    }
    return (
      <div className="mb-4 flex w-full items-start gap-2.5">
        <div className="flex w-10 shrink-0 flex-col items-end text-right text-[10px] text-muted-foreground/80 leading-tight">
          {showYear && <div className="text-sm font-semibold text-foreground">{yearLabel}</div>}
          {showDay && <div className={cn("font-semibold text-foreground", showYear ? "mt-0.5 text-xs" : "text-sm")}>{dayLabel}</div>}
          <div className={cn("text-[10px]", showYear || showDay ? "mt-0.5" : "text-xs")}>{timeLabel}</div>
        </div>
        <div className="flex-1">
          <div className="rounded-xl border border-border/50 bg-background/90 px-2.5 py-2">
            <div className="flex items-start gap-2.5">
              <UserAvatar className="mt-1 h-7 w-7" avatarUrl={creator?.avatarUrl} />
              <div className="flex-1">
                <MemoView
                  key={`${memo.name}-${memo.updateTime}`}
                  className="p-0 [&_.memo-content-block]:text-[0.9rem] [&_.memo-content-block]:leading-5 [&_.memo-content-block]:tracking-normal"
                  memo={memo}
                  showCreator
                  showVisibility
                  compact
                  showHeader={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Determine visibility filter based on authentication status
  // - Logged-in users: Can see PUBLIC and PROTECTED memos
  // - Visitors: Can only see PUBLIC memos
  // Note: The backend is responsible for filtering stats based on visibility permissions.
  const visibilities = currentUser ? [Visibility.PUBLIC, Visibility.PROTECTED] : [Visibility.PUBLIC];

  // Build filter using unified hook (no creator scoping for Explore)
  const memoFilter = useMemoFilters({
    includeShortcuts: false,
    includePinned: false,
    visibilities,
  });

  // Get sorting logic using unified hook (no pinned sorting)
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: false,
    state: State.NORMAL,
  });

  return (
    <div className="w-full">
      <CoverHeaderDialog />

      <PagedMemoList
        renderer={(memo: Memo, context) => <MemoRow memo={memo} context={context} />}
        listSort={listSort}
        orderBy={orderBy}
        filter={memoFilter}
        showCreator
        showMemoEditor
        containerClassName="max-w-none px-0 pt-1"
      />
    </div>
  );
};

export default Explore;
