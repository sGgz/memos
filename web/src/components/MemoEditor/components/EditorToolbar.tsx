import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/utils/i18n";
import { validationService } from "../services";
import { useEditorContext } from "../state";
import InsertMenu from "../Toolbar/InsertMenu";
import VisibilitySelector from "../Toolbar/VisibilitySelector";
import type { EditorToolbarProps } from "../types";

export const EditorToolbar: FC<EditorToolbarProps> = ({ onSave, onCancel, memoName }) => {
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

  return (
    <div className="w-full flex flex-col gap-3 lg:flex-row lg:justify-between lg:items-center mb-2">
      <div className="flex flex-row justify-start items-center">
        <InsertMenu
          isUploading={state.ui.isLoading.uploading}
          location={state.metadata.location}
          onLocationChange={handleLocationChange}
          onToggleFocusMode={handleToggleFocusMode}
          memoName={memoName}
        />
      </div>

      <div className="flex flex-row justify-end items-center gap-3">
        <VisibilitySelector value={state.metadata.visibility} onChange={handleVisibilityChange} />

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
          className="relative overflow-hidden rounded-full px-6 font-semibold tracking-[0.3em]"
        >
          <span className="relative z-10">{isSaving ? t("editor.saving") : t("editor.save")}</span>
          <span className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-80 blur" />
        </Button>
      </div>
    </div>
  );
};
