import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import type { MemoRenderContext } from "@/components/MasonryView";
import CoverHeaderDialog from "@/components/CoverHeaderDialog";
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
import { useTranslate } from "@/utils/i18n";

const Explore = () => {
  const currentUser = useCurrentUser();
  const t = useTranslate();
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
      <div className="w-full flex items-start gap-3 mb-6">
        <div className="w-12 shrink-0 flex flex-col items-end text-right text-xs text-muted-foreground/80">
          {showYear && <div className="text-lg font-semibold text-foreground">{yearLabel}</div>}
          {showDay && <div className={cn("font-semibold text-foreground", showYear ? "mt-0.5 text-sm" : "text-base")}>{dayLabel}</div>}
          <div className={cn("text-[10px]", showYear || showDay ? "mt-1" : "text-sm")}>{timeLabel}</div>
        </div>
        <div className="flex-1">
          <div className="rounded-2xl border border-border/60 bg-background/90 px-3 py-3">
            <div className="flex items-start gap-3">
              <UserAvatar className="h-8 w-8 mt-1.5" avatarUrl={creator?.avatarUrl} />
              <div className="flex-1">
                <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showCreator showVisibility compact showHeader={false} />
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
        containerClassName="max-w-none px-0 pt-2"
      />
    </div>
  );
};

export default Explore;
