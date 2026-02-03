package v1

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const maxLoanTitleLength = 11

func normalizeLoanTitle(title string) string {
	trimmed := strings.TrimSpace(title)
	if trimmed == "" {
		return ""
	}
	return truncateRunes(trimmed, maxLoanTitleLength)
}

func truncateRunes(value string, limit int) string {
	if limit <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func (s *APIV1Service) CreateBank(ctx context.Context, request *v1pb.CreateBankRequest) (*v1pb.Bank, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if request.Bank == nil {
		return nil, status.Errorf(codes.InvalidArgument, "bank is required")
	}
	if strings.TrimSpace(request.Bank.Title) == "" {
		return nil, status.Errorf(codes.InvalidArgument, "title is required")
	}

	bankUID := shortuuid.New()
	create := &store.Bank{
		UID:         bankUID,
		Title:       strings.TrimSpace(request.Bank.Title),
		Description: strings.TrimSpace(request.Bank.Description),
	}

	bank, err := s.Store.CreateBank(ctx, create)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "UNIQUE constraint failed") ||
			strings.Contains(errMsg, "duplicate key") ||
			strings.Contains(errMsg, "Duplicate entry") {
			return nil, status.Errorf(codes.AlreadyExists, "bank with ID %q already exists", bankUID)
		}
		return nil, status.Errorf(codes.Internal, "failed to create bank: %v", err)
	}

	return convertBankFromStore(bank), nil
}

