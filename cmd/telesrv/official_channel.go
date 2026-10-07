package main

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"telesrv/internal/config"
	channelapp "telesrv/internal/app/channels"
	"telesrv/internal/domain"
)

// systemAccountID — служебный 777000, создатель официальных канала и чата.
const systemAccountID = 777000

// officialPeerIDs — id официальных канала и чата для хука автоподписки.
var officialPeerIDs []int64

// ensureOfficialChannel находит официальный канал по username из конфига или
// создаёт его (broadcast, создатель 777000), выставляет username/about и
// подписывает всех существующих живых юзеров.
func ensureOfficialChannel(ctx context.Context, logger *zap.Logger, pool *pgxpool.Pool, cfg config.Config, channels *channelapp.Service) int64 {
	title := cfg.OfficialChannelTitle
	username := cfg.OfficialChannelUsername
	if title == "" {
		return 0
	}
	var channelID int64
	if username != "" {
		_ = pool.QueryRow(ctx, `SELECT id FROM channels WHERE lower(username) = lower($1) LIMIT 1`, username).Scan(&channelID)
	}
	if channelID == 0 {
		_ = pool.QueryRow(ctx, `SELECT id FROM channels WHERE creator_user_id = $1 AND title = $2 AND broadcast AND NOT megagroup LIMIT 1`, systemAccountID, title).Scan(&channelID)
	}
	if channelID == 0 {
		res, err := channels.CreateChannel(ctx, systemAccountID, domain.CreateChannelRequest{
			Title:     title,
			About:     cfg.OfficialChannelAbout,
			Broadcast: true,
			Date:      int(time.Now().Unix()),
		})
		if err != nil {
			logger.Warn("официальный канал не создан", zap.Error(err))
			return 0
		}
		channelID = res.Channel.ID
	}
	if username != "" {
		if _, err := channels.UpdateUsername(ctx, systemAccountID, domain.UpdateChannelUsernameRequest{
			UserID:    systemAccountID,
			ChannelID: channelID,
			Username:  username,
		}); err != nil {
			logger.Warn("username официального канала не выставлен", zap.String("username", username), zap.Error(err))
		}
	}
	joinAllUsers(ctx, logger, pool, channels, channelID)
	logger.Info("официальный канал готов", zap.Int64("channel_id", channelID), zap.String("username", username))
	return channelID
}

// ensureOfficialChat находит официальную группу по названию или создаёт её
// (megagroup, создатель 777000) и подписывает всех существующих живых юзеров.
func ensureOfficialChat(ctx context.Context, logger *zap.Logger, pool *pgxpool.Pool, cfg config.Config, channels *channelapp.Service) int64 {
	title := cfg.OfficialChatTitle
	if title == "" {
		return 0
	}
	var chatID int64
	_ = pool.QueryRow(ctx, `SELECT id FROM channels WHERE creator_user_id = $1 AND title = $2 AND megagroup LIMIT 1`, systemAccountID, title).Scan(&chatID)
	if chatID == 0 {
		res, err := channels.CreateMegagroupFromCreateChat(ctx, systemAccountID, domain.CreateChannelRequest{
			Title: title,
			About: cfg.OfficialChannelAbout,
			Date:  int(time.Now().Unix()),
		})
		if err != nil {
			logger.Warn("официальный чат не создан", zap.Error(err))
			return 0
		}
		chatID = res.Channel.ID
	}
	joinAllUsers(ctx, logger, pool, channels, chatID)
	logger.Info("официальный чат готов", zap.Int64("channel_id", chatID))
	return chatID
}

func joinAllUsers(ctx context.Context, logger *zap.Logger, pool *pgxpool.Pool, channels *channelapp.Service, channelID int64) {
	rows, err := pool.Query(ctx, `SELECT id FROM users WHERE id != $1 AND (is_bot IS DISTINCT FROM true)`, systemAccountID)
	if err != nil {
		logger.Warn("список юзеров для подписки не получен", zap.Error(err))
		return
	}
	var joined int
	for rows.Next() {
		var userID int64
		if err := rows.Scan(&userID); err != nil {
			break
		}
		if _, err := channels.JoinChannel(ctx, userID, channelID, int(time.Now().Unix())); err == nil {
			joined++
		}
	}
	rows.Close()
	if joined > 0 {
		logger.Info("подписано на официальный peer", zap.Int64("channel_id", channelID), zap.Int("joined", joined))
	}
}
