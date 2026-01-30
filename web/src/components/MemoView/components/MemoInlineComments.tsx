import { MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import MemoEditor from "@/components/MemoEditor";
import MemoView from "@/components/MemoView";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoComments } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { useMemoViewContext } from "../MemoViewContext";

interface MemoInlineCommentsProps {
  memoName: string;
  parentPage: string;
}

const MemoInlineComments = ({ memoName, parentPage }: MemoInlineCommentsProps) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { memo } = useMemoViewContext();
  const [expanded, setExpanded] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const { data: commentsResponse, isLoading } = useMemoComments(memoName, {
    enabled: true,
  });
  const comments = commentsResponse?.memos ?? [];
  const displayCount = comments.length;

  const handleToggleExpanded = () => {
    setExpanded((prev) => !prev);
  };

  const handleCommentCreated = () => {
    setShowEditor(false);
    setExpanded(true);
  };

  if (memo.parent) {
    return null;
  }

  return (
    <section
      className={cn("mt-4 w-full rounded-2xl border border-border/60 bg-white/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(15,102,64,0.08)]")}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground/80 hover:text-primary transition-colors"
          onClick={handleToggleExpanded}
        >
          <MessageCircleIcon className="w-4 h-4" />
          {t("memo.comment.toggle-comments")}
          {displayCount > 0 && <span className="text-[0.65rem] text-muted-foreground/70">({displayCount})</span>}
        </button>
        {currentUser && !showEditor && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowEditor(true)}>
            {t("memo.comment.write-a-comment")}
          </Button>
        )}
      </div>

      {showEditor && (
        <div className="mt-3">
          <MemoEditor
            className="border border-border/60 rounded-2xl bg-background/80 shadow-none"
            cacheKey={`${memoName}-inline-comment`}
            placeholder={t("editor.add-your-comment-here")}
            parentMemoName={memoName}
            autoFocus
            onConfirm={handleCommentCreated}
            onCancel={() => setShowEditor(false)}
          />
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {!isLoading && comments.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-3">{t("memo.comment.no-comments-yet")}</p>
        )}
        {(expanded ? comments : comments.slice(0, 3)).map((comment) => (
          <MemoView
            key={`${comment.name}-${comment.updateTime}`}
            className="!border-transparent !bg-gradient-to-br !from-white !to-white/90 !shadow-[0_18px_40px_rgba(14,62,42,0.1)]"
            memo={comment}
            compact
            parentPage={parentPage}
            showCreator
          />
        ))}
        {comments.length > 3 && (
          <button
            type="button"
            className="self-start text-xs uppercase tracking-[0.3em] text-muted-foreground/80 hover:text-primary transition-colors"
            onClick={handleToggleExpanded}
          >
            {expanded ? t("common.collapse") : t("memo.comment.toggle-comments")}
          </button>
        )}
      </div>
    </section>
  );
};

export default MemoInlineComments;
