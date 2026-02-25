import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString } from "@/utils/memo";
import { EditorContent, EditorMetadata, EditorToolbar, FocusModeExitButton, FocusModeOverlay } from "./components";
import { FOCUS_MODE_STYLES } from "./constants";
import type { EditorRefActions } from "./Editor";
import { useAutoSave, useFocusMode, useKeyboard, useMemoInit } from "./hooks";
import { cacheService, errorService, memoService, validationService } from "./services";
import { EditorProvider, useEditorContext } from "./state";
import type { MemoEditorProps } from "./types";

const MemoEditor = (props: MemoEditorProps) => {
  const {
    className,
    cacheKey,
    memoName,
    parentMemoName,
    autoFocus,
    placeholder,
    onConfirm,
    onCancel,
    minimal,
    initialContent,
    showInsertMenu,
    variant = "default",
  } = props;

  return (
    <EditorProvider>
      <MemoEditorImpl
        className={cn("memo-editor-shell", className)}
        cacheKey={cacheKey}
        memoName={memoName}
        parentMemoName={parentMemoName}
        autoFocus={autoFocus}
        placeholder={placeholder}
        initialContent={initialContent}
        onConfirm={onConfirm}
        onCancel={onCancel}
        minimal={minimal}
        showInsertMenu={showInsertMenu}
        variant={variant}
      />
    </EditorProvider>
  );
};

const MemoEditorImpl: React.FC<MemoEditorProps> = ({
  className,
  cacheKey,
  memoName,
  parentMemoName,
  autoFocus,
  placeholder,
  initialContent,
  onConfirm,
  onCancel,
  minimal,
  showInsertMenu,
  variant = "default",
}) => {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const editorRef = useRef<EditorRefActions>(null);
  const { state, actions, dispatch } = useEditorContext();
  const { userGeneralSetting } = useAuth();

  // Get default visibility from user settings
  const defaultVisibility =
    variant === "publish"
      ? Visibility.PROTECTED
      : userGeneralSetting?.memoVisibility
        ? convertVisibilityFromString(userGeneralSetting.memoVisibility)
        : undefined;

  useMemoInit(editorRef, memoName, cacheKey, currentUser?.name ?? "", autoFocus, defaultVisibility, initialContent);

  // Auto-save content to localStorage
  useAutoSave(state.content, currentUser?.name ?? "", cacheKey);

  // Focus mode management with body scroll lock
  useFocusMode(state.ui.isFocusMode);

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  useKeyboard(editorRef, { onSave: handleSave });

  async function handleSave() {
    // Validate before saving
    const { valid, reason } = validationService.canSave(state);
    if (!valid) {
      toast.error(reason || "Cannot save");
      return;
    }

    dispatch(actions.setLoading("saving", true));

    try {
      const effectiveDisplayTime = state.timestamps.displayTimeIsManual ? state.timestamps.displayTime : new Date();
      const result = await memoService.save(
        {
          ...state,
          timestamps: {
            ...state.timestamps,
            displayTime: effectiveDisplayTime,
            createTime: effectiveDisplayTime,
            updateTime: effectiveDisplayTime,
          },
        },
        { memoName, parentMemoName },
      );

      if (!result.hasChanges) {
        toast.error(t("editor.no-changes-detected"));
        onCancel?.();
        return;
      }

      // Clear localStorage cache on successful save
      cacheService.clear(cacheService.key(currentUser?.name ?? "", cacheKey));

      // Reset active/inactive memo list queries to avoid infinite-query pagination gaps
      // when creating memos with custom display times.
      const invalidationPromises = [
        queryClient.resetQueries({ queryKey: memoKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: userKeys.stats() }),
      ];

      // If this was a comment, also invalidate the comments query for the parent memo
      if (parentMemoName) {
        invalidationPromises.push(queryClient.invalidateQueries({ queryKey: memoKeys.comments(parentMemoName) }));
      }

      await Promise.all(invalidationPromises);

      // Reset editor state to initial values
      dispatch(actions.reset());

      // Notify parent component of successful save
      onConfirm?.(result.memoName);
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to save memo",
        fallbackMessage: errorService.getErrorMessage(error),
      });
    } finally {
      dispatch(actions.setLoading("saving", false));
    }
  }

  return (
    <>
      <FocusModeOverlay isActive={state.ui.isFocusMode} onToggle={handleToggleFocusMode} />

      {/*
        Layout structure:
        - Uses justify-between to push content to top and bottom
        - In focus mode: becomes fixed with specific spacing, editor grows to fill space
        - In normal mode: stays relative with max-height constraint
      */}
      <div
        className={cn(
          "memo-editor-container group relative w-full flex flex-col justify-between items-start bg-background/95 px-5 pt-4 pb-1 rounded-2xl border border-border/60 gap-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition-all duration-300 hover:border-primary/30",
          FOCUS_MODE_STYLES.transition,
          state.ui.isFocusMode && cn(FOCUS_MODE_STYLES.container.base, FOCUS_MODE_STYLES.container.spacing),
          variant === "publish" && "min-h-[160px] pt-3 pb-5 bg-background/85 backdrop-blur-sm shadow-[0_18px_40px_rgba(15,23,42,0.16)]",
          className,
        )}
      >
        {variant === "publish" && (
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl">
            <div className="h-[30%] w-full bg-gradient-to-br from-emerald-50/70 via-muted/30 to-transparent" />
          </div>
        )}
        {/* Exit button is absolutely positioned in top-right corner when active */}
        <FocusModeExitButton isActive={state.ui.isFocusMode} onToggle={handleToggleFocusMode} title={t("editor.exit-focus-mode")} />

        {variant === "publish" && (
          <EditorToolbar
            onSave={handleSave}
            onCancel={onCancel}
            memoName={memoName}
            minimal={minimal}
            showInsertMenu={showInsertMenu}
            variant={variant}
          />
        )}

        {/* Editor content grows to fill available space in focus mode */}
        <EditorContent ref={editorRef} placeholder={placeholder} autoFocus={autoFocus} variant={variant} />

        {/* Metadata and toolbar grouped together at bottom */}
        <div className="w-full flex flex-col gap-2 z-10">
          <EditorMetadata memoName={memoName} minimal={minimal} variant={variant} />
          {variant !== "publish" && (
            <EditorToolbar
              onSave={handleSave}
              onCancel={onCancel}
              memoName={memoName}
              minimal={minimal}
              showInsertMenu={showInsertMenu}
              variant={variant}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default MemoEditor;
