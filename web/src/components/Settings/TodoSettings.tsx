import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInstance } from "@/contexts/InstanceContext";
import { handleError } from "@/lib/error";
import { InstanceSetting_Key, InstanceSetting_TodoSettingSchema, InstanceSettingSchema } from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";

const parseOffsets = (value: string) => {
  const parts = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.map((item) => Number(item)).filter((offset) => Number.isInteger(offset) && offset > 0);
};

const TodoSettings = () => {
  const t = useTranslate();
  const { todoSetting: originalSetting, updateSetting, fetchSetting } = useInstance();
  const [rawOffsets, setRawOffsets] = useState(originalSetting.reminderDayOffsets.join(","));
  const parsedOffsets = useMemo(() => parseOffsets(rawOffsets), [rawOffsets]);
  const isDirty = parsedOffsets.length > 0 && !isEqual(parsedOffsets, originalSetting.reminderDayOffsets);

  useEffect(() => {
    setRawOffsets(originalSetting.reminderDayOffsets.join(","));
  }, [originalSetting.reminderDayOffsets]);

  const handleSave = async () => {
    if (parsedOffsets.length === 0) {
      toast.error(t("todo.settings.invalid"));
      return;
    }

    const nextSetting = create(InstanceSetting_TodoSettingSchema, {
      ...originalSetting,
      reminderDayOffsets: parsedOffsets,
    });

    try {
      await updateSetting(
        create(InstanceSettingSchema, {
          name: `instance/settings/${InstanceSetting_Key[InstanceSetting_Key.TODO]}`,
          value: {
            case: "todoSetting",
            value: nextSetting,
          },
        }),
      );
      await fetchSetting(InstanceSetting_Key.TODO);
      toast.success(t("todo.settings.saved"));
    } catch (error) {
      await handleError(error, toast.error, {
        context: "Update todo settings",
      });
    }
  };

  return (
    <SettingSection>
      <SettingGroup title={t("todo.settings.title")}>
        <SettingRow label={t("todo.settings.title")} description={t("todo.settings.description")}>
          <Input
            className="w-56"
            value={rawOffsets}
            placeholder={t("todo.settings.placeholder")}
            onChange={(event) => setRawOffsets(event.target.value)}
          />
        </SettingRow>
      </SettingGroup>
      <div className="w-full flex justify-end">
        <Button disabled={!isDirty} onClick={handleSave}>
          {t("common.save")}
        </Button>
      </div>
    </SettingSection>
  );
};

export default TodoSettings;
