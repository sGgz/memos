package store

import (
	"context"
	"database/sql"
)

// Driver is an interface for store driver.
// It contains all methods that store database driver should implement.
type Driver interface {
	GetDB() *sql.DB
	Close() error

	IsInitialized(ctx context.Context) (bool, error)

	// Activity model related methods.
	CreateActivity(ctx context.Context, create *Activity) (*Activity, error)
	ListActivities(ctx context.Context, find *FindActivity) ([]*Activity, error)

	// Attachment model related methods.
	CreateAttachment(ctx context.Context, create *Attachment) (*Attachment, error)
	ListAttachments(ctx context.Context, find *FindAttachment) ([]*Attachment, error)
	UpdateAttachment(ctx context.Context, update *UpdateAttachment) error
	DeleteAttachment(ctx context.Context, delete *DeleteAttachment) error

	// Memo model related methods.
	CreateMemo(ctx context.Context, create *Memo) (*Memo, error)
	ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error)
	UpdateMemo(ctx context.Context, update *UpdateMemo) error
	DeleteMemo(ctx context.Context, delete *DeleteMemo) error

	// Todo model related methods.
	CreateTodo(ctx context.Context, create *Todo) (*Todo, error)
	ListTodos(ctx context.Context, find *FindTodo) ([]*Todo, error)
	GetTodo(ctx context.Context, find *FindTodo) (*Todo, error)
	UpdateTodo(ctx context.Context, update *UpdateTodo) error
	DeleteTodo(ctx context.Context, delete *DeleteTodo) error

	// Bank model related methods.
	CreateBank(ctx context.Context, create *Bank) (*Bank, error)
	ListBanks(ctx context.Context, find *FindBank) ([]*Bank, error)
	GetBank(ctx context.Context, find *FindBank) (*Bank, error)
	UpdateBank(ctx context.Context, update *UpdateBank) error
	DeleteBank(ctx context.Context, delete *DeleteBank) error

	// Loan model related methods.
	CreateLoan(ctx context.Context, create *Loan) (*Loan, error)
	ListLoans(ctx context.Context, find *FindLoan) ([]*Loan, error)
	GetLoan(ctx context.Context, find *FindLoan) (*Loan, error)
	UpdateLoan(ctx context.Context, update *UpdateLoan) error
	DeleteLoan(ctx context.Context, delete *DeleteLoan) error

	// Repayment model related methods.
	CreateRepayment(ctx context.Context, create *Repayment) (*Repayment, error)
	ListRepayments(ctx context.Context, find *FindRepayment) ([]*Repayment, error)
	GetRepayment(ctx context.Context, find *FindRepayment) (*Repayment, error)
	UpdateRepayment(ctx context.Context, update *UpdateRepayment) error
	DeleteRepayment(ctx context.Context, delete *DeleteRepayment) error

	// MemoRelation model related methods.
	UpsertMemoRelation(ctx context.Context, create *MemoRelation) (*MemoRelation, error)
	ListMemoRelations(ctx context.Context, find *FindMemoRelation) ([]*MemoRelation, error)
	DeleteMemoRelation(ctx context.Context, delete *DeleteMemoRelation) error

	// InstanceSetting model related methods.
	UpsertInstanceSetting(ctx context.Context, upsert *InstanceSetting) (*InstanceSetting, error)
	ListInstanceSettings(ctx context.Context, find *FindInstanceSetting) ([]*InstanceSetting, error)
	DeleteInstanceSetting(ctx context.Context, delete *DeleteInstanceSetting) error

	// User model related methods.
	CreateUser(ctx context.Context, create *User) (*User, error)
	UpdateUser(ctx context.Context, update *UpdateUser) (*User, error)
	ListUsers(ctx context.Context, find *FindUser) ([]*User, error)
	DeleteUser(ctx context.Context, delete *DeleteUser) error

	// UserSetting model related methods.
	UpsertUserSetting(ctx context.Context, upsert *UserSetting) (*UserSetting, error)
	ListUserSettings(ctx context.Context, find *FindUserSetting) ([]*UserSetting, error)
	GetUserByPATHash(ctx context.Context, tokenHash string) (*PATQueryResult, error)

	// IdentityProvider model related methods.
	CreateIdentityProvider(ctx context.Context, create *IdentityProvider) (*IdentityProvider, error)
	ListIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*IdentityProvider, error)
	UpdateIdentityProvider(ctx context.Context, update *UpdateIdentityProvider) (*IdentityProvider, error)
	DeleteIdentityProvider(ctx context.Context, delete *DeleteIdentityProvider) error

	// Inbox model related methods.
	CreateInbox(ctx context.Context, create *Inbox) (*Inbox, error)
	ListInboxes(ctx context.Context, find *FindInbox) ([]*Inbox, error)
	UpdateInbox(ctx context.Context, update *UpdateInbox) (*Inbox, error)
	DeleteInbox(ctx context.Context, delete *DeleteInbox) error

	// Reaction model related methods.
	UpsertReaction(ctx context.Context, create *Reaction) (*Reaction, error)
	ListReactions(ctx context.Context, find *FindReaction) ([]*Reaction, error)
	GetReaction(ctx context.Context, find *FindReaction) (*Reaction, error)
	DeleteReaction(ctx context.Context, delete *DeleteReaction) error
}
