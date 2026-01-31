package v1

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/base"
	"github.com/usememos/memos/plugin/filter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) CreateTodo(ctx context.Context, request *v1pb.CreateTodoRequest) (*v1pb.Todo, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if request.Todo == nil {
		return nil, status.Errorf(codes.InvalidArgument, "todo is required")
	}
	if strings.TrimSpace(request.Todo.Title) == "" {
		return nil, status.Errorf(codes.InvalidArgument, "title is required")
	}
	if request.Todo.DueTime == nil || !request.Todo.DueTime.IsValid() {
		return nil, status.Errorf(codes.InvalidArgument, "due_time is required")
	}

	todoUID := strings.TrimSpace(request.TodoId)
	if todoUID == "" {
		todoUID = shortuuid.New()
	} else if !base.UIDMatcher.MatchString(todoUID) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid todo_id format: must be 1-32 characters, alphanumeric and hyphens only, cannot start or end with hyphen")
	}

	payload := &storepb.TodoPayload{}
	create := &store.Todo{
		UID:         todoUID,
		CreatorID:   user.ID,
		Title:       request.Todo.Title,
		Description: request.Todo.Description,
		DueTime:     request.Todo.DueTime.AsTime(),
		Priority:    convertTodoPriorityToStore(request.Todo.Priority),
		Status:      convertTodoStatusToStore(request.Todo.Status),
		Payload:     payload,
	}

	todo, err := s.Store.CreateTodo(ctx, create)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "UNIQUE constraint failed") ||
			strings.Contains(errMsg, "duplicate key") ||
			strings.Contains(errMsg, "Duplicate entry") {
			return nil, status.Errorf(codes.AlreadyExists, "todo with ID %q already exists", todoUID)
		}
		return nil, status.Errorf(codes.Internal, "failed to create todo: %v", err)
	}

	return convertTodoFromStore(todo), nil
}

func (s *APIV1Service) ListTodos(ctx context.Context, request *v1pb.ListTodosRequest) (*v1pb.ListTodosResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	todoFind := &store.FindTodo{}
	if request.Filter != "" {
		if err := s.validateTodoFilter(ctx, request.Filter); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		todoFind.Filters = append(todoFind.Filters, request.Filter)
	}

	if !request.ShowCompleted {
		statusNormal := store.TodoStatusNormal
		todoFind.Status = &statusNormal
	}

	var limit, offset int
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = int(pageToken.Limit)
		offset = int(pageToken.Offset)
	} else {
		limit = int(request.PageSize)
	}
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	limitPlusOne := limit + 1
	todoFind.Limit = &limitPlusOne
	todoFind.Offset = &offset

	todos, err := s.Store.ListTodos(ctx, todoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list todos: %v", err)
	}

	nextPageToken := ""
	if len(todos) == limitPlusOne {
		todos = todos[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token: %v", err)
		}
	}

	response := &v1pb.ListTodosResponse{
		Todos:         make([]*v1pb.Todo, 0, len(todos)),
		NextPageToken: nextPageToken,
	}
	for _, todo := range todos {
		response.Todos = append(response.Todos, convertTodoFromStore(todo))
	}
	return response, nil
}

func (s *APIV1Service) GetTodo(ctx context.Context, request *v1pb.GetTodoRequest) (*v1pb.Todo, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	todoUID, err := ExtractTodoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid todo name: %v", err)
	}
	todo, err := s.Store.GetTodo(ctx, &store.FindTodo{UID: &todoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get todo: %v", err)
	}
	if todo == nil {
		return nil, status.Errorf(codes.NotFound, "todo not found")
	}
	return convertTodoFromStore(todo), nil
}

