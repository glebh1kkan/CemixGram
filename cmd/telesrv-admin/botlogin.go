package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"sync"
	"time"
)

// Bot-gated admin login: the panel password form is disabled (empty
// TELESRV_ADMIN_UI_PASSWORD), and the only way in is a one-time link issued
// through the Telegram bot (/apanel, owner only).
//
// Flow: bot -> POST /api/internal/bot-login-token {secret} -> {token}
// user opens GET /auth/bot?token= -> one-time session cookie -> redirect /.

var botLoginTokens = struct {
	sync.Mutex
	tokens map[string]time.Time
}{tokens: make(map[string]time.Time)}

const botLoginTokenTTL = 5 * time.Minute

func mintBotLoginToken() (string, error) {
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	token := hex.EncodeToString(raw[:])
	botLoginTokens.Lock()
	botLoginTokens.tokens[token] = time.Now().Add(botLoginTokenTTL)
	// opportunistic cleanup
	for stale, exp := range botLoginTokens.tokens {
		if time.Now().After(exp) {
			delete(botLoginTokens.tokens, stale)
		}
	}
	botLoginTokens.Unlock()
	return token, nil
}

func consumeBotLoginToken(token string) bool {
	botLoginTokens.Lock()
	defer botLoginTokens.Unlock()
	exp, ok := botLoginTokens.tokens[token]
	if !ok || time.Now().After(exp) {
		delete(botLoginTokens.tokens, token)
		return false
	}
	delete(botLoginTokens.tokens, token)
	return true
}

type botLoginTokenRequest struct {
	Secret string `json:"secret"`
}

func (s *server) handleBotLoginTokenAPI(w http.ResponseWriter, r *http.Request) {
	var body botLoginTokenRequest
	if !decodeAction(w, r, &body) {
		return
	}
	if len(s.cfg.BotSecret) == 0 || len(body.Secret) == 0 ||
		len(body.Secret) != len(s.cfg.BotSecret) ||
		subtle.ConstantTimeCompare([]byte(body.Secret), []byte(s.cfg.BotSecret)) != 1 {
		writeAPIError(w, http.StatusUnauthorized, "invalid secret")
		return
	}
	token, err := mintBotLoginToken()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"token":      token,
		"expires_in": int(botLoginTokenTTL.Seconds()),
	})
}

func peekBotLoginToken(token string) bool {
	if token == "" {
		return false
	}
	botLoginTokens.Lock()
	defer botLoginTokens.Unlock()
	exp, ok := botLoginTokens.tokens[token]
	if !ok || time.Now().After(exp) {
		return false
	}
	return true
}

func (s *server) handleBotLoginPage(w http.ResponseWriter, r *http.Request) {
	// One-time links die to Telegram link previews (the preview fetch is a GET
	// that would burn the token), so GET only renders a confirm button and the
	// token is consumed by the POST behind it.
	token := r.URL.Query().Get("token")
	if !peekBotLoginToken(token) {
		writeAPIError(w, http.StatusUnauthorized, "invalid or expired token")
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход в админку</title></head><body style="font-family:sans-serif;display:flex;min-height:90vh;align-items:center;justify-content:center;background:#0b1620;color:#e8eef4"><form method="POST" style="text-align:center"><h2>Вход в админку CemixGram</h2><p style="color:#8fa3b5">Ссылка одноразовая — нажми кнопку чтобы войти.</p><button type="submit" style="font-size:18px;padding:12px 32px;border-radius:10px;border:0;background:#2b7cd3;color:#fff;cursor:pointer">Войти</button></form></body></html>`))
}

func (s *server) handleBotLoginConfirm(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" || !consumeBotLoginToken(token) {
		writeAPIError(w, http.StatusUnauthorized, "invalid or expired token")
		return
	}
	csrfToken, err := newCSRFToken()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	permissions := newPanelPermissions(s.cfg.Permissions)
	value, err := signSession(s.cfg.SessionKey, sessionClaims{
		Actor:       breakGlassUsername,
		Epoch:       0,
		Exp:         time.Now().Add(sessionTTL).Unix(),
		Nonce:       newCommandID("sess"),
		Permissions: permissions.List(),
		CSRF:        csrfToken,
	})
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	setCSRFCookie(w, csrfToken, sessionTTL)
	http.Redirect(w, r, "/", http.StatusFound)
}
