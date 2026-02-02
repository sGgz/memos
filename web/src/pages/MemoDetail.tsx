import { timestampDate } from "@bufbuild/protobuf/wkt";
import { ConnectError } from "@connectrpc/connect";
import { ArrowUpLeftFromCircleIcon, MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useLocation, useParams } from "react-router-dom";
import { MemoDetailSidebar, MemoDetailSidebarDrawer } from "@/components/MemoDetailSidebar";
import MemoEditor from "@/components/MemoEditor";
import MemoView from "@/components/MemoView";
import MobileHeader from "@/components/MobileHeader";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { memoNamePrefix } from "@/helpers/resource-names";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useMemo, useMemoComments } from "@/hooks/useMemoQueries";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const MemoDetail = () => {
  const t = useTranslate();
  const md = useMediaQuery("md");
  const params = useParams();
  const navigateTo = useNavigateTo();
  const { state: locationState } = useLocation();
  const currentUser = useCurrentUser();
  const uid = params.uid;
  const memoName = `${memoNamePrefix}${uid}`;
  const [showCommentEditor, setShowCommentEditor] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ memo: Memo; authorName: string } | null>(null);

  // Fetch main memo with React Query
  const { data: memo, error, isLoading } = useMemo(memoName, { enabled: !!memoName });

  // Handle errors
  if (error) {
    toast.error((error as ConnectError).message);
    navigateTo("/403");
  }

  // Fetch parent memo if exists
  const { data: parentMemo } = useMemo(memo?.parent || "", {
    enabled: !!memo?.parent,
  });

  // Fetch all comments for this memo in a single query
  const { data: commentsResponse } = useMemoComments(memoName, {
    enabled: !!memo,
  });
  const comments = commentsResponse?.memos || [];

  const showCreateCommentButton = currentUser && !showCommentEditor;
  const sortedComments = [...comments].sort((a, b) => {
    const aTime = (a.createTime ? timestampDate(a.createTime) : a.displayTime ? timestampDate(a.displayTime) : undefined)?.getTime() ?? 0;
    const bTime = (b.createTime ? timestampDate(b.createTime) : b.displayTime ? timestampDate(b.displayTime) : undefined)?.getTime() ?? 0;
    return aTime - bTime;
  });
  const currentUserName = currentUser?.displayName || currentUser?.username || t("common.user");
  const replyPrefix = replyTarget ? `${currentUserName}回复${replyTarget.authorName}：` : undefined;

  if (isLoading || !memo) {
    return null;
  }

  const handleShowCommentEditor = () => {
    setReplyTarget(null);
    setShowCommentEditor(true);
  };

  const handleCommentCreated = async (_memoCommentName: string) => {
    // React Query will auto-refetch due to invalidation in the mutation
    setShowCommentEditor(false);
    setReplyTarget(null);
  };
  const handleReply = (memo: Memo, authorName: string) => {
    if (!currentUser) {
      return;
    }
    setReplyTarget({ memo, authorName });
    setShowCommentEditor(true);
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && (
        <MobileHeader>
          <MemoDetailSidebarDrawer memo={memo} parentPage={locationState?.from} />
        </MobileHeader>
      )}
      <div className={cn("w-full flex flex-row justify-start items-start px-4 sm:px-6 gap-4")}>
        <div className={cn("w-full md:w-[calc(100%-15rem)]")}>
          {parentMemo && (
            <div className="w-auto inline-block mb-2">
              <Link
                className="px-3 py-1 border border-border rounded-lg max-w-xs w-auto text-sm flex flex-row justify-start items-center flex-nowrap text-muted-foreground hover:shadow hover:opacity-80"
                to={`/${parentMemo.name}`}
                state={locationState}
                viewTransition
              >
                <ArrowUpLeftFromCircleIcon className="w-4 h-auto shrink-0 opacity-60 mr-2" />
                <span className="truncate">{parentMemo.content}</span>
              </Link>
            </div>
          )}
          <MemoView
            key={`${memo.name}-${memo.displayTime}`}
            className="!shadow-[0_45px_95px_rgba(0,0,0,0.25)] !border-border/60"
            memo={memo}
            compact={false}
            parentPage={locationState?.from}
            showCreator
            showVisibility
            showPinned
            showNsfwContent
            showComments={false}
          />
          <div className="pt-8 pb-16 w-full">
            <h2 id="comments" className="sr-only">
              {t("memo.comment.self")}
            </h2>
            <div className="relative mx-auto grow w-full min-h-full flex flex-col justify-start items-start gap-y-1">
              {comments.length > 0 && (
                <>
                  <div className="w-full flex flex-row justify-between items-center h-8 pl-3 mb-2">
                    <div className="flex flex-row justify-start items-center">
                      <MessageCircleIcon className="w-5 h-auto text-muted-foreground mr-1" />
                      <span className="text-muted-foreground text-sm">{t("memo.comment.self")}</span>
                      <span className="text-muted-foreground text-sm ml-1">({comments.length})</span>
                    </div>
                    {showCreateCommentButton && (
                      <Button variant="ghost" className="text-muted-foreground" onClick={handleShowCommentEditor}>
                        {t("memo.comment.write-a-comment")}
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {sortedComments.map((comment) => (
                      <CommentItem key={`${comment.name}-${comment.displayTime}`} memo={comment} onReply={handleReply} />
                    ))}
                  </div>
                </>
              )}
              {comments.length === 0 && showCreateCommentButton && !showCommentEditor && (
                <div className="w-full flex flex-row justify-center items-center py-6">
                  <Button variant="ghost" onClick={handleShowCommentEditor}>
                    <span className="text-muted-foreground">{t("memo.comment.write-a-comment")}</span>
                    <MessageCircleIcon className="ml-2 w-5 h-auto text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
            {showCommentEditor && (
              <div className="w-full">
                <MemoEditor
                  cacheKey={
                    replyTarget
                      ? `${memo.name}-${memo.updateTime}-comment-reply-${replyTarget.memo.name}`
                      : `${memo.name}-${memo.updateTime}-comment`
                  }
                  placeholder={t("editor.add-your-comment-here")}
                  initialContent={replyPrefix}
                  parentMemoName={memo.name}
                  autoFocus
                  onConfirm={handleCommentCreated}
                  onCancel={() => {
                    setShowCommentEditor(false);
                    setReplyTarget(null);
                  }}
                  minimal
                  key={replyTarget ? `detail-comment-reply-${replyTarget.memo.name}` : "detail-comment-new"}
                />
              </div>
            )}
          </div>
        </div>
        {md && (
          <div className="sticky top-0 left-0 shrink-0 -mt-6 w-56 h-full">
            <MemoDetailSidebar className="py-6" memo={memo} parentPage={locationState?.from} />
          </div>
        )}
      </div>
    </section>
  );
};

const CommentItem = ({ memo, onReply }: { memo: Memo; onReply?: (memo: Memo, authorName: string) => void }) => {
  const t = useTranslate();
  const { data: creator } = useUser(memo.creator);
  const content = memo.content?.trim();
  const creatorName = creator?.displayName || creator?.username || t("common.user");
  const canReply = Boolean(onReply);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border/50 bg-card/70 px-4 py-2 transition-colors",
        canReply && "cursor-pointer hover:border-primary/40 hover:bg-accent/10",
      )}
      onClick={canReply ? () => onReply?.(memo, creatorName) : undefined}
    >
      <UserAvatar className="h-8 w-8" avatarUrl={creator?.avatarUrl} />
      <div className="min-w-0 flex-1 pt-1">{content && <p className="whitespace-pre-wrap text-sm text-foreground/90">{content}</p>}</div>
    </div>
  );
};

export default MemoDetail;
