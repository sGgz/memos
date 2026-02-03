import type { Translations } from "@/utils/i18n";

type Translate = (key: Translations, params?: Record<string, unknown>) => string;

export type BankNameMap = Map<string, string>;

export const buildBankNameMap = (banks: { name: string; title: string }[]): BankNameMap => {
  return new Map(banks.map((bank) => [bank.name, bank.title]));
};

export const formatBankName = (bankNameMap: BankNameMap, bankName?: string): string | null => {
  if (!bankName) return null;
  return bankNameMap.get(bankName) ?? null;
};

export const formatCurrency = (valueCents: bigint, t: Translate): string => {
  const value = Number(valueCents) / 100;
  if (!Number.isFinite(value)) {
    return t("loan.amount-invalid");
  }
  return value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const parseCurrencyToCents = (value: string): number | null => {
  if (!value.trim()) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const cents = Math.round(numeric * 100);
  if (!Number.isFinite(cents)) return null;
  return cents;
};
