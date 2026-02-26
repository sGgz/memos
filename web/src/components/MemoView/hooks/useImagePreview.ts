import { useState } from "react";

export interface ImagePreviewState {
  open: boolean;
  urls: string[];
  index: number;
  sourceRects: (DOMRect | null)[];
}

interface OpenPreviewOptions {
  urls: string[];
  index: number;
  sourceRects?: (DOMRect | null)[];
}

export interface UseImagePreviewReturn {
  previewState: ImagePreviewState;
  openPreview: (options: OpenPreviewOptions) => void;
  closePreview: () => void;
  setPreviewOpen: (open: boolean) => void;
}

export const useImagePreview = (): UseImagePreviewReturn => {
  const [previewState, setPreviewState] = useState<ImagePreviewState>({ open: false, urls: [], index: 0, sourceRects: [] });

  return {
    previewState,
    openPreview: ({ urls, index, sourceRects = [] }) => setPreviewState({ open: true, urls, index, sourceRects }),
    closePreview: () => setPreviewState({ open: false, urls: [], index: 0, sourceRects: [] }),
    setPreviewOpen: (open: boolean) => setPreviewState((prev) => ({ ...prev, open })),
  };
};
