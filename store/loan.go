package store

import (
	"context"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/base"
)

type Bank struct {
	ID  int32
	UID string

	CreatedTs int64
	UpdatedTs int64

	Title       string
	Description string
}

type FindBank struct {
	ID  *int32
	UID *string

	Limit  *int
	Offset *int
}

type UpdateBank struct {
	ID int32

	Title       *string
	Description *string
	UpdatedTs   *int64
}

type DeleteBank struct {
	ID int32
}

type Loan struct {
	ID  int32
	UID string

	CreatedTs int64
	UpdatedTs int64

	Title       string
	Description string
	BankID      *int32

	PrincipalCents          int64
	InterestRateBps         int32
	StartTime               time.Time
	NextRepaymentTime       time.Time
	RepaidPrincipalCents    int64
	RepaidInterestCents     int64
	RepaidAmountCents       int64
	RemainingPrincipalCents int64
	OrderIndex              int32
	MonthlyRepaymentDay     int32
	RepaymentPeriods        int32
	RepaymentMethod         int32
}

type FindLoan struct {
	ID  *int32
	UID *string

	BankID *int32

	Limit  *int
	Offset *int
}

type UpdateLoan struct {
	ID int32

	Title       *string
	Description *string
	BankID      *int32

	PrincipalCents          *int64
	InterestRateBps         *int32
	StartTime               *time.Time
	NextRepaymentTime       *time.Time
	RepaidPrincipalCents    *int64
	RepaidInterestCents     *int64
	RepaidAmountCents       *int64
	RemainingPrincipalCents *int64
	OrderIndex              *int32
	MonthlyRepaymentDay     *int32
	RepaymentPeriods        *int32
	RepaymentMethod         *int32
	UpdatedTs               *int64
}

type DeleteLoan struct {
	ID int32
}

type Repayment struct {
	ID  int32
	UID string

	CreatedTs int64
	UpdatedTs int64

	LoanID int32

	RepaymentTime           time.Time
	PrincipalCents          int64
	InterestCents           int64
	TotalCents              int64
	RemainingPrincipalCents int64
	Note                    string
	IsEarlyRepayment        bool
	Period                  *int32
}

type FindRepayment struct {
	ID     *int32
	UID    *string
	LoanID *int32

	Limit  *int
	Offset *int
}

type UpdateRepayment struct {
	ID int32

	RepaymentTime           *time.Time
	PrincipalCents          *int64
	InterestCents           *int64
	TotalCents              *int64
	RemainingPrincipalCents *int64
	Note                    *string
	IsEarlyRepayment        *bool
	Period                  *int32
	UpdatedTs               *int64
}

type DeleteRepayment struct {
	ID int32
}

func (s *Store) CreateBank(ctx context.Context, create *Bank) (*Bank, error) {
	if !base.UIDMatcher.MatchString(create.UID) {
		return nil, errors.New("invalid uid")
	}
	return s.driver.CreateBank(ctx, create)
}

func (s *Store) ListBanks(ctx context.Context, find *FindBank) ([]*Bank, error) {
	return s.driver.ListBanks(ctx, find)
}

func (s *Store) GetBank(ctx context.Context, find *FindBank) (*Bank, error) {
	return s.driver.GetBank(ctx, find)
}

func (s *Store) UpdateBank(ctx context.Context, update *UpdateBank) error {
	return s.driver.UpdateBank(ctx, update)
}

func (s *Store) DeleteBank(ctx context.Context, delete *DeleteBank) error {
	return s.driver.DeleteBank(ctx, delete)
}

func (s *Store) CreateLoan(ctx context.Context, create *Loan) (*Loan, error) {
	if !base.UIDMatcher.MatchString(create.UID) {
		return nil, errors.New("invalid uid")
	}
	return s.driver.CreateLoan(ctx, create)
}

func (s *Store) ListLoans(ctx context.Context, find *FindLoan) ([]*Loan, error) {
	return s.driver.ListLoans(ctx, find)
}

func (s *Store) GetLoan(ctx context.Context, find *FindLoan) (*Loan, error) {
	return s.driver.GetLoan(ctx, find)
}

func (s *Store) UpdateLoan(ctx context.Context, update *UpdateLoan) error {
	return s.driver.UpdateLoan(ctx, update)
}

func (s *Store) DeleteLoan(ctx context.Context, delete *DeleteLoan) error {
	return s.driver.DeleteLoan(ctx, delete)
}

func (s *Store) CreateRepayment(ctx context.Context, create *Repayment) (*Repayment, error) {
	if !base.UIDMatcher.MatchString(create.UID) {
		return nil, errors.New("invalid uid")
	}
	return s.driver.CreateRepayment(ctx, create)
}

func (s *Store) ListRepayments(ctx context.Context, find *FindRepayment) ([]*Repayment, error) {
	return s.driver.ListRepayments(ctx, find)
}

func (s *Store) GetRepayment(ctx context.Context, find *FindRepayment) (*Repayment, error) {
	return s.driver.GetRepayment(ctx, find)
}

func (s *Store) UpdateRepayment(ctx context.Context, update *UpdateRepayment) error {
	return s.driver.UpdateRepayment(ctx, update)
}

func (s *Store) DeleteRepayment(ctx context.Context, delete *DeleteRepayment) error {
	return s.driver.DeleteRepayment(ctx, delete)
}
