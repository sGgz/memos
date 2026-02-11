import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const Explore = () => {
  const currentUser = useCurrentUser();
  const t = useTranslate();
  const { generalSetting } = useInstance();

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
      <div className="relative mb-0 overflow-hidden bg-muted/30 w-screen -mx-4 sm:mx-0 sm:w-full">
        <div className="group relative h-60 w-full overflow-hidden bg-muted/30">
          {generalSetting.customProfile?.coverUrl ? (
            <img src={generalSetting.customProfile.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              {t("memo.cover-placeholder")}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        </div>
      </div>

      <PagedMemoList
        renderer={(memo: Memo) => (
          <div className="w-full flex items-start gap-3">
            <div className="w-12 shrink-0 flex flex-col items-start pt-3 text-xs text-muted-foreground/80">
              <div className="text-lg font-semibold text-foreground">
                {memo.displayTime ? dayjs(timestampDate(memo.displayTime)).format("YYYY") : "----"}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">
                {memo.displayTime ? dayjs(timestampDate(memo.displayTime)).format("MM/DD") : "--/--"}
              </div>
              <div className="mt-1 text-[10px]">{memo.displayTime ? dayjs(timestampDate(memo.displayTime)).format("HH:mm") : "--:--"}</div>
            </div>
            <div className="flex-1 pt-3">
              <MemoView key={`${memo.name}-${memo.updateTime}`} memo={memo} showCreator showVisibility compact />
            </div>
          </div>
        )}
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
