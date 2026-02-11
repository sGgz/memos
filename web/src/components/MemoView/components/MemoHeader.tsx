import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Link } from "react-router-dom";
import i18n from "@/i18n";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import UserAvatar from "../../UserAvatar";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";
import type { MemoHeaderProps } from "../types";

const MemoHeader: React.FC<MemoHeaderProps> = ({
  showCreator,
  showPinned: _showPinned,
  onEdit: _onEdit,
  onGotoDetail,
  onUnpin: _onUnpin,
  onToggleNsfwVisibility: _onToggleNsfwVisibility,
  showTime = true,
}) => {
  const { memo, creator, isArchived } = useMemoViewContext();
  const { relativeTimeFormat } = useMemoViewDerived();

  const displayTime = isArchived ? (
    (memo.displayTime ? timestampDate(memo.displayTime) : undefined)?.toLocaleString(i18n.language)
  ) : (
    <relative-time
      datetime={(memo.displayTime ? timestampDate(memo.displayTime) : undefined)?.toISOString()}
      lang={i18n.language}
      format={relativeTimeFormat}
    ></relative-time>
  );

  return (
    <div className="w-full flex flex-row justify-between items-start gap-2">
      <div className="w-full flex flex-row justify-start items-center">
        {showCreator && creator ? (
          <CreatorDisplay creator={creator} />
        ) : (
          showTime && <TimeDisplay displayTime={displayTime} onGotoDetail={onGotoDetail} />
        )}
      </div>

      <div className="hidden"></div>
    </div>
  );
};

interface CreatorDisplayProps {
  creator: User;
}

const CreatorDisplay: React.FC<CreatorDisplayProps> = ({ creator }) => (
  <div className="w-full flex flex-row justify-start items-center gap-3">
    <Link
      className="w-auto hover:opacity-95 rounded-full transition-all duration-300 border border-border/60 hover:border-primary/40"
      to={`/u/${encodeURIComponent(creator.username)}`}
      viewTransition
    >
      <UserAvatar className="mr-0 shrink-0 ring-1 ring-border/60" avatarUrl={creator.avatarUrl} />
    </Link>
  </div>
);

interface TimeDisplayProps {
  displayTime: React.ReactNode;
  onGotoDetail: () => void;
}

const TimeDisplay: React.FC<TimeDisplayProps> = () => null;

export default MemoHeader;
