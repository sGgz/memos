package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateBank(ctx context.Context, create *store.Bank) (*store.Bank, error) {
	fields := []string{"uid", "title", "description"}
	args := []any{create.UID, create.Title, create.Description}

	if create.CreatedTs != 0 {
		fields = append(fields, "created_ts")
		args = append(args, create.CreatedTs)
	}
	if create.UpdatedTs != 0 {
		fields = append(fields, "updated_ts")
		args = append(args, create.UpdatedTs)
	}

	stmt := "INSERT INTO bank (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts, updated_ts"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListBanks(ctx context.Context, find *store.FindBank) ([]*store.Bank, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "bank.id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "bank.uid = "+placeholder(len(args)+1)), append(args, *v)
	}

	fields := []string{
		"bank.id AS id",
		"bank.uid AS uid",
		"bank.created_ts AS created_ts",
		"bank.updated_ts AS updated_ts",
		"bank.title AS title",
		"bank.description AS description",
	}

	query := fmt.Sprintf(`
SELECT %s
FROM bank
WHERE %s
ORDER BY bank.id DESC
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

	list := make([]*store.Bank, 0)
	for rows.Next() {
		bank := store.Bank{}
		if err := rows.Scan(
			&bank.ID,
			&bank.UID,
			&bank.CreatedTs,
			&bank.UpdatedTs,
			&bank.Title,
			&bank.Description,
		); err != nil {
			return nil, err
		}
		list = append(list, &bank)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) GetBank(ctx context.Context, find *store.FindBank) (*store.Bank, error) {
	list, err := d.ListBanks(ctx, find)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get bank")
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (d *DB) UpdateBank(ctx context.Context, update *store.UpdateBank) error {
	set, args := []string{}, []any{}
	if v := update.Title; v != nil {
		set, args = append(set, "title = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Description; v != nil {
		set, args = append(set, "description = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if len(set) == 0 {
		return nil
	}
	args = append(args, update.ID)

	stmt := "UPDATE bank SET " + strings.Join(set, ", ") + " WHERE id = " + placeholder(len(args)+1)
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteBank(ctx context.Context, delete *store.DeleteBank) error {
	stmt := "DELETE FROM bank WHERE id = " + placeholder(1)
	result, err := d.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

func (d *DB) CreateLoan(ctx context.Context, create *store.Loan) (*store.Loan, error) {
	fields := []string{"uid", "title", "description", "principal_cents", "interest_rate_bps", "start_time", "next_repayment_time", "repaid_principal_cents", "repaid_interest_cents", "repaid_amount_cents", "remaining_principal_cents", "order_index", "monthly_repayment_day", "repayment_periods", "repayment_method"}
	args := []any{
		create.UID,
		create.Title,
		create.Description,
		create.PrincipalCents,
		create.InterestRateBps,
		create.StartTime.Unix(),
		create.NextRepaymentTime.Unix(),
		create.RepaidPrincipalCents,
		create.RepaidInterestCents,
		create.RepaidAmountCents,
		create.RemainingPrincipalCents,
		create.OrderIndex,
		create.MonthlyRepaymentDay,
		create.RepaymentPeriods,
		create.RepaymentMethod,
	}

	if create.BankID != nil {
		fields = append(fields, "bank_id")
		args = append(args, *create.BankID)
	}
	if create.CreatedTs != 0 {
		fields = append(fields, "created_ts")
		args = append(args, create.CreatedTs)
	}
	if create.UpdatedTs != 0 {
		fields = append(fields, "updated_ts")
		args = append(args, create.UpdatedTs)
	}

	stmt := "INSERT INTO loan (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts, updated_ts"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListLoans(ctx context.Context, find *store.FindLoan) ([]*store.Loan, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "loan.id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "loan.uid = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.BankID; v != nil {
		where, args = append(where, "loan.bank_id = "+placeholder(len(args)+1)), append(args, *v)
	}

	fields := []string{
		"loan.id AS id",
		"loan.uid AS uid",
		"loan.created_ts AS created_ts",
		"loan.updated_ts AS updated_ts",
		"loan.title AS title",
		"loan.description AS description",
		"loan.bank_id AS bank_id",
		"loan.principal_cents AS principal_cents",
		"loan.interest_rate_bps AS interest_rate_bps",
		"loan.start_time AS start_time",
		"loan.next_repayment_time AS next_repayment_time",
		"loan.repaid_principal_cents AS repaid_principal_cents",
		"loan.repaid_interest_cents AS repaid_interest_cents",
		"loan.repaid_amount_cents AS repaid_amount_cents",
		"loan.remaining_principal_cents AS remaining_principal_cents",
		"loan.order_index AS order_index",
		"loan.monthly_repayment_day AS monthly_repayment_day",
		"loan.repayment_periods AS repayment_periods",
		"loan.repayment_method AS repayment_method",
	}

	query := fmt.Sprintf(`
SELECT %s
FROM loan
WHERE %s
ORDER BY loan.order_index ASC, loan.id DESC
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

	list := make([]*store.Loan, 0)
	for rows.Next() {
		loan := store.Loan{}
		var bankID sql.NullInt32
		var startTime int64
		var nextTime int64
		if err := rows.Scan(
			&loan.ID,
			&loan.UID,
			&loan.CreatedTs,
			&loan.UpdatedTs,
			&loan.Title,
			&loan.Description,
			&bankID,
			&loan.PrincipalCents,
			&loan.InterestRateBps,
			&startTime,
			&nextTime,
			&loan.RepaidPrincipalCents,
			&loan.RepaidInterestCents,
			&loan.RepaidAmountCents,
			&loan.RemainingPrincipalCents,
			&loan.OrderIndex,
			&loan.MonthlyRepaymentDay,
			&loan.RepaymentPeriods,
			&loan.RepaymentMethod,
		); err != nil {
			return nil, err
		}
		if bankID.Valid {
			bankValue := bankID.Int32
			loan.BankID = &bankValue
		}
		loan.StartTime = time.Unix(startTime, 0)
		loan.NextRepaymentTime = time.Unix(nextTime, 0)
		list = append(list, &loan)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) GetLoan(ctx context.Context, find *store.FindLoan) (*store.Loan, error) {
	list, err := d.ListLoans(ctx, find)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get loan")
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (d *DB) UpdateLoan(ctx context.Context, update *store.UpdateLoan) error {
	set, args := []string{}, []any{}
	if v := update.Title; v != nil {
		set, args = append(set, "title = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Description; v != nil {
		set, args = append(set, "description = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.BankID; v != nil {
		set, args = append(set, "bank_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.PrincipalCents; v != nil {
		set, args = append(set, "principal_cents = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.InterestRateBps; v != nil {
		set, args = append(set, "interest_rate_bps = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.StartTime; v != nil {
		set, args = append(set, "start_time = "+placeholder(len(args)+1)), append(args, v.Unix())
	}
	if v := update.NextRepaymentTime; v != nil {
		set, args = append(set, "next_repayment_time = "+placeholder(len(args)+1)), append(args, v.Unix())
	}
	if v := update.RepaidPrincipalCents; v != nil {
		set, args = append(set, "repaid_principal_cents = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.RepaidInterestCents; v != nil {
		set, args = append(set, "repaid_interest_cents = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.RepaidAmountCents; v != nil {
		set, args = append(set, "repaid_amount_cents = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.RemainingPrincipalCents; v != nil {
		set, args = append(set, "remaining_principal_cents = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.OrderIndex; v != nil {
		set, args = append(set, "order_index = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.MonthlyRepaymentDay; v != nil {
		set, args = append(set, "monthly_repayment_day = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.RepaymentPeriods; v != nil {
		set, args = append(set, "repayment_periods = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.RepaymentMethod; v != nil {
		set, args = append(set, "repayment_method = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if len(set) == 0 {
		return nil
	}
	args = append(args, update.ID)

	stmt := "UPDATE loan SET " + strings.Join(set, ", ") + " WHERE id = " + placeholder(len(args)+1)
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteLoan(ctx context.Context, delete *store.DeleteLoan) error {
	stmt := "DELETE FROM loan WHERE id = " + placeholder(1)
	result, err := d.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

func (d *DB) CreateRepayment(ctx context.Context, create *store.Repayment) (*store.Repayment, error) {
	fields := []string{"uid", "loan_id", "repayment_time", "principal_cents", "interest_cents", "total_cents", "remaining_principal_cents", "note", "is_early_repayment", "period"}
	isEarly := 0
	if create.IsEarlyRepayment {
		isEarly = 1
	}
	var period sql.NullInt32
	if create.Period != nil {
		period = sql.NullInt32{Int32: *create.Period, Valid: true}
	}
	args := []any{
		create.UID,
		create.LoanID,
		create.RepaymentTime.Unix(),
		create.PrincipalCents,
		create.InterestCents,
		create.TotalCents,
		create.RemainingPrincipalCents,
		create.Note,
		isEarly,
		period,
	}

	if create.CreatedTs != 0 {
		fields = append(fields, "created_ts")
		args = append(args, create.CreatedTs)
	}
	if create.UpdatedTs != 0 {
		fields = append(fields, "updated_ts")
		args = append(args, create.UpdatedTs)
	}

	stmt := "INSERT INTO repayment (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts, updated_ts"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListRepayments(ctx context.Context, find *store.FindRepayment) ([]*store.Repayment, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "repayment.id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "repayment.uid = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.LoanID; v != nil {
		where, args = append(where, "repayment.loan_id = "+placeholder(len(args)+1)), append(args, *v)
	}

	fields := []string{
		"repayment.id AS id",
		"repayment.uid AS uid",
		"repayment.created_ts AS created_ts",
		"repayment.updated_ts AS updated_ts",
		"repayment.loan_id AS loan_id",
		"repayment.repayment_time AS repayment_time",
		"repayment.principal_cents AS principal_cents",
		"repayment.interest_cents AS interest_cents",
		"repayment.total_cents AS total_cents",
		"repayment.remaining_principal_cents AS remaining_principal_cents",
		"repayment.note AS note",
		"repayment.is_early_repayment AS is_early_repayment",
		"repayment.period AS period",
	}

	query := fmt.Sprintf(`
SELECT %s
FROM repayment
WHERE %s
ORDER BY repayment.repayment_time DESC, repayment.id DESC
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

	list := make([]*store.Repayment, 0)
	for rows.Next() {
		repayment := store.Repayment{}
		var repaymentTime int64
		var isEarly int64
		var period sql.NullInt32
		if err := rows.Scan(
			&repayment.ID,
			&repayment.UID,
			&repayment.CreatedTs,
			&repayment.UpdatedTs,
			&repayment.LoanID,
			&repaymentTime,
			&repayment.PrincipalCents,
			&repayment.InterestCents,
			&repayment.TotalCents,
			&repayment.RemainingPrincipalCents,
			&repayment.Note,
			&isEarly,
			&period,
		); err != nil {
			return nil, err
		}
		repayment.RepaymentTime = time.Unix(repaymentTime, 0)
		repayment.IsEarlyRepayment = isEarly != 0
		if period.Valid {
			value := period.Int32
			repayment.Period = &value
		}
		list = append(list, &repayment)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) GetRepayment(ctx context.Context, find *store.FindRepayment) (*store.Repayment, error) {
	list, err := d.ListRepayments(ctx, find)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get repayment")
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (d *DB) UpdateRepayment(ctx context.Context, update *store.UpdateRepayment) error {
	set, args := []string{}, []any{}
	if v := update.RepaymentTime; v != nil {
		set, args = append(set, "repayment_time = "+placeholder(len(args)+1)), append(args, v.Unix())
	}
	if v := update.PrincipalCents; v != nil {
		set, args = append(set, "principal_cents = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.InterestCents; v != nil {
		set, args = append(set, "interest_cents = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.TotalCents; v != nil {
		set, args = append(set, "total_cents = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.RemainingPrincipalCents; v != nil {
		set, args = append(set, "remaining_principal_cents = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Note; v != nil {
		set, args = append(set, "note = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.IsEarlyRepayment; v != nil {
		value := 0
		if *v {
			value = 1
		}
		set, args = append(set, "is_early_repayment = "+placeholder(len(args)+1)), append(args, value)
	}
	if v := update.Period; v != nil {
		if *v == 0 {
			set = append(set, "period = NULL")
		} else {
			set, args = append(set, "period = "+placeholder(len(args)+1)), append(args, *v)
		}
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if len(set) == 0 {
		return nil
	}
	args = append(args, update.ID)

	stmt := "UPDATE repayment SET " + strings.Join(set, ", ") + " WHERE id = " + placeholder(len(args)+1)
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteRepayment(ctx context.Context, delete *store.DeleteRepayment) error {
	stmt := "DELETE FROM repayment WHERE id = " + placeholder(1)
	result, err := d.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
