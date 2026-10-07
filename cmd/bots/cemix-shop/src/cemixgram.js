// клиент admin api cemix (127.0.0.1:2599): резолв по номеру, гранты, минты.
export class CemixgramClient {
  constructor(api, token, actor) {
    this.api = api.replace(/\/+$/, "");
    this.token = token;
    this.actor = actor;
  }

  async post(route, payload) {
    const response = await fetch(`${this.api}${route}`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    if (!response.ok) throw Object.assign(new Error(`cemix ${route} ${response.status}: ${text.slice(0, 200)}`), { status: response.status });
    return text ? JSON.parse(text) : {};
  }

  async resolveUserByPhone(phone) {
    const result = await this.post("/v1/accounts/resolve-by-phone", { phone });
    if (result?.found === false) return 0;
    const id = Number(result?.user_id);
    if (result?.found === true && Number.isSafeInteger(id) && id > 0) return id;
    throw new Error("invalid account lookup response");
  }

  grantStars(userID, amount, reason, idempotencyKey) {
    return this.post("/v1/accounts/grant-stars", {
      command_id: `cemix-shop-${idempotencyKey}`,
      actor: this.actor,
      reason,
      dry_run: false,
      user_id: userID,
      amount,
    });
  }

  // минт коллекционного +888. dry_run=true только проверяет свободу номера.
  mintPhone(userID, phone, priceTG, idempotencyKey, dryRun = false) {
    return this.post("/v1/collectible-phones/mint", {
      command_id: `cemix-shop-${idempotencyKey}`,
      actor: this.actor,
      reason: "покупка нфт номера через бота",
      dry_run: dryRun,
      phone,
      tier: "standard",
      owner_user_id: String(userID),
      currency: "USD",
      amount: String(priceTG),
      crypto_currency: "TON",
      crypto_amount: String(priceTG),
      url: `http://127.0.0.1:2401/nft/phone/${phone.replace(/^\+/, "")}`,
      purchase_date: Math.floor(Date.now() / 1000),
    });
  }

  mintUsername(userID, username, priceTG, idempotencyKey, dryRun = false) {
    return this.post("/v1/collectible-usernames/mint", {
      command_id: `cemix-shop-${idempotencyKey}`,
      actor: this.actor,
      reason: "покупка нфт юзернейма через бота",
      dry_run: dryRun,
      username,
      owner_user_id: String(userID),
      currency: "USD",
      amount: String(priceTG),
      crypto_currency: "TON",
      crypto_amount: String(priceTG),
      url: `http://127.0.0.1:2401/nft/username/${username}`,
      purchase_date: Math.floor(Date.now() / 1000),
    });
  }
}
