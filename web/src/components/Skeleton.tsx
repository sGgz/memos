import { cn } from "@/lib/utils";

interface SkeletonProps {
  showCreator?: boolean;
  count?: number;
}

const skeletonBase = "bg-gradient-to-r from-card/15 via-card/30 to-card/15 rounded-full animate-pulse";

const MemoCardSkeleton = ({ showCreator, index }: { showCreator?: boolean; index: number }) => (
  <div className="relative flex flex-col bg-gradient-to-br from-card/80 via-card/60 to-card/80 w-full px-5 py-4 mb-4 gap-3 rounded-2xl border border-border/50 shadow-[0_30px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl">
    <div className="w-full flex justify-between items-center gap-2">
      <div className="grow flex items-center max-w-[calc(100%-8rem)]">
        {showCreator ? (
          <div className="w-full flex items-center gap-2">
            <div className={cn("w-8 h-8 rounded-full shrink-0", skeletonBase)} />
            <div className="flex flex-col gap-1">
              <div className={cn("h-4 w-24", skeletonBase)} />
              <div className={cn("h-3 w-16", skeletonBase)} />
            </div>
          </div>
        ) : (
          <div className={cn("h-4 w-32", skeletonBase)} />
        )}
      </div>
      <div className="flex gap-2">
        <div className={cn("w-6 h-6", skeletonBase)} />
        <div className={cn("w-6 h-6", skeletonBase)} />
      </div>
    </div>
    <div className="space-y-3">
      <div className={cn("h-4", skeletonBase, index % 3 === 0 ? "w-full" : index % 3 === 1 ? "w-4/5" : "w-5/6")} />
      <div className={cn("h-4", skeletonBase, index % 2 === 0 ? "w-3/4" : "w-4/5")} />
      {index % 2 === 0 && <div className={cn("h-4 w-2/3", skeletonBase)} />}
    </div>
  </div>
);

/**
 * Memo list loading skeleton - shows card structure while loading.
 * Only use for memo lists in PagedMemoList component.
 */
const Skeleton = ({ showCreator = false, count = 4 }: SkeletonProps) => (
  <div className="w-full max-w-2xl mx-auto">
    {Array.from({ length: count }, (_, i) => (
      <MemoCardSkeleton key={i} showCreator={showCreator} index={i} />
    ))}
  </div>
);

export default Skeleton;
