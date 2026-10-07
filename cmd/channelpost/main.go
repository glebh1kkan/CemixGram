// Command channelpost sends a plain text message to a channel as a given
// user (e.g. 777000 welcome posts). It reuses the real app/services so all
// read models, dialogs and outbox rows are written consistently.
//
// Usage: TELESRV_POSTGRES_DSN=... channelpost <channel_id> <text>
package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	channelapp "telesrv/internal/app/channels"
	"telesrv/internal/domain"
	"telesrv/internal/store/postgres"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "usage: channelpost <channel_id> <text>")
		os.Exit(2)
	}
	channelID, err := strconv.ParseInt(os.Args[1], 10, 64)
	if err != nil || channelID == 0 {
		fmt.Fprintln(os.Stderr, "bad channel_id")
		os.Exit(2)
	}
	dsn := os.Getenv("TELESRV_POSTGRES_DSN")
	if dsn == "" {
		fmt.Fprintln(os.Stderr, "TELESRV_POSTGRES_DSN is required")
		os.Exit(2)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	pool, err := postgres.Open(ctx, dsn)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open db:", err)
		os.Exit(1)
	}
	defer pool.Close()
	svc := channelapp.NewService(postgres.NewChannelStore(pool))
	res, err := svc.SendMessage(ctx, 777000, domain.SendChannelMessageRequest{
		UserID:    777000,
		ChannelID: channelID,
		Message:   os.Args[2],
		Date:      int(time.Now().Unix()),
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "send:", err)
		os.Exit(1)
	}
	fmt.Printf("posted message %d to channel %d\n", res.Message.ID, res.Channel.ID)
}
