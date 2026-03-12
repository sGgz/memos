import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useEffect, useState } from "react";
import MemoEditor from "@/components/MemoEditor";
import UserAvatar from "@/components/UserAvatar";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoComments } from "@/hooks/useMemoQueries";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useMemoViewContext } from "../MemoViewContext";

interface MemoInlineCommentsProps {
  memoName: string;
  forceEditorOpen?: boolean;
  onForceEditorClose?: () => void;
}

const COLLAPSED_COMMENT_COUNT = 3;
const COLLAPSED_CONTENT_LENGTH = 140;

const MemoInlineComments = ({ memoName, forceEditorOpen, onForceEditorClose }: MemoInlineCommentsProps) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { memo } = useMemoViewContext();
  const [expanded, setExpanded] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ memo: Memo; authorName: string } | null>(null);

  const { data: commentsResponse, isLoading } = useMemoComments(memoName, {
    enabled: true,
  });
  const comments = commentsResponse?.memos ?? [];
  const renderableComments = comments.filter((comment) => Boolean(comment.content?.trim()));
  const displayCount = renderableComments.length;
  const needsExpand = displayCount > COLLAPSED_COMMENT_COUNT;

  const handleToggleExpanded = () => {
    setExpanded((prev) => !prev);
  };

  const handleCommentCreated = () => {
    setShowEditor(false);
    setReplyTarget(null);
    setExpanded(true);
    onForceEditorClose?.();
  };

  if (memo.parent) {
    return null;
  }

  const hasComments = renderableComments.length > 0;
  const canWriteComment = Boolean(currentUser);

  const sortedComments = [...renderableComments].sort((a, b) => {
    const aTime = (a.createTime ? timestampDate(a.createTime) : a.displayTime ? timestampDate(a.displayTime) : undefined)?.getTime() ?? 0;
    const bTime = (b.createTime ? timestampDate(b.createTime) : b.displayTime ? timestampDate(b.displayTime) : undefined)?.getTime() ?? 0;
    return aTime - bTime;
  });
  const visibleComments = expanded || !needsExpand ? sortedComments : sortedComments.slice(0, COLLAPSED_COMMENT_COUNT);
  const currentUserName = currentUser?.displayName || currentUser?.username || t("common.user");
  const replyPrefix = replyTarget ? `${currentUserName}回复${replyTarget.authorName}：` : undefined;

  const handleReply = (memo: Memo, authorName: string) => {
    if (!canWriteComment) {
      return;
    }
    setReplyTarget({ memo, authorName });
    setShowEditor(true);
    setExpanded(true);
  };

  useEffect(() => {
    if (forceEditorOpen && !showEditor && canWriteComment) {
      setReplyTarget(null);
      setShowEditor(true);
    }
  }, [forceEditorOpen, showEditor, canWriteComment]);

  if (!isLoading && !hasComments && !showEditor) {
    if (!canWriteComment) {
      return null;
    }
    return null;
  }

  return (
    <section className={cn("mt-2 w-full border-0 bg-transparent px-0 py-0 shadow-none")}>
      {showEditor && (
        <div className="mt-2">
          <MemoEditor
            className="border border-border/60 bg-background/80 shadow-none"
            cacheKey={replyTarget ? `${memoName}-inline-comment-reply-${replyTarget.memo.name}` : `${memoName}-inline-comment`}
            placeholder={t("editor.add-your-comment-here")}
            initialContent={replyPrefix}
            parentMemoName={memoName}
            autoFocus
            onConfirm={handleCommentCreated}
            onCancel={() => {
              setShowEditor(false);
              setReplyTarget(null);
              onForceEditorClose?.();
            }}
            minimal
            showInsertMenu={false}
            key={replyTarget ? `inline-comment-reply-${replyTarget.memo.name}` : "inline-comment-new"}
          />
        </div>
      )}

      <div className="mt-1 flex flex-col gap-1.5">
        {visibleComments.map((comment) => (
          <InlineCommentItem key={`${comment.name}-${comment.updateTime}`} memo={comment} onReply={handleReply} />
        ))}
        {needsExpand && !expanded && (
          <button
            type="button"
            className="self-start px-1 text-xs text-muted-foreground/80 hover:text-primary transition-colors"
            onClick={handleToggleExpanded}
          >
            {t("memo.comment.toggle-comments")}
            {displayCount > 0 && <span className="ml-1">({displayCount})</span>}
          </button>
        )}
        {needsExpand && expanded && (
          <button
            type="button"
            className="self-start px-1 text-xs text-muted-foreground/80 hover:text-primary transition-colors"
            onClick={handleToggleExpanded}
          >
            {t("common.collapse")}
          </button>
        )}
      </div>
    </section>
  );
};

const InlineCommentItem = ({ memo, onReply }: { memo: Memo; onReply?: (memo: Memo, authorName: string) => void }) => {
  const t = useTranslate();
  const { data: creator } = useUser(memo.creator);
  const content = memo.content?.trim();
  const creatorName = creator?.displayName || creator?.username || t("common.user");
  const canReply = Boolean(onReply);
  const commentTime = memo.createTime ? timestampDate(memo.createTime) : memo.displayTime ? timestampDate(memo.displayTime) : undefined;
  const [contentExpanded, setContentExpanded] = useState(false);
  const needsContentExpand = Boolean(content && (content.length > COLLAPSED_CONTENT_LENGTH || content.includes("\n")));

  if (!content) {
    return null;
  }

  return (
    <div
      className={cn(
        "border border-border/50 bg-muted/20 px-3 py-1.5 text-sm transition-colors",
        canReply && "cursor-pointer hover:border-primary/35 hover:bg-muted/35",
      )}
      onClick={canReply ? () => onReply?.(memo, creatorName) : undefined}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
        <UserAvatar className="h-3.5 w-3.5" avatarUrl={creator?.avatarUrl} />
        {commentTime && <span>{commentTime.toLocaleString()}</span>}
      </div>
      <p className={cn("mt-0.5 whitespace-pre-wrap text-sm text-foreground/90", !contentExpanded && needsContentExpand && "line-clamp-2")}>
        {content}
      </p>
      {needsContentExpand && (
        <button
          type="button"
          className="mt-0.5 text-xs text-muted-foreground/80 hover:text-primary transition-colors"
          onClick={(event) => {
            event.stopPropagation();
            setContentExpanded((prev) => !prev);
          }}
        >
          {contentExpanded ? t("common.collapse") : "查看全部"}
        </button>
      )}
    </div>
  );
};

export default MemoInlineComments;
