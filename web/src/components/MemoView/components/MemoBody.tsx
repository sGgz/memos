import { cn } from "@/lib/utils";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemoContent from "../../MemoContent";
import { MemoReactionListView } from "../../MemoReactionListView";
import { useMemoViewContext } from "../MemoViewContext";
import type { MemoBodyProps } from "../types";
import { AttachmentList, LocationDisplay, RelationList } from "./metadata";

const MemoBody: React.FC<MemoBodyProps> = ({ compact, onContentClick, onContentDoubleClick, onToggleNsfwVisibility }) => {
  const t = useTranslate();

  const { memo, parentPage, showNSFWContent, nsfw } = useMemoViewContext();

  const referencedMemos = memo.relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);

  return (
    <>
      <div
        className={cn(
          "w-full flex flex-col justify-start items-start gap-4 text-[1.05rem] leading-7 tracking-[0.01em] text-foreground/85 transition-all",
          nsfw && !showNSFWContent && "blur-lg transition-all duration-200",
        )}
      >
        <MemoContent
          key={`${memo.name}-${memo.updateTime}`}
          className="memo-content-block w-full rounded-[24px] bg-gradient-to-br from-white/90 via-white to-white/80 px-1 shadow-[inset_0_1px_0_rgba(93,156,111,0.12)]"
          content={memo.content}
          onClick={onContentClick}
          onDoubleClick={onContentDoubleClick}
          compact={memo.pinned ? false : compact} // Always show full content when pinned
        />
        <AttachmentList attachments={memo.attachments} />
        <RelationList relations={referencedMemos} currentMemoName={memo.name} parentPage={parentPage} />
        {memo.location && <LocationDisplay location={memo.location} />}
        <MemoReactionListView memo={memo} reactions={memo.reactions} />
      </div>

      {/* NSFW content overlay */}
      {nsfw && !showNSFWContent && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-[#05060f]/80 via-[#05060f]/40 to-transparent rounded-2xl backdrop-blur-sm" />
          <button
            type="button"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 py-2.5 px-5 text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase border border-white/20 rounded-full bg-card/60 hover:bg-card/90 hover:text-foreground transition-all"
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
