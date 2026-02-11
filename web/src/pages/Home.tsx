import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { useState } from "react";
import type { MemoRenderContext } from "@/components/MasonryView";
import MemoEditor from "@/components/MemoEditor";
import MemoView from "@/components/MemoView";
import PagedMemoList from "@/components/PagedMemoList";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInstance } from "@/contexts/InstanceContext";
import { buildInstanceSettingName } from "@/helpers/resource-names";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import {
  InstanceSetting_GeneralSetting_CustomProfileSchema,
  InstanceSetting_Key,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const Home = () => {
  const user = useCurrentUser();
  const t = useTranslate();
  const { isInitialized, generalSetting, updateSetting } = useInstance();
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState(generalSetting.customProfile?.coverUrl ?? "");

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
        <div className="w-12 shrink-0 flex flex-col items-start text-xs text-muted-foreground/80">
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
      <div className="relative mb-0 overflow-hidden bg-muted/30 w-screen -mx-4 sm:mx-0 sm:w-full">
        <button
          type="button"
          className="group relative h-60 w-full overflow-hidden bg-muted/30"
          onClick={() => {
            setCoverUrl(generalSetting.customProfile?.coverUrl ?? "");
            setCoverOpen(true);
          }}
        >
          {generalSetting.customProfile?.coverUrl ? (
            <img src={generalSetting.customProfile.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              {t("memo.cover-placeholder")}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        </button>
      </div>

      <div className="relative -mt-14">
        <div className="w-full border-0 bg-transparent px-0 pt-5 pb-3 shadow-none">
          <div className="rounded-2xl border border-border/60 bg-background/95 px-3 pt-4 pb-3 shadow-[0_12px_28px_rgba(15,23,42,0.12)] mb-4">
            <MemoEditor
              className="border-0 shadow-none bg-transparent px-0 pt-0"
              cacheKey="home-memo-editor"
              placeholder={t("editor.any-thoughts")}
              minimal
            />
          </div>
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

      <Dialog open={coverOpen} onOpenChange={setCoverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("memo.cover-edit")}</DialogTitle>
            <DialogDescription>{t("memo.cover-desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="cover-url">{t("memo.cover-url")}</Label>
            <Input id="cover-url" value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} placeholder="https://" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoverOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={async () => {
                await updateSetting(
                  create(InstanceSettingSchema, {
                    name: buildInstanceSettingName(InstanceSetting_Key.GENERAL),
                    value: {
                      case: "generalSetting",
                      value: {
                        ...generalSetting,
                        customProfile: create(InstanceSetting_GeneralSetting_CustomProfileSchema, {
                          title: generalSetting.customProfile?.title,
                          description: generalSetting.customProfile?.description,
                          logoUrl: generalSetting.customProfile?.logoUrl,
                          coverUrl,
                        }),
                      },
                    },
                  }),
                );
                setCoverOpen(false);
              }}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
