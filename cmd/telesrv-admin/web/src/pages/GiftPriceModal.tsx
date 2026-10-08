import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { errorMessage } from "../api";
import { ActionButton } from "../components/ActionButton";
import { Alert } from "../components/ui";
import { useI18n } from "../i18n";
import type { StarGiftRow } from "../types";

type PriceState = {
  currency: string;
  amountNanoton: number;
  overridden: boolean;
} | null;

// GiftPriceModal — цена продажи подарка: выбор валюты (звёзды/грамы) и суммы.
// Грамы вводятся десятичными (0.1+), на сервер уходят нанотоны.
export function GiftPriceModal({ gift, onClose, onDone }: {
  gift: StarGiftRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [price, setPrice] = useState<PriceState>(null);
  const [currency, setCurrency] = useState("XTR");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/gifts/${gift.GiftID}/price`, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<PriceState>;
      })
      .then((loaded) => {
      if (cancelled) return;
      setPrice(loaded);
      setCurrency(loaded?.currency === "TON" ? "TON" : "XTR");
      if (loaded?.overridden) {
        setAmount(loaded.currency === "TON" ? String(Number(loaded.amountNanoton) / 1e9) : String(loaded.amountNanoton));
      } else {
        setAmount("");
      }
    }).catch((err) => {
      if (!cancelled) setError(errorMessage(err));
    });
    return () => { cancelled = true; };
  }, [gift.GiftID]);

  function nanoton(): number | null {
    const value = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return null;
    if (currency === "TON") {
      if (value < 0.000000001) return null;
      return Math.round(value * 1e9);
    }
    if (!Number.isInteger(value)) return null;
    return value;
  }

  const parsed = nanoton();
  const unit = currency === "TON" ? t("gifts.priceGrams") : t("gifts.priceStars");

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <strong>{t("gifts.priceTitle", { title: gift.Title || `#${gift.GiftID}` })}</strong>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t("action.close")}><X size={15} /></button>
        </div>
        {error && <Alert>{error}</Alert>}
        <p className="muted">
          {t("gifts.priceCatalog", { stars: gift.Stars })}
          {price?.overridden
            ? ` · ${t("gifts.priceOverride", { amount: price.currency === "TON" ? `${Number(price.amountNanoton) / 1e9} gram` : `${price.amountNanoton} ⭐` })}`
            : ` · ${t("gifts.priceNoOverride")}`}
        </p>
        <label><span>{t("gifts.priceCurrency")}</span>
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            <option value="XTR">⭐ {t("gifts.currencyStars")}</option>
            <option value="TON">🪙 {t("gifts.currencyGrams")}</option>
          </select>
        </label>
        <label><span>{t("gifts.priceAmount", { unit })}</span>
          <input type="number" min="0" step={currency === "TON" ? "0.1" : "1"} value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <div className="modal-actions">
          <ActionButton
            tone="warn"
            label={t("gifts.priceSave")}
            path="/api/actions/set-gift-price"
            disabled={parsed === null || busy}
            payload={() => ({ gift_id: gift.GiftID, currency, amount_nanoton: String(parsed) })}
            onDone={() => { onDone(); onClose(); }}
          />
          {price?.overridden && (
            <ActionButton
              tone="danger"
              label={t("gifts.priceClear")}
              path="/api/actions/set-gift-price"
              payload={() => ({ gift_id: gift.GiftID, currency: "XTR", amount_nanoton: "0" })}
              onDone={() => { onDone(); onClose(); }}
            />
          )}
          <button className="btn" type="button" onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
