import { timestampDate } from "@bufbuild/protobuf/wkt";
import { MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import MemoEditor from "@/components/MemoEditor";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoComments } from "@/hooks/useMemoQueries";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useMemoViewContext } from "../MemoViewContext";

interface MemoInlineCommentsProps {
  memoName: string;
}

const MemoInlineComments = ({ memoName }: MemoInlineCommentsProps) => {
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

  if (!isLoading && !hasComments && !showEditor) {
    if (!canWriteComment) {
      return null;
    }
    return (
      <div className="mt-3 w-full flex justify-end">
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setShowEditor(true)}>
          <MessageCircleIcon className="mr-1 h-4 w-4" />
          {t("memo.comment.write-a-comment")}
        </Button>
      </div>
    );
  }

  const handleStartComment = () => {
    setReplyTarget(null);
    setShowEditor(true);
  };

  const handleReply = (memo: Memo, authorName: string) => {
    if (!canWriteComment) {
      return;
    }
    setReplyTarget({ memo, authorName });
    setShowEditor(true);
    setExpanded(true);
  };

  return (
    <section
      className={cn("mt-4 w-full rounded-2xl border border-border/60 bg-card/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]")}
    >
      <div className="flex items-center justify-between gap-2">
        {needsExpand ? (
          <button
            type="button"
            className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground/80 hover:text-primary transition-colors"
            onClick={handleToggleExpanded}
          >
            <MessageCircleIcon className="w-4 h-4" />
            {expanded ? t("common.collapse") : t("memo.comment.toggle-comments")}
            {displayCount > 0 && <span className="text-[0.65rem] text-muted-foreground/70">({displayCount})</span>}
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground/80">
            <MessageCircleIcon className="w-4 h-4" />
            {t("memo.comment.self")}
            {displayCount > 0 && <span className="text-[0.65rem] text-muted-foreground/70">({displayCount})</span>}
          </div>
        )}
        {currentUser && !showEditor && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleStartComment}>
            {t("memo.comment.write-a-comment")}
          </Button>
        )}
      </div>

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
            }}
            minimal
            key={replyTarget ? `inline-comment-reply-${replyTarget.memo.name}` : "inline-comment-new"}
          />
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {visibleComments.map((comment) => (
          <InlineCommentItem key={`${comment.name}-${comment.updateTime}`} memo={comment} onReply={handleReply} />
        ))}
        {needsExpand && expanded && (
          <button
            type="button"
            className="self-start text-xs uppercase tracking-[0.3em] text-muted-foreground/80 hover:text-primary transition-colors"
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

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border/50 bg-background/80 px-3 py-1.5 text-sm transition-colors",
        canReply && "cursor-pointer hover:border-primary/40 hover:bg-accent/10",
      )}
      onClick={canReply ? () => onReply?.(memo, creatorName) : undefined}
    >
      <UserAvatar className="h-7 w-7" avatarUrl={creator?.avatarUrl} />
      <div className="min-w-0 flex-1 pt-1">{content && <p className="whitespace-pre-wrap text-sm text-foreground/90">{content}</p>}</div>
    </div>
  );
};

export default MemoInlineComments;
