package store

import (
	"context"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/base"
	storepb "github.com/usememos/memos/proto/gen/store"
)

type TodoStatus string

type TodoPriority string

const (
	TodoStatusNormal TodoStatus = "NORMAL"
	TodoStatusDone   TodoStatus = "DONE"

	TodoPriorityLow    TodoPriority = "LOW"
	TodoPriorityMedium TodoPriority = "MEDIUM"
	TodoPriorityHigh   TodoPriority = "HIGH"
)

type Todo struct {
	ID  int32
	UID string

	CreatorID int32
	CreatedTs int64
	UpdatedTs int64

	Title       string
	Description string
	DueTime     time.Time
	Priority    TodoPriority
	Status      TodoStatus
	Payload     *storepb.TodoPayload
}

type FindTodo struct {
	ID     *int32
	UID    *string
	Status *TodoStatus

	Filters []string

	Limit  *int
	Offset *int
}

type UpdateTodo struct {
	ID int32

	Title       *string
	Description *string
	DueTime     *time.Time
	Priority    *TodoPriority
	Status      *TodoStatus
	Payload     *storepb.TodoPayload
	UpdatedTs   *int64
}

type DeleteTodo struct {
	ID int32
}

func (s *Store) CreateTodo(ctx context.Context, create *Todo) (*Todo, error) {
	if !base.UIDMatcher.MatchString(create.UID) {
		return nil, errors.New("invalid uid")
	}
	return s.driver.CreateTodo(ctx, create)
}

func (s *Store) ListTodos(ctx context.Context, find *FindTodo) ([]*Todo, error) {
	return s.driver.ListTodos(ctx, find)
}

func (s *Store) GetTodo(ctx context.Context, find *FindTodo) (*Todo, error) {
	return s.driver.GetTodo(ctx, find)
}

func (s *Store) UpdateTodo(ctx context.Context, update *UpdateTodo) error {
	return s.driver.UpdateTodo(ctx, update)
}

func (s *Store) DeleteTodo(ctx context.Context, delete *DeleteTodo) error {
	return s.driver.DeleteTodo(ctx, delete)
}
