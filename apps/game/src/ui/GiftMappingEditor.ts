import { SELECTABLE_ACTIONS, getAction } from "../gifts/actions";
import type {
  GiftCatalogConfig,
  GiftMappingEntry,
  GiftTierRule,
} from "../gifts/giftCatalog";
import type { UnknownGift } from "../gifts/RulesEngine";
import { escapeHtml } from "./StartScreen";

export type MappingEditorHandlers = {
  onChange: (catalog: GiftCatalogConfig) => void;
  getUnknownGifts: () => UnknownGift[];
};

/**
 * Local gift-to-effect mapping. Gift ids are the key; names are only a
 * fallback. Nothing here is sent anywhere — the config lives in localStorage.
 */
export class GiftMappingEditor {
  private readonly root: HTMLElement;

  constructor(
    parent: HTMLElement,
    private catalog: GiftCatalogConfig,
    private readonly handlers: MappingEditorHandlers,
  ) {
    this.root = document.createElement("div");
    this.root.className = "mapping-editor";
    parent.append(this.root);
    this.render();
    this.root.addEventListener("change", (event) => this.onChange(event));
    this.root.addEventListener("click", (event) => this.onClick(event));
  }

  setCatalog(catalog: GiftCatalogConfig): void {
    this.catalog = catalog;
    this.render();
  }

  refreshUnknown(): void {
    const list = this.root.querySelector<HTMLElement>("[data-unknown]");
    if (list) list.innerHTML = this.unknownMarkup();
  }

  private onChange(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const tierId = target.dataset["tierId"];
    const field = target.dataset["field"];
    if (tierId && field) {
      const rule = this.catalog.tiers.find((item) => item.id === tierId);
      if (!rule) return;
      if (field === "action") {
        rule.action = target.value as GiftTierRule["action"];
        rule.cooldownSeconds = getAction(rule.action).defaultCooldownSeconds;
      } else if (field === "strength") {
        rule.strength = Number(target.value) || 1;
      } else if (field === "cooldown") {
        rule.cooldownSeconds = Math.max(0, Number(target.value) || 0);
      } else if (field === "enabled") {
        rule.enabled = (target as HTMLInputElement).checked;
      }
      this.handlers.onChange(this.catalog);
      if (field === "action") this.render();
      return;
    }

    const giftId = target.dataset["giftId"];
    if (!giftId || !field) return;
    const entry = this.catalog.entries.find((item) => item.giftId === giftId);
    if (!entry) return;

    if (field === "action") {
      entry.action = target.value as GiftMappingEntry["action"];
      entry.cooldownSeconds = getAction(entry.action).defaultCooldownSeconds;
    } else if (field === "strength") {
      entry.strength = Number(target.value) || 1;
    } else if (field === "cooldown") {
      entry.cooldownSeconds = Math.max(0, Number(target.value) || 0);
    } else if (field === "enabled") {
      entry.enabled = (target as HTMLInputElement).checked;
    }
    this.handlers.onChange(this.catalog);
    if (field === "action") this.render();
  }

