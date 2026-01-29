import { Link } from "react-router-dom";
import { extractMemoIdFromName } from "@/helpers/resource-names";
import { cn } from "@/lib/utils";
import type { MemoRelation_Memo } from "@/types/proto/api/v1/memo_service_pb";

interface RelationCardProps {
  memo: MemoRelation_Memo;
  parentPage?: string;
  className?: string;
}

const RelationCard = ({ memo, parentPage, className }: RelationCardProps) => {
  const memoId = extractMemoIdFromName(memo.name);

  return (
    <Link
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground/80 hover:text-foreground hover:bg-white/5 border border-white/5 hover:border-primary/40 transition-all group shadow-[0_10px_25px_rgba(4,8,20,0.35)]",
        className,
      )}
      to={`/${memo.name}`}
      viewTransition
      state={{ from: parentPage }}
    >
      <span className="text-[0.6rem] font-mono px-2 py-0.5 rounded-full border border-white/10 bg-white/5 group-hover:text-primary group-hover:border-primary/50 transition-colors shrink-0 tracking-[0.3em]">
        {memoId.slice(0, 6)}
      </span>
      <span className="truncate text-sm">{memo.snippet}</span>
    </Link>
  );
};

export default RelationCard;
