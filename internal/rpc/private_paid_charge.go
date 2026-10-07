package rpc

import (
	"context"
	"errors"

	"go.uber.org/zap"

	"telesrv/internal/domain"
)

// Private paid messages (user -> user for Stars): the privacy gate only
// validates the sender's authorization ceiling. The ledger movement is
// orchestrated here around the message-store commit:
//
//  1. debit the sender first (fails closed on insufficient balance),
//  2. send; on any store error or idempotent duplicate, refund the debit,
//  3. on a fresh commit, credit the recipient in full.
//
// The debit and the send are separate transactions (message store and Stars
// ledger do not share one); a process crash between them can strand a debit,
// which the refund path cannot cover. Duplicate random_id replays never move
// money: they are refunded immediately.
func (r *Router) debitPrivatePaidSender(ctx context.Context, senderUserID, recipientUserID, amount int64) error {
	if r.deps.Stars == nil {
		return paymentUnsupportedErr()
	}
	if amount <= 0 {
		return nil
	}
	_, err := r.deps.Stars.Debit(ctx, senderUserID, amount,
		domain.StarsReasonPaidMessage,
		domain.Peer{Type: domain.PeerTypeUser, ID: recipientUserID},
		"paid message", "")
	if err != nil {
		if errors.Is(err, domain.ErrStarsInsufficient) {
			return balanceTooLowErr()
		}
		return internalErr()
	}
	return nil
}

func (r *Router) refundPrivatePaidSender(ctx context.Context, senderUserID, recipientUserID, amount int64) {
	if r.deps.Stars == nil || amount <= 0 {
		return
	}
	if _, err := r.deps.Stars.Credit(ctx, senderUserID, amount,
		domain.StarsReasonPaidMessage,
		domain.Peer{Type: domain.PeerTypeUser, ID: recipientUserID},
		"paid message", "refund"); err != nil {
		r.log.Warn("private paid message refund failed",
			zap.Int64("sender", senderUserID), zap.Int64("recipient", recipientUserID), zap.Int64("amount", amount))
	}
}

func (r *Router) creditPrivatePaidRecipient(ctx context.Context, senderUserID, recipientUserID, amount int64) error {
	if r.deps.Stars == nil || amount <= 0 {
		return nil
	}
	_, err := r.deps.Stars.Credit(ctx, recipientUserID, amount,
		domain.StarsReasonPaidMessage,
		domain.Peer{Type: domain.PeerTypeUser, ID: senderUserID},
		"paid message", "")
	if err != nil {
		r.log.Warn("private paid message recipient credit failed",
			zap.Int64("sender", senderUserID), zap.Int64("recipient", recipientUserID), zap.Int64("amount", amount))
		return internalErr()
	}
	return nil
}
