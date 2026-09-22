/** News & updates bulletin board. */
import { onMany } from '../core/bus.js';
import { icon } from '../core/icons.js';
import { store, profileOf } from '../core/store.js';
import {
  avatarHTML, nameHTML, toast, showError, withBusy, emptyState, confirmDialog,
} from '../core/ui.js';
import { esc, $, $$, richText, timeAgo, delegate } from '../core/utils.js';

function sortPosts(posts) {
  return posts.sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.created_at.localeCompare(a.created_at));
}

export function mountNews(container) {
  let posts = [];

  container.innerHTML = `
    <header class="card__header">
      <h2 class="card__title">${icon('megaphone')} News &amp; updates</h2>
      <button type="button" class="btn btn--soft btn--sm" data-compose>${icon('plus')}<span>Post</span></button>
    </header>
    <form class="form news-form" data-news-form hidden novalidate>
      <label class="field">
        <span class="field__label">Headline</span>
        <input class="input" name="title" maxlength="120" placeholder="e.g. Holiday plans are booked! 🏖️">
      </label>
      <label class="field">
        <span class="field__label">Details</span>
        <textarea class="input" name="body" rows="3" maxlength="4000" placeholder="Share the news with everyone…"></textarea>
      </label>
      <label class="check">
        <input type="checkbox" name="pinned">
        <span>Pin to the top</span>
      </label>
      <p class="form__error" role="alert" hidden></p>
      <div class="form__actions">
        <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
        <button type="submit" class="btn btn--primary">${icon('send')} Publish</button>
      </div>
    </form>
    <div class="news-list" data-news></div>`;

  const form = $('[data-news-form]', container);
  const list = $('[data-news]', container);
  const errorEl = $('.form__error', form);

  function postHTML(post) {
    const author = profileOf(post.author_id);
    const mine = post.author_id === store.userId;
    return `
      <article class="news-post ${post.pinned ? 'is-pinned' : ''}" data-id="${esc(post.id)}">
        <header class="news-post__header">
          ${avatarHTML(author, { size: 'sm' })}
          <div class="news-post__meta">
            ${nameHTML(author)}
            <time datetime="${esc(post.created_at)}">${esc(timeAgo(post.created_at))}</time>
          </div>
          ${post.pinned ? `<span class="news-post__pin" title="Pinned">${icon('pin')}</span>` : ''}
        </header>
        <h3 class="news-post__title">${esc(post.title)}</h3>
        ${post.body ? `<p class="news-post__body">${richText(post.body)}</p>` : ''}
        ${mine ? `
          <footer class="news-post__actions">
            <button type="button" class="btn btn--ghost btn--xs" data-pin="${esc(post.id)}">${icon('pin')} ${post.pinned ? 'Unpin' : 'Pin'}</button>
            <button type="button" class="btn btn--danger-ghost btn--xs" data-delete="${esc(post.id)}">${icon('trash')} Delete</button>
          </footer>` : ''}
      </article>`;
  }

  function render() {
    list.innerHTML = posts.length
      ? posts.map(postHTML).join('')
      : emptyState('📰', 'No news yet. Share a family update, a win, or a reminder.');
  }

  async function load() {
    try {
      posts = sortPosts(await store.backend.listNews(30));
      render();
    } catch (err) {
      list.innerHTML = emptyState('⚠️', 'Could not load the news board.');
      console.warn(err);
    }
  }

  const toggleComposer = (open) => {
    form.hidden = !open;
    errorEl.hidden = true;
    if (open) $('[name=title]', form).focus();
  };

  $('[data-compose]', container).addEventListener('click', () => toggleComposer(form.hidden));
  $('[data-cancel]', form).addEventListener('click', () => {
    form.reset();
    toggleComposer(false);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const title = String(data.title || '').trim();
    if (!title) {
      errorEl.textContent = 'Add a headline.';
      errorEl.hidden = false;
      return;
    }
    withBusy($('[type=submit]', form), async () => {
      try {
        const post = await store.backend.createNews({ title, body: String(data.body || ''), pinned: data.pinned === 'on' });
        if (!posts.some((p) => p.id === post.id)) posts = sortPosts([post, ...posts]);
        render();
        form.reset();
        toggleComposer(false);
        toast('Posted to the news board.', { type: 'success' });
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    });
  });

  const offPin = delegate(list, 'click', '[data-pin]', async (event, button) => {
    const post = posts.find((p) => p.id === button.dataset.pin);
    if (!post) return;
    await withBusy(button, async () => {
      try {
        const updated = await store.backend.updateNews(post.id, { pinned: !post.pinned });
        posts = sortPosts(posts.map((p) => (p.id === updated.id ? updated : p)));
        render();
      } catch (err) {
        showError(err);
      }
    });
  });

  const offDelete = delegate(list, 'click', '[data-delete]', async (event, button) => {
    const post = posts.find((p) => p.id === button.dataset.delete);
    if (!post) return;
    const ok = await confirmDialog({ title: 'Delete post?', message: `"${post.title}" will be removed for everyone.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await store.backend.deleteNews(post.id);
      posts = posts.filter((p) => p.id !== post.id);
      render();
    } catch (err) {
      showError(err);
    }
  });

  const offBus = onMany({
    'db:news_posts': (change) => {
      if (change.eventType === 'DELETE') posts = posts.filter((p) => p.id !== change.old?.id);
      else if (change.new) posts = sortPosts([change.new, ...posts.filter((p) => p.id !== change.new.id)]);
      render();
    },
    profiles: render,
    resync: load,
  });

  const clock = setInterval(() => {
    $$('.news-post__meta time', list).forEach((node) => {
      node.textContent = timeAgo(node.getAttribute('datetime'));
    });
  }, 60000);

  list.innerHTML = '<div class="skeleton-list"><span></span><span></span></div>';
  load();

  return () => {
    offBus();
    offPin();
    offDelete();
    clearInterval(clock);
  };
}
