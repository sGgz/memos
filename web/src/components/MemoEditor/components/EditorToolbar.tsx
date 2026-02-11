import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { validationService } from "../services";
import { useEditorContext } from "../state";
import InsertMenu from "../Toolbar/InsertMenu";
import VisibilitySelector from "../Toolbar/VisibilitySelector";
import type { EditorToolbarProps } from "../types";

export const EditorToolbar: FC<EditorToolbarProps> = ({ onSave, onCancel, memoName, minimal, showInsertMenu }) => {
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

      <div className="flex flex-row justify-end items-center gap-2">
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
    </div>
  );
};
