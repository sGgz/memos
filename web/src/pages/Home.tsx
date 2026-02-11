import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { useState } from "react";
import MemoView from "@/components/MemoView";
import MemoEditor from "@/components/MemoEditor";
import PagedMemoList from "@/components/PagedMemoList";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInstance } from "@/contexts/InstanceContext";
import { buildInstanceSettingName } from "@/helpers/resource-names";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
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

  return (
    <div className="w-full">
      <div className="relative mb-0 overflow-hidden rounded-3xl bg-muted/30">
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
        <div className="rounded-[28px] border border-border/60 bg-background/90 px-4 pt-5 pb-3 shadow-[0_20px_45px_-35px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="rounded-2xl border border-border/60 bg-background/95 px-4 pt-4 pb-3 shadow-[0_12px_28px_rgba(15,23,42,0.12)] mb-4">
            <MemoEditor
              className="border-0 shadow-none bg-transparent px-0 pt-0"
              cacheKey="home-memo-editor"
              placeholder={t("editor.any-thoughts")}
              minimal
            />
          </div>
          <PagedMemoList
            renderer={(memo: Memo) => (
              <div className="w-full grid grid-cols-[56px,1fr] gap-3">
                <div className="flex flex-col items-start pt-3 text-xs text-muted-foreground/80">
                  <div className="text-base font-semibold text-foreground">
                    {memo.displayTime ? dayjs(timestampDate(memo.displayTime)).format("MM/DD") : "--/--"}
                  </div>
                  <div className="mt-1 text-[11px]">
                    {memo.displayTime ? dayjs(timestampDate(memo.displayTime)).format("HH:mm") : "--:--"}
                  </div>
                </div>
                <MemoView key={`${memo.name}-${memo.displayTime}`} memo={memo} showVisibility showPinned compact showTimeline />
              </div>
            )}
            listSort={listSort}
            orderBy={orderBy}
            filter={memoFilter}
            enabled={isInitialized && !!user} // Wait for contexts to stabilize before fetching
            showMemoEditor={false}
            containerClassName="max-w-none px-0 pt-3"
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
