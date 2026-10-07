package rpc

import (
	"context"
	"errors"
	"testing"

	"github.com/iamxvbaba/td/clock"
	"github.com/iamxvbaba/td/tg"
	"github.com/iamxvbaba/td/tgerr"
	"go.uber.org/zap/zaptest"

	appaccount "telesrv/internal/app/account"
	appprivacy "telesrv/internal/app/privacy"
	appstars "telesrv/internal/app/stars"
	appusers "telesrv/internal/app/users"
	"telesrv/internal/domain"
	"telesrv/internal/store/memory"
)

type paidChargeFixture struct {
	router   *Router
	messages *captureMessages
	stars    *appstars.Service
	alice    domain.User
	bob      domain.User
}

func newPaidChargeFixture(t *testing.T, bobPrice int64) *paidChargeFixture {
	t.Helper()
	ctx := context.Background()
	usersStore := memory.NewUserStore()
	alice, err := usersStore.Create(ctx, domain.User{AccessHash: 11, Phone: "15550008111", FirstName: "Alice"})
	if err != nil {
		t.Fatalf("create Alice: %v", err)
	}
	bob, err := usersStore.Create(ctx, domain.User{AccessHash: 22, Phone: "15550008112", FirstName: "Bob"})
	if err != nil {
		t.Fatalf("create Bob: %v", err)
	}
	users := appusers.NewService(usersStore)
	contacts := memory.NewContactStore()
	privacy := appprivacy.NewService(memory.NewPrivacyStore(), contacts).ConfigureReadModels(users, nil)
	settingsStore := memory.NewPasswordStore()
	account := appaccount.NewService(settingsStore, appaccount.WithAccountSettings(settingsStore))
	if bobPrice > 0 {
		if _, err := account.SetGlobalPrivacy(ctx, bob.ID, domain.GlobalPrivacy{NoncontactPeersPaidStars: bobPrice}); err != nil {
			t.Fatalf("set Bob paid requirement: %v", err)
		}
	}
	stars := appstars.NewService(memory.NewStarsStore())
	messages := &captureMessages{}
	router := New(Config{}, Deps{
		Account:  account,
		Privacy:  privacy,
		Users:    users,
		Messages: messages,
		Stars:    stars,
	}, zaptest.NewLogger(t), clock.System)
	if _, err := stars.GetBalance(ctx, alice.ID); err != nil {
		t.Fatalf("prime Alice balance: %v", err)
	}
	return &paidChargeFixture{router: router, messages: messages, stars: stars, alice: alice, bob: bob}
}

func (f *paidChargeFixture) send(t *testing.T, allowPaidStars, randomID int64) error {
	t.Helper()
	ctx := WithUserID(context.Background(), f.alice.ID)
	_, err := f.router.onMessagesSendMessage(ctx, &tg.MessagesSendMessageRequest{
		Peer:           &tg.InputPeerUser{UserID: f.bob.ID, AccessHash: f.bob.AccessHash},
		Message:        "hi",
		RandomID:       randomID,
		AllowPaidStars: allowPaidStars,
	})
	return err
}

func (f *paidChargeFixture) balances(t *testing.T) (int64, int64) {
	t.Helper()
	ctx := context.Background()
	a, err := f.stars.GetBalance(ctx, f.alice.ID)
	if err != nil {
		t.Fatalf("alice balance: %v", err)
	}
	b, err := f.stars.GetBalance(ctx, f.bob.ID)
	if err != nil {
		t.Fatalf("bob balance: %v", err)
	}
	return a.Balance, b.Balance
}

func TestPaidPrivateSendMovesStars(t *testing.T) {
	f := newPaidChargeFixture(t, 7)
	if err := f.send(t, 7, 1001); err != nil {
		t.Fatalf("paid send: %v", err)
	}
	a, b := f.balances(t)
	if a != 1000-7 || b != 1000+7 {
		t.Fatalf("balances = %d/%d, want 993/1007", a, b)
	}
	if f.messages.sendUserID != f.alice.ID {
		t.Fatalf("store got sender %d, want Alice", f.messages.sendUserID)
	}
}

func TestPaidPrivateSendRejectsInsufficientBalance(t *testing.T) {
	f := newPaidChargeFixture(t, 50000)
	if err := f.send(t, 50000, 1002); err == nil {
		t.Fatal("expected BALANCE_TOO_LOW, got nil")
	} else if !tgerr.Is(err, "BALANCE_TOO_LOW") {
		t.Fatalf("error = %v, want BALANCE_TOO_LOW", err)
	}
	if f.messages.sendUserID != 0 {
		t.Fatal("message store must not run on insufficient balance")
	}
	a, b := f.balances(t)
	if a != 1000 || b != 1000 {
		t.Fatalf("balances = %d/%d, want 1000/1000", a, b)
	}
}

func TestPaidPrivateSendRefundsOnStoreError(t *testing.T) {
	f := newPaidChargeFixture(t, 7)
	f.messages.sendErr = errors.New("store down")
	if err := f.send(t, 7, 1003); err == nil {
		t.Fatal("expected send error, got nil")
	}
	a, b := f.balances(t)
	if a != 1000 || b != 1000 {
		t.Fatalf("balances = %d/%d, want refunded 1000/1000", a, b)
	}
}

func TestPaidPrivateSendDuplicateDoesNotCharge(t *testing.T) {
	f := newPaidChargeFixture(t, 7)
	f.messages.sendResult.Duplicate = true
	if err := f.send(t, 7, 1004); err != nil {
		t.Fatalf("duplicate replay: %v", err)
	}
	a, b := f.balances(t)
	if a != 1000 || b != 1000 {
		t.Fatalf("balances = %d/%d, want untouched 1000/1000", a, b)
	}
}

func TestFreePrivateSendMovesNoStars(t *testing.T) {
	f := newPaidChargeFixture(t, 0)
	if err := f.send(t, 0, 1005); err != nil {
		t.Fatalf("free send: %v", err)
	}
	a, b := f.balances(t)
	if a != 1000 || b != 1000 {
		t.Fatalf("balances = %d/%d, want 1000/1000", a, b)
	}
}
