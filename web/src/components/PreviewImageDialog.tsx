import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imgUrls: string[];
  initialIndex?: number;
  sourceRects?: (DOMRect | null)[];
}

const SWIPE_THRESHOLD_RATIO = 0.18;
const SWIPE_TRANSITION = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
const EDGE_RESISTANCE = 0.35;

function PreviewImageDialog({ open, onOpenChange, imgUrls, initialIndex = 0 }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [visible, setVisible] = useState(open);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const startXRef = useRef<number | null>(null);
  const lastDeltaXRef = useRef(0);
  const isPointerSwipingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const safeIndex = Math.max(0, Math.min(currentIndex, Math.max(imgUrls.length - 1, 0)));
  const hasMultipleImages = imgUrls.length > 1;

  const viewportWidth = containerWidth || (typeof window !== "undefined" ? window.innerWidth : 0);

  const clampIndex = useCallback(
    (nextIndex: number) => {
      if (!imgUrls.length) {
        return 0;
      }
      return Math.max(0, Math.min(nextIndex, imgUrls.length - 1));
    },
    [imgUrls.length],
  );

  const applyEdgeResistance = useCallback(
    (deltaX: number) => {
      const atFirstImage = safeIndex === 0;
      const atLastImage = safeIndex === imgUrls.length - 1;

      if ((atFirstImage && deltaX > 0) || (atLastImage && deltaX < 0)) {
        return deltaX * EDGE_RESISTANCE;
      }

      return deltaX;
    },
    [safeIndex, imgUrls.length],
  );

  const showPrevImage = useCallback(() => {
    if (!hasMultipleImages || safeIndex === 0) {
      return;
    }
    setCurrentIndex((prev) => clampIndex(prev - 1));
  }, [hasMultipleImages, safeIndex, clampIndex]);

  const showNextImage = useCallback(() => {
    if (!hasMultipleImages || safeIndex >= imgUrls.length - 1) {
      return;
    }
    setCurrentIndex((prev) => clampIndex(prev + 1));
  }, [hasMultipleImages, safeIndex, imgUrls.length, clampIndex]);

  useEffect(() => {
    setCurrentIndex(clampIndex(initialIndex));
    setDragOffsetX(0);
  }, [initialIndex, clampIndex]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      return;
    }
    setVisible(false);
    setIsDragging(false);
    setDragOffsetX(0);
  }, [open]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const updateContainerWidth = () => {
      const width = containerRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      setContainerWidth(width);
    };

    updateContainerWidth();
    window.addEventListener("resize", updateContainerWidth);

    return () => {
      window.removeEventListener("resize", updateContainerWidth);
    };
  }, [visible]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!visible) {
        return;
      }

      switch (event.key) {
        case "Escape":
          onOpenChange(false);
          break;
        case "ArrowLeft":
          showPrevImage();
          break;
        case "ArrowRight":
          showNextImage();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible, onOpenChange, showNextImage, showPrevImage]);

  const handlePointerDown = (clientX: number) => {
    if (!hasMultipleImages) {
      return;
    }
    startXRef.current = clientX;
    lastDeltaXRef.current = 0;
    setIsDragging(true);
  };

  const handlePointerMove = (clientX: number) => {
    if (!hasMultipleImages || startXRef.current === null) {
      return;
    }

    const deltaX = clientX - startXRef.current;
    lastDeltaXRef.current = deltaX;
    if (Math.abs(deltaX) > 4) {
      isPointerSwipingRef.current = true;
    }

    setDragOffsetX(applyEdgeResistance(deltaX));
  };

  const handlePointerUp = () => {
    if (!hasMultipleImages || startXRef.current === null) {
      startXRef.current = null;
      setIsDragging(false);
      setDragOffsetX(0);
      return;
    }

    const deltaX = lastDeltaXRef.current;
    const threshold = viewportWidth * SWIPE_THRESHOLD_RATIO;
    const canMoveNext = safeIndex < imgUrls.length - 1;
    const canMovePrev = safeIndex > 0;

    if (Math.abs(deltaX) > threshold) {
      if (deltaX < 0 && canMoveNext) {
        setCurrentIndex((prev) => clampIndex(prev + 1));
      } else if (deltaX > 0 && canMovePrev) {
        setCurrentIndex((prev) => clampIndex(prev - 1));
      }
    }

    startXRef.current = null;
    setIsDragging(false);
    setDragOffsetX(0);
  };

  const trackTranslate = useMemo(() => {
    return -safeIndex * viewportWidth + dragOffsetX;
  }, [safeIndex, viewportWidth, dragOffsetX]);

  const dots = useMemo(
    () =>
      imgUrls.map((_, index) => (
        <span
          key={`dot-${index}`}
          className={cn("h-2 rounded-full transition-all duration-300", index === safeIndex ? "w-4 bg-white" : "w-2 bg-white/35")}
        />
      )),
    [imgUrls, safeIndex],
  );

  if (!imgUrls.length || !visible) {
    return null;
  }

  return (
    <Dialog
      open={visible}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="!fixed !inset-0 !top-0 !left-0 !w-screen !h-screen !max-w-none !max-h-none !translate-x-0 !translate-y-0 !rounded-none p-0 border-0 shadow-none bg-black [&>div]:!h-full [&>div]:!overflow-hidden"
        aria-describedby="image-preview-description"
      >
        <div
          ref={containerRef}
          className="fixed inset-0 touch-pan-y bg-black"
          onClick={() => {
            if (isPointerSwipingRef.current) {
              isPointerSwipingRef.current = false;
              return;
            }
            onOpenChange(false);
          }}
        >
          <div
            className="h-full flex"
            style={{
              width: `${imgUrls.length * viewportWidth}px`,
              transform: `translate3d(${trackTranslate}px, 0, 0)`,
              transition: isDragging ? "none" : SWIPE_TRANSITION,
            }}
            onMouseDown={(event) => handlePointerDown(event.clientX)}
            onMouseMove={(event) => handlePointerMove(event.clientX)}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={(event) => handlePointerDown(event.touches[0]?.clientX ?? 0)}
            onTouchMove={(event) => handlePointerMove(event.touches[0]?.clientX ?? 0)}
            onTouchEnd={handlePointerUp}
          >
            {imgUrls.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className="h-screen flex-shrink-0 flex items-center justify-center overflow-hidden bg-black"
                style={{ width: `${viewportWidth}px` }}
              >
                <img
                  src={url}
                  alt={`Preview image ${index + 1} of ${imgUrls.length}`}
                  className="w-full h-auto max-h-full object-contain select-none"
                  draggable={false}
                  loading={index === safeIndex ? "eager" : "lazy"}
                  decoding="async"
                />
              </div>
            ))}
          </div>

          {hasMultipleImages && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">{dots}</div>}
        </div>

        <div id="image-preview-description" className="sr-only">
          Image preview dialog. Press Escape to close. Use left/right arrow keys or swipe to switch images.
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PreviewImageDialog;
