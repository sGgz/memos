import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import type { MemoRenderContext } from "@/components/MasonryView";
import CoverHeaderDialog from "@/components/CoverHeaderDialog";
import MemoEditor from "@/components/MemoEditor";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import UserAvatar from "@/components/UserAvatar";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const Home = () => {
  const user = useCurrentUser();
  const t = useTranslate();
  const { isInitialized } = useInstance();

  const memoFilter = useMemoFilters({
    creatorName: user?.name,
    includeShortcuts: true,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

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
                <MemoView
                  key={`${memo.name}-${memo.displayTime}`}
                  memo={memo}
                  showVisibility
                  showPinned
                  compact
                  showTimeline
                  showHeader={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <CoverHeaderDialog />

      <div className="relative">
        <div className="w-full border-0 bg-transparent px-0 pt-5 pb-3 shadow-none">
          <PagedMemoList
            renderer={(memo: Memo, context) => <MemoRow memo={memo} context={context} />}
            listSort={listSort}
            orderBy={orderBy}
            filter={memoFilter}
            enabled={isInitialized && !!user} // Wait for contexts to stabilize before fetching
            showMemoEditor={false}
            containerClassName="max-w-none px-0 pt-2"
          />
        </div>
      </div>

    </div>
  );
};

export default Home;
