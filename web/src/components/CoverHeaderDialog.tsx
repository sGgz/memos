import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { instanceServiceClient } from "@/connect";
import { useInstance } from "@/contexts/InstanceContext";
import { buildInstanceSettingName } from "@/helpers/resource-names";
import { cn } from "@/lib/utils";
import type { CoverImage } from "@/types/proto/api/v1/instance_service_pb";
import {
  InstanceSetting_GeneralSetting_CustomProfileSchema,
  InstanceSetting_Key,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";

const CoverHeaderDialog = () => {
  const t = useTranslate();
  const { generalSetting, updateSetting } = useInstance();
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState(generalSetting.customProfile?.coverUrl ?? "");
  const [coverImages, setCoverImages] = useState<CoverImage[]>([]);
  const [isCoverLoading, setIsCoverLoading] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState("");
  const coverUploadRef = useRef<HTMLInputElement>(null);

  const fetchCoverImages = async () => {
    setIsCoverLoading(true);
    try {
      const response = await instanceServiceClient.listCoverImages({});
      setCoverImages(response.images);
      setCoverError("");
    } catch (error) {
      setCoverImages([]);
      if (error instanceof ConnectError && error.code === Code.FailedPrecondition) {
        setCoverError(t("memo.cover-config-missing"));
      } else if (error instanceof ConnectError) {
        setCoverError(error.message);
      } else {
        setCoverError(t("memo.cover-config-missing"));
      }
    } finally {
      setIsCoverLoading(false);
    }
  };

  const saveCoverUrl = async (nextUrl: string) => {
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
              coverUrl: nextUrl,
            }),
          },
        },
      }),
    );
    setCoverUrl(nextUrl);
  };

  const handleCoverOpenChange = (open: boolean) => {
    setCoverOpen(open);
    if (open) {
      setCoverUrl(generalSetting.customProfile?.coverUrl ?? "");
    }
  };

  useEffect(() => {
    if (!coverOpen) {
      return;
    }
    fetchCoverImages();
  }, [coverOpen]);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-10 h-60 overflow-hidden bg-muted/30">
        <button
          type="button"
          className="group relative h-full w-full overflow-hidden bg-muted/30 pointer-events-auto"
          onClick={() => handleCoverOpenChange(true)}
          onTouchEnd={() => handleCoverOpenChange(true)}
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
      <div className="h-60" />

      <Dialog open={coverOpen} onOpenChange={handleCoverOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("memo.cover-edit")}</DialogTitle>
            <DialogDescription>{t("memo.cover-desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>{t("memo.cover-history")}</Label>
              <Button variant="outline" size="icon" onClick={() => coverUploadRef.current?.click()} disabled={isCoverUploading}>
                {isCoverUploading ? (
                  <span className="text-xs">...</span>
                ) : (
                  <span className="text-sm">+</span>
                )}
              </Button>
            </div>
            {coverError ? (
              <div className="text-sm text-muted-foreground">{coverError}</div>
            ) : isCoverLoading ? (
              <div className="text-sm text-muted-foreground">{t("memo.cover-loading")}</div>
            ) : coverImages.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("memo.cover-empty")}</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {coverImages.map((image) => (
                  <button
                    type="button"
                    key={image.filename}
                    className={cn(
                      "relative overflow-hidden rounded-lg border border-border/60 bg-muted/20",
                      coverUrl === image.url ? "ring-2 ring-primary/60" : "hover:border-primary/60",
                    )}
                    onClick={async () => {
                      await saveCoverUrl(image.url);
                      setCoverOpen(false);
                    }}
                  >
                    <img src={image.url} alt={image.filename} className="h-24 w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-1 text-[10px] text-foreground shadow-sm hover:bg-background"
                      onClick={async (event) => {
                        event.stopPropagation();
                        await instanceServiceClient.deleteCoverImage({
                          filename: image.filename,
                        });
                        await fetchCoverImages();
                        if (coverUrl === image.url) {
                          await saveCoverUrl("");
                        }
                      }}
                    >
                      {t("common.delete")}
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            ref={coverUploadRef}
            className="hidden"
            type="file"
            accept="image/*"
            disabled={isCoverUploading}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              setIsCoverUploading(true);
              try {
                const buffer = await file.arrayBuffer();
                const response = await instanceServiceClient.uploadCoverImage({
                  filename: file.name,
                  content: new Uint8Array(buffer),
                });
                if (response.image?.url) {
                  await saveCoverUrl(response.image.url);
                }
                await fetchCoverImages();
                setCoverOpen(false);
              } catch (error) {
                if (error instanceof ConnectError && error.code === Code.FailedPrecondition) {
                  setCoverError(t("memo.cover-config-missing"));
                } else if (error instanceof ConnectError) {
                  setCoverError(error.message);
                } else {
                  setCoverError(t("memo.cover-config-missing"));
                }
              } finally {
                setIsCoverUploading(false);
                if (coverUploadRef.current) {
                  coverUploadRef.current.value = "";
                }
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoverOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={async () => {
                await saveCoverUrl(coverUrl);
                setCoverOpen(false);
              }}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CoverHeaderDialog;