func (s *APIV1Service) ListBanks(ctx context.Context, _ *v1pb.ListBanksRequest) (*v1pb.ListBanksResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	banks, err := s.Store.ListBanks(ctx, &store.FindBank{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list banks: %v", err)
	}

	response := &v1pb.ListBanksResponse{Banks: make([]*v1pb.Bank, 0, len(banks))}
	for _, bank := range banks {
		response.Banks = append(response.Banks, convertBankFromStore(bank))
	}
	return response, nil
}

func (s *APIV1Service) UpdateBank(ctx context.Context, request *v1pb.UpdateBankRequest) (*v1pb.Bank, error) {
	if request.Bank == nil {
		return nil, status.Errorf(codes.InvalidArgument, "bank is required")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	bankUID, err := ExtractBankUIDFromName(request.Bank.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid bank name: %v", err)
	}
	bank, err := s.Store.GetBank(ctx, &store.FindBank{UID: &bankUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get bank: %v", err)
	}
	if bank == nil {
		return nil, status.Errorf(codes.NotFound, "bank not found")
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	update := &store.UpdateBank{ID: bank.ID}
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "title":
			if strings.TrimSpace(request.Bank.Title) == "" {
				return nil, status.Errorf(codes.InvalidArgument, "title is required")
			}
			title := strings.TrimSpace(request.Bank.Title)
			update.Title = &title
		case "description":
			description := strings.TrimSpace(request.Bank.Description)
			update.Description = &description
		case "update_time":
			updatedTs := time.Now().Unix()
			if request.Bank.UpdateTime != nil {
				updatedTs = request.Bank.UpdateTime.AsTime().Unix()
			}
			update.UpdatedTs = &updatedTs
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", path)
		}
	}
	if update.UpdatedTs == nil {
		updatedTs := time.Now().Unix()
		update.UpdatedTs = &updatedTs
	}

	if err := s.Store.UpdateBank(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update bank: %v", err)
	}

	bank, err = s.Store.GetBank(ctx, &store.FindBank{ID: &bank.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get bank: %v", err)
	}
	if bank == nil {
		return nil, status.Errorf(codes.NotFound, "bank not found")
	}
	return convertBankFromStore(bank), nil
}

func (s *APIV1Service) DeleteBank(ctx context.Context, request *v1pb.DeleteBankRequest) (*emptypb.Empty, error) {
	bankUID, err := ExtractBankUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid bank name: %v", err)
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	bank, err := s.Store.GetBank(ctx, &store.FindBank{UID: &bankUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get bank: %v", err)
	}
	if bank == nil {
		return nil, status.Errorf(codes.NotFound, "bank not found")
	}

	if err := s.Store.DeleteBank(ctx, &store.DeleteBank{ID: bank.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete bank: %v", err)
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) CreateLoan(ctx context.Context, request *v1pb.CreateLoanRequest) (*v1pb.Loan, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if request.Loan == nil {
		return nil, status.Errorf(codes.InvalidArgument, "loan is required")
	}
	normalizedTitle := normalizeLoanTitle(request.Loan.Title)
	if normalizedTitle == "" {
		return nil, status.Errorf(codes.InvalidArgument, "title is required")
	}

	loanUID := shortuuid.New()
	create := &store.Loan{
		UID:                     loanUID,
		Title:                   normalizedTitle,
		Description:             strings.TrimSpace(request.Loan.Description),
		PrincipalCents:          request.Loan.PrincipalCents,
		InterestRateBps:         request.Loan.InterestRateBps,
		StartTime:               timestampOrZero(request.Loan.StartTime),
		NextRepaymentTime:       time.Time{},
		RepaidPrincipalCents:    0,
		RepaidInterestCents:     0,
		RepaidAmountCents:       0,
		RemainingPrincipalCents: request.Loan.PrincipalCents,
		MonthlyRepaymentDay:     request.Loan.MonthlyRepaymentDay,
		RepaymentPeriods:        request.Loan.RepaymentPeriods,
		RepaymentMethod:         int32(request.Loan.RepaymentMethod),
	}

	if request.Loan.Bank != "" {
		bankUID, err := ExtractBankUIDFromName(request.Loan.Bank)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid bank: %v", err)
		}
		bank, err := s.Store.GetBank(ctx, &store.FindBank{UID: &bankUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get bank: %v", err)
		}
		if bank == nil {
			return nil, status.Errorf(codes.NotFound, "bank not found")
		}
		create.BankID = &bank.ID
	}

	var orderIndex int32
	if request.Loan.OrderIndex != nil {
		orderIndex = request.Loan.GetOrderIndex()
	}
	if request.Loan.OrderIndex == nil || orderIndex <= 0 {
		loans, err := s.Store.ListLoans(ctx, &store.FindLoan{})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get loans for order: %v", err)
		}
		var maxIndex int32
		for _, existing := range loans {
			if existing.OrderIndex > maxIndex {
				maxIndex = existing.OrderIndex
			}
		}
		orderIndex = maxIndex + 1
	}
	create.OrderIndex = orderIndex

	if request.Loan.MonthlyRepaymentDay != 0 && (request.Loan.MonthlyRepaymentDay < 1 || request.Loan.MonthlyRepaymentDay > 31) {
		return nil, status.Errorf(codes.InvalidArgument, "monthly_repayment_day must be between 1 and 31")
	}
	if request.Loan.RepaymentPeriods < 0 {
		return nil, status.Errorf(codes.InvalidArgument, "repayment_periods must be non-negative")
	}
	if request.Loan.RepaymentMethod < 0 {
		return nil, status.Errorf(codes.InvalidArgument, "repayment_method must be non-negative")
	}

	loan, err := s.Store.CreateLoan(ctx, create)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "UNIQUE constraint failed") ||
			strings.Contains(errMsg, "duplicate key") ||
			strings.Contains(errMsg, "Duplicate entry") {
			return nil, status.Errorf(codes.AlreadyExists, "loan with ID %q already exists", loanUID)
		}
		return nil, status.Errorf(codes.Internal, "failed to create loan: %v", err)
	}

	return convertLoanFromStore(ctx, s.Store, loan), nil
}

func (s *APIV1Service) ListLoans(ctx context.Context, _ *v1pb.ListLoansRequest) (*v1pb.ListLoansResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	loans, err := s.Store.ListLoans(ctx, &store.FindLoan{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list loans: %v", err)
	}

	response := &v1pb.ListLoansResponse{Loans: make([]*v1pb.Loan, 0, len(loans))}
	for _, loan := range loans {
		if err := s.ensureLoanTitleLength(ctx, loan); err != nil {
			return nil, err
		}
		response.Loans = append(response.Loans, convertLoanFromStore(ctx, s.Store, loan))
	}
	return response, nil
}

func (s *APIV1Service) GetLoan(ctx context.Context, request *v1pb.GetLoanRequest) (*v1pb.Loan, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	loanUID, err := ExtractLoanUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid loan name: %v", err)
	}
	loan, err := s.Store.GetLoan(ctx, &store.FindLoan{UID: &loanUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get loan: %v", err)
	}
	if loan == nil {
		return nil, status.Errorf(codes.NotFound, "loan not found")
	}
	if err := s.ensureLoanTitleLength(ctx, loan); err != nil {
		return nil, err
	}
	return convertLoanFromStore(ctx, s.Store, loan), nil
}

func (s *APIV1Service) UpdateLoan(ctx context.Context, request *v1pb.UpdateLoanRequest) (*v1pb.Loan, error) {
	if request.Loan == nil {
		return nil, status.Errorf(codes.InvalidArgument, "loan is required")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	loanUID, err := ExtractLoanUIDFromName(request.Loan.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid loan name: %v", err)
	}
	loan, err := s.Store.GetLoan(ctx, &store.FindLoan{UID: &loanUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get loan: %v", err)
	}
	if loan == nil {
		return nil, status.Errorf(codes.NotFound, "loan not found")
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	update := &store.UpdateLoan{ID: loan.ID}
	shouldRecompute := false
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "title":
			title := normalizeLoanTitle(request.Loan.Title)
			if title == "" {
				return nil, status.Errorf(codes.InvalidArgument, "title is required")
			}
			update.Title = &title
		case "description":
			description := strings.TrimSpace(request.Loan.Description)
			update.Description = &description
		case "bank":
			if request.Loan.Bank == "" {
				update.BankID = nil
				break
			}
			bankUID, err := ExtractBankUIDFromName(request.Loan.Bank)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid bank: %v", err)
			}
			bank, err := s.Store.GetBank(ctx, &store.FindBank{UID: &bankUID})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get bank: %v", err)
			}
			if bank == nil {
				return nil, status.Errorf(codes.NotFound, "bank not found")
			}
			update.BankID = &bank.ID
		case "principal_cents":
			value := request.Loan.PrincipalCents
			update.PrincipalCents = &value
			shouldRecompute = true
		case "interest_rate_bps":
			value := request.Loan.InterestRateBps
			update.InterestRateBps = &value
			shouldRecompute = true
		case "start_time":
			if request.Loan.StartTime == nil || !request.Loan.StartTime.IsValid() {
				return nil, status.Errorf(codes.InvalidArgument, "start_time is required")
			}
			startTime := request.Loan.StartTime.AsTime()
			update.StartTime = &startTime
			shouldRecompute = true
		case "order_index":
			if request.Loan.OrderIndex == nil {
				return nil, status.Errorf(codes.InvalidArgument, "order_index is required")
			}
			value := request.Loan.GetOrderIndex()
			update.OrderIndex = &value
		case "monthly_repayment_day":
			value := request.Loan.MonthlyRepaymentDay
			if value != 0 && (value < 1 || value > 31) {
				return nil, status.Errorf(codes.InvalidArgument, "monthly_repayment_day must be between 1 and 31")
			}
			update.MonthlyRepaymentDay = &value
			shouldRecompute = true
		case "repayment_periods":
			value := request.Loan.RepaymentPeriods
			if value < 0 {
				return nil, status.Errorf(codes.InvalidArgument, "repayment_periods must be non-negative")
			}
			update.RepaymentPeriods = &value
			shouldRecompute = true
		case "repayment_method":
			value := int32(request.Loan.RepaymentMethod)
			if value < 0 {
				return nil, status.Errorf(codes.InvalidArgument, "repayment_method must be non-negative")
			}
			update.RepaymentMethod = &value
		case "remaining_principal_cents":
			value := request.Loan.RemainingPrincipalCents
			if value < 0 {
				return nil, status.Errorf(codes.InvalidArgument, "remaining_principal_cents must be non-negative")
			}
			update.RemainingPrincipalCents = &value
		case "update_time":
			updatedTs := time.Now().Unix()
			if request.Loan.UpdateTime != nil {
				updatedTs = request.Loan.UpdateTime.AsTime().Unix()
			}
			update.UpdatedTs = &updatedTs
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", path)
		}
	}
	if update.UpdatedTs == nil {
		updatedTs := time.Now().Unix()
		update.UpdatedTs = &updatedTs
	}

	if update.PrincipalCents != nil && update.RemainingPrincipalCents == nil {
		newRemaining := *update.PrincipalCents - loan.RepaidPrincipalCents
		if newRemaining < 0 {
			newRemaining = 0
		}
		update.RemainingPrincipalCents = &newRemaining
	}

	if err := s.Store.UpdateLoan(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update loan: %v", err)
	}
	if shouldRecompute {
		if err := s.recomputeRepaymentMeta(ctx, loan); err != nil {
			return nil, err
		}
	}

	loan, err = s.Store.GetLoan(ctx, &store.FindLoan{ID: &loan.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get loan: %v", err)
	}
	if loan == nil {
		return nil, status.Errorf(codes.NotFound, "loan not found")
	}
	return convertLoanFromStore(ctx, s.Store, loan), nil
}

func (s *APIV1Service) DeleteLoan(ctx context.Context, request *v1pb.DeleteLoanRequest) (*emptypb.Empty, error) {
	loanUID, err := ExtractLoanUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid loan name: %v", err)
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	loan, err := s.Store.GetLoan(ctx, &store.FindLoan{UID: &loanUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get loan: %v", err)
	}
	if loan == nil {
		return nil, status.Errorf(codes.NotFound, "loan not found")
	}

	if err := s.Store.DeleteLoan(ctx, &store.DeleteLoan{ID: loan.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete loan: %v", err)
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) CreateRepayment(ctx context.Context, request *v1pb.CreateRepaymentRequest) (*v1pb.Repayment, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if request.Repayment == nil {
		return nil, status.Errorf(codes.InvalidArgument, "repayment is required")
	}
	if request.Repayment.RepaymentTime == nil || !request.Repayment.RepaymentTime.IsValid() {
		return nil, status.Errorf(codes.InvalidArgument, "repayment_time is required")
	}
	if request.Repayment.PrincipalCents < 0 || request.Repayment.InterestCents < 0 {
		return nil, status.Errorf(codes.InvalidArgument, "repayment amounts must be non-negative")
	}

	loanUID, err := ExtractLoanUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}
	loan, err := s.Store.GetLoan(ctx, &store.FindLoan{UID: &loanUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get loan: %v", err)
	}
	if loan == nil {
		return nil, status.Errorf(codes.NotFound, "loan not found")
	}

	repaymentUID := shortuuid.New()
	principal := request.Repayment.PrincipalCents
	interest := request.Repayment.InterestCents
	total := principal + interest
	remainingPrincipal := loan.RemainingPrincipalCents - principal
	if remainingPrincipal < 0 {
		remainingPrincipal = 0
	}
	repaymentTime := request.Repayment.RepaymentTime.AsTime()

	create := &store.Repayment{
		UID:                     repaymentUID,
		LoanID:                  loan.ID,
		RepaymentTime:           repaymentTime,
		PrincipalCents:          principal,
		InterestCents:           interest,
		TotalCents:              total,
		RemainingPrincipalCents: remainingPrincipal,
		Note:                    strings.TrimSpace(request.Repayment.Note),
	}
	create.IsEarlyRepayment = request.Repayment.IsEarlyRepayment

	repayment, err := s.Store.CreateRepayment(ctx, create)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "UNIQUE constraint failed") ||
			strings.Contains(errMsg, "duplicate key") ||
			strings.Contains(errMsg, "Duplicate entry") {
			return nil, status.Errorf(codes.AlreadyExists, "repayment with ID %q already exists", repaymentUID)
		}
		return nil, status.Errorf(codes.Internal, "failed to create repayment: %v", err)
	}

	if err := s.applyRepaymentToLoan(ctx, loan, principal, interest, repayment.RepaymentTime); err != nil {
		return nil, err
	}
	if err := s.recomputeRepaymentMeta(ctx, loan); err != nil {
		return nil, err
	}

	repayment, err = s.Store.GetRepayment(ctx, &store.FindRepayment{ID: &repayment.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get repayment: %v", err)
	}
	if repayment == nil {
		return nil, status.Errorf(codes.NotFound, "repayment not found")
	}

	updatedLoan, err := s.Store.GetLoan(ctx, &store.FindLoan{ID: &loan.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get loan: %v", err)
	}
	if updatedLoan != nil {
		repayment.RemainingPrincipalCents = updatedLoan.RemainingPrincipalCents
	}

	return convertRepaymentFromStore(repayment, loan.UID), nil
}

func (s *APIV1Service) ListRepayments(ctx context.Context, request *v1pb.ListRepaymentsRequest) (*v1pb.ListRepaymentsResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	loanUID, err := ExtractLoanUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}
	loan, err := s.Store.GetLoan(ctx, &store.FindLoan{UID: &loanUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get loan: %v", err)
	}
	if loan == nil {
		return nil, status.Errorf(codes.NotFound, "loan not found")
	}

	repayments, err := s.Store.ListRepayments(ctx, &store.FindRepayment{LoanID: &loan.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list repayments: %v", err)
	}

	response := &v1pb.ListRepaymentsResponse{Repayments: make([]*v1pb.Repayment, 0, len(repayments))}
	for _, repayment := range repayments {
		response.Repayments = append(response.Repayments, convertRepaymentFromStore(repayment, loan.UID))
	}
	return response, nil
}

func (s *APIV1Service) UpdateRepayment(ctx context.Context, request *v1pb.UpdateRepaymentRequest) (*v1pb.Repayment, error) {
	if request.Repayment == nil {
		return nil, status.Errorf(codes.InvalidArgument, "repayment is required")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	loanUID, repaymentID, err := ExtractLoanRepaymentIDFromName(request.Repayment.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid repayment name: %v", err)
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	loan, err := s.Store.GetLoan(ctx, &store.FindLoan{UID: &loanUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get loan: %v", err)
	}
	if loan == nil {
		return nil, status.Errorf(codes.NotFound, "loan not found")
	}

	repayment, err := s.Store.GetRepayment(ctx, &store.FindRepayment{ID: &repaymentID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get repayment: %v", err)
	}
	if repayment == nil || repayment.LoanID != loan.ID {
		return nil, status.Errorf(codes.NotFound, "repayment not found")
	}

	update := &store.UpdateRepayment{ID: repayment.ID}
	shouldRecompute := false
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "repayment_time":
			if request.Repayment.RepaymentTime == nil || !request.Repayment.RepaymentTime.IsValid() {
				return nil, status.Errorf(codes.InvalidArgument, "repayment_time is required")
			}
			repaymentTime := request.Repayment.RepaymentTime.AsTime()
			update.RepaymentTime = &repaymentTime
			shouldRecompute = true
		case "principal_cents":
			value := request.Repayment.PrincipalCents
			if value < 0 {
				return nil, status.Errorf(codes.InvalidArgument, "principal_cents must be non-negative")
			}
			update.PrincipalCents = &value
			shouldRecompute = true
		case "interest_cents":
			value := request.Repayment.InterestCents
			if value < 0 {
				return nil, status.Errorf(codes.InvalidArgument, "interest_cents must be non-negative")
			}
			update.InterestCents = &value
			shouldRecompute = true
		case "note":
			note := strings.TrimSpace(request.Repayment.Note)
			update.Note = &note
		case "is_early_repayment":
			value := request.Repayment.IsEarlyRepayment
			update.IsEarlyRepayment = &value
			shouldRecompute = true
		case "update_time":
			updatedTs := time.Now().Unix()
			if request.Repayment.UpdateTime != nil {
				updatedTs = request.Repayment.UpdateTime.AsTime().Unix()
			}
			update.UpdatedTs = &updatedTs
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", path)
		}
	}
	if update.UpdatedTs == nil {
		updatedTs := time.Now().Unix()
		update.UpdatedTs = &updatedTs
	}

	oldPrincipal := repayment.PrincipalCents
	oldInterest := repayment.InterestCents
	newPrincipal := oldPrincipal
	newInterest := oldInterest
	if update.PrincipalCents != nil {
		newPrincipal = *update.PrincipalCents
	}
	if update.InterestCents != nil {
		newInterest = *update.InterestCents
	}

	totalValue := newPrincipal + newInterest
	update.TotalCents = &totalValue
	repaymentTime := repayment.RepaymentTime
	if update.RepaymentTime != nil {
		repaymentTime = *update.RepaymentTime
	}

	if err := s.Store.UpdateRepayment(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update repayment: %v", err)
	}

	if err := s.adjustLoanForRepaymentUpdate(ctx, loan, oldPrincipal, oldInterest, newPrincipal, newInterest, repaymentTime); err != nil {
		return nil, err
	}

	if shouldRecompute {
		if err := s.recomputeRepaymentMeta(ctx, loan); err != nil {
			return nil, err
		}
	}

	repayment, err = s.Store.GetRepayment(ctx, &store.FindRepayment{ID: &repayment.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get repayment: %v", err)
	}
	if repayment == nil {
		return nil, status.Errorf(codes.NotFound, "repayment not found")
	}

	updatedLoan, err := s.Store.GetLoan(ctx, &store.FindLoan{ID: &loan.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get loan: %v", err)
	}
	if updatedLoan != nil {
		repayment.RemainingPrincipalCents = updatedLoan.RemainingPrincipalCents
	}

	return convertRepaymentFromStore(repayment, loan.UID), nil
}

func (s *APIV1Service) DeleteRepayment(ctx context.Context, request *v1pb.DeleteRepaymentRequest) (*emptypb.Empty, error) {
	loanUID, repaymentID, err := ExtractLoanRepaymentIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid repayment name: %v", err)
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	loan, err := s.Store.GetLoan(ctx, &store.FindLoan{UID: &loanUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get loan: %v", err)
	}
	if loan == nil {
		return nil, status.Errorf(codes.NotFound, "loan not found")
	}

	repayment, err := s.Store.GetRepayment(ctx, &store.FindRepayment{ID: &repaymentID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get repayment: %v", err)
	}
	if repayment == nil || repayment.LoanID != loan.ID {
		return nil, status.Errorf(codes.NotFound, "repayment not found")
	}

	if err := s.Store.DeleteRepayment(ctx, &store.DeleteRepayment{ID: repayment.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete repayment: %v", err)
	}

	if err := s.adjustLoanForRepaymentUpdate(ctx, loan, repayment.PrincipalCents, repayment.InterestCents, 0, 0, repayment.RepaymentTime); err != nil {
		return nil, err
	}
	if err := s.recomputeRepaymentMeta(ctx, loan); err != nil {
		return nil, err
	}

	return &emptypb.Empty{}, nil
}

func convertBankFromStore(bank *store.Bank) *v1pb.Bank {
	if bank == nil {
		return nil
	}
	return &v1pb.Bank{
		Name:        fmt.Sprintf("%s%s", BankNamePrefix, bank.UID),
		CreateTime:  timestamppb.New(time.Unix(bank.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(bank.UpdatedTs, 0)),
		Title:       bank.Title,
		Description: bank.Description,
	}
}

func convertLoanFromStore(ctx context.Context, st *store.Store, loan *store.Loan) *v1pb.Loan {
	if loan == nil {
		return nil
	}
	loanMessage := &v1pb.Loan{
		Name:                    fmt.Sprintf("%s%s", LoanNamePrefix, loan.UID),
		CreateTime:              timestamppb.New(time.Unix(loan.CreatedTs, 0)),
		UpdateTime:              timestamppb.New(time.Unix(loan.UpdatedTs, 0)),
		Title:                   loan.Title,
		Description:             loan.Description,
		PrincipalCents:          loan.PrincipalCents,
		InterestRateBps:         loan.InterestRateBps,
		StartTime:               toTimestampOrNil(loan.StartTime),
		NextRepaymentTime:       toTimestampOrNil(loan.NextRepaymentTime),
		RepaidPrincipalCents:    loan.RepaidPrincipalCents,
		RepaidInterestCents:     loan.RepaidInterestCents,
		RepaidAmountCents:       loan.RepaidAmountCents,
		RemainingPrincipalCents: loan.RemainingPrincipalCents,
		OrderIndex:              &loan.OrderIndex,
		MonthlyRepaymentDay:     loan.MonthlyRepaymentDay,
		RepaymentPeriods:        loan.RepaymentPeriods,
		RepaymentMethod:         v1pb.RepaymentMethod(loan.RepaymentMethod),
	}
	if loan.BankID != nil {
		bank, err := st.GetBank(ctx, &store.FindBank{ID: loan.BankID})
		if err == nil && bank != nil {
			loanMessage.Bank = fmt.Sprintf("%s%s", BankNamePrefix, bank.UID)
		}
	}
	return loanMessage
}

func (s *APIV1Service) ensureLoanTitleLength(ctx context.Context, loan *store.Loan) error {
	if loan == nil {
		return nil
	}
	normalized := normalizeLoanTitle(loan.Title)
	if normalized == "" || normalized == loan.Title {
		return nil
	}
	updatedTs := time.Now().Unix()
	update := &store.UpdateLoan{
		ID:        loan.ID,
		Title:     &normalized,
		UpdatedTs: &updatedTs,
	}
	if err := s.Store.UpdateLoan(ctx, update); err != nil {
		return status.Errorf(codes.Internal, "failed to update loan title: %v", err)
	}
	loan.Title = normalized
	return nil
}

func convertRepaymentFromStore(repayment *store.Repayment, loanUID string) *v1pb.Repayment {
	if repayment == nil {
		return nil
	}
	var periodValue int32
	var period *int32
	if repayment.Period != nil {
		periodValue = *repayment.Period
		period = &periodValue
	}
	return &v1pb.Repayment{
		Name:                    fmt.Sprintf("%s%s/%s%d", LoanNamePrefix, loanUID, RepaymentNamePrefix, repayment.ID),
		CreateTime:              timestamppb.New(time.Unix(repayment.CreatedTs, 0)),
		UpdateTime:              timestamppb.New(time.Unix(repayment.UpdatedTs, 0)),
		Loan:                    fmt.Sprintf("%s%s", LoanNamePrefix, loanUID),
		RepaymentTime:           toTimestampOrNil(repayment.RepaymentTime),
		PrincipalCents:          repayment.PrincipalCents,
		InterestCents:           repayment.InterestCents,
		TotalCents:              repayment.TotalCents,
		RemainingPrincipalCents: repayment.RemainingPrincipalCents,
		Note:                    repayment.Note,
		IsEarlyRepayment:        repayment.IsEarlyRepayment,
		Period:                  period,
	}
}

func (s *APIV1Service) recomputeRepaymentMeta(ctx context.Context, loan *store.Loan) error {
	if loan == nil {
		return nil
	}
	repayments, err := s.Store.ListRepayments(ctx, &store.FindRepayment{LoanID: &loan.ID})
	if err != nil {
		return status.Errorf(codes.Internal, "failed to list repayments: %v", err)
	}
	sort.Slice(repayments, func(i, j int) bool {
		if repayments[i].RepaymentTime.Equal(repayments[j].RepaymentTime) {
			return repayments[i].ID < repayments[j].ID
		}
		return repayments[i].RepaymentTime.Before(repayments[j].RepaymentTime)
	})

	period := int32(0)
	for _, repayment := range repayments {
		var periodValue *int32
		if !repayment.IsEarlyRepayment {
			period++
			value := period
			periodValue = &value
		}
		update := &store.UpdateRepayment{ID: repayment.ID}
		if periodValue != nil {
			value := *periodValue
			update.Period = &value
		} else {
			zero := int32(0)
			update.Period = &zero
		}
		updatedTs := time.Now().Unix()
		update.UpdatedTs = &updatedTs
		if err := s.Store.UpdateRepayment(ctx, update); err != nil {
			return status.Errorf(codes.Internal, "failed to update repayment meta: %v", err)
		}
	}
	return nil
}

func repaymentDueDate(repaymentTime time.Time, repaymentDay int32) time.Time {
	if repaymentDay <= 0 {
		return time.Time{}
	}
	if repaymentDay > 31 {
		repaymentDay = 31
	}
	year, month, _ := repaymentTime.Date()
	location := repaymentTime.Location()
	daysInMonth := time.Date(year, month+1, 0, 0, 0, 0, 0, location).Day()
	targetDay := int(repaymentDay)
	if targetDay > daysInMonth {
		targetDay = daysInMonth
	}
	return time.Date(year, month, targetDay, 0, 0, 0, 0, location)
}

func sameDay(a, b time.Time) bool {
	return a.Year() == b.Year() && a.YearDay() == b.YearDay()
}

func (s *APIV1Service) applyRepaymentToLoan(ctx context.Context, loan *store.Loan, principalDelta, interestDelta int64, repaymentTime time.Time) error {
	newRepaidPrincipal := loan.RepaidPrincipalCents + principalDelta
	newRepaidInterest := loan.RepaidInterestCents + interestDelta
	newRepaidAmount := loan.RepaidAmountCents + principalDelta + interestDelta
	newRemaining := loan.RemainingPrincipalCents - principalDelta
	if newRemaining < 0 {
		newRemaining = 0
	}

	nextRepaymentTime := loan.NextRepaymentTime
	if repaymentTime.After(nextRepaymentTime) {
		nextRepaymentTime = repaymentTime.AddDate(0, 1, 0)
	}

	updatedTs := time.Now().Unix()
	update := &store.UpdateLoan{
		ID:                      loan.ID,
		RepaidPrincipalCents:    &newRepaidPrincipal,
		RepaidInterestCents:     &newRepaidInterest,
		RepaidAmountCents:       &newRepaidAmount,
		RemainingPrincipalCents: &newRemaining,
		NextRepaymentTime:       &nextRepaymentTime,
		UpdatedTs:               &updatedTs,
	}

	if err := s.Store.UpdateLoan(ctx, update); err != nil {
		return status.Errorf(codes.Internal, "failed to update loan summary: %v", err)
	}

	return nil
}

func (s *APIV1Service) adjustLoanForRepaymentUpdate(ctx context.Context, loan *store.Loan, oldPrincipal, oldInterest, newPrincipal, newInterest int64, repaymentTime time.Time) error {
	principalDelta := newPrincipal - oldPrincipal
	interestDelta := newInterest - oldInterest

	newRepaidPrincipal := loan.RepaidPrincipalCents + principalDelta
	newRepaidInterest := loan.RepaidInterestCents + interestDelta
	newRepaidAmount := loan.RepaidAmountCents + principalDelta + interestDelta
	newRemaining := loan.RemainingPrincipalCents - principalDelta
	if newRemaining < 0 {
		newRemaining = 0
	}

	nextRepaymentTime := loan.NextRepaymentTime
	if repaymentTime.After(nextRepaymentTime) {
		nextRepaymentTime = repaymentTime.AddDate(0, 1, 0)
	}

	updatedTs := time.Now().Unix()
	update := &store.UpdateLoan{
		ID:                      loan.ID,
		RepaidPrincipalCents:    &newRepaidPrincipal,
		RepaidInterestCents:     &newRepaidInterest,
		RepaidAmountCents:       &newRepaidAmount,
		RemainingPrincipalCents: &newRemaining,
		NextRepaymentTime:       &nextRepaymentTime,
		UpdatedTs:               &updatedTs,
	}

	if err := s.Store.UpdateLoan(ctx, update); err != nil {
		return status.Errorf(codes.Internal, "failed to update loan summary: %v", err)
	}

	return nil
}

func timestampOrZero(ts *timestamppb.Timestamp) time.Time {
	if ts == nil || !ts.IsValid() {
		return time.Time{}
	}
	return ts.AsTime()
}

func toTimestampOrNil(value time.Time) *timestamppb.Timestamp {
	if value.IsZero() {
		return nil
	}
	return timestamppb.New(value)
}
