import { FileIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import PreviewImageDialog from "../../../PreviewImageDialog";
import AttachmentCard from "./AttachmentCard";

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

const SingleImageCard = ({ attachment, onImageClick }: { attachment: Attachment; onImageClick: (url: string) => void }) => {
  const [ratio, setRatio] = useState<number | null>(null);
  const sourceUrl = getAttachmentUrl(attachment);

  const isWideImage = ratio !== null && ratio >= 1.7;
  const isTallImage = ratio !== null && ratio <= 0.65;

  return (
    <button
      type="button"
      className={cn(
        "w-full max-w-[11rem] rounded-lg overflow-hidden bg-muted/30 border border-border/30 hover:border-primary/30 transition-all cursor-pointer",
        isWideImage && "aspect-video",
        isTallImage && "aspect-[3/4]",
      )}
      onClick={() => onImageClick(sourceUrl)}
    >
      <img
        src={sourceUrl}
        alt={attachment.filename}
        className={cn("w-full h-full bg-muted/30", isWideImage || isTallImage ? "object-cover" : "object-contain max-h-[18rem]")}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) {
            setRatio(naturalWidth / naturalHeight);
          }
        }}
        loading="lazy"
      />
    </button>
  );
};

const getGridLayout = (count: number) => {
  switch (count) {
    case 2:
    case 3:
      return {
        containerClass: "grid-cols-3",
        itemClass: "aspect-square",
      };
    case 4:
      return {
        containerClass: "grid-cols-2",
        itemClass: "aspect-square",
      };
    default:
      return {
        containerClass: "grid-cols-3",
        itemClass: "aspect-square",
      };
  }
};

const MediaGrid = ({ attachments, onImageClick }: { attachments: Attachment[]; onImageClick: (url: string) => void }) => {
  const layout = getGridLayout(attachments.length);

  return (
    <div
      className={cn(
        "grid gap-2",
        layout.containerClass,
        attachments.length <= 3 && "max-w-[18rem]",
        attachments.length === 4 && "max-w-[12rem]",
      )}
    >
      {attachments.map((attachment) => (
        <div
          key={attachment.name}
          className={cn(
            layout.itemClass,
            "rounded-lg overflow-hidden bg-muted/30 border border-border/30 hover:border-primary/30 transition-all cursor-pointer group",
          )}
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
      <div className="w-full rounded-lg border-0 bg-transparent overflow-hidden">
        <div className="p-0 flex flex-col gap-1">
          {mediaItems.length > 0 && !allImages && <MediaGrid attachments={mediaItems} onImageClick={handleImageClick} />}
          {allImages && imageOnlyMedia.length === 1 && <SingleImageCard attachment={imageOnlyMedia[0]} onImageClick={handleImageClick} />}
          {allImages && imageOnlyMedia.length > 1 && <MediaGrid attachments={imageOnlyMedia} onImageClick={handleImageClick} />}

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
