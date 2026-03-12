import { XIcon } from "lucide-react";
import type { FC } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { LocalFile } from "../types/attachment";
import { toAttachmentItems } from "../types/attachment";

interface AttachmentListProps {
  attachments: Attachment[];
  localFiles?: LocalFile[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onRemoveLocalFile?: (previewUrl: string) => void;
}

// AttachmentItemCard removed: grid-only preview used in editor.

const AttachmentList: FC<AttachmentListProps> = ({ attachments, localFiles = [], onAttachmentsChange, onRemoveLocalFile }) => {
  if (attachments.length === 0 && localFiles.length === 0) {
    return null;
  }

  const items = toAttachmentItems(attachments, localFiles);

  const handleRemoveAttachment = (name: string) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter((attachment) => attachment.name !== name));
    }
  };

  const handleRemoveItem = (item: (typeof items)[0]) => {
    if (item.isLocal) {
      onRemoveLocalFile?.(item.id);
    } else {
      handleRemoveAttachment(item.id);
    }
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {items.map((item) => (
          <div key={item.id} className="relative aspect-square overflow-hidden bg-muted/30 border border-border/40">
            {item.category === "image" && item.thumbnailUrl ? (
              <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">{item.filename}</div>
            )}
            <button
              type="button"
              onClick={() => handleRemoveItem(item)}
              className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 shadow"
              aria-label="Remove attachment"
            >
              <XIcon className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttachmentList;
