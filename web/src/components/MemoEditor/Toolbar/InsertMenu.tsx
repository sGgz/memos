import { LatLng } from "leaflet";
import { uniqBy } from "lodash-es";
import { ImageIcon, LinkIcon, LoaderIcon, MapPinIcon, Maximize2Icon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useDebounce } from "react-use";
import { useReverseGeocoding } from "@/components/map";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  useDropdownMenuSubHoverDelay,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { LinkMemoDialog, LocationDialog } from "../components";
import { MAX_MEMO_ATTACHMENTS } from "../constants";
import { useFileUpload, useLinkMemo, useLocation } from "../hooks";
import { useEditorContext } from "../state";
import type { InsertMenuProps } from "../types";
import type { LocalFile } from "../types/attachment";

const InsertMenu = (props: InsertMenuProps) => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [moreSubmenuOpen, setMoreSubmenuOpen] = useState(false);

  const { handleTriggerEnter, handleTriggerLeave, handleContentEnter, handleContentLeave } = useDropdownMenuSubHoverDelay(
    150,
    setMoreSubmenuOpen,
  );

  const addFilesWithLimit = (newFiles: LocalFile[]) => {
    const currentCount = state.metadata.attachments.length + state.localFiles.length;
    const availableSlots = Math.max(MAX_MEMO_ATTACHMENTS - currentCount, 0);

    if (availableSlots <= 0) {
      toast.error(`最多只能上传 ${MAX_MEMO_ATTACHMENTS} 张图片`);
      return;
    }

    if (newFiles.length > availableSlots) {
      toast.error(`最多只能上传 ${MAX_MEMO_ATTACHMENTS} 张图片`);
    }

    newFiles.slice(0, availableSlots).forEach((file) => dispatch(actions.addLocalFile(file)));
  };

  const { fileInputRef, selectingFlag, handleFileInputChange, handleUploadClick } = useFileUpload((newFiles: LocalFile[]) => {
    addFilesWithLimit(newFiles);
  });
  const {
    fileInputRef: imageOnlyInputRef,
    selectingFlag: selectingImages,
    handleFileInputChange: handleImageInputChange,
  } = useFileUpload((newFiles: LocalFile[]) => {
    addFilesWithLimit(newFiles);
  });

  const linkMemo = useLinkMemo({
    isOpen: linkDialogOpen,
    currentMemoName: props.memoName,
    existingRelations: state.metadata.relations,
    onAddRelation: (relation: MemoRelation) => {
      dispatch(actions.setMetadata({ relations: uniqBy([...state.metadata.relations, relation], (r) => r.relatedMemo?.name) }));
      setLinkDialogOpen(false);
    },
  });

  const location = useLocation(props.location);

  const [debouncedPosition, setDebouncedPosition] = useState<LatLng | undefined>(undefined);

  useDebounce(
    () => {
      setDebouncedPosition(location.state.position);
    },
    1000,
    [location.state.position],
  );

  const { data: displayName } = useReverseGeocoding(debouncedPosition?.lat, debouncedPosition?.lng);

  useEffect(() => {
    if (displayName) {
      location.setPlaceholder(displayName);
    }
  }, [displayName]);

  const isUploading = selectingFlag || selectingImages || props.isUploading;
  const compactMode = props.compactMode ?? "upload";
  const compactButtonClassName = cn(
    "h-12 w-12 rounded-2xl border border-border/40 bg-muted/35 text-muted-foreground shadow-none hover:bg-muted/55 hover:text-foreground",
    props.className,
  );

  const handleLocationClick = () => {
    setLocationDialogOpen(true);
    if (!props.location && !location.locationInitialized) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            location.handlePositionChange(new LatLng(position.coords.latitude, position.coords.longitude));
          },
          (error) => {
            console.error("Geolocation error:", error);
          },
        );
      }
    }
  };

  const handleLocationConfirm = () => {
    const newLocation = location.getLocation();
    if (newLocation) {
      props.onLocationChange(newLocation);
      setLocationDialogOpen(false);
    }
  };

  const handleLocationCancel = () => {
    location.reset();
    setLocationDialogOpen(false);
  };

  const handlePositionChange = (position: LatLng) => {
    location.handlePositionChange(position);
  };

  return (
    <>
      {props.compact ? (
        compactMode === "menu" ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={compactButtonClassName} disabled={isUploading}>
                {isUploading ? <LoaderIcon className="size-4 animate-spin" /> : <MoreHorizontalIcon className="size-5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleUploadClick}>
                <ImageIcon className="w-4 h-4" />
                {t("common.upload")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLinkDialogOpen(true)}>
                <LinkIcon className="w-4 h-4" />
                {t("tooltip.link-memo")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLocationClick}>
                <MapPinIcon className="w-4 h-4" />
                {t("tooltip.select-location")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => props.onToggleFocusMode?.()}>
                <Maximize2Icon className="w-4 h-4" />
                {t("editor.focus-mode")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={compactButtonClassName}
            disabled={isUploading}
            onClick={() => imageOnlyInputRef.current?.click()}
          >
            {isUploading ? <LoaderIcon className="size-4 animate-spin" /> : <ImageIcon className="size-5" />}
          </Button>
        )
      ) : (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shadow-none" disabled={isUploading}>
              {isUploading ? <LoaderIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleUploadClick}>
              <ImageIcon className="w-4 h-4" />
              {t("common.upload")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLinkDialogOpen(true)}>
              <LinkIcon className="w-4 h-4" />
              {t("tooltip.link-memo")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLocationClick}>
              <MapPinIcon className="w-4 h-4" />
              {t("tooltip.select-location")}
            </DropdownMenuItem>
            {/* View submenu with Focus Mode */}
            <DropdownMenuSub open={moreSubmenuOpen} onOpenChange={setMoreSubmenuOpen}>
              <DropdownMenuSubTrigger onPointerEnter={handleTriggerEnter} onPointerLeave={handleTriggerLeave}>
                <MoreHorizontalIcon className="w-4 h-4" />
                {t("common.more")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent onPointerEnter={handleContentEnter} onPointerLeave={handleContentLeave}>
                <DropdownMenuItem
                  onClick={() => {
                    props.onToggleFocusMode?.();
                    setMoreSubmenuOpen(false);
                  }}
                >
                  <Maximize2Icon className="w-4 h-4" />
                  {t("editor.focus-mode")}
                  <span className="ml-auto text-xs text-muted-foreground opacity-60">⌘⇧F</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <div className="px-2 py-1 text-xs text-muted-foreground opacity-80">{t("editor.slash-commands")}</div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Hidden file input */}
      <input
        className="hidden"
        ref={fileInputRef}
        disabled={isUploading}
        onChange={handleFileInputChange}
        type="file"
        multiple={true}
        accept={props.compact ? "image/*" : "*"}
      />
      <input
        className="hidden"
        ref={imageOnlyInputRef}
        disabled={isUploading}
        onChange={handleImageInputChange}
        type="file"
        multiple={true}
        accept="image/*"
      />

      <LinkMemoDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        searchText={linkMemo.searchText}
        onSearchChange={linkMemo.setSearchText}
        filteredMemos={linkMemo.filteredMemos}
        isFetching={linkMemo.isFetching}
        onSelectMemo={linkMemo.addMemoRelation}
      />

      <LocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        state={location.state}
        locationInitialized={location.locationInitialized}
        onPositionChange={handlePositionChange}
        onUpdateCoordinate={location.updateCoordinate}
        onPlaceholderChange={location.setPlaceholder}
        onCancel={handleLocationCancel}
        onConfirm={handleLocationConfirm}
      />
    </>
  );
};

export default InsertMenu;
