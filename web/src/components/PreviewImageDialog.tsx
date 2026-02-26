import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imgUrls: string[];
  initialIndex?: number;
  sourceRects?: (DOMRect | null)[];
}

const ANIMATION_DURATION_MS = 260;

const getContainRect = (naturalSize: { width: number; height: number } | null) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const sidePadding = 24;
  const verticalPadding = 84;

  const maxWidth = Math.max(0, viewportWidth - sidePadding * 2);
  const maxHeight = Math.max(0, viewportHeight - verticalPadding * 2);

  if (!naturalSize?.width || !naturalSize?.height) {
    return {
      left: sidePadding,
      top: verticalPadding,
      width: maxWidth,
      height: maxHeight,
    };
  }

  const ratio = Math.min(maxWidth / naturalSize.width, maxHeight / naturalSize.height);
  const width = naturalSize.width * ratio;
  const height = naturalSize.height * ratio;

  return {
    left: (viewportWidth - width) / 2,
    top: (viewportHeight - height) / 2,
    width,
    height,
  };
};

function PreviewImageDialog({ open, onOpenChange, imgUrls, initialIndex = 0, sourceRects = [] }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [visible, setVisible] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const [naturalSizes, setNaturalSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [imageStyle, setImageStyle] = useState<React.CSSProperties | undefined>(undefined);
  const dragStartXRef = useRef<number | null>(null);
  const isSwipingRef = useRef(false);

  const safeIndex = Math.max(0, Math.min(currentIndex, imgUrls.length - 1));
  const hasMultipleImages = imgUrls.length > 1;

  const currentSourceRect = sourceRects[safeIndex] ?? null;
  const currentImageUrl = imgUrls[safeIndex];

  const showPrevImage = useCallback(() => {
    if (!hasMultipleImages) {
      return;
    }
    setCurrentIndex((prev) => (prev - 1 + imgUrls.length) % imgUrls.length);
  }, [hasMultipleImages, imgUrls.length]);

  const showNextImage = useCallback(() => {
    if (!hasMultipleImages) {
      return;
    }
    setCurrentIndex((prev) => (prev + 1) % imgUrls.length);
  }, [hasMultipleImages, imgUrls.length]);

  const animateOpenFromSource = useCallback(() => {
    if (!currentImageUrl) {
      return;
    }

    const containRect = getContainRect(naturalSizes[currentImageUrl] ?? null);

    if (!currentSourceRect) {
      setImageStyle({
        left: containRect.left,
        top: containRect.top,
        width: containRect.width,
        height: containRect.height,
      });
      return;
    }

    setImageStyle({
      left: currentSourceRect.left,
      top: currentSourceRect.top,
      width: currentSourceRect.width,
      height: currentSourceRect.height,
      transition: "none",
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setImageStyle({
          left: containRect.left,
          top: containRect.top,
          width: containRect.width,
          height: containRect.height,
          transition: `all ${ANIMATION_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        });
      });
    });
  }, [currentImageUrl, currentSourceRect, naturalSizes]);

  const animateCloseToSource = useCallback(() => {
    if (!currentImageUrl) {
      onOpenChange(false);
      setVisible(false);
      return;
    }

    const containRect = getContainRect(naturalSizes[currentImageUrl] ?? null);
    const targetRect = currentSourceRect;

    if (!targetRect) {
      onOpenChange(false);
      setVisible(false);
      return;
    }

    setIsClosing(true);
    setImageStyle({
      left: containRect.left,
      top: containRect.top,
      width: containRect.width,
      height: containRect.height,
      transition: `all ${ANIMATION_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setImageStyle({
          left: targetRect.left,
          top: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
          transition: `all ${ANIMATION_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        });
      });
    });

    window.setTimeout(() => {
      setIsClosing(false);
      setVisible(false);
      onOpenChange(false);
    }, ANIMATION_DURATION_MS);
  }, [currentImageUrl, currentSourceRect, naturalSizes, onOpenChange]);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (open) {
      setVisible(true);
    }
  }, [open]);

  useEffect(() => {
    if (!visible || !open || !imgUrls.length) {
      return;
    }
    animateOpenFromSource();
  }, [visible, open, safeIndex, imgUrls.length, animateOpenFromSource]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!visible) return;

      switch (event.key) {
        case "Escape":
          animateCloseToSource();
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
  }, [visible, showNextImage, showPrevImage, animateCloseToSource]);

  const finishSwipe = (clientX: number) => {
    if (!hasMultipleImages || dragStartXRef.current === null) {
      dragStartXRef.current = null;
      return;
    }

    const deltaX = clientX - dragStartXRef.current;
    const swipeThreshold = 40;

    if (Math.abs(deltaX) > swipeThreshold) {
      isSwipingRef.current = true;
      if (deltaX < 0) {
        showNextImage();
      } else {
        showPrevImage();
      }
    }

    dragStartXRef.current = null;
  };

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
        if (!nextOpen) {
          animateCloseToSource();
          return;
        }
        setVisible(true);
      }}
    >
      <DialogContent
        className="!w-[100vw] !h-[100vh] !max-w-[100vw] !max-h-[100vh] p-0 border-0 shadow-none bg-black/98 [&>button]:hidden"
        aria-describedby="image-preview-description"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {hasMultipleImages && (
          <>
            <div className="fixed top-1/2 left-3 -translate-y-1/2 z-50">
              <Button
                onClick={showPrevImage}
                variant="secondary"
                size="icon"
                className="rounded-full bg-black/35 hover:bg-black/55 border border-white/10 text-white"
                aria-label="Show previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <div className="fixed top-1/2 right-3 -translate-y-1/2 z-50">
              <Button
                onClick={showNextImage}
                variant="secondary"
                size="icon"
                className="rounded-full bg-black/35 hover:bg-black/55 border border-white/10 text-white"
                aria-label="Show next image"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </>
        )}

        <div
          className={cn("fixed inset-0 bg-black transition-opacity duration-200", isClosing ? "opacity-70" : "opacity-100")}
          onClick={() => {
            if (isSwipingRef.current) {
              isSwipingRef.current = false;
              return;
            }
            animateCloseToSource();
          }}
        />

        <img
          src={currentImageUrl}
          alt={`Preview image ${safeIndex + 1} of ${imgUrls.length}`}
          className="fixed object-contain select-none cursor-zoom-out"
          style={imageStyle}
          draggable={false}
          loading="eager"
          decoding="async"
          onMouseDown={(event) => {
            dragStartXRef.current = event.clientX;
          }}
          onMouseUp={(event) => finishSwipe(event.clientX)}
          onMouseLeave={(event) => {
            if (dragStartXRef.current !== null) {
              finishSwipe(event.clientX);
            }
          }}
          onTouchStart={(event) => {
            dragStartXRef.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const touch = event.changedTouches[0];
            if (touch) {
              finishSwipe(touch.clientX);
            }
          }}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth > 0 && naturalHeight > 0) {
              setNaturalSizes((prev) => ({
                ...prev,
                [currentImageUrl]: { width: naturalWidth, height: naturalHeight },
              }));
            }
          }}
        />

        {hasMultipleImages && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">{dots}</div>}

        <div id="image-preview-description" className="sr-only">
          Image preview dialog. Press Escape to close. Use left/right arrow keys or swipe to switch images.
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PreviewImageDialog;
