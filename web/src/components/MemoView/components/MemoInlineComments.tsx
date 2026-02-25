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
  const displayCount = comments.length;
  const needsExpand = displayCount > 3;

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

  const hasComments = comments.length > 0;
  const canWriteComment = Boolean(currentUser);

  const sortedComments = [...comments].sort((a, b) => {
    const aTime = (a.createTime ? timestampDate(a.createTime) : a.displayTime ? timestampDate(a.displayTime) : undefined)?.getTime() ?? 0;
    const bTime = (b.createTime ? timestampDate(b.createTime) : b.displayTime ? timestampDate(b.displayTime) : undefined)?.getTime() ?? 0;
    return aTime - bTime;
  });
  const visibleComments = expanded || !needsExpand ? sortedComments : sortedComments.slice(-3);
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
    <section className={cn("mt-4 w-full border-0 bg-transparent px-0 py-0 shadow-none")}>
      {showEditor && (
        <div className="mt-3">
          <MemoEditor
            className="border border-border/60 rounded-2xl bg-background/80 shadow-none"
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

      <div className="mt-3 flex flex-col gap-2">
        {visibleComments.map((comment) => (
          <InlineCommentItem key={`${comment.name}-${comment.updateTime}`} memo={comment} onReply={handleReply} />
        ))}
        {needsExpand && !expanded && (
          <button
            type="button"
            className="self-start text-xs text-muted-foreground/80 hover:text-primary transition-colors"
            onClick={handleToggleExpanded}
          >
            {t("memo.comment.toggle-comments")}
            {displayCount > 0 && <span className="ml-1">({displayCount})</span>}
          </button>
        )}
        {needsExpand && expanded && (
          <button
            type="button"
            className="self-start text-xs text-muted-foreground/80 hover:text-primary transition-colors"
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

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/25 px-3 py-2 text-sm transition-colors",
        canReply && "cursor-pointer hover:border-primary/40 hover:bg-muted/40",
      )}
      onClick={canReply ? () => onReply?.(memo, creatorName) : undefined}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
        <UserAvatar className="h-4 w-4" avatarUrl={creator?.avatarUrl} />
        {commentTime && <span>{commentTime.toLocaleString()}</span>}
      </div>
      {content && <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{content}</p>}
    </div>
  );
};

export default MemoInlineComments;
