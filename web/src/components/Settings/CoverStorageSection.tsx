import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useInstance } from "@/contexts/InstanceContext";
import { handleError } from "@/lib/error";
import {
  InstanceSetting_CoverStorageSetting,
  InstanceSetting_CoverStorageSettingSchema,
  InstanceSetting_Key,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";

const CoverStorageSection = () => {
  const t = useTranslate();
  const { coverStorageSetting: originalSetting, updateSetting, fetchSetting } = useInstance();
  const [coverStorageSetting, setCoverStorageSetting] = useState<InstanceSetting_CoverStorageSetting>(originalSetting);

  useEffect(() => {
    setCoverStorageSetting(originalSetting);
  }, [originalSetting]);

  const allowSave = useMemo(() => {
    if (coverStorageSetting.uploadSizeLimitMb <= 0) {
      return false;
    }
    if (coverStorageSetting.directoryPath.length === 0) {
      return false;
    }
    if (!coverStorageSetting.enableLocalServer && coverStorageSetting.urlPrefix.length === 0) {
      return false;
    }
    return !isEqual(originalSetting, coverStorageSetting);
  }, [coverStorageSetting, originalSetting]);

  const handleDirectoryPathChanged = (event: React.FocusEvent<HTMLInputElement>) => {
    const update = create(InstanceSetting_CoverStorageSettingSchema, {
      ...coverStorageSetting,
      directoryPath: event.target.value,
    });
    setCoverStorageSetting(update);
  };

  const handleUrlPrefixChanged = (event: React.FocusEvent<HTMLInputElement>) => {
    const update = create(InstanceSetting_CoverStorageSettingSchema, {
      ...coverStorageSetting,
      urlPrefix: event.target.value,
    });
    setCoverStorageSetting(update);
  };

  const handleLocalServerToggled = (checked: boolean) => {
    const update = create(InstanceSetting_CoverStorageSettingSchema, {
      ...coverStorageSetting,
      enableLocalServer: checked,
    });
    if (checked && update.urlPrefix.length === 0) {
      update.urlPrefix = "/cover";
    }
    setCoverStorageSetting(update);
  };

  const handleUploadSizeChanged = (event: React.FocusEvent<HTMLInputElement>) => {
    let num = parseInt(event.target.value);
    if (Number.isNaN(num)) {
      num = 0;
    }
    const update = create(InstanceSetting_CoverStorageSettingSchema, {
      ...coverStorageSetting,
      uploadSizeLimitMb: BigInt(num),
    });
    setCoverStorageSetting(update);
  };

  const saveCoverStorageSetting = async () => {
    try {
      const setting = create(InstanceSetting_CoverStorageSettingSchema, {
        ...coverStorageSetting,
      });
      if (setting.enableLocalServer) {
        setting.urlPrefix = "/cover";
      }
      await updateSetting(
        create(InstanceSettingSchema, {
          name: `instance/settings/${InstanceSetting_Key[InstanceSetting_Key.COVER_STORAGE]}`,
          value: {
            case: "coverStorageSetting",
            value: setting,
          },
        }),
      );
      await fetchSetting(InstanceSetting_Key.COVER_STORAGE);
      toast.success(t("message.update-succeed"));
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: "Update cover storage settings",
      });
    }
  };

  return (
    <SettingSection>
      <SettingGroup title={t("setting.cover-storage.title")}>
        <SettingRow label={t("setting.cover-storage.directory-path")} vertical>
          <Input
            className="w-full"
            value={coverStorageSetting.directoryPath}
            onChange={handleDirectoryPathChanged}
            placeholder="/var/www/images"
          />
        </SettingRow>

        <SettingRow label={t("setting.cover-storage.enable-local")} description={t("setting.cover-storage.enable-local-desc")}>
          <Switch checked={coverStorageSetting.enableLocalServer} onCheckedChange={handleLocalServerToggled} />
        </SettingRow>

        <SettingRow
          label={t("setting.cover-storage.url-prefix")}
          description={coverStorageSetting.enableLocalServer ? t("setting.cover-storage.url-prefix-disabled") : undefined}
          vertical
        >
          <Input
            className="w-full"
            value={coverStorageSetting.urlPrefix}
            onChange={handleUrlPrefixChanged}
            placeholder="http://example.com/images"
            disabled={coverStorageSetting.enableLocalServer}
          />
        </SettingRow>

        <SettingRow label={t("setting.cover-storage.max-upload-size")}>
          <Input className="w-24 font-mono" value={String(coverStorageSetting.uploadSizeLimitMb)} onChange={handleUploadSizeChanged} />
        </SettingRow>
      </SettingGroup>

      <div className="w-full flex justify-end">
        <Button disabled={!allowSave} onClick={saveCoverStorageSetting}>
          {t("common.save")}
        </Button>
      </div>
    </SettingSection>
  );
};

export default CoverStorageSection;
