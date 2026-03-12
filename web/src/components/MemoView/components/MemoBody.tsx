import { MessageCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemoActionMenu from "../../MemoActionMenu";
import MemoContent from "../../MemoContent";
import { MemoReactionListView, ReactionSelector } from "../../MemoReactionListView";
import { useMemoViewContext } from "../MemoViewContext";
import type { MemoBodyProps } from "../types";
import { AttachmentList, LocationDisplay, RelationList } from "./metadata";

const MemoBody: React.FC<MemoBodyProps> = ({
  compact,
  onContentClick,
  onContentDoubleClick,
  onToggleNsfwVisibility,
  onAttachmentImageClick,
  onCommentClick,
  showActionBar,
  onEdit,
}) => {
  const t = useTranslate();

  const { memo, parentPage, showNSFWContent, nsfw, currentUser, isArchived, readonly } = useMemoViewContext();

  const referencedMemos = memo.relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);

  return (
    <>
      <div
        className={cn(
          "w-full flex flex-col justify-start items-start gap-2.5 text-[0.98rem] leading-6 tracking-[0.01em] text-foreground transition-all",
          nsfw && !showNSFWContent && "blur-lg transition-all duration-200",
        )}
      >
        <MemoContent
          key={`${memo.name}-${memo.updateTime}`}
          className="memo-content-block w-full bg-transparent px-0 pt-0 text-foreground"
          content={memo.content}
          onClick={onContentClick}
          onDoubleClick={onContentDoubleClick}
          compact={memo.pinned ? false : compact} // Always show full content when pinned
        />
        <AttachmentList attachments={memo.attachments} onImagePreviewOpen={onAttachmentImageClick} />
        <RelationList relations={referencedMemos} currentMemoName={memo.name} parentPage={parentPage} />
        {memo.location && <LocationDisplay location={memo.location} />}
        <div className="w-full flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <MemoReactionListView memo={memo} reactions={memo.reactions} />
          </div>
          {showActionBar && (
            <div className="shrink-0 ml-auto pr-2 flex items-center gap-2 whitespace-nowrap text-muted-foreground/70">
              {currentUser && !isArchived && <ReactionSelector memo={memo} className="h-7 w-7 border border-border/60" />}
              {currentUser && !isArchived && (
                <button
                  type="button"
                  className="flex items-center justify-center rounded-md p-1 hover:text-foreground"
                  onClick={onCommentClick}
                  aria-label="Write a comment"
                >
                  <MessageCircleIcon className="h-4 w-4" />
                </button>
              )}
              <MemoActionMenu memo={memo} readonly={readonly} onEdit={onEdit ?? (() => {})} />
            </div>
          )}
        </div>
      </div>

      {/* NSFW content overlay */}
      {nsfw && !showNSFWContent && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/40 to-transparent backdrop-blur-sm" />
          <button
            type="button"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 py-2.5 px-5 text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase border border-foreground/20 rounded-full bg-card/70 hover:bg-card/90 hover:text-foreground transition-all"
            onClick={onToggleNsfwVisibility}
          >
            {t("memo.click-to-show-nsfw-content")}
          </button>
        </>
      )}
    </>
  );
};

export default MemoBody;
