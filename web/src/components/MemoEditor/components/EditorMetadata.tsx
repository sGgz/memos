import type { FC } from "react";
import { useEditorContext } from "../state";
import type { EditorMetadataProps } from "../types";
import AttachmentList from "./AttachmentList";
import LocationDisplay from "./LocationDisplay";
import RelationList from "./RelationList";

const EditorMetadata: FC<EditorMetadataProps> = ({ memoName, minimal, variant = "default" }) => {
  const { state, actions, dispatch } = useEditorContext();

  const hasAttachments = state.metadata.attachments.length > 0 || state.localFiles.length > 0;

  if (minimal && !hasAttachments) {
    return null;
  }

  return (
    <div className={variant === "publish" ? "w-full flex flex-col gap-2" : "w-full flex flex-col gap-2"}>
      <AttachmentList
        attachments={state.metadata.attachments}
        localFiles={state.localFiles}
        onAttachmentsChange={(attachments) => dispatch(actions.setMetadata({ attachments }))}
        onRemoveLocalFile={(previewUrl) => dispatch(actions.removeLocalFile(previewUrl))}
      />

      {!minimal && (
        <>
          <RelationList
            relations={state.metadata.relations}
            onRelationsChange={(relations) => dispatch(actions.setMetadata({ relations }))}
            memoName={memoName}
          />

          {state.metadata.location && (
            <LocationDisplay location={state.metadata.location} onRemove={() => dispatch(actions.setMetadata({ location: undefined }))} />
          )}
        </>
      )}
    </div>
  );
};

export default EditorMetadata;
