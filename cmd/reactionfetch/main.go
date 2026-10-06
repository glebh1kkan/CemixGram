// Command reactionfetch snapshots Telegram's available reactions
// (messages.getAvailableReactions) into the telesrv seed layout:
//
//	<out>/telegram_reactions_export/global_json/available_reactions_raw.json
//	<out>/telegram_reactions_export/reactions/<docid>.<ext>
//
// The metadata schema matches internal/app/files seedReactionJSON /
// seedDocumentJSON exactly (Bot-API-style {result:{reactions:[...]}}).
// Thumbnails are omitted: the seed repair path rebuilds previews.
//
// Usage:
//
//	SESSION=/path/to/session reactionfetch <out_dir>
package main

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/iamxvbaba/td/telegram"
	"github.com/iamxvbaba/td/telegram/downloader"
	"github.com/iamxvbaba/td/tg"
)

type attrJSON struct {
	Type              string           `json:"_"`
	W                 int            `json:"w,omitempty"`
	H                 int            `json:"h,omitempty"`
	Alt               string         `json:"alt,omitempty"`
	Mask              bool           `json:"mask,omitempty"`
	Free              bool           `json:"free,omitempty"`
	TextColor         bool           `json:"text_color,omitempty"`
	Duration          float64        `json:"duration,omitempty"`
	RoundMessage      bool           `json:"round_message,omitempty"`
	SupportsStreaming bool           `json:"supports_streaming,omitempty"`
	NoSound           bool           `json:"nosound,omitempty"`
	VideoCodec        string         `json:"video_codec,omitempty"`
	Voice             bool           `json:"voice,omitempty"`
	Title             string         `json:"title,omitempty"`
	Performer         string         `json:"performer,omitempty"`
	FileName          string         `json:"file_name,omitempty"`
	Stickerset        *stickersetRefJSON `json:"stickerset,omitempty"`
}

type stickersetRefJSON struct {
	ID         int64 `json:"id"`
	AccessHash int64 `json:"access_hash"`
}

type documentJSON struct {
	ID            int64      `json:"id"`
	AccessHash    int64      `json:"access_hash"`
	FileReference string     `json:"file_reference"`
	Date          string     `json:"date"`
	MimeType      string     `json:"mime_type"`
	Size          int64      `json:"size"`
	DCID          int        `json:"dc_id"`
	Attributes    []attrJSON `json:"attributes"`
}

type reactionJSON struct {
	Reaction          string        `json:"reaction"`
	Title             string        `json:"title"`
	Inactive          bool          `json:"inactive"`
	Premium           bool          `json:"premium"`
	StaticIcon        *documentJSON `json:"static_icon"`
	AppearAnimation   *documentJSON `json:"appear_animation"`
	SelectAnimation   *documentJSON `json:"select_animation"`
	ActivateAnimation *documentJSON `json:"activate_animation"`
	EffectAnimation   *documentJSON `json:"effect_animation"`
	AroundAnimation   *documentJSON `json:"around_animation"`
	CenterIcon        *documentJSON `json:"center_icon"`
}

func mapAttrs(in []tg.DocumentAttributeClass) []attrJSON {
	out := make([]attrJSON, 0, len(in))
	for _, a := range in {
		switch v := a.(type) {
		case *tg.DocumentAttributeImageSize:
			out = append(out, attrJSON{Type: "DocumentAttributeImageSize", W: v.W, H: v.H})
		case *tg.DocumentAttributeAnimated:
			out = append(out, attrJSON{Type: "DocumentAttributeAnimated"})
		case *tg.DocumentAttributeSticker:
			aj := attrJSON{Type: "DocumentAttributeSticker", Alt: v.Alt, Mask: v.Mask}
			if id, ok := v.Stickerset.(*tg.InputStickerSetID); ok {
				aj.Stickerset = &stickersetRefJSON{ID: id.ID, AccessHash: id.AccessHash}
			}
			out = append(out, aj)
		case *tg.DocumentAttributeCustomEmoji:
			aj := attrJSON{Type: "DocumentAttributeCustomEmoji", Alt: v.Alt, Free: v.Free, TextColor: v.TextColor}
			if id, ok := v.Stickerset.(*tg.InputStickerSetID); ok {
				aj.Stickerset = &stickersetRefJSON{ID: id.ID, AccessHash: id.AccessHash}
			}
			out = append(out, aj)
		case *tg.DocumentAttributeVideo:
			out = append(out, attrJSON{Type: "DocumentAttributeVideo", W: v.W, H: v.H, Duration: v.Duration, RoundMessage: v.RoundMessage, SupportsStreaming: v.SupportsStreaming})
		case *tg.DocumentAttributeFilename:
			out = append(out, attrJSON{Type: "DocumentAttributeFilename", FileName: v.FileName})
		}
	}
	return out
}

