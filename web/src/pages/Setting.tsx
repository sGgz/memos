import { CheckSquareIcon, CogIcon, DatabaseIcon, KeyIcon, LibraryIcon, LucideIcon, Settings2Icon, UserIcon, UsersIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import MobileHeader from "@/components/MobileHeader";
import CoverStorageSection from "@/components/Settings/CoverStorageSection";
import InstanceSection from "@/components/Settings/InstanceSection";
import MemberSection from "@/components/Settings/MemberSection";
import MemoRelatedSettings from "@/components/Settings/MemoRelatedSettings";
import MyAccountSection from "@/components/Settings/MyAccountSection";
import PreferencesSection from "@/components/Settings/PreferencesSection";
import SectionMenuItem from "@/components/Settings/SectionMenuItem";
import SSOSection from "@/components/Settings/SSOSection";
import StorageSection from "@/components/Settings/StorageSection";
import TodoSettings from "@/components/Settings/TodoSettings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
import { User_Role } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

type SettingSection = "my-account" | "preference" | "member" | "system" | "memo-related" | "storage" | "sso" | "todo" | "cover-storage";

interface State {
  selectedSection: SettingSection;
}

const BASIC_SECTIONS: SettingSection[] = ["my-account", "preference"];
const ADMIN_SECTIONS: SettingSection[] = ["member", "system", "memo-related", "todo", "storage", "cover-storage", "sso"];
const SECTION_ICON_MAP: Record<SettingSection, LucideIcon> = {
  "my-account": UserIcon,
  preference: CogIcon,
  member: UsersIcon,
  system: Settings2Icon,
  "memo-related": LibraryIcon,
  todo: CheckSquareIcon,
  storage: DatabaseIcon,
  "cover-storage": DatabaseIcon,
  sso: KeyIcon,
};

const Setting = () => {
  const t = useTranslate();
  const sm = useMediaQuery("sm");
  const location = useLocation();
  const user = useCurrentUser();
  const { profile, fetchSetting } = useInstance();
  const [state, setState] = useState<State>({
    selectedSection: "my-account",
  });
  const isHost = user?.role === User_Role.ADMIN;

  const settingsSectionList = useMemo(() => {
    let settingList = [...BASIC_SECTIONS];
    if (isHost) {
      settingList = settingList.concat(ADMIN_SECTIONS);
    }
    return settingList;
  }, [isHost]);

  const getSectionLabel = (section: SettingSection) => {
    switch (section) {
      case "my-account":
        return t("setting.my-account");
      case "preference":
        return t("setting.preference");
      case "member":
        return t("setting.member");
      case "system":
        return t("setting.system");
      case "memo-related":
        return t("setting.memo-related");
      case "todo":
        return t("todo.title");
      case "storage":
        return t("setting.storage");
      case "cover-storage":
        return t("setting.cover-storage.title");
      case "sso":
        return t("setting.sso");
      default:
        return "";
    }
  };

  useEffect(() => {
    let hash = location.hash.slice(1) as SettingSection;
    // If the hash is not a valid section, redirect to the default section.
    if (![...BASIC_SECTIONS, ...ADMIN_SECTIONS].includes(hash)) {
      hash = "my-account";
    }
    setState({
      selectedSection: hash,
    });
  }, [location.hash]);

  useEffect(() => {
    if (!isHost) {
      return;
    }

    // Initial fetch for instance settings.
    (async () => {
      [InstanceSetting_Key.MEMO_RELATED, InstanceSetting_Key.STORAGE, InstanceSetting_Key.COVER_STORAGE].forEach(async (key) => {
        await fetchSetting(key);
      });
    })();
  }, [isHost, fetchSetting]);

  const handleSectionSelectorItemClick = useCallback((settingSection: SettingSection) => {
    window.location.hash = settingSection;
  }, []);

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-start sm:pt-3 md:pt-6 pb-8">
      {!sm && <MobileHeader />}
      <div className="w-full px-4 sm:px-6">
        <div className="w-full border border-border flex flex-row justify-start items-start px-4 py-3 bg-background text-muted-foreground">
          {sm && (
            <div className="flex flex-col justify-start items-start w-40 h-auto shrink-0 py-2">
              <span className="text-sm mt-0.5 pl-3 font-mono select-none text-muted-foreground">{t("common.basic")}</span>
              <div className="w-full flex flex-col justify-start items-start mt-1">
                {BASIC_SECTIONS.map((item) => (
                  <SectionMenuItem
                    key={item}
                    text={getSectionLabel(item)}
                    icon={SECTION_ICON_MAP[item]}
                    isSelected={state.selectedSection === item}
                    onClick={() => handleSectionSelectorItemClick(item)}
                  />
                ))}
              </div>
              {isHost ? (
                <>
                  <span className="text-sm mt-4 pl-3 font-mono select-none text-muted-foreground">{t("common.admin")}</span>
                  <div className="w-full flex flex-col justify-start items-start mt-1">
                    {ADMIN_SECTIONS.map((item) => (
                      <SectionMenuItem
                        key={item}
                        text={getSectionLabel(item)}
                        icon={SECTION_ICON_MAP[item]}
                        isSelected={state.selectedSection === item}
                        onClick={() => handleSectionSelectorItemClick(item)}
                      />
                    ))}
                    <span className="px-3 mt-2 opacity-70 text-sm">
                      {t("setting.version")}: v{profile.version}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          )}
          <div className="w-full grow sm:pl-4 overflow-x-auto">
            {!sm && (
              <div className="w-auto inline-block my-2">
                <Select value={state.selectedSection} onValueChange={(value) => handleSectionSelectorItemClick(value as SettingSection)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {settingsSectionList.map((settingSection) => (
                      <SelectItem key={settingSection} value={settingSection}>
                        {getSectionLabel(settingSection)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {state.selectedSection === "my-account" ? (
              <MyAccountSection />
            ) : state.selectedSection === "preference" ? (
              <PreferencesSection />
            ) : state.selectedSection === "member" ? (
              <MemberSection />
            ) : state.selectedSection === "system" ? (
              <InstanceSection />
            ) : state.selectedSection === "memo-related" ? (
              <MemoRelatedSettings />
            ) : state.selectedSection === "todo" ? (
              <TodoSettings />
            ) : state.selectedSection === "storage" ? (
              <StorageSection />
            ) : state.selectedSection === "cover-storage" ? (
              <CoverStorageSection />
            ) : state.selectedSection === "sso" ? (
              <SSOSection />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Setting;
