import { forwardRef } from "react";
import { toast } from "react-hot-toast";
import { MAX_MEMO_ATTACHMENTS } from "../constants";
import Editor, { type EditorRefActions } from "../Editor";
import { useBlobUrls, useDragAndDrop } from "../hooks";
import { useEditorContext } from "../state";
import type { EditorContentProps } from "../types";
import type { LocalFile } from "../types/attachment";

export const EditorContent = forwardRef<EditorRefActions, EditorContentProps>(({ placeholder, variant = "default" }, ref) => {
  const { state, actions, dispatch } = useEditorContext();
  const { createBlobUrl } = useBlobUrls();

  const { dragHandlers } = useDragAndDrop((files: FileList) => {
    const localFiles: LocalFile[] = Array.from(files).map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
    }));

    const currentCount = state.metadata.attachments.length + state.localFiles.length;
    const availableSlots = Math.max(MAX_MEMO_ATTACHMENTS - currentCount, 0);

    if (availableSlots <= 0) {
      toast.error(`最多只能上传 ${MAX_MEMO_ATTACHMENTS} 张图片`);
      return;
    }

    if (localFiles.length > availableSlots) {
      toast.error(`最多只能上传 ${MAX_MEMO_ATTACHMENTS} 张图片`);
    }

    localFiles.slice(0, availableSlots).forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
  });

  const handleCompositionStart = () => {
    dispatch(actions.setComposing(true));
  };

  const handleCompositionEnd = () => {
    dispatch(actions.setComposing(false));
  };

  const handleContentChange = (content: string) => {
    dispatch(actions.updateContent(content));
  };

  const handlePaste = () => {
    // Paste handling is managed by the Editor component internally
  };

  return (
    <div className={variant === "publish" ? "w-full flex flex-col flex-1 mt-0" : "w-full flex flex-col flex-1"} {...dragHandlers}>
      <Editor
        ref={ref}
        className="memo-editor-content"
        initialContent={state.content}
        placeholder={placeholder || ""}
        isFocusMode={state.ui.isFocusMode}
        isInIME={state.ui.isComposing}
        variant={variant}
        onContentChange={handleContentChange}
        onPaste={handlePaste}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      />
    </div>
  );
});

EditorContent.displayName = "EditorContent";