func extFor(mime string) string {
	switch mime {
	case "video/webm":
		return ".webm"
	case "image/webp":
		return ".webp"
	default:
		return ".tgs"
	}
}

func completeExistingFile(path string, size int64) bool {
	st, err := os.Stat(path)
	if err != nil || size <= 0 {
		return false
	}
	return st.Size() == size
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: SESSION=/path/to/session reactionfetch <out_dir>")
		os.Exit(2)
	}
	session := os.Getenv("SESSION")
	if session == "" {
		fmt.Fprintln(os.Stderr, "ERROR: SESSION is required")
		os.Exit(2)
	}
	outRoot := os.Args[1]
	reactionsDir := filepath.Join(outRoot, "telegram_reactions_export", "reactions")
	globalDir := filepath.Join(outRoot, "telegram_reactions_export", "global_json")
	if err := os.MkdirAll(reactionsDir, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		os.Exit(1)
	}
	if err := os.MkdirAll(globalDir, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Hour)
	defer cancel()

	client := telegram.NewClient(17349, "344583e45741c457fe1862106095a5eb", telegram.Options{
		SessionStorage: &telegram.FileSessionStorage{Path: session},
	})
	err := client.Run(ctx, func(ctx context.Context) error {
		status, err := client.Auth().Status(ctx)
		if err != nil {
			return err
		}
		if !status.Authorized {
			return errors.New("SESSION is not authorized")
		}
		api := client.API()
		res, err := api.MessagesGetAvailableReactions(ctx, 0)
		if err != nil {
			return fmt.Errorf("getAvailableReactions: %w", err)
		}
		avail, ok := res.(*tg.MessagesAvailableReactions)
		if !ok {
			return fmt.Errorf("unexpected response %T", res)
		}
		dl := downloader.NewDownloader()
		seen := map[int64]bool{}
		reactions := make([]reactionJSON, 0, len(avail.Reactions))
		fetchDoc := func(dc tg.DocumentClass) *documentJSON {
			doc, ok := dc.(*tg.Document)
			if !ok || doc.ID == 0 {
				return nil
			}
			if !seen[doc.ID] {
				seen[doc.ID] = true
				path := filepath.Join(reactionsDir, fmt.Sprintf("%d%s", doc.ID, extFor(doc.MimeType)))
				if !completeExistingFile(path, doc.Size) {
					loc := &tg.InputDocumentFileLocation{ID: doc.ID, AccessHash: doc.AccessHash, FileReference: doc.FileReference}
					var buf bytes.Buffer
					if _, err := dl.Download(api, loc).Stream(ctx, &buf); err != nil {
						fmt.Fprintf(os.Stderr, "skip doc %d: %v\n", doc.ID, err)
						return nil
					}
					if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
						fmt.Fprintf(os.Stderr, "skip doc %d: %v\n", doc.ID, err)
						return nil
					}
				}
			}
			return &documentJSON{
				ID:            doc.ID,
				AccessHash:    doc.AccessHash,
				FileReference: hex.EncodeToString(doc.FileReference),
				Date:          time.Unix(int64(doc.Date), 0).UTC().Format(time.RFC3339),
				MimeType:      doc.MimeType,
				Size:          doc.Size,
				DCID:          doc.DCID,
				Attributes:    mapAttrs(doc.Attributes),
			}
		}
		for _, r := range avail.Reactions {
			rj := reactionJSON{
				Reaction:          r.Reaction,
				Title:             r.Title,
				Inactive:          r.Inactive,
				Premium:           r.Premium,
				StaticIcon:        fetchDoc(r.StaticIcon),
				AppearAnimation:   fetchDoc(r.AppearAnimation),
				SelectAnimation:   fetchDoc(r.SelectAnimation),
				ActivateAnimation: fetchDoc(r.ActivateAnimation),
				EffectAnimation:   fetchDoc(r.EffectAnimation),
				AroundAnimation:   fetchDoc(r.AroundAnimation),
				CenterIcon:        fetchDoc(r.CenterIcon),
			}
			reactions = append(reactions, rj)
		}
		out := map[string]any{"result": map[string]any{"reactions": reactions}}
		b, err := json.MarshalIndent(out, "", "  ")
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(globalDir, "available_reactions_raw.json"), append(b, '\n'), 0o644); err != nil {
			return err
		}
		fmt.Printf("[complete] reactions=%d documents=%d\n", len(reactions), len(seen))
		return nil
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		os.Exit(1)
	}
}
