package todoreminder

import (
	"context"
	"log/slog"
	"sort"
	"strconv"
	"time"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

type Runner struct {
	Store *store.Store
}

func NewRunner(store *store.Store) *Runner {
	return &Runner{
		Store: store,
	}
}

// Schedule runner every 6 hours.
const runnerInterval = time.Hour * 6

//const runnerInterval = time.Minute * 1

func (r *Runner) Run(ctx context.Context) {
	ticker := time.NewTicker(runnerInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			r.RunOnce(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func (r *Runner) RunOnce(ctx context.Context) {
	if err := r.SendReminders(ctx); err != nil {
		slog.Error("todo reminder runner failed", "error", err)
	}
}

func (r *Runner) SendReminders(ctx context.Context) error {
	instanceTodoSetting, err := r.Store.GetInstanceTodoSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get instance todo setting")
	}

	offsets := normalizeReminderOffsets(instanceTodoSetting.ReminderDayOffsets)
	if len(offsets) == 0 {
		return nil
	}

	maxOffset := offsets[len(offsets)-1]
	if maxOffset <= 0 {
		return nil
	}

	now := time.Now().UTC()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	end := start.Add(time.Duration(maxOffset+1) * 24 * time.Hour)

	filter := buildTodoReminderFilter(start.Unix(), end.Unix())
	todos, err := r.Store.ListTodos(ctx, &store.FindTodo{Filters: []string{filter}})
	if err != nil {
		return errors.Wrap(err, "failed to list todos")
	}

	users, err := r.Store.ListUsers(ctx, &store.FindUser{})
	if err != nil {
		return errors.Wrap(err, "failed to list users")
	}
	receiverIDs := make([]int32, 0, len(users))
	for _, user := range users {
		if user.RowStatus == store.Archived {
			continue
		}
		receiverIDs = append(receiverIDs, user.ID)
	}

	var runErr error
	for _, todo := range todos {
		if todo == nil {
			continue
		}

		dueTime := todo.DueTime.UTC()
		if !dueTime.After(start) {
			continue
		}
		dueDate := time.Date(dueTime.Year(), dueTime.Month(), dueTime.Day(), 0, 0, 0, 0, time.UTC)
		daysUntil := int(dueDate.Sub(start).Hours() / 24)
		offsetsToSend := pendingOffsets(offsets, daysUntil, todo.Payload)
		if len(offsetsToSend) == 0 {
			continue
		}

		todoUID := todo.UID
		sendSucceeded := true
		for _, receiverID := range receiverIDs {
			if _, err := r.Store.CreateInbox(ctx, &store.Inbox{
				SenderID:   store.SystemBotID,
				ReceiverID: receiverID,
				Status:     store.UNREAD,
				Message: &storepb.InboxMessage{
					Type:    storepb.InboxMessage_TODO_REMINDER,
					TodoUid: &todoUID,
				},
			}); err != nil {
				sendSucceeded = false
				runErr = errors.Wrap(err, "failed to create todo reminder inbox")
				slog.Error("failed to create todo reminder inbox", "error", err, "todo", todo.UID, "receiver", receiverID)
			}
		}

		if sendSucceeded {
			if todo.Payload == nil {
				todo.Payload = &storepb.TodoPayload{}
			}
			todo.Payload.ReminderDayOffsets = append(todo.Payload.ReminderDayOffsets, offsetsToSend...)
			if err := r.Store.UpdateTodo(ctx, &store.UpdateTodo{ID: todo.ID, Payload: todo.Payload}); err != nil {
				return errors.Wrap(err, "failed to update todo reminder payload")
			}
		}
	}

	return runErr
}

func normalizeReminderOffsets(offsets []int32) []int32 {
	unique := make(map[int32]struct{})
	for _, offset := range offsets {
		if offset <= 0 {
			continue
		}
		unique[offset] = struct{}{}
	}
	list := make([]int32, 0, len(unique))
	for offset := range unique {
		list = append(list, offset)
	}
	sort.Slice(list, func(i, j int) bool { return list[i] < list[j] })
	return list
}

func pendingOffsets(offsets []int32, daysUntil int, payload *storepb.TodoPayload) []int32 {
	if daysUntil <= 0 {
		return nil
	}
	if payload == nil {
		payload = &storepb.TodoPayload{}
	}
	sent := make(map[int32]struct{}, len(payload.ReminderDayOffsets))
	for _, offset := range payload.ReminderDayOffsets {
		sent[offset] = struct{}{}
	}

	var pending []int32
	for _, offset := range offsets {
		if int(offset) == daysUntil {
			if _, ok := sent[offset]; !ok {
				pending = append(pending, offset)
			}
		}
	}
	return pending
}

func buildTodoReminderFilter(startUnix, endUnix int64) string {
	return "status == \"NORMAL\" && due_time >= " + fmtUnix(startUnix) + " && due_time < " + fmtUnix(endUnix)
}

func fmtUnix(value int64) string {
	return strconv.FormatInt(value, 10)
}
