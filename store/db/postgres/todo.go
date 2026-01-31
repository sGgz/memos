package postgres

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/plugin/filter"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateTodo(ctx context.Context, create *store.Todo) (*store.Todo, error) {
	fields := []string{"uid", "creator_id", "title", "description", "due_time", "priority", "status", "payload"}
	payload := "{}"
	if create.Payload != nil {
		payloadBytes, err := protojson.Marshal(create.Payload)
		if err != nil {
			return nil, err
		}
		payload = string(payloadBytes)
	}
	args := []any{create.UID, create.CreatorID, create.Title, create.Description, create.DueTime.Unix(), create.Priority, create.Status, payload}

	if create.CreatedTs != 0 {
		fields = append(fields, "created_ts")
		args = append(args, create.CreatedTs)
	}
	if create.UpdatedTs != 0 {
		fields = append(fields, "updated_ts")
		args = append(args, create.UpdatedTs)
	}

	stmt := "INSERT INTO todo (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts, updated_ts"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListTodos(ctx context.Context, find *store.FindTodo) ([]*store.Todo, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "todo.id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "todo.uid = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.Status; v != nil {
		where, args = append(where, "todo.status = "+placeholder(len(args)+1)), append(args, *v)
	}

	if len(find.Filters) > 0 {
		engine, err := filter.DefaultTodoEngine()
		if err != nil {
			return nil, errors.Wrap(err, "failed to get filter engine")
		}
		if err := filter.AppendConditions(ctx, engine, find.Filters, filter.DialectPostgres, &where, &args); err != nil {
			return nil, errors.Wrap(err, "failed to append filter conditions")
		}
	}

	fields := []string{
		"todo.id AS id",
		"todo.uid AS uid",
		"todo.creator_id AS creator_id",
		"todo.created_ts AS created_ts",
		"todo.updated_ts AS updated_ts",
		"todo.title AS title",
		"todo.description AS description",
		"todo.due_time AS due_time",
		"todo.priority AS priority",
		"todo.status AS status",
		"todo.payload AS payload",
	}

	query := fmt.Sprintf(`
SELECT %s
FROM todo
WHERE %s
ORDER BY todo.due_time ASC, todo.id DESC
`, strings.Join(fields, ", "), strings.Join(where, " AND "))
	if find.Limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *find.Limit)
		if find.Offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *find.Offset)
		}
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.Todo, 0)
	for rows.Next() {
		todo := store.Todo{}
		var payloadBytes []byte
		var dueTime int64
		if err := rows.Scan(
			&todo.ID,
			&todo.UID,
			&todo.CreatorID,
			&todo.CreatedTs,
			&todo.UpdatedTs,
			&todo.Title,
			&todo.Description,
			&dueTime,
			&todo.Priority,
			&todo.Status,
			&payloadBytes,
		); err != nil {
			return nil, err
		}
		todo.DueTime = time.Unix(dueTime, 0)
		payload := &storepb.TodoPayload{}
		if err := protojsonUnmarshaler.Unmarshal(payloadBytes, payload); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal payload")
		}
		todo.Payload = payload
		list = append(list, &todo)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) GetTodo(ctx context.Context, find *store.FindTodo) (*store.Todo, error) {
	list, err := d.ListTodos(ctx, find)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get todo")
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (d *DB) UpdateTodo(ctx context.Context, update *store.UpdateTodo) error {
	set, args := []string{}, []any{}
	if v := update.Title; v != nil {
		set, args = append(set, "title = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Description; v != nil {
		set, args = append(set, "description = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.DueTime; v != nil {
		set, args = append(set, "due_time = "+placeholder(len(args)+1)), append(args, v.Unix())
	}
	if v := update.Priority; v != nil {
		set, args = append(set, "priority = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Status; v != nil {
		set, args = append(set, "status = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Payload; v != nil {
		payloadBytes, err := protojson.Marshal(v)
		if err != nil {
			return err
		}
		set, args = append(set, "payload = "+placeholder(len(args)+1)), append(args, string(payloadBytes))
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if len(set) == 0 {
		return nil
	}
	args = append(args, update.ID)

	stmt := "UPDATE todo SET " + strings.Join(set, ", ") + " WHERE id = " + placeholder(len(args)+1)
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteTodo(ctx context.Context, delete *store.DeleteTodo) error {
	stmt := "DELETE FROM todo WHERE id = " + placeholder(1)
	result, err := d.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
