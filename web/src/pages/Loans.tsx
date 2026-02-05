import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import {
  BanknoteIcon,
  CalendarIcon,
  GripVerticalIcon,
  LandmarkIcon,
  PencilIcon,
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import { type DragEvent, type PointerEvent, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import Empty from "@/components/Empty";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildBankNameMap, formatBankName, formatCurrency, parseCurrencyToCents } from "@/helpers/loan";
import useCurrentUser from "@/hooks/useCurrentUser";
import useDialog from "@/hooks/useDialog";
import {
  useBanks,
  useCreateBank,
  useCreateLoan,
  useCreateRepayment,
  useDeleteBank,
  useDeleteLoan,
  useDeleteRepayment,
  useLoans,
  useRepayments,
  useUpdateLoan,
  useUpdateRepayment,
} from "@/hooks/useLoanQueries";
import useMediaQuery from "@/hooks/useMediaQuery";
import { handleError } from "@/lib/error";
import type { Bank, Loan, Repayment } from "@/types/proto/api/v1/loan_service_pb";
import { BankSchema, CreateRepaymentRequestSchema, LoanSchema, RepaymentSchema } from "@/types/proto/api/v1/loan_service_pb";
import { useTranslate } from "@/utils/i18n";

type LoanFilter = "all" | "active" | "paid";

interface LoanRepaymentsProps {
  loan: Loan;
  onEditRepayment: (repayment: Repayment) => void;
}

const LoanRepayments = ({ loan, onEditRepayment }: LoanRepaymentsProps) => {
  const t = useTranslate();
  const { mutateAsync: createRepayment } = useCreateRepayment();
  const { data } = useRepayments({ parent: loan.name }, { enabled: Boolean(loan.name) });
  const repayments = data?.repayments ?? [];

  const sorted = [...repayments].sort((a, b) => {
    const aTime = a.repaymentTime ? timestampDate(a.repaymentTime).getTime() : 0;
    const bTime = b.repaymentTime ? timestampDate(b.repaymentTime).getTime() : 0;
    return bTime - aTime;
  });

  const latestStandardRepayment = sorted.find((repayment) => !repayment.isEarlyRepayment);
  const canQuickAdd = Boolean(latestStandardRepayment) && loan.remainingPrincipalCents > 0n;

  const handleQuickAddRepayment = async () => {
    if (!latestStandardRepayment || !loan.name) return;
    const baseDate = latestStandardRepayment.repaymentTime ? timestampDate(latestStandardRepayment.repaymentTime) : null;
    if (!baseDate || Number.isNaN(baseDate.getTime())) {
      toast.error(t("loan.repayment-date"));
      return;
    }
    const targetDay = loan.monthlyRepaymentDay > 0 ? loan.monthlyRepaymentDay : dayjs(baseDate).date();
    const nextBase = dayjs(baseDate).add(1, "month");
    const safeDay = Math.min(targetDay, nextBase.daysInMonth());
    const nextDate = nextBase.date(safeDay).toDate();
    if (dayjs(nextDate).isAfter(dayjs(), "day")) {
      toast.error(t("loan.date-invalid"));
      return;
    }
    try {
      await createRepayment(
        create(CreateRepaymentRequestSchema, {
          parent: loan.name,
          repayment: create(RepaymentSchema, {
            loan: loan.name,
            repaymentTime: timestampFromDate(nextDate),
            principalCents: latestStandardRepayment.principalCents,
            interestCents: latestStandardRepayment.interestCents,
            totalCents: latestStandardRepayment.totalCents,
            note: latestStandardRepayment.note ?? "",
            isEarlyRepayment: false,
          } as Repayment),
        }),
      );
      toast.success(t("loan.repayment-created"));
    } catch (error) {
      handleError(error, toast.error, { context: "Quick create repayment" });
    }
  };

  return (
    <div className="space-y-2 pb-4">
      {canQuickAdd && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleQuickAddRepayment}>
            <RefreshCcwIcon className="h-3.5 w-3.5" />
            {t("loan.repayment-quick-add")}
          </Button>
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="w-full flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
          <Empty />
          <span>{t("loan.repayment-empty")}</span>
        </div>
      ) : (
        sorted.map((repayment) => {
          const repayDate = repayment.repaymentTime ? dayjs(timestampDate(repayment.repaymentTime)).format("YYYY-MM-DD") : "-";
          const hasNote = Boolean(repayment.note?.trim());
          const hasPeriod = !repayment.isEarlyRepayment && (repayment.period ?? 0) >= 1;
          return (
            <div key={repayment.name} className="relative border border-border rounded-lg px-3 py-2 bg-muted/20">
              <Button
                size="icon"
                variant="outline"
                className="absolute right-2 top-2 h-7 w-7"
                aria-label={t("loan.edit-repayment")}
                onClick={() => onEditRepayment(repayment)}
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </Button>
              <div className="flex flex-col gap-1">
                <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5 text-foreground">
                    <span className="text-sm font-medium">{repayDate}</span>
                    {repayment.isEarlyRepayment && (
                      <span className="text-xs text-blue-600 bg-blue-600/10 px-2 py-0.5 rounded-full">{t("loan.repayment-early")}</span>
                    )}
                    {hasPeriod && (
                      <span className="text-xs text-emerald-600 bg-emerald-600/10 px-2 py-0.5 rounded-full">
                        {t("loan.repayment-period", { period: repayment.period })}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm pr-8 sm:pr-10">
                    <span className="text-foreground font-medium">
                      {t("loan.repayment-short-total")}
                      {formatCurrency(repayment.totalCents, t)}
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <span>
                      {t("loan.repayment-short-principal")}
                      {formatCurrency(repayment.principalCents, t)}
                    </span>
                    <span className="text-muted-foreground">+</span>
                    <span>
                      {t("loan.repayment-short-interest")}
                      {formatCurrency(repayment.interestCents, t)}
                    </span>
                  </div>
                </div>
                {hasNote && <div className="text-xs text-muted-foreground line-clamp-2">{repayment.note}</div>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

const loanTitleMaxLength = 11;

const normalizeLoanTitle = (title: string) => {
  const trimmed = title.trim();
  if (!trimmed) return "";
  return Array.from(trimmed).slice(0, loanTitleMaxLength).join("");
};

const sortLoansByStatus = (items: Loan[]) => {
  return [...items].sort((a, b) => {
    const aPaid = a.remainingPrincipalCents === 0n;
    const bPaid = b.remainingPrincipalCents === 0n;
    if (aPaid !== bPaid) {
      return aPaid ? 1 : -1;
    }
    return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
  });
};

const formatCentsInput = (valueCents: bigint) => {
  const value = Number(valueCents) / 100;
  if (!Number.isFinite(value)) {
    return "";
  }
  return value.toFixed(2);
};

const estimateEqualInstallmentInterest = (principalCents: bigint, rateBps: number, months: number) => {
  const principal = Number(principalCents);
  if (!Number.isFinite(principal) || principal <= 0) {
    return 0n;
  }
  const durationMonths = Math.max(1, Math.round(months));
  const monthsCount = Math.max(1, durationMonths);
  const annualRate = rateBps / 10000;
  if (annualRate <= 0) {
    return 0n;
  }
  const monthlyRate = annualRate / 12;
  const factor = Math.pow(1 + monthlyRate, monthsCount);
  const denominator = factor - 1;
  if (!Number.isFinite(factor) || denominator === 0) {
    return 0n;
  }
  const monthlyPayment = (principal * monthlyRate * factor) / denominator;
  if (!Number.isFinite(monthlyPayment)) {
    return 0n;
  }
  const totalInterest = monthlyPayment * monthsCount - principal;
  const rounded = Math.round(totalInterest);
  return rounded > 0 ? BigInt(rounded) : 0n;
};

const estimateLoanInterest = (principalCents: bigint, rateBps: number, months: number, method: number) => {
  const normalizedMonths = Number.isFinite(months) ? months : 0;
  const durationMonths = Math.max(1, Math.round(normalizedMonths));
  const monthsValue = BigInt(durationMonths);
  const rateBpsValue = BigInt(rateBps);
  const interestOnly = (principalCents * rateBpsValue * monthsValue) / 120000n;
  const equalPrincipal = (principalCents * rateBpsValue * (monthsValue + 1n)) / 240000n;
  switch (method) {
    case 1:
      return estimateEqualInstallmentInterest(principalCents, rateBps, durationMonths);
    case 2:
      return equalPrincipal;
    case 3:
      return interestOnly;
    case 4:
      return interestOnly;
    case 5:
      return interestOnly;
    default:
      return interestOnly;
  }
};

const roundCurrencyCents = (value: number) => Math.round(value);

const resolveRepaymentDate = (base: dayjs.Dayjs, repaymentDay: number) => {
  const safeDay = repaymentDay > 0 ? repaymentDay : base.date();
  const daysInMonth = base.daysInMonth();
  return base.date(Math.min(safeDay, daysInMonth));
};

const buildRepaymentDays = (startDate: Date, repaymentDay: number, totalMonths: number) => {
  const periods: number[] = [];
  let periodStart = dayjs(startDate);
  let periodEnd = resolveRepaymentDate(dayjs(startDate).add(1, "month"), repaymentDay);
  for (let i = 0; i < totalMonths; i += 1) {
    const days = Math.max(1, periodEnd.diff(periodStart, "day"));
    periods.push(days);
    periodStart = periodEnd;
    periodEnd = resolveRepaymentDate(periodEnd.add(1, "month"), repaymentDay);
  }
  return periods;
};

const estimateEqualInstallmentTotalInterestDaily = (loan: Loan) => {
  if (!loan.startTime) return 0n;
  const principal = Number(loan.principalCents);
  if (!Number.isFinite(principal) || principal <= 0) return 0n;

  const annualRate = loan.interestRateBps / 10000;
  if (!Number.isFinite(annualRate) || annualRate <= 0) return 0n;

  const totalMonths = Math.max(1, loan.repaymentPeriods);
  const startDate = timestampDate(loan.startTime);
  if (!Number.isFinite(startDate.getTime())) return 0n;

  const periods = buildRepaymentDays(startDate, loan.monthlyRepaymentDay, totalMonths);
  const dailyRate = annualRate / 365;

  let low = 0;
  let high = principal * 2;
  for (let i = 0; i < 60; i += 1) {
    const payment = (low + high) / 2;
    let remaining = principal;
    for (const days of periods) {
      const interest = roundCurrencyCents(remaining * dailyRate * days);
      remaining = remaining + interest - payment;
      if (remaining <= 0) break;
    }
    if (remaining > 0) {
      low = payment;
    } else {
      high = payment;
    }
  }

  const payment = roundCurrencyCents(high);
  let remaining = principal;
  let totalInterest = 0;
  for (const days of periods) {
    const interest = roundCurrencyCents(remaining * dailyRate * days);
    totalInterest += interest;
    const principalPayment = payment - interest;
    if (principalPayment >= remaining) {
      remaining = 0;
      break;
    }
    remaining -= principalPayment;
  }

  return BigInt(Math.max(0, totalInterest));
};

const estimateLoanTotalInterest = (loan: Loan) => {
  if (loan.repaymentMethod === 1 && loan.startTime) {
    return estimateEqualInstallmentTotalInterestDaily(loan);
  }
  return estimateLoanInterest(loan.principalCents, loan.interestRateBps, loan.repaymentPeriods, loan.repaymentMethod);
};

const sanitizeNumericInput = (value: string) => {
  const normalized = value.replace(/[^\d.]/g, "");
  const [integer, ...rest] = normalized.split(".");
  if (rest.length === 0) return integer;
  const decimals = rest.join("").slice(0, 2);
  return `${integer}.${decimals}`;
};

const sanitizeIntegerInput = (value: string) => value.replace(/\D/g, "");

const Loans = () => {
  const t = useTranslate();
  const md = useMediaQuery("md");
  const currentUser = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<LoanFilter>("all");
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const createLoanDialog = useDialog();
  const createBankDialog = useDialog();
  const manageBanksDialog = useDialog();
  const deleteDialog = useDialog();
  const deleteBankDialog = useDialog();

  const { data } = useLoans({}, { enabled: !!currentUser });
  const { data: bankData } = useBanks({ enabled: !!currentUser });
  const loans = data?.loans ?? [];
  const banks = bankData?.banks ?? [];

  const { mutateAsync: createLoan } = useCreateLoan();
  const { mutateAsync: createBank } = useCreateBank();
  const { mutateAsync: deleteBank } = useDeleteBank();
  const { mutateAsync: deleteLoan } = useDeleteLoan();
  const { mutateAsync: updateLoan } = useUpdateLoan();
  const { mutateAsync: createRepayment } = useCreateRepayment();
  const { mutateAsync: updateRepayment } = useUpdateRepayment();
  const { mutateAsync: deleteRepayment } = useDeleteRepayment();

  const [loanTitle, setLoanTitle] = useState("");
  const [loanDescription, setLoanDescription] = useState("");
  const [loanPrincipal, setLoanPrincipal] = useState("");
  const [loanRate, setLoanRate] = useState("");
  const [loanStartDate, setLoanStartDate] = useState("");
  const [loanBank, setLoanBank] = useState("");
  const [loanMonthlyDay, setLoanMonthlyDay] = useState("");
  const [loanPeriods, setLoanPeriods] = useState("");
  const [loanMethod, setLoanMethod] = useState(0);
  const [repaymentDate, setRepaymentDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [repaymentPrincipal, setRepaymentPrincipal] = useState("");
  const [repaymentInterest, setRepaymentInterest] = useState("");
  const [repaymentNote, setRepaymentNote] = useState("");
  const [repaymentIsEarly, setRepaymentIsEarly] = useState(false);
  const createRepaymentDialog = useDialog();
  const [repaymentLoan, setRepaymentLoan] = useState<Loan | null>(null);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [editLoanTitle, setEditLoanTitle] = useState("");
  const [editLoanDescription, setEditLoanDescription] = useState("");
  const [editLoanPrincipal, setEditLoanPrincipal] = useState("");
  const [editLoanRate, setEditLoanRate] = useState("");
  const [editLoanStartDate, setEditLoanStartDate] = useState("");
  const [editLoanBank, setEditLoanBank] = useState("");
  const [editLoanMonthlyDay, setEditLoanMonthlyDay] = useState("");
  const [editLoanPeriods, setEditLoanPeriods] = useState("");
  const [editLoanMethod, setEditLoanMethod] = useState(0);
  const [editLoanRemainingPrincipal, setEditLoanRemainingPrincipal] = useState(0n);
  const [editRepayment, setEditRepayment] = useState<Repayment | null>(null);
  const [editRepaymentDate, setEditRepaymentDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [editRepaymentPrincipal, setEditRepaymentPrincipal] = useState("");
  const [editRepaymentInterest, setEditRepaymentInterest] = useState("");
  const [editRepaymentNote, setEditRepaymentNote] = useState("");
  const [editRepaymentIsEarly, setEditRepaymentIsEarly] = useState(false);
  const editRepaymentDialog = useDialog();
  const deleteRepaymentDialog = useDialog();

  const [bankTitle, setBankTitle] = useState("");
  const [bankDescription, setBankDescription] = useState("");
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [bankToDelete, setBankToDelete] = useState<Bank | null>(null);
  const [loanOrderDraft, setLoanOrderDraft] = useState<Loan[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [draggingLoanName, setDraggingLoanName] = useState<string | null>(null);
  const [pointerDragging, setPointerDragging] = useState(false);
  const [hoverLoanName, setHoverLoanName] = useState<string | null>(null);

  const filteredLoans = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return loans.filter((loan) => {
      const matchQuery = normalized ? `${loan.title} ${loan.description}`.toLowerCase().includes(normalized) : true;
      if (!matchQuery) return false;
      if (filter === "paid") {
        return loan.remainingPrincipalCents === 0n;
      }
      if (filter === "active") {
        return loan.remainingPrincipalCents > 0n;
      }
      return true;
    });
  }, [loans, searchQuery, filter]);

  const orderedLoans = useMemo(() => {
    return manageMode ? loanOrderDraft : sortLoansByStatus(filteredLoans);
  }, [filteredLoans, loanOrderDraft, manageMode]);

  const bankNameMap = useMemo(() => buildBankNameMap(banks), [banks]);

  useEffect(() => {
    if (manageMode) {
      setLoanOrderDraft(sortLoansByStatus(loans));
    }
  }, [manageMode, loans]);

  const activeLoans = useMemo(() => {
    return filteredLoans.filter((loan) => loan.remainingPrincipalCents > 0n);
  }, [filteredLoans]);
  const totalOutstanding = useMemo(() => {
    return activeLoans.reduce((sum, loan) => sum + loan.remainingPrincipalCents, 0n);
  }, [activeLoans]);
  const totalPrincipal = useMemo(() => {
    return activeLoans.reduce((sum, loan) => sum + loan.principalCents, 0n);
  }, [activeLoans]);
  const totalRepaid = useMemo(() => {
    return activeLoans.reduce((sum, loan) => sum + loan.repaidAmountCents, 0n);
  }, [activeLoans]);
  const totalInterestEstimate = useMemo(() => {
    return activeLoans.reduce((sum, loan) => {
      const interestEstimate = estimateLoanInterest(loan.principalCents, loan.interestRateBps, loan.repaymentPeriods, loan.repaymentMethod);
      return sum + interestEstimate;
    }, 0n);
  }, [activeLoans]);
  const totalPayable = useMemo(() => {
    return totalPrincipal + totalInterestEstimate;
  }, [totalPrincipal, totalInterestEstimate]);

  const handleCreateLoan = async () => {
    const normalizedTitle = normalizeLoanTitle(loanTitle);
    if (!normalizedTitle || !loanPrincipal.trim()) {
      toast.error(t("message.fill-all-required-fields"));
      return;
    }
    const principalValue = parseCurrencyToCents(loanPrincipal);
    if (principalValue === null || principalValue <= 0) {
      toast.error(t("loan.amount-invalid"));
      return;
    }
    const rateValue = loanRate.trim() ? Math.round(Number(loanRate) * 100) : 0;
    if (!Number.isFinite(rateValue) || rateValue < 0) {
      toast.error(t("loan.rate-invalid"));
      return;
    }
    const startDate = loanStartDate ? new Date(`${loanStartDate}T00:00:00`) : null;
    if (loanStartDate && (!startDate || Number.isNaN(startDate.getTime()))) {
      toast.error(t("loan.date-invalid"));
      return;
    }

    try {
      const monthlyDay = loanMonthlyDay.trim() ? Number(loanMonthlyDay) : 0;
      if (!Number.isFinite(monthlyDay) || monthlyDay < 0 || monthlyDay > 31) {
        toast.error(t("loan.monthly-day-invalid"));
        return;
      }
      const periods = loanPeriods.trim() ? Number(loanPeriods) : 1;
      if (!Number.isFinite(periods) || periods < 0) {
        toast.error(t("loan.years-invalid"));
        return;
      }
      await createLoan(
        create(LoanSchema, {
          title: normalizedTitle,
          description: loanDescription.trim(),
          principalCents: BigInt(principalValue),
          interestRateBps: rateValue,
          bank: loanBank,
          startTime: startDate ? timestampFromDate(startDate) : undefined,
          monthlyRepaymentDay: monthlyDay,
          repaymentPeriods: periods,
          repaymentMethod: loanMethod,
        } as Loan),
      );
      setLoanTitle("");
      setLoanDescription("");
      setLoanPrincipal("");
      setLoanRate("");
      setLoanStartDate("");
      setLoanBank("");
      setLoanMonthlyDay("");
      setLoanPeriods("");
      setLoanMethod(0);
      setLoanPeriods("");
      createLoanDialog.close();
      setSelectedLoan(null);
    } catch (error) {
      handleError(error, toast.error, { context: "Create loan" });
    }
  };

  const handleCreateRepayment = async () => {
    if (!repaymentLoan || !repaymentDate.trim() || !repaymentPrincipal.trim() || !repaymentInterest.trim()) {
      toast.error(t("message.fill-all-required-fields"));
      return;
    }
    const principalCents = parseCurrencyToCents(repaymentPrincipal);
    const interestCents = parseCurrencyToCents(repaymentInterest);
    if (principalCents === null || principalCents < 0 || interestCents === null || interestCents < 0) {
      toast.error(t("loan.amount-invalid"));
      return;
    }
    const repaymentTime = new Date(`${repaymentDate}T00:00:00`);
    if (!repaymentDate.trim() || Number.isNaN(repaymentTime.getTime())) {
      toast.error(t("loan.date-invalid"));
      return;
    }
    try {
      await createRepayment(
        create(CreateRepaymentRequestSchema, {
          parent: repaymentLoan.name,
          repayment: create(RepaymentSchema, {
            loan: repaymentLoan.name,
            repaymentTime: timestampFromDate(repaymentTime),
            principalCents: BigInt(principalCents),
            interestCents: BigInt(interestCents),
            note: repaymentNote.trim(),
            isEarlyRepayment: repaymentIsEarly,
          }),
        }),
      );
      setRepaymentLoan(null);
      setRepaymentDate(dayjs().format("YYYY-MM-DD"));
      setRepaymentPrincipal("");
      setRepaymentInterest("");
      setRepaymentNote("");
      setRepaymentIsEarly(false);
      createRepaymentDialog.close();
      toast.success(t("loan.repayment-created"));
      setSelectedLoan(repaymentLoan);
    } catch (error) {
      handleError(error, toast.error, { context: "Create repayment" });
    }
  };

  const orderDirty = useMemo(() => {
    if (!manageMode) return false;
    const original = sortLoansByStatus(loans)
      .map((loan) => loan.name)
      .join("|");
    const draft = loanOrderDraft.map((loan) => loan.name).join("|");
    return original !== draft;
  }, [manageMode, loanOrderDraft, loans]);

  const handleSaveOrder = async () => {
    if (!orderDirty) {
      setManageMode(false);
      return;
    }
    try {
      setSavingOrder(true);
      await Promise.all(
        loanOrderDraft.map((loan, index) =>
          updateLoan({
            loan: { name: loan.name, orderIndex: index + 1 },
            updateMask: ["order_index"],
          }),
        ),
      );
      toast.success(t("loan.order-saved"));
      setManageMode(false);
    } catch (error) {
      handleError(error, toast.error, { context: "Update loan order" });
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, loanName: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", loanName);
    setDraggingLoanName(loanName);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, loanName: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (hoverLoanName !== loanName) {
      setHoverLoanName(loanName);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, loanName: string) => {
    event.preventDefault();
    const draggedName = event.dataTransfer.getData("text/plain");
    if (!draggedName || draggedName === loanName) {
      setHoverLoanName(null);
      return;
    }
    setLoanOrderDraft((prev) => {
      const sourceIndex = prev.findIndex((item) => item.name === draggedName);
      const targetIndex = prev.findIndex((item) => item.name === loanName);
      if (sourceIndex < 0 || targetIndex < 0) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setHoverLoanName(null);
  };

  const handleDragEnd = () => {
    setDraggingLoanName(null);
    setHoverLoanName(null);
  };

  const reorderLoans = (sourceName: string, targetName: string) => {
    if (!sourceName || !targetName || sourceName === targetName) {
      return;
    }
    setLoanOrderDraft((prev) => {
      const sourceIndex = prev.findIndex((item) => item.name === sourceName);
      const targetIndex = prev.findIndex((item) => item.name === targetName);
      if (sourceIndex < 0 || targetIndex < 0) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setHoverLoanName(targetName);
    setDraggingLoanName(targetName);
  };

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>, loanName: string) => {
    if (!manageMode || event.pointerType === "mouse") {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerDragging(true);
    setDraggingLoanName(loanName);
    setHoverLoanName(loanName);
  };

  const handlePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (!pointerDragging || !draggingLoanName) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const card = target?.closest<HTMLElement>("[data-loan-name]");
    const targetName = card?.dataset.loanName;
    if (!targetName || targetName === draggingLoanName) {
      return;
    }
    reorderLoans(draggingLoanName, targetName);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLSpanElement>) => {
    if (!pointerDragging) {
      return;
    }
    event.preventDefault();
    event.currentTarget.releasePointerCapture(event.pointerId);
    setPointerDragging(false);
    setDraggingLoanName(null);
    setHoverLoanName(null);
  };

  const startEditLoan = (loan: Loan) => {
    setEditLoan(loan);
    setEditLoanTitle(loan.title ?? "");
    setEditLoanDescription(loan.description ?? "");
    setEditLoanPrincipal(formatCentsInput(loan.principalCents));
    setEditLoanRate((loan.interestRateBps / 100).toFixed(2));
    setEditLoanStartDate(loan.startTime ? dayjs(timestampDate(loan.startTime)).format("YYYY-MM-DD") : "");
    setEditLoanBank(loan.bank ?? "");
    setEditLoanMonthlyDay(loan.monthlyRepaymentDay > 0 ? String(loan.monthlyRepaymentDay) : "");
    setEditLoanPeriods(loan.repaymentPeriods > 0 ? String(loan.repaymentPeriods) : "");
    setEditLoanMethod(loan.repaymentMethod ?? 0);
    setEditLoanRemainingPrincipal(loan.remainingPrincipalCents);
  };

  const handleUpdateLoan = async () => {
    if (!editLoan) return;
    const normalizedTitle = normalizeLoanTitle(editLoanTitle);
    if (!normalizedTitle || !editLoanPrincipal.trim()) {
      toast.error(t("message.fill-all-required-fields"));
      return;
    }
    const principalValue = parseCurrencyToCents(editLoanPrincipal);
    if (principalValue === null || principalValue <= 0) {
      toast.error(t("loan.amount-invalid"));
      return;
    }
    const rateValue = editLoanRate.trim() ? Math.round(Number(editLoanRate) * 100) : 0;
    if (!Number.isFinite(rateValue) || rateValue < 0) {
      toast.error(t("loan.rate-invalid"));
      return;
    }
    const startDate = editLoanStartDate ? new Date(`${editLoanStartDate}T00:00:00`) : null;
    if (editLoanStartDate && (!startDate || Number.isNaN(startDate.getTime()))) {
      toast.error(t("loan.date-invalid"));
      return;
    }
    const monthlyDay = editLoanMonthlyDay.trim() ? Number(editLoanMonthlyDay) : 0;
    if (!Number.isFinite(monthlyDay) || monthlyDay < 0 || monthlyDay > 31) {
      toast.error(t("loan.monthly-day-invalid"));
      return;
    }
    const periods = editLoanPeriods.trim() ? Number(editLoanPeriods) : 1;
    if (!Number.isFinite(periods) || periods < 0) {
      toast.error(t("loan.years-invalid"));
      return;
    }
    if (!startDate) {
      toast.error(t("loan.date-invalid"));
      return;
    }
    const updateMask = [
      "title",
      "description",
      "principal_cents",
      "interest_rate_bps",
      "bank",
      "start_time",
      "monthly_repayment_day",
      "repayment_periods",
      "repayment_method",
      "remaining_principal_cents",
    ];
    try {
      await updateLoan({
        loan: create(LoanSchema, {
          name: editLoan.name,
          title: normalizedTitle,
          description: editLoanDescription.trim(),
          principalCents: BigInt(principalValue),
          interestRateBps: rateValue,
          bank: editLoanBank,
          startTime: timestampFromDate(startDate),
          monthlyRepaymentDay: monthlyDay,
          repaymentPeriods: periods,
          repaymentMethod: editLoanMethod,
          remainingPrincipalCents: editLoanRemainingPrincipal,
        } as Loan),
        updateMask,
      });
      toast.success(t("loan.updated"));
      setEditLoan(null);
    } catch (error) {
      handleError(error, toast.error, { context: "Update loan" });
    }
  };

  const startEditRepayment = (repayment: Repayment) => {
    setEditRepayment(repayment);
    setEditRepaymentDate(
      repayment.repaymentTime ? dayjs(timestampDate(repayment.repaymentTime)).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
    );
    setEditRepaymentPrincipal(formatCentsInput(repayment.principalCents));
    setEditRepaymentInterest(formatCentsInput(repayment.interestCents));
    setEditRepaymentNote(repayment.note ?? "");
    setEditRepaymentIsEarly(repayment.isEarlyRepayment ?? false);
    editRepaymentDialog.open();
  };

  const handleUpdateRepayment = async () => {
    if (!editRepayment) return;
    const principalCents = parseCurrencyToCents(editRepaymentPrincipal);
    const interestCents = parseCurrencyToCents(editRepaymentInterest);
    if (principalCents === null || principalCents < 0 || interestCents === null || interestCents < 0) {
      toast.error(t("loan.amount-invalid"));
      return;
    }
    const repaymentTime = new Date(`${editRepaymentDate}T00:00:00`);
    if (!editRepaymentDate.trim() || Number.isNaN(repaymentTime.getTime())) {
      toast.error(t("loan.date-invalid"));
      return;
    }
    try {
      await updateRepayment({
        repayment: create(RepaymentSchema, {
          name: editRepayment.name,
          repaymentTime: timestampFromDate(repaymentTime),
          principalCents: BigInt(principalCents),
          interestCents: BigInt(interestCents),
          note: editRepaymentNote.trim(),
          isEarlyRepayment: editRepaymentIsEarly,
        } as Repayment),
        updateMask: ["repayment_time", "principal_cents", "interest_cents", "note", "is_early_repayment"],
      });
      toast.success(t("loan.repayment-updated"));
      editRepaymentDialog.close();
      setEditRepayment(null);
      setEditRepaymentIsEarly(false);
    } catch (error) {
      handleError(error, toast.error, { context: "Update repayment" });
    }
  };

  const handleDeleteRepayment = async () => {
    if (!editRepayment) return;
    try {
      await deleteRepayment({ name: editRepayment.name, parent: editRepayment.loan });
      toast.success(t("loan.repayment-deleted"));
      deleteRepaymentDialog.close();
      editRepaymentDialog.close();
      setEditRepayment(null);
    } catch (error) {
      handleError(error, toast.error, { context: "Delete repayment" });
    }
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && <MobileHeader className="shadow-none" />}
      <div className="w-full px-4 sm:px-6 space-y-6 overflow-x-hidden pb-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LandmarkIcon className="w-5 h-5" />
          <h1 className="text-xl font-semibold text-foreground">{t("loan.title")}</h1>
        </div>
        <div className="grid gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={t("loan.search")}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    disabled={manageMode}
                  />
                </div>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as LoanFilter)}
                  disabled={manageMode}
                >
                  <option value="all">{t("common.all")}</option>
                  <option value="active">{t("loan.filter-active")}</option>
                  <option value="paid">{t("loan.filter-paid")}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 items-stretch gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                <Button
                  variant={manageMode ? "secondary" : "outline"}
                  size="sm"
                  className="w-full gap-1.5 whitespace-nowrap justify-center sm:w-auto"
                  onClick={() => (manageMode ? handleSaveOrder() : setManageMode(true))}
                  disabled={savingOrder}
                >
                  <SettingsIcon className="h-4 w-4" />
                  <span>{manageMode ? t("loan.manage-done") : t("loan.manage-loans")}</span>
                </Button>
                <Dialog open={createLoanDialog.isOpen} onOpenChange={createLoanDialog.setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full gap-1.5 whitespace-nowrap justify-center sm:w-auto">
                      <PlusIcon className="h-4 w-4" />
                      <span>{t("loan.create-loan")}</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent size="xl">
                    <DialogHeader className="relative p-4">
                      <div className="relative space-y-2">
                        <DialogTitle className="text-2xl font-semibold tracking-tight leading-tight">{t("loan.create-loan")}</DialogTitle>
                        <DialogDescription className="max-w-2xl">{t("loan.create-loan-desc")}</DialogDescription>
                      </div>
                    </DialogHeader>
                    <div className="grid gap-5">
                      <div className="space-y-4">
                        <div className="grid gap-4 rounded-xl border border-border bg-background p-4">
                          <div className="space-y-2">
                            <Label htmlFor="loan-title">{t("loan.fields.title")}</Label>
                            <Input
                              id="loan-title"
                              value={loanTitle}
                              maxLength={loanTitleMaxLength}
                              onChange={(event) => setLoanTitle(normalizeLoanTitle(event.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="loan-desc">{t("loan.fields.description")}</Label>
                            <Textarea id="loan-desc" value={loanDescription} onChange={(event) => setLoanDescription(event.target.value)} />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="loan-principal">{t("loan.fields.principal")}</Label>
                              <Input
                                id="loan-principal"
                                value={loanPrincipal}
                                inputMode="decimal"
                                pattern="[0-9.]*"
                                onChange={(event) => setLoanPrincipal(sanitizeNumericInput(event.target.value))}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="loan-rate">{t("loan.fields.rate")}</Label>
                              <Input
                                id="loan-rate"
                                value={loanRate}
                                inputMode="decimal"
                                pattern="[0-9.]*"
                                onChange={(event) => setLoanRate(sanitizeNumericInput(event.target.value))}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="loan-start">{t("loan.fields.start-time")}</Label>
                              <Input
                                id="loan-start"
                                type="date"
                                value={loanStartDate}
                                onChange={(event) => setLoanStartDate(event.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="loan-monthly-day">{t("loan.fields.monthly-day")}</Label>
                              <Input
                                id="loan-monthly-day"
                                value={loanMonthlyDay}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                onChange={(event) => setLoanMonthlyDay(sanitizeIntegerInput(event.target.value))}
                                placeholder={t("loan.fields.monthly-day-placeholder")}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 rounded-xl border border-border bg-muted/10 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <Label htmlFor="loan-bank" className="shrink-0">
                              {t("loan.fields.bank")}
                            </Label>
                            <div className="inline-flex w-full overflow-hidden rounded-md border border-border bg-background/70 sm:w-auto">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 gap-1.5 rounded-none border-r border-border px-3 text-foreground hover:bg-background sm:flex-none"
                                onClick={() => manageBanksDialog.open()}
                              >
                                <SettingsIcon className="h-3.5 w-3.5" />
                                {t("loan.manage-banks")}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 gap-1.5 rounded-none px-3 text-foreground hover:bg-background sm:flex-none"
                                onClick={() => createBankDialog.open()}
                              >
                                <PlusIcon className="h-3.5 w-3.5" />
                                {t("loan.create-bank")}
                              </Button>
                            </div>
                          </div>
                          <select
                            id="loan-bank"
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={loanBank}
                            onChange={(event) => setLoanBank(event.target.value)}
                          >
                            <option value="">{t("loan.bank-none")}</option>
                            {banks.map((bank) => (
                              <option key={bank.name} value={bank.name}>
                                {bank.title}
                              </option>
                            ))}
                          </select>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="loan-years">{t("loan.fields.repayment-years")}</Label>
                              <Input
                                id="loan-years"
                                value={loanPeriods}
                                inputMode="decimal"
                                pattern="[0-9.]*"
                                onChange={(event) => setLoanPeriods(sanitizeNumericInput(event.target.value))}
                                placeholder={t("loan.fields.repayment-years-placeholder")}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="loan-method">{t("loan.fields.repayment-method")}</Label>
                              <select
                                id="loan-method"
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={loanMethod}
                                onChange={(event) => setLoanMethod(Number(event.target.value))}
                              >
                                <option value={0}>{t("loan.repayment-method-labels.unspecified")}</option>
                                <option value={1}>{t("loan.repayment-method-labels.equal-installment")}</option>
                                <option value={2}>{t("loan.repayment-method-labels.equal-principal")}</option>
                                <option value={3}>{t("loan.repayment-method-labels.interest-only")}</option>
                                <option value={4}>{t("loan.repayment-method-labels.flexible")}</option>
                                <option value={5}>{t("loan.repayment-method-labels.equal-principal-interest")}</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="sm:items-center">
                      <Button variant="outline" onClick={() => createLoanDialog.close()}>
                        {t("common.cancel")}
                      </Button>
                      <Button onClick={handleCreateLoan}>{t("common.create")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={manageBanksDialog.isOpen} onOpenChange={manageBanksDialog.setOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("loan.manage-banks")}</DialogTitle>
                      <DialogDescription>{t("loan.manage-banks-desc")}</DialogDescription>
                    </DialogHeader>
                    {banks.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                        <Empty />
                        <span>{t("loan.bank-empty")}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {banks.map((bank) => (
                          <div key={bank.name} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
                            <div className="min-w-0 space-y-0.5">
                              <div className="font-medium text-foreground truncate">{bank.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {bank.description || t("loan.bank-desc-empty")}
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="destructive"
                              onClick={() => {
                                setBankToDelete(bank);
                                deleteBankDialog.open();
                              }}
                            >
                              <Trash2Icon className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
                <Dialog open={createBankDialog.isOpen} onOpenChange={createBankDialog.setOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("loan.create-bank")}</DialogTitle>
                      <DialogDescription>{t("loan.create-bank-desc")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="bank-title">{t("loan.fields.bank-title")}</Label>
                        <Input id="bank-title" value={bankTitle} onChange={(event) => setBankTitle(event.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="bank-desc">{t("loan.fields.bank-description")}</Label>
                        <Textarea id="bank-desc" value={bankDescription} onChange={(event) => setBankDescription(event.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => createBankDialog.close()}>
                        {t("common.cancel")}
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!bankTitle.trim()) {
                            toast.error(t("message.fill-all-required-fields"));
                            return;
                          }
                          try {
                            await createBank(
                              create(BankSchema, {
                                title: bankTitle.trim(),
                                description: bankDescription.trim(),
                              }),
                            );
                            setBankTitle("");
                            setBankDescription("");
                            createBankDialog.close();
                          } catch (error) {
                            handleError(error, toast.error, { context: "Create bank" });
                          }
                        }}
                      >
                        {t("common.create")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            {manageMode && (
              <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-xs text-primary">
                {t("loan.manage-tip")}
              </div>
            )}
          </div>

          <div className="grid gap-4">
            <div className="rounded-xl border border-primary/40 bg-primary/8 p-4 overflow-hidden">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-primary">
                  <BanknoteIcon className="h-4 w-4" />
                  <span>{t("loan.total-outstanding")}</span>
                </div>
                <span className="text-lg font-semibold text-primary">{formatCurrency(totalOutstanding, t)}</span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>{t("loan.progress")}</span>
                  <span>
                    {t("loan.progress-detail", { repaid: formatCurrency(totalRepaid, t), total: formatCurrency(totalPayable, t) })}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, Number(totalPayable === 0n ? 0 : (totalRepaid * 100n) / totalPayable))}%`,
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {t("loan.principal")}: {formatCurrency(totalPrincipal, t)}
                  </span>
                  <span>
                    {t("loan.total-interest")}: {formatCurrency(totalInterestEstimate, t)}
                  </span>
                </div>
              </div>
            </div>

            {(manageMode ? loanOrderDraft : filteredLoans).length === 0 ? (
              <div className="w-full rounded-xl border border-border bg-background px-4 py-8">
                <div className="flex flex-col items-center gap-3">
                  <Empty />
                  <span className="text-sm text-muted-foreground">{t("loan.empty")}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {orderedLoans.map((loan) => {
                  const startDate = loan.startTime ? dayjs(timestampDate(loan.startTime)).format("YYYY-MM-DD") : "-";
                  const nextDate = loan.nextRepaymentTime ? dayjs(timestampDate(loan.nextRepaymentTime)).format("YYYY-MM-DD") : "-";
                  const isPaid = loan.remainingPrincipalCents === 0n;
                  const estimatedInterest = estimateLoanInterest(
                    loan.principalCents,
                    loan.interestRateBps,
                    loan.repaymentPeriods,
                    loan.repaymentMethod,
                  );
                  const totalInterest = estimateLoanTotalInterest(loan);
                  const actualInterest = loan.repaidInterestCents;
                  const interestDelta = actualInterest - totalInterest;
                  const isSettled = loan.remainingPrincipalCents === 0n;
                  const settledStyle = isSettled
                    ? interestDelta <= 0n
                      ? "border-emerald-500/40 bg-emerald-500/8"
                      : "border-rose-500/40 bg-rose-500/8"
                    : "border-border";
                  const payableTotal = loan.principalCents + totalInterest;
                  const isDragging = draggingLoanName === loan.name;
                  const isHovering = hoverLoanName === loan.name && draggingLoanName !== loan.name;
                  const isInteractive = manageMode;
                  const canNativeDrag = isInteractive && md;
                  return (
                    <div
                      key={loan.name}
                      data-loan-name={loan.name}
                      draggable={canNativeDrag}
                      onDragStart={(event) => canNativeDrag && handleDragStart(event, loan.name)}
                      onDragOver={(event) => canNativeDrag && handleDragOver(event, loan.name)}
                      onDrop={(event) => canNativeDrag && handleDrop(event, loan.name)}
                      onDragEnd={handleDragEnd}
                      className={[
                        "relative rounded-xl border border-border bg-background px-4 py-4 shadow-sm transition-all sm:cursor-auto",
                        isInteractive ? "cursor-move" : "",
                        isDragging ? "opacity-60 shadow-none" : "",
                        isHovering ? "border-primary/60 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]" : "",
                      ].join(" ")}
                    >
                      {!manageMode && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="absolute right-3 top-3 h-8 w-8"
                          aria-label={t("loan.edit-loan")}
                          onClick={() => startEditLoan(loan)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {manageMode && (
                                <span
                                  className="inline-flex items-center justify-center rounded-full border border-border bg-muted/30 p-1 touch-none"
                                  onPointerDown={(event) => handlePointerDown(event, loan.name)}
                                  onPointerMove={handlePointerMove}
                                  onPointerUp={handlePointerEnd}
                                  onPointerCancel={handlePointerEnd}
                                >
                                  <GripVerticalIcon className="h-4 w-4 text-muted-foreground" />
                                </span>
                              )}
                              <h2 className="text-base sm:text-lg font-semibold text-foreground truncate" title={loan.title}>
                                {loan.title}
                              </h2>
                              <span
                                className={[
                                  "text-xs px-2 py-0.5 rounded-full shrink-0",
                                  isPaid ? "text-emerald-600 bg-emerald-600/10" : "text-amber-600 bg-amber-500/10",
                                ].join(" ")}
                              >
                                {isPaid ? t("loan.status-paid") : t("loan.status-active")}
                              </span>
                            </div>
                            {loan.description && <p className="text-sm text-muted-foreground">{loan.description}</p>}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {(() => {
                                const bankTitle = formatBankName(bankNameMap, loan.bank);
                                if (bankTitle) {
                                  return (
                                    <span className="inline-flex items-center gap-1">
                                      <LandmarkIcon className="h-3 w-3" />
                                      {bankTitle}
                                    </span>
                                  );
                                }
                                if (loan.bank) {
                                  return (
                                    <span className="inline-flex items-center gap-1">
                                      <LandmarkIcon className="h-3 w-3" />
                                      {t("loan.bank-unknown")}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              <span className="inline-flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {t("loan.start-time")}: {startDate}
                              </span>
                              {loan.monthlyRepaymentDay > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
                                  {t("loan.monthly-day", { day: loan.monthlyRepaymentDay })}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <RefreshCcwIcon className="h-3 w-3" />
                                {t("loan.next-time")}: {nextDate}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={`rounded-lg border p-3 space-y-2 text-sm ${settledStyle}`}>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{t("loan.progress")}</span>
                            <span>
                              {t("loan.progress-detail", {
                                repaid: formatCurrency(loan.repaidAmountCents, t),
                                total: formatCurrency(payableTotal, t),
                              })}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${Math.min(100, Number(payableTotal === 0n ? 0 : (loan.repaidAmountCents * 100n) / payableTotal))}%`,
                              }}
                            />
                          </div>
                          <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-4 sm:items-center">
                            <span>
                              {t("loan.principal")}: {formatCurrency(loan.principalCents, t)}
                            </span>
                            <span>
                              {t("loan.rate")}: {(loan.interestRateBps / 100).toFixed(2)}%
                            </span>
                            <span>
                              {t("loan.total-interest")}: {formatCurrency(estimatedInterest, t)}
                            </span>
                            <span>
                              {t("loan.total-interest-actual")}: {formatCurrency(actualInterest, t)}
                            </span>
                          </div>
                          {isSettled && (
                            <div
                              className={`mt-1 rounded-md border px-2 py-1 text-xs font-medium ${
                                interestDelta <= 0n
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                                  : "border-rose-500/40 bg-rose-500/10 text-rose-700"
                              }`}
                            >
                              {interestDelta <= 0n ? t("loan.settled-saved") : t("loan.settled-over")}
                            </div>
                          )}
                        </div>
                        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                          {!manageMode && (
                            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setSelectedLoan(loan)}>
                              {t("loan.repayment-records")}
                            </Button>
                          )}
                          {!manageMode && !isPaid && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() => {
                                setRepaymentLoan(loan);
                                createRepaymentDialog.open();
                              }}
                            >
                              {t("loan.create-repayment")}
                            </Button>
                          )}
                          {manageMode && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="col-span-2 w-full sm:w-auto"
                              onClick={() => {
                                setLoanToDelete(loan);
                                deleteDialog.open();
                              }}
                            >
                              <Trash2Icon className="mr-1 h-4 w-4" />
                              {t("common.delete")}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={Boolean(selectedLoan)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLoan(null);
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{selectedLoan?.title}</DialogTitle>
            <DialogDescription className="flex items-center justify-between gap-2">
              <span>{t("loan.repayments-title")}</span>
              {selectedLoan?.remainingPrincipalCents !== 0n && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => {
                    if (!selectedLoan) return;
                    setRepaymentLoan(selectedLoan);
                    createRepaymentDialog.open();
                  }}
                  aria-label={t("loan.create-repayment")}
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedLoan && <LoanRepayments loan={selectedLoan} onEditRepayment={startEditRepayment} />}
        </DialogContent>
      </Dialog>

      <Dialog
        open={createRepaymentDialog.isOpen}
        onOpenChange={(open) => {
          createRepaymentDialog.setOpen(open);
          if (!open) {
            setRepaymentLoan(null);
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t("loan.create-repayment")}</DialogTitle>
            <DialogDescription>
              {repaymentLoan ? t("loan.create-repayment-for", { title: repaymentLoan.title }) : t("loan.create-repayment-desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="repayment-date">{t("loan.repayment-date")}</Label>
              <Input id="repayment-date" type="date" value={repaymentDate} onChange={(event) => setRepaymentDate(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="repayment-is-early">{t("loan.repayment-early-label")}</Label>
              <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                <Checkbox
                  id="repayment-is-early"
                  checked={repaymentIsEarly}
                  onCheckedChange={(value) => setRepaymentIsEarly(Boolean(value))}
                />
                <span className="text-sm text-foreground">{t("loan.repayment-early")}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="repayment-principal">{t("loan.repayment-principal")}</Label>
              <Input
                id="repayment-principal"
                value={repaymentPrincipal}
                onChange={(event) => setRepaymentPrincipal(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="repayment-interest">{t("loan.repayment-interest")}</Label>
              <Input
                id="repayment-interest"
                value={repaymentInterest}
                onChange={(event) => setRepaymentInterest(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="repayment-note">{t("loan.repayment-note")}</Label>
              <Textarea id="repayment-note" value={repaymentNote} onChange={(event) => setRepaymentNote(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => createRepaymentDialog.close()}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreateRepayment}>{t("loan.repayment-submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editRepaymentDialog.isOpen}
        onOpenChange={(open) => {
          editRepaymentDialog.setOpen(open);
          if (!open) {
            setEditRepayment(null);
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t("loan.edit-repayment")}</DialogTitle>
            <DialogDescription>{t("loan.edit-repayment-desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="edit-repayment-date">{t("loan.repayment-date")}</Label>
              <Input
                id="edit-repayment-date"
                type="date"
                value={editRepaymentDate}
                onChange={(event) => setEditRepaymentDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-repayment-is-early">{t("loan.repayment-early-label")}</Label>
              <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                <Checkbox
                  id="edit-repayment-is-early"
                  checked={editRepaymentIsEarly}
                  onCheckedChange={(value) => setEditRepaymentIsEarly(Boolean(value))}
                />
                <span className="text-sm text-foreground">{t("loan.repayment-early")}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-repayment-principal">{t("loan.repayment-principal")}</Label>
              <Input
                id="edit-repayment-principal"
                value={editRepaymentPrincipal}
                onChange={(event) => setEditRepaymentPrincipal(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-repayment-interest">{t("loan.repayment-interest")}</Label>
              <Input
                id="edit-repayment-interest"
                value={editRepaymentInterest}
                onChange={(event) => setEditRepaymentInterest(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="edit-repayment-note">{t("loan.repayment-note")}</Label>
              <Textarea id="edit-repayment-note" value={editRepaymentNote} onChange={(event) => setEditRepaymentNote(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => editRepaymentDialog.close()}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => deleteRepaymentDialog.open()}>
              {t("common.delete")}
            </Button>
            <Button onClick={handleUpdateRepayment}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteRepaymentDialog.isOpen}
        onOpenChange={deleteRepaymentDialog.setOpen}
        title={t("loan.repayment-delete-title")}
        description={t("loan.repayment-delete-desc")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        confirmVariant="destructive"
        onConfirm={handleDeleteRepayment}
      />

      <Dialog
        open={Boolean(editLoan)}
        onOpenChange={(open) => {
          if (!open) {
            setEditLoan(null);
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t("loan.edit-loan")}</DialogTitle>
            <DialogDescription>{t("loan.edit-loan-desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="edit-loan-title">{t("loan.fields.title")}</Label>
              <Input
                id="edit-loan-title"
                value={editLoanTitle}
                maxLength={loanTitleMaxLength}
                onChange={(event) => setEditLoanTitle(normalizeLoanTitle(event.target.value))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="edit-loan-desc">{t("loan.fields.description")}</Label>
              <Textarea id="edit-loan-desc" value={editLoanDescription} onChange={(event) => setEditLoanDescription(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-loan-principal">{t("loan.fields.principal")}</Label>
              <Input
                id="edit-loan-principal"
                value={editLoanPrincipal}
                inputMode="decimal"
                pattern="[0-9.]*"
                onChange={(event) => setEditLoanPrincipal(sanitizeNumericInput(event.target.value))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-loan-rate">{t("loan.fields.rate")}</Label>
              <Input
                id="edit-loan-rate"
                value={editLoanRate}
                inputMode="decimal"
                pattern="[0-9.]*"
                onChange={(event) => setEditLoanRate(sanitizeNumericInput(event.target.value))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-loan-start">{t("loan.fields.start-time")}</Label>
              <Input
                id="edit-loan-start"
                type="date"
                value={editLoanStartDate}
                onChange={(event) => setEditLoanStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-loan-bank">{t("loan.fields.bank")}</Label>
              <select
                id="edit-loan-bank"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={editLoanBank}
                onChange={(event) => setEditLoanBank(event.target.value)}
              >
                <option value="">{t("loan.bank-none")}</option>
                {banks.map((bank) => (
                  <option key={bank.name} value={bank.name}>
                    {bank.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-loan-monthly-day">{t("loan.fields.monthly-day")}</Label>
              <Input
                id="edit-loan-monthly-day"
                value={editLoanMonthlyDay}
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(event) => setEditLoanMonthlyDay(sanitizeIntegerInput(event.target.value))}
                placeholder={t("loan.fields.monthly-day-placeholder")}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="edit-loan-years">{t("loan.fields.repayment-years")}</Label>
              <Input
                id="edit-loan-years"
                value={editLoanPeriods}
                inputMode="decimal"
                pattern="[0-9.]*"
                onChange={(event) => setEditLoanPeriods(sanitizeNumericInput(event.target.value))}
                placeholder={t("loan.fields.repayment-years-placeholder")}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="edit-loan-method">{t("loan.fields.repayment-method")}</Label>
              <select
                id="edit-loan-method"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={editLoanMethod}
                onChange={(event) => setEditLoanMethod(Number(event.target.value))}
              >
                <option value={0}>{t("loan.repayment-method-labels.unspecified")}</option>
                <option value={1}>{t("loan.repayment-method-labels.equal-installment")}</option>
                <option value={2}>{t("loan.repayment-method-labels.equal-principal")}</option>
                <option value={3}>{t("loan.repayment-method-labels.interest-only")}</option>
                <option value={4}>{t("loan.repayment-method-labels.flexible")}</option>
                <option value={5}>{t("loan.repayment-method-labels.equal-principal-interest")}</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="edit-loan-settled">{t("loan.settled-label")}</Label>
              <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                <Checkbox
                  id="edit-loan-settled"
                  checked={editLoanRemainingPrincipal === 0n}
                  onCheckedChange={(value) => {
                    if (!editLoan) return;
                    if (value) {
                      setEditLoanRemainingPrincipal(0n);
                      return;
                    }
                    const principalValue = parseCurrencyToCents(editLoanPrincipal);
                    const basePrincipal = principalValue !== null ? BigInt(principalValue) : editLoan.principalCents;
                    const remaining = basePrincipal - editLoan.repaidPrincipalCents;
                    setEditLoanRemainingPrincipal(remaining > 0n ? remaining : 0n);
                  }}
                />
                <span className="text-sm text-foreground">{t("loan.settled")}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLoan(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleUpdateLoan}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setOpen}
        title={t("loan.delete-title")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!loanToDelete) return;
          try {
            await deleteLoan(loanToDelete.name);
            setLoanToDelete(null);
            setLoanOrderDraft((prev) => prev.filter((loan) => loan.name !== loanToDelete.name));
            deleteDialog.close();
          } catch (error) {
            handleError(error, toast.error, { context: "Delete loan" });
          }
        }}
        confirmVariant="destructive"
      />
      <ConfirmDialog
        open={deleteBankDialog.isOpen}
        onOpenChange={(open) => {
          deleteBankDialog.setOpen(open);
          if (!open) {
            setBankToDelete(null);
          }
        }}
        title={t("loan.bank-delete-title")}
        description={t("loan.bank-delete-desc")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!bankToDelete) return;
          try {
            await deleteBank(bankToDelete.name);
            toast.success(t("loan.bank-deleted"));
            setBankToDelete(null);
          } catch (error) {
            handleError(error, toast.error, { context: "Delete bank" });
          }
        }}
        confirmVariant="destructive"
      />
    </section>
  );
};

export default Loans;
