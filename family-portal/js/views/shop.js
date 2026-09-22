/** Kudos shop: buy badges, chat titles, objects and 3D decorations. */
import { STORAGE_KEYS } from '../config.js';
import { ITEM_TYPES } from '../data/catalog.js';
import { onMany } from '../core/bus.js';
import { icon } from '../core/icons.js';
import {
  store, me, sortedItems, ownsItem, ownedItems, upsertInventory, upsertProfile,
} from '../core/store.js';
import {
  toast, showError, withBusy, confirmDialog, celebrate, kudosPill, emptyState,
} from '../core/ui.js';
import { esc, $, $$, formatNumber, delegate } from '../core/utils.js';

const TYPE_LABELS = { badge: 'Badge', title: 'Chat title', object: 'Object', decoration: '3D décor' };

export function itemArtHTML(item) {
  if (item.image_url && /^https?:\/\//i.test(item.image_url)) {
    return `<img src="${esc(item.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }
  return `<span class="item-art__emoji" aria-hidden="true">${esc(item.icon || '🎁')}</span>`;
}

function isEquipped(item, profile) {
  return (item.type === 'badge' && profile?.equipped_badge === item.id)
    || (item.type === 'title' && profile?.equipped_title === item.id);
}

export async function equip(item, equipIt) {
  const updated = await store.backend.equipItem(item.type, equipIt ? item.id : null);
  if (updated) upsertProfile(updated);
  return updated;
}

export function mount(root) {
  let tab = localStorage.getItem(STORAGE_KEYS.shopTab) || 'all';
  if (!ITEM_TYPES.some((t) => t.key === tab)) tab = 'all';

  root.innerHTML = `
    <div class="shop">
      <section class="card shop__banner">
        <div class="shop__intro">
          <h2>Spend your kudos</h2>
          <p>Earn kudos from shout-outs and arcade wins, then treat yourself.</p>
        </div>
        <div class="shop__balance">
          <span class="shop__balance-value" data-balance></span>
          <span class="shop__balance-label">your balance</span>
        </div>
      </section>
      <div class="tabs" role="tablist" aria-label="Item types">
        ${ITEM_TYPES.map((t) => `<button type="button" role="tab" class="tab" data-tab="${t.key}">${esc(t.label)}</button>`).join('')}
      </div>
      <div class="shop__grid" data-grid></div>
      <section class="card shop__collection">
        <header class="card__header"><h2 class="card__title">${icon('gift')} Your collection</h2></header>
        <div data-collection></div>
      </section>
    </div>`;

  const grid = $('[data-grid]', root);
  const collection = $('[data-collection]', root);

  function cardHTML(item, profile) {
    const owned = ownsItem(item.id);
    const affordable = (profile?.kudos_balance ?? 0) >= item.cost;
    const equipped = isEquipped(item, profile);
    let action;
    if (owned && (item.type === 'badge' || item.type === 'title')) {
      action = `<button type="button" class="btn btn--sm ${equipped ? 'btn--ghost' : 'btn--soft'}" data-equip="${esc(item.id)}">${equipped ? 'Unequip' : 'Equip'}</button>`;
    } else if (owned) {
      action = `<span class="owned-tag">${icon('check')} ${item.type === 'decoration' ? 'On your island' : 'Owned'}</span>`;
    } else {
      action = `<button type="button" class="btn btn--sm btn--primary" data-buy="${esc(item.id)}" ${affordable ? '' : 'disabled'}>Buy</button>`;
    }
    return `
      <article class="item-card item-card--${esc(item.type)} ${owned ? 'is-owned' : ''} ${equipped ? 'is-equipped' : ''}">
        <div class="item-card__art item-art">${itemArtHTML(item)}</div>
        <div class="item-card__body">
          <span class="item-card__type">${esc(TYPE_LABELS[item.type] || item.type)}${equipped ? ' · equipped' : ''}</span>
          <h3 class="item-card__name">${esc(item.name.replace(/^Title:\s*/, ''))}</h3>
          <p class="item-card__desc">${esc(item.description)}</p>
        </div>
        <footer class="item-card__footer">
          ${kudosPill(formatNumber(item.cost))}
          ${action}
        </footer>
        ${!owned && !affordable ? `<p class="item-card__need">Need ${formatNumber(item.cost - (profile?.kudos_balance ?? 0))} more</p>` : ''}
      </article>`;
  }

  function render() {
    const profile = me();
    $('[data-balance]', root).innerHTML = `⭐ ${formatNumber(profile?.kudos_balance ?? 0)}`;
    $$('[data-tab]', root).forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    const items = sortedItems().filter((item) => tab === 'all' || item.type === tab);
    grid.innerHTML = items.length ? items.map((item) => cardHTML(item, profile)).join('') : emptyState('🛍️', 'Nothing here yet.');

    const mine = ownedItems();
    collection.innerHTML = mine.length
      ? `<div class="collection">${mine.map((item) => `
          <div class="collection__item ${isEquipped(item, profile) ? 'is-equipped' : ''}" title="${esc(item.name)}">
            <span class="item-art item-art--sm">${itemArtHTML(item)}</span>
            <span class="collection__name">${esc(item.name.replace(/^Title:\s*/, ''))}</span>
          </div>`).join('')}</div>`
      : emptyState('🎁', 'You have not bought anything yet. Your first treat is waiting!');
  }

  async function buy(item, button) {
    const profile = me();
    const left = profile.kudos_balance - item.cost;
    const ok = await confirmDialog({
      title: `Buy ${item.name.replace(/^Title:\s*/, '')}?`,
      message: `This costs ${item.cost} kudos. You'll have ${left} left.`,
      confirmText: `Buy for ${item.cost}`,
    });
    if (!ok) return;
    await withBusy(button, async () => {
      try {
        const row = await store.backend.purchaseItem(item.id);
        upsertInventory(row);
        const fresh = me();
        if (fresh && fresh.kudos_balance === profile.kudos_balance) {
          upsertProfile({ id: fresh.id, kudos_balance: fresh.kudos_balance - item.cost });
        }
        celebrate(button, item.icon || '🎉', 14);
        if (item.type === 'decoration') {
          toast(`${item.name} now appears on your 3D island.`, { type: 'success', title: 'Purchased!', action: { label: 'See it', onClick: () => { location.hash = '#/hub'; } } });
        } else if (item.type === 'badge' || item.type === 'title') {
          toast(`You bought ${item.name.replace(/^Title:\s*/, '')}.`, {
            type: 'success',
            title: 'Purchased!',
            action: { label: 'Equip now', onClick: () => equip(item, true).then(() => toast('Equipped!', { type: 'success' })).catch(showError) },
          });
        } else {
          toast(`${item.name} is now in your collection.`, { type: 'success', title: 'Purchased!' });
        }
        render();
      } catch (err) {
        showError(err);
      }
    });
  }

  root.addEventListener('click', (event) => {
    const tabBtn = event.target.closest('[data-tab]');
    if (tabBtn) {
      tab = tabBtn.dataset.tab;
      localStorage.setItem(STORAGE_KEYS.shopTab, tab);
      render();
    }
  });

  const offBuy = delegate(grid, 'click', '[data-buy]', (event, button) => {
    const item = store.items.get(button.dataset.buy);
    if (item) buy(item, button);
  });

  const offEquip = delegate(grid, 'click', '[data-equip]', (event, button) => {
    const item = store.items.get(button.dataset.equip);
    if (!item) return;
    const equipping = !isEquipped(item, me());
    withBusy(button, async () => {
      try {
        await equip(item, equipping);
        toast(equipping ? `${item.name.replace(/^Title:\s*/, '')} equipped.` : 'Unequipped.', { type: 'success' });
      } catch (err) {
        showError(err);
      }
    });
  });

  const offBus = onMany({ me: render, items: render, inventory: render, resync: render });
  render();

  return () => {
    offBus();
    offBuy();
    offEquip();
  };
}
