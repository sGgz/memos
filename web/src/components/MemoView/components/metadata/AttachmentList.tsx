import { FileIcon, GripHorizontalIcon, PaperclipIcon } from "lucide-react";
import { useState } from "react";
import { useSwipeable } from "react-swipeable";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import PreviewImageDialog from "../../../PreviewImageDialog";
import AttachmentCard from "./AttachmentCard";
import SectionHeader from "./SectionHeader";

interface AttachmentListProps {
  attachments: Attachment[];
}

const separateMediaAndDocs = (attachments: Attachment[]): { media: Attachment[]; docs: Attachment[] } => {
  const media: Attachment[] = [];
  const docs: Attachment[] = [];

  for (const attachment of attachments) {
    const attachmentType = getAttachmentType(attachment);
    if (attachmentType === "image/*" || attachmentType === "video/*") {
      media.push(attachment);
    } else {
      docs.push(attachment);
    }
  }

  return { media, docs };
};

const DocumentItem = ({ attachment }: { attachment: Attachment }) => {
  const fileTypeLabel = getFileTypeLabel(attachment.type);
  const fileSizeLabel = attachment.size ? formatFileSize(Number(attachment.size)) : undefined;

  return (
    <div className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-accent/20 transition-colors whitespace-nowrap">
      <div className="shrink-0 w-5 h-5 rounded overflow-hidden bg-muted/40 flex items-center justify-center">
        <FileIcon className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs truncate" title={attachment.filename}>
          {attachment.filename}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <span className="text-muted-foreground/50">•</span>
          <span>{fileTypeLabel}</span>
          {fileSizeLabel && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{fileSizeLabel}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const MediaGrid = ({ attachments, onImageClick }: { attachments: Attachment[]; onImageClick: (url: string) => void }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
    {attachments.map((attachment) => (
      <div
        key={attachment.name}
        className="aspect-square rounded-lg overflow-hidden bg-muted/40 border border-border hover:border-accent/50 transition-all cursor-pointer group"
        onClick={() => onImageClick(getAttachmentUrl(attachment))}
      >
        <div className="w-full h-full relative">
          <AttachmentCard attachment={attachment} className="rounded-none" />
          {getAttachmentType(attachment) === "video/*" && (
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/20 group-hover:bg-foreground/30 transition-colors">
              <div className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center">
                <svg className="w-5 h-5 text-foreground fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
);

const ImageCarousel = ({ attachments, onImageClick }: { attachments: Attachment[]; onImageClick: (url: string) => void }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = attachments.length;

  const handlers = useSwipeable({
    onSwipedLeft: () => setActiveIndex((prev) => Math.min(prev + 1, total - 1)),
    onSwipedRight: () => setActiveIndex((prev) => Math.max(prev - 1, 0)),
    trackMouse: true,
    preventScrollOnSwipe: true,
    delta: 12,
  });

  return (
    <div className="relative w-full">
      <div
        {...handlers}
        className="overflow-hidden rounded-2xl border border-transparent bg-transparent"
        onScroll={(event) => {
          const target = event.currentTarget;
          const nextIndex = Math.round(target.scrollLeft / target.clientWidth);
          setActiveIndex(Math.min(Math.max(nextIndex, 0), total - 1));
        }}
      >
        <div className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth no-scrollbar">
          {attachments.map((attachment) => (
            <div
              key={attachment.name}
              className="min-w-full snap-center aspect-[4/3] relative cursor-pointer flex items-center justify-center bg-card/80"
              onClick={() => onImageClick(getAttachmentUrl(attachment))}
            >
              <AttachmentCard attachment={attachment} className="rounded-none w-full h-full object-contain" />
            </div>
          ))}
        </div>
      </div>
      {total > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-foreground/20 px-3 py-1 text-xs text-foreground">
          <GripHorizontalIcon className="w-3 h-3 text-foreground/70" />
          <span>
            {activeIndex + 1}/{total}
          </span>
        </div>
      )}
    </div>
  );
};

const DocsList = ({ attachments }: { attachments: Attachment[] }) => (
  <div className="flex flex-col gap-0.5">
    {attachments.map((attachment) => (
      <a key={attachment.name} href={getAttachmentUrl(attachment)} download title={`Download ${attachment.filename}`}>
        <DocumentItem attachment={attachment} />
      </a>
    ))}
  </div>
);

const AttachmentList = ({ attachments }: AttachmentListProps) => {
  const [previewImage, setPreviewImage] = useState<{ open: boolean; urls: string[]; index: number; mimeType?: string }>({
    open: false,
    urls: [],
    index: 0,
    mimeType: undefined,
  });

  const { media: mediaItems, docs: docItems } = separateMediaAndDocs(attachments);
  const imageOnlyMedia = mediaItems.filter((item) => getAttachmentType(item) === "image/*");
  const allImages = imageOnlyMedia.length === mediaItems.length && mediaItems.length > 0;

  if (attachments.length === 0) {
    return null;
  }

  const handleImageClick = (imgUrl: string) => {
    const imageAttachments = mediaItems.filter((a) => getAttachmentType(a) === "image/*");
    const imgUrls = imageAttachments.map((a) => getAttachmentUrl(a));
    const index = imgUrls.findIndex((url) => url === imgUrl);
    const mimeType = imageAttachments[index]?.type;
    setPreviewImage({ open: true, urls: imgUrls, index, mimeType });
  };

  return (
    <>
      <div className="w-full rounded-lg border border-transparent bg-transparent overflow-hidden">
        <SectionHeader icon={PaperclipIcon} title="附件" count={attachments.length} hideIcon hideCount hideBorder />

        <div className="p-2 flex flex-col gap-1">
          {mediaItems.length > 0 && !allImages && <MediaGrid attachments={mediaItems} onImageClick={handleImageClick} />}
          {allImages && <ImageCarousel attachments={imageOnlyMedia} onImageClick={handleImageClick} />}

          {mediaItems.length > 0 && docItems.length > 0 && <div className="border-t mt-1 border-border opacity-60" />}

          {docItems.length > 0 && <DocsList attachments={docItems} />}
        </div>
      </div>

      <PreviewImageDialog
        open={previewImage.open}
        onOpenChange={(open: boolean) => setPreviewImage((prev) => ({ ...prev, open }))}
        imgUrls={previewImage.urls}
        initialIndex={previewImage.index}
      />
    </>
  );
};

export default AttachmentList;
