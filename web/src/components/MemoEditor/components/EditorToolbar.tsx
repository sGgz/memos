import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import type { FC } from "react";
import EditableTimestamp from "@/components/EditableTimestamp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { validationService } from "../services";
import { useEditorContext } from "../state";
import InsertMenu from "../Toolbar/InsertMenu";
import VisibilitySelector from "../Toolbar/VisibilitySelector";
import type { EditorToolbarProps } from "../types";

export const EditorToolbar: FC<EditorToolbarProps> = ({ onSave, onCancel, memoName, minimal, showInsertMenu, variant = "default" }) => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();
  const { valid } = validationService.canSave(state);

  const isSaving = state.ui.isLoading.saving;

  const handleLocationChange = (location: typeof state.metadata.location) => {
    dispatch(actions.setMetadata({ location }));
  };

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  const handleVisibilityChange = (visibility: typeof state.metadata.visibility) => {
    dispatch(actions.setMetadata({ visibility }));
  };

  const showInsertMenuButton = showInsertMenu ?? true;
  const showVisibilitySelector = !minimal;
  const displayTime = state.timestamps.displayTime ?? new Date();
  const publishDateLabel = dayjs(displayTime).format("YYYY/MM/DD");

  return (
    <div className={cn("w-full flex flex-col gap-2 lg:flex-row lg:items-center mb-0", minimal ? "lg:justify-end" : "lg:justify-between")}>
      {!minimal && (
        <div className="flex flex-row justify-between items-center w-full lg:w-auto">
          {showInsertMenuButton && (
            <InsertMenu
              isUploading={state.ui.isLoading.uploading}
              location={state.metadata.location}
              onLocationChange={handleLocationChange}
              onToggleFocusMode={handleToggleFocusMode}
              memoName={memoName}
              compact={minimal}
            />
          )}
        </div>
      )}

      <div className={cn("flex flex-row justify-end items-center gap-2", variant === "publish" && "hidden")}>
        {minimal && showInsertMenuButton && (
          <InsertMenu
            isUploading={state.ui.isLoading.uploading}
            location={state.metadata.location}
            onLocationChange={handleLocationChange}
            onToggleFocusMode={handleToggleFocusMode}
            memoName={memoName}
            compact={minimal}
          />
        )}
        {showVisibilitySelector && <VisibilitySelector value={state.metadata.visibility} onChange={handleVisibilityChange} />}

        {onCancel && (
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-full border border-border/60 hover:border-primary/40"
          >
            {t("common.cancel")}
          </Button>
        )}

        <Button
          onClick={onSave}
          disabled={!valid || isSaving}
          className="rounded-full px-4 py-1.5 text-xs font-semibold bg-[#3B82F6] text-white hover:bg-[#2563EB]"
        >
          {isSaving ? t("editor.saving") : t("editor.save")}
        </Button>
      </div>

      {variant === "publish" && (
        <div className="relative z-10 w-full flex items-center justify-between gap-3 px-0 pt-0">
          <EditableTimestamp
            timestamp={timestampFromDate(displayTime)}
            onChange={(date) => {
              dispatch(actions.setTimestamps({ displayTime: date }));
              dispatch(actions.setDisplayTimeManual(true));
            }}
            showSeconds={false}
            mode={state.timestamps.displayTimeIsManual ? "datetime" : "date"}
            displayValue={publishDateLabel}
            className="w-auto min-w-0 border-0 bg-transparent px-0 py-0 text-[1.2rem] font-semibold leading-none text-foreground hover:bg-transparent"
          />
          <Button
            onClick={onSave}
            disabled={!valid || isSaving}
            className="h-9 rounded-[18px] bg-[#4C8DFF] px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(76,141,255,0.26)] hover:bg-[#377CF7]"
          >
            {isSaving ? t("editor.saving") : t("editor.publish")}
          </Button>
        </div>
      )}
    </div>
  );
};