func (s *APIV1Service) UpdateTodo(ctx context.Context, request *v1pb.UpdateTodoRequest) (*v1pb.Todo, error) {
	if request.Todo == nil {
		return nil, status.Errorf(codes.InvalidArgument, "todo is required")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	todoUID, err := ExtractTodoUIDFromName(request.Todo.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid todo name: %v", err)
	}
	todo, err := s.Store.GetTodo(ctx, &store.FindTodo{UID: &todoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get todo: %v", err)
	}
	if todo == nil {
		return nil, status.Errorf(codes.NotFound, "todo not found")
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if todo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	update := &store.UpdateTodo{
		ID: todo.ID,
	}
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "title":
			if strings.TrimSpace(request.Todo.Title) == "" {
				return nil, status.Errorf(codes.InvalidArgument, "title is required")
			}
			update.Title = &request.Todo.Title
		case "description":
			update.Description = &request.Todo.Description
		case "due_time":
			if request.Todo.DueTime == nil || !request.Todo.DueTime.IsValid() {
				return nil, status.Errorf(codes.InvalidArgument, "due_time is required")
			}
			dueTime := request.Todo.DueTime.AsTime()
			update.DueTime = &dueTime
		case "priority":
			priority := convertTodoPriorityToStore(request.Todo.Priority)
			update.Priority = &priority
		case "status":
			statusValue := convertTodoStatusToStore(request.Todo.Status)
			update.Status = &statusValue
		case "update_time":
			updatedTs := time.Now().Unix()
			if request.Todo.UpdateTime != nil {
				updatedTs = request.Todo.UpdateTime.AsTime().Unix()
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

	if err := s.Store.UpdateTodo(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update todo: %v", err)
	}

	todo, err = s.Store.GetTodo(ctx, &store.FindTodo{ID: &todo.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get todo: %v", err)
	}
	if todo == nil {
		return nil, status.Errorf(codes.NotFound, "todo not found")
	}
	return convertTodoFromStore(todo), nil
}

func (s *APIV1Service) DeleteTodo(ctx context.Context, request *v1pb.DeleteTodoRequest) (*emptypb.Empty, error) {
	todoUID, err := ExtractTodoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid todo name: %v", err)
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	todo, err := s.Store.GetTodo(ctx, &store.FindTodo{UID: &todoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get todo: %v", err)
	}
	if todo == nil {
		return nil, status.Errorf(codes.NotFound, "todo not found")
	}
	if todo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if err := s.Store.DeleteTodo(ctx, &store.DeleteTodo{ID: todo.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete todo: %v", err)
	}

	return &emptypb.Empty{}, nil
}

func convertTodoFromStore(todo *store.Todo) *v1pb.Todo {
	if todo == nil {
		return nil
	}
	todoMessage := &v1pb.Todo{
		Name:        fmt.Sprintf("%s%s", TodoNamePrefix, todo.UID),
		Creator:     fmt.Sprintf("%s%d", UserNamePrefix, todo.CreatorID),
		CreateTime:  timestamppb.New(time.Unix(todo.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(todo.UpdatedTs, 0)),
		Title:       todo.Title,
		Description: todo.Description,
		DueTime:     timestamppb.New(todo.DueTime),
		Priority:    convertTodoPriorityFromStore(todo.Priority),
		Status:      convertTodoStatusFromStore(todo.Status),
	}
	if todo.Payload != nil {
		payload := &v1pb.Todo_Payload{
			ReminderDayOffsets: append([]int32(nil), todo.Payload.ReminderDayOffsets...),
		}
		todoMessage.Payload = payload
	}
	return todoMessage
}

func convertTodoPriorityFromStore(priority store.TodoPriority) v1pb.Todo_Priority {
	switch priority {
	case store.TodoPriorityHigh:
		return v1pb.Todo_HIGH
	case store.TodoPriorityMedium:
		return v1pb.Todo_MEDIUM
	case store.TodoPriorityLow:
		return v1pb.Todo_LOW
	default:
		return v1pb.Todo_PRIORITY_UNSPECIFIED
	}
}

func convertTodoPriorityToStore(priority v1pb.Todo_Priority) store.TodoPriority {
	switch priority {
	case v1pb.Todo_HIGH:
		return store.TodoPriorityHigh
	case v1pb.Todo_MEDIUM:
		return store.TodoPriorityMedium
	default:
		return store.TodoPriorityLow
	}
}

func convertTodoStatusFromStore(status store.TodoStatus) v1pb.Todo_Status {
	switch status {
	case store.TodoStatusDone:
		return v1pb.Todo_DONE
	case store.TodoStatusNormal:
		return v1pb.Todo_NORMAL
	default:
		return v1pb.Todo_STATUS_UNSPECIFIED
	}
}

func convertTodoStatusToStore(status v1pb.Todo_Status) store.TodoStatus {
	switch status {
	case v1pb.Todo_DONE:
		return store.TodoStatusDone
	default:
		return store.TodoStatusNormal
	}
}

func (s *APIV1Service) validateTodoFilter(ctx context.Context, filterStr string) error {
	if filterStr == "" {
		return errors.New("filter cannot be empty")
	}

	engine, err := filter.DefaultTodoEngine()
	if err != nil {
		return err
	}

	var dialect filter.DialectName
	switch s.Profile.Driver {
	case "mysql":
		dialect = filter.DialectMySQL
	case "postgres":
		dialect = filter.DialectPostgres
	default:
		dialect = filter.DialectSQLite
	}

	if _, err := engine.CompileToStatement(ctx, filterStr, filter.RenderOptions{Dialect: dialect}); err != nil {
		return errors.Wrap(err, "failed to compile filter")
	}
	return nil
}
