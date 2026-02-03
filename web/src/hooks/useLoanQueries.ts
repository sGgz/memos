import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loanServiceClient } from "@/connect";
import type {
  Bank,
  CreateRepaymentRequest,
  ListLoansRequest,
  ListRepaymentsRequest,
  Loan,
  Repayment,
  UpdateBankRequest,
  UpdateLoanRequest,
  UpdateRepaymentRequest,
} from "@/types/proto/api/v1/loan_service_pb";
import {
  BankSchema,
  CreateBankRequestSchema,
  CreateLoanRequestSchema,
  CreateRepaymentRequestSchema,
  ListBanksRequestSchema,
  ListLoansRequestSchema,
  ListRepaymentsRequestSchema,
  LoanSchema,
  RepaymentSchema,
} from "@/types/proto/api/v1/loan_service_pb";

export const loanKeys = {
  all: ["loans"] as const,
  banks: () => [...loanKeys.all, "banks"] as const,
  bankList: () => [...loanKeys.banks(), "list"] as const,
  loans: () => [...loanKeys.all, "list"] as const,
  loanDetail: (name: string) => [...loanKeys.all, "detail", name] as const,
  repayments: (loanName: string) => [...loanKeys.all, "repayments", loanName] as const,
};

export function useBanks(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: loanKeys.bankList(),
    queryFn: async () => {
      const response = await loanServiceClient.listBanks(create(ListBanksRequestSchema, {}));
      return response;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCreateBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bank: Bank) => {
      const response = await loanServiceClient.createBank(create(CreateBankRequestSchema, { bank }));
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanKeys.bankList() });
    },
  });
}

export function useUpdateBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bank, updateMask }: { bank: Partial<Bank>; updateMask: string[] }) => {
      const response = await loanServiceClient.updateBank({
        bank: create(BankSchema, bank as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      } as UpdateBankRequest);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanKeys.bankList() });
    },
  });
}

export function useDeleteBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await loanServiceClient.deleteBank({ name });
      return name;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanKeys.bankList() });
    },
  });
}

export function useLoans(request: Partial<ListLoansRequest> = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: loanKeys.loans(),
    queryFn: async () => {
      const response = await loanServiceClient.listLoans(create(ListLoansRequestSchema, request as Record<string, unknown>));
      return response;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useLoan(name: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: loanKeys.loanDetail(name),
    queryFn: async () => {
      const response = await loanServiceClient.getLoan({ name });
      return response;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (loan: Loan) => {
      const response = await loanServiceClient.createLoan(create(CreateLoanRequestSchema, { loan }));
      return response;
    },
    onSuccess: (newLoan) => {
      queryClient.invalidateQueries({ queryKey: loanKeys.loans() });
      queryClient.setQueryData(loanKeys.loanDetail(newLoan.name), newLoan);
    },
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ loan, updateMask }: { loan: Partial<Loan>; updateMask: string[] }) => {
      const response = await loanServiceClient.updateLoan({
        loan: create(LoanSchema, loan as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      } as UpdateLoanRequest);
      return response;
    },
    onSuccess: (updatedLoan) => {
      queryClient.setQueryData(loanKeys.loanDetail(updatedLoan.name), updatedLoan);
      queryClient.invalidateQueries({ queryKey: loanKeys.loans() });
    },
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await loanServiceClient.deleteLoan({ name });
      return name;
    },
    onSuccess: (name) => {
      queryClient.removeQueries({ queryKey: loanKeys.loanDetail(name) });
      queryClient.invalidateQueries({ queryKey: loanKeys.loans() });
    },
  });
}

export function useRepayments(request: Partial<ListRepaymentsRequest>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: loanKeys.repayments(request.parent ?? ""),
    queryFn: async () => {
      const response = await loanServiceClient.listRepayments(create(ListRepaymentsRequestSchema, request as Record<string, unknown>));
      return response;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCreateRepayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateRepaymentRequest) => {
      const response = await loanServiceClient.createRepayment(create(CreateRepaymentRequestSchema, request as Record<string, unknown>));
      return response;
    },
    onSuccess: (_repayment, request) => {
      if (request.parent) {
        queryClient.invalidateQueries({ queryKey: loanKeys.repayments(request.parent) });
        queryClient.invalidateQueries({ queryKey: loanKeys.loanDetail(request.parent) });
      }
      queryClient.invalidateQueries({ queryKey: loanKeys.loans() });
    },
  });
}

export function useUpdateRepayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ repayment, updateMask }: { repayment: Partial<Repayment>; updateMask: string[] }) => {
      const response = await loanServiceClient.updateRepayment({
        repayment: create(RepaymentSchema, repayment as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      } as UpdateRepaymentRequest);
      return response;
    },
    onSuccess: (updatedRepayment) => {
      const loanName = updatedRepayment.loan;
      if (loanName) {
        queryClient.invalidateQueries({ queryKey: loanKeys.repayments(loanName) });
        queryClient.invalidateQueries({ queryKey: loanKeys.loanDetail(loanName) });
      }
      queryClient.invalidateQueries({ queryKey: loanKeys.loans() });
    },
  });
}

export function useDeleteRepayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, parent }: { name: string; parent: string }) => {
      await loanServiceClient.deleteRepayment({ name });
      return parent;
    },
    onSuccess: (parent) => {
      if (parent) {
        queryClient.invalidateQueries({ queryKey: loanKeys.repayments(parent) });
        queryClient.invalidateQueries({ queryKey: loanKeys.loanDetail(parent) });
      }
      queryClient.invalidateQueries({ queryKey: loanKeys.loans() });
    },
  });
}
