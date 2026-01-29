import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { MasonryColumn } from "./MasonryColumn";
import { MasonryViewProps, MemoRenderContext } from "./types";
import { useMasonryLayout } from "./useMasonryLayout";

const MasonryView = ({ memoList, renderer, prefixElement, listMode = false }: MasonryViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefixElementRef = useRef<HTMLDivElement>(null);

  const { columns, distribution, handleHeightChange } = useMasonryLayout(memoList, listMode, containerRef, prefixElementRef);

  // Create render context: always enable compact mode for list views
  const renderContext: MemoRenderContext = useMemo(
    () => ({
      compact: true,
      columns,
    }),
    [columns],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full grid gap-4 lg:gap-6 relative",
        "before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/5 before:via-transparent before:to-white/5 before:opacity-40 before:pointer-events-none",
        "after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_top,rgba(156,132,255,0.12),transparent_45%)] after:pointer-events-none",
      )}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: columns }).map((_, columnIndex) => (
        <MasonryColumn
          key={columnIndex}
          memoIndices={distribution[columnIndex] || []}
          memoList={memoList}
          renderer={renderer}
          renderContext={renderContext}
          onHeightChange={handleHeightChange}
          isFirstColumn={columnIndex === 0}
          prefixElement={prefixElement}
          prefixElementRef={prefixElementRef}
        />
      ))}
    </div>
  );
};

export default MasonryView;
