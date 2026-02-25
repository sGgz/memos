import { ChevronLeft, ChevronRight, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imgUrls: string[];
  initialIndex?: number;
}

function PreviewImageDialog({ open, onOpenChange, imgUrls, initialIndex = 0 }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const dragStartXRef = useRef<number | null>(null);
  const isSwipingRef = useRef(false);

  const safeIndex = Math.max(0, Math.min(currentIndex, imgUrls.length - 1));
  const hasMultipleImages = imgUrls.length > 1;

  const showPrevImage = () => {
    if (!hasMultipleImages) {
      return;
    }
    setCurrentIndex((prev) => (prev - 1 + imgUrls.length) % imgUrls.length);
  };

  const showNextImage = () => {
    if (!hasMultipleImages) {
      return;
    }
    setCurrentIndex((prev) => (prev + 1) % imgUrls.length);
  };

  // Update current index when initialIndex prop changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

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
  }, [open, onOpenChange, showNextImage, showPrevImage]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isSwipingRef.current) {
      isSwipingRef.current = false;
      return;
    }

    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  const finishSwipe = (clientX: number) => {
    if (!hasMultipleImages || dragStartXRef.current === null) {
      dragStartXRef.current = null;
      return;
    }

    const deltaX = clientX - dragStartXRef.current;
    const swipeThreshold = 50;

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

  // Return early if no images provided
  if (!imgUrls.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[100vw] !h-[100vh] !max-w-[100vw] !max-h-[100vw] p-0 border-0 shadow-none bg-transparent [&>button]:hidden"
        aria-describedby="image-preview-description"
      >
        {/* Close button */}
        <div className="fixed top-4 right-4 z-50">
          <Button
            onClick={handleClose}
            variant="secondary"
            size="icon"
            className="rounded-full bg-popover/20 hover:bg-popover/30 border-border/20 backdrop-blur-sm"
            aria-label="Close image preview"
          >
            <X className="h-4 w-4 text-popover-foreground" />
          </Button>
        </div>

        {hasMultipleImages && (
          <>
            <div className="fixed top-1/2 left-4 -translate-y-1/2 z-50">
              <Button
                onClick={showPrevImage}
                variant="secondary"
                size="icon"
                className="rounded-full bg-popover/20 hover:bg-popover/30 border-border/20 backdrop-blur-sm"
                aria-label="Show previous image"
              >
                <ChevronLeft className="h-5 w-5 text-popover-foreground" />
              </Button>
            </div>
            <div className="fixed top-1/2 right-4 -translate-y-1/2 z-50">
              <Button
                onClick={showNextImage}
                variant="secondary"
                size="icon"
                className="rounded-full bg-popover/20 hover:bg-popover/30 border-border/20 backdrop-blur-sm"
                aria-label="Show next image"
              >
                <ChevronRight className="h-5 w-5 text-popover-foreground" />
              </Button>
            </div>
          </>
        )}

        {/* Image container */}
        <div
          className="w-full h-full flex items-center justify-center p-4 sm:p-8 overflow-auto"
          onClick={handleBackdropClick}
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
        >
          <img
            src={imgUrls[safeIndex]}
            alt={`Preview image ${safeIndex + 1} of ${imgUrls.length}`}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
            loading="eager"
            decoding="async"
          />
        </div>

        {/* Screen reader description */}
        <div id="image-preview-description" className="sr-only">
          Image preview dialog. Press Escape to close. Use left/right arrow keys or swipe to switch images.
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PreviewImageDialog;
