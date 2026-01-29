import i18n, { BackendModule } from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocaleWithFallback } from "./utils/i18n";

export const locales = ["zh-Hans"] as const;

const LazyImportPlugin: BackendModule = {
  type: "backend",
  init: function () {},
  read: function (language, _, callback) {
    const locale = getLocaleWithFallback(language);
    import(`./locales/${locale}.json`)
      .then((translation: Record<string, unknown>) => {
        callback(null, translation);
      })
      .catch(() => {
        // Fallback to English.
      });
  },
};

i18n
  .use(LazyImportPlugin)
  .use(initReactI18next)
  .init({
    detection: {
      order: ["navigator"],
    },
    fallbackLng: "zh-Hans",
  });

export default i18n;
export type TLocale = (typeof locales)[number];
