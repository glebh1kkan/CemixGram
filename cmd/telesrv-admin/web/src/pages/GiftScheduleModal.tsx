import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { errorMessage } from "../api";
import { ActionButton } from "../components/ActionButton";
import { Alert } from "../components/ui";
import { useI18n } from "../i18n";
import { toUnixSeconds } from "../lib/format";
import type { StarGiftRow } from "../types";

type ScheduleState = {
  gift_id: number;
  release_date: number;
  upgrade_attributes_date: number;
  upgrade_open_date: number;
} | null;

function toLocalInput(unix: number): string {
  if (!unix) return "";
  const at = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

// GiftScheduleModal — операторское расписание подарка: релиз продажи,
// видимость атрибутов улучшений и открытие самого апгрейда.
// Пустые поля = гейт выключен (действуют значения каталога).
export function GiftScheduleModal({ gift, onClose, onDone }: {
  gift: StarGiftRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<ScheduleState>(null);
  const [release, setRelease] = useState("");
  const [attrs, setAttrs] = useState("");
  const [open, setOpen] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/gifts/${gift.GiftID}/schedule`, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<ScheduleState>;
      })
      .then((value) => {
        if (cancelled) return;
        setLoaded(value);
        setRelease(toLocalInput(value?.release_date ?? 0));
        setAttrs(toLocalInput(value?.upgrade_attributes_date ?? 0));
        setOpen(toLocalInput(value?.upgrade_open_date ?? 0));
      }).catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => { cancelled = true; };
  }, [gift.GiftID]);

  function payload() {
    return {
      gift_id: gift.GiftID,
      release_date: toUnixSeconds(release),
      upgrade_attributes_date: toUnixSeconds(attrs),
      upgrade_open_date: toUnixSeconds(open),
    };
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <strong>{t("gifts.scheduleTitle", { title: gift.Title || `#${gift.GiftID}` })}</strong>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t("action.close")}><X size={15} /></button>
        </div>
        {error && <Alert>{error}</Alert>}
        <p className="muted">
          {t("gifts.scheduleRelease")}: {loaded?.release_date ? new Date(loaded.release_date * 1000).toLocaleString() : t("gifts.scheduleUnset")}
          {" · "}{t("gifts.scheduleAttrs")}: {loaded?.upgrade_attributes_date ? new Date(loaded.upgrade_attributes_date * 1000).toLocaleString() : t("gifts.scheduleUnset")}
          {" · "}{t("gifts.scheduleOpen")}: {loaded?.upgrade_open_date ? new Date(loaded.upgrade_open_date * 1000).toLocaleString() : t("gifts.scheduleUnset")}
        </p>
        <label><span>{t("gifts.scheduleRelease")}</span>
          <input type="datetime-local" value={release} onChange={(event) => setRelease(event.target.value)} />
        </label>
        <label><span>{t("gifts.scheduleAttrs")}</span>
          <input type="datetime-local" value={attrs} onChange={(event) => setAttrs(event.target.value)} />
        </label>
        <label><span>{t("gifts.scheduleOpen")}</span>
          <input type="datetime-local" value={open} onChange={(event) => setOpen(event.target.value)} />
        </label>
        <div className="modal-actions">
          <ActionButton
            tone="warn"
            label={t("gifts.scheduleSave")}
            path="/api/actions/set-gift-schedule"
            payload={payload}
            onDone={() => { onDone(); onClose(); }}
          />
          <ActionButton
            tone="danger"
            label={t("gifts.scheduleClear")}
            path="/api/actions/set-gift-schedule"
            payload={() => ({ gift_id: gift.GiftID, release_date: 0, upgrade_attributes_date: 0, upgrade_open_date: 0 })}
            onDone={() => { onDone(); onClose(); }}
          />
          <button className="btn" type="button" onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