  private onClick(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-adopt]",
    );
    if (!button) return;
    const giftId = button.dataset["adopt"];
    const giftName = button.dataset["giftName"] ?? giftId ?? "Unbekannt";
    if (!giftId) return;
    if (this.catalog.entries.some((item) => item.giftId === giftId)) return;
    this.catalog.entries.push({
      giftId,
      matchNames: [giftName.toLowerCase()],
      displayName: giftName,
      coinValue: 0,
      action: "team_energy",
      strength: 4,
      cooldownSeconds: 0,
      enabled: true,
    });
    this.handlers.onChange(this.catalog);
    this.render();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="section-title"><span>Münzstufen</span><small>Gelten für jedes Geschenk</small></div>
      <p class="hint">
        Entscheidend ist der Münzwert, den TikTok mitliefert — nicht der Name.
        So wirkt auch ein Geschenk, das diese App noch nie gesehen hat.
      </p>
      <div class="mapping-rows">${this.catalog.tiers.map((rule) => this.tierMarkup(rule)).join("")}</div>

      <div class="section-title"><span>Ausnahmen</span><small>Einzelne Geschenke, gehen vor</small></div>
      <div class="mapping-rows">${this.catalog.entries.map((entry) => this.rowMarkup(entry)).join("")}</div>
      <div class="section-title"><span>Unbekannte Geschenke</span><small>Nur protokolliert</small></div>
      <div class="unknown-list" data-unknown>${this.unknownMarkup()}</div>
    `;
  }

  private tierMarkup(rule: GiftTierRule): string {
    const options = SELECTABLE_ACTIONS.map((id) => {
      const definition = getAction(id);
      const selected = id === rule.action ? " selected" : "";
      return `<option value="${id}"${selected}>${definition.icon} ${escapeHtml(definition.label)}</option>`;
    }).join("");
    const range =
      rule.maxCoins === Infinity
        ? `ab ${rule.minCoins}`
        : `${rule.minCoins}–${rule.maxCoins}`;
    return `
      <div class="mapping-row">
        <label class="mapping-toggle" title="Aktiviert">
          <input type="checkbox" data-tier-id="${escapeHtml(rule.id)}" data-field="enabled" ${rule.enabled ? "checked" : ""} />
        </label>
        <div class="mapping-name">
          <strong>${escapeHtml(rule.label)}</strong>
          <small>${escapeHtml(range)} Coins</small>
        </div>
        <select data-tier-id="${escapeHtml(rule.id)}" data-field="action">${options}</select>
        <label class="mapping-number">Stärke
          <input type="number" min="0" step="1" value="${rule.strength}" data-tier-id="${escapeHtml(rule.id)}" data-field="strength" />
        </label>
        <label class="mapping-number">Abklingzeit
          <input type="number" min="0" step="1" value="${rule.cooldownSeconds}" data-tier-id="${escapeHtml(rule.id)}" data-field="cooldown" />
        </label>
      </div>
    `;
  }

  private rowMarkup(entry: GiftMappingEntry): string {
    const options = SELECTABLE_ACTIONS.map((id) => {
      const definition = getAction(id);
      const selected = id === entry.action ? " selected" : "";
      return `<option value="${id}"${selected}>${definition.icon} ${escapeHtml(definition.label)}</option>`;
    }).join("");

    return `
      <div class="mapping-row">
        <label class="mapping-toggle" title="Aktiviert">
          <input type="checkbox" data-gift-id="${escapeHtml(entry.giftId)}" data-field="enabled" ${entry.enabled ? "checked" : ""} />
        </label>
        <div class="mapping-name">
          <strong>${escapeHtml(entry.displayName)}</strong>
          <small>${entry.coinValue} Coins · ${escapeHtml(entry.giftId)}</small>
        </div>
        <select data-gift-id="${escapeHtml(entry.giftId)}" data-field="action">${options}</select>
        <label class="mapping-number">Stärke
          <input type="number" min="0" step="1" value="${entry.strength}" data-gift-id="${escapeHtml(entry.giftId)}" data-field="strength" />
        </label>
        <label class="mapping-number">Abklingzeit
          <input type="number" min="0" step="1" value="${entry.cooldownSeconds}" data-gift-id="${escapeHtml(entry.giftId)}" data-field="cooldown" />
        </label>
      </div>
    `;
  }

  private unknownMarkup(): string {
    const unknown = this.handlers.getUnknownGifts();
    if (unknown.length === 0) {
      return `<p class="hint">Noch keine unbekannten Geschenke empfangen.</p>`;
    }
    return unknown
      .map(
        (item) => `
          <div class="unknown-row">
            <span>${escapeHtml(item.giftName)} <small>${escapeHtml(item.giftId)} · ${item.count}×</small></span>
            <button data-adopt="${escapeHtml(item.giftId)}" data-gift-name="${escapeHtml(item.giftName)}">Übernehmen</button>
          </div>`,
      )
      .join("");
  }
}
