/** Connect screen (choose backend) and Sign in / Sign up / Reset password screen. */
import { normalizeSupabaseUrl, saveConfig } from '../backend/index.js';
import { PRESET_AVATARS } from '../data/avatars.js';
import { icon } from '../core/icons.js';
import { withBusy } from '../core/ui.js';
import { esc, $, $$ } from '../core/utils.js';
import { Lobby3D } from '../three/lobby3d.js';

function mountBackdrop(root) {
  const stage = $('.auth__stage', root);
  const lobby = new Lobby3D(stage, { interactive: false, autoRotateSpeed: 0.12, cameraDistance: 13.5, members: [] });
  lobby.start();
  return () => lobby.destroy();
}

function showFormError(form, message) {
  const errorEl = $('.form__error', form);
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

// ------------------------------------------------------------------ connect

async function verifySupabase(url, key) {
  const headers = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  let response;
  try {
    response = await fetch(`${url}/auth/v1/settings`, { headers });
  } catch {
    throw new Error("Couldn't reach that project URL. Check it and your internet connection.");
  }
  if (response.status === 401 || response.status === 403) throw new Error('The project rejected that key. Copy the anon / publishable key again.');
  if (!response.ok) throw new Error(`The project answered with an error (${response.status}). Is the URL right?`);
  try {
    const rpc = await fetch(`${url}/rest/v1/rpc/get_app_settings`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (rpc.status === 404) throw new Error('Connected, but the database is not set up yet. Run supabase/schema.sql in the SQL editor first.');
  } catch (err) {
    if (err.message.startsWith('Connected')) throw err;
  }
}

export function mountConnect(root, { onConnected }) {
  root.innerHTML = `
    <div class="auth">
      <div class="auth__stage" aria-hidden="true"></div>
      <div class="auth__panel">
        <div class="auth__brand">
          <img src="icons/icon.svg" alt="" width="64" height="64">
          <h1>Family Portal</h1>
          <p>Calendar, chat, kudos, a shop and an arcade for your whole family.</p>
        </div>
        <section class="card auth__card">
          <h2 class="auth__heading">Connect your family</h2>
          <p class="muted">Paste your Supabase project details once on this device.</p>
          <form class="form" data-connect novalidate>
            <label class="field">
              <span class="field__label">Project URL</span>
              <input class="input" name="url" type="url" inputmode="url" placeholder="https://abcdefgh.supabase.co" autocomplete="off" autocapitalize="off" spellcheck="false" required>
            </label>
            <label class="field">
              <span class="field__label">Anon / publishable key</span>
              <input class="input" name="key" type="text" placeholder="eyJhbGciOi… or sb_publishable_…" autocomplete="off" autocapitalize="off" spellcheck="false" required>
            </label>
            <p class="form__error" role="alert" hidden></p>
            <button type="submit" class="btn btn--primary btn--block">${icon('link')} Connect</button>
          </form>
          <details class="help">
            <summary>Where do I find these?</summary>
            <ol>
              <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a>.</li>
              <li>Open <b>SQL Editor</b>, paste <code>supabase/schema.sql</code> and press <b>Run</b>.</li>
              <li>Open <b>Project Settings → API</b> (or <b>API Keys</b>) and copy the <b>Project URL</b> and the <b>anon / publishable</b> key.</li>
              <li>Tip: once connected, <b>Profile → Invite family</b> gives you a link that sets up other devices automatically.</li>
            </ol>
          </details>
          <div class="divider"><span>or</span></div>
          <button type="button" class="btn btn--soft btn--block" data-demo>${icon('sparkles')} Try demo mode on this device</button>
          <p class="fine-print">Demo mode keeps everything in this browser. Open a second tab and sign in as another family member to play together.</p>
        </section>
      </div>
    </div>`;

  const cleanupBackdrop = mountBackdrop(root);
  const form = $('[data-connect]', root);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showFormError(form, '');
    const data = Object.fromEntries(new FormData(form));
    let url;
    try {
      url = normalizeSupabaseUrl(data.url);
    } catch (err) {
      showFormError(form, err.message.includes('https') ? err.message : 'Enter the full project URL, e.g. https://abcdefgh.supabase.co');
      return;
    }
    const key = String(data.key || '').trim();
    if (key.length < 20) {
      showFormError(form, 'Paste the full anon / publishable key.');
      return;
    }
    withBusy($('[type=submit]', form), async () => {
      try {
        await verifySupabase(url, key);
        const config = { kind: 'supabase', url, key };
        saveConfig(config);
        onConnected(config);
      } catch (err) {
        showFormError(form, err.message);
      }
    });
  });

  $('[data-demo]', root).addEventListener('click', () => {
    const config = { kind: 'local' };
    saveConfig(config);
    onConnected(config);
  });

  return cleanupBackdrop;
}

// ------------------------------------------------------------------ sign in / sign up

export function mountAuth(root, { backend, canChangeConnection, onSignedIn, onChangeConnection }) {
  const quickAvatars = PRESET_AVATARS.slice(0, 8);
  root.innerHTML = `
    <div class="auth">
      <div class="auth__stage" aria-hidden="true"></div>
      <div class="auth__panel">
        <div class="auth__brand">
          <img src="icons/icon.svg" alt="" width="64" height="64">
          <h1>Family Portal</h1>
          <p>Your family's cosy corner of the internet.</p>
        </div>
        <section class="card auth__card">
          <div class="segmented" role="tablist" aria-label="Account">
            <button type="button" role="tab" class="segmented__btn is-active" aria-selected="true" data-tab="signin">Sign in</button>
            <button type="button" role="tab" class="segmented__btn" aria-selected="false" data-tab="signup">Create account</button>
          </div>

          <form class="form" data-form="signin" novalidate>
            <label class="field">
              <span class="field__label">Email</span>
              <input class="input" name="email" type="email" autocomplete="email" inputmode="email" required>
            </label>
            <label class="field">
              <span class="field__label">Password</span>
              <input class="input" name="password" type="password" autocomplete="current-password" required>
            </label>
            <p class="form__error" role="alert" hidden></p>
            <button type="submit" class="btn btn--primary btn--block">Sign in</button>
            <button type="button" class="link-btn" data-show="reset">Forgot your password?</button>
          </form>

          <form class="form" data-form="signup" novalidate hidden>
            <label class="field">
              <span class="field__label">Display name</span>
              <input class="input" name="username" type="text" maxlength="24" autocomplete="nickname" placeholder="e.g. Mum, Leo, Grandpa Joe" required>
            </label>
            <fieldset class="field">
              <legend class="field__label">Pick an avatar</legend>
              <div class="avatar-picker avatar-picker--compact">
                ${quickAvatars.map((a, i) => `
                  <label class="avatar-option" title="${esc(a.key)}">
                    <input type="radio" name="avatar" value="preset:${esc(a.key)}" ${i === 0 ? 'checked' : ''}>
                    <span class="avatar avatar--md" style="--avatar-bg:${esc(a.bg)}"><span class="avatar__emoji">${a.emoji}</span></span>
                  </label>`).join('')}
              </div>
            </fieldset>
            <label class="field">
              <span class="field__label">Email</span>
              <input class="input" name="email" type="email" autocomplete="email" inputmode="email" required>
            </label>
            <label class="field">
              <span class="field__label">Password <span class="muted">(6+ characters)</span></span>
              <input class="input" name="password" type="password" minlength="6" autocomplete="new-password" required>
            </label>
            <label class="field" data-family-code hidden>
              <span class="field__label">Family code</span>
              <input class="input" name="familyCode" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">
              <span class="field__hint">Ask whoever set up the portal for your family's code.</span>
            </label>
            <p class="form__error" role="alert" hidden></p>
            <button type="submit" class="btn btn--primary btn--block">Create account</button>
          </form>

          <form class="form" data-form="reset" novalidate hidden>
            <p class="muted">We'll email you a link to choose a new password.</p>
            <label class="field">
              <span class="field__label">Email</span>
              <input class="input" name="email" type="email" autocomplete="email" inputmode="email" required>
            </label>
            <p class="form__error" role="alert" hidden></p>
            <button type="submit" class="btn btn--primary btn--block">Send reset link</button>
            <button type="button" class="link-btn" data-show="signin">Back to sign in</button>
          </form>

          <div class="notice" data-notice hidden></div>

          <footer class="auth__footer">
            <span class="auth__backend">${icon('link')} ${esc(backend.label)}</span>
            ${canChangeConnection ? '<button type="button" class="link-btn" data-change-connection>Change</button>' : ''}
          </footer>
        </section>
      </div>
    </div>`;

  const cleanupBackdrop = mountBackdrop(root);
  const tabs = $$('[data-tab]', root);
  const forms = Object.fromEntries($$('[data-form]', root).map((f) => [f.dataset.form, f]));
  const notice = $('[data-notice]', root);

  const show = (name) => {
    Object.entries(forms).forEach(([key, form]) => {
      form.hidden = key !== name;
      showFormError(form, '');
    });
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    $('.segmented', root).hidden = name === 'reset';
    notice.hidden = true;
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => show(tab.dataset.tab)));
  $$('[data-show]', root).forEach((btn) => btn.addEventListener('click', () => show(btn.dataset.show)));
  $('[data-change-connection]', root)?.addEventListener('click', onChangeConnection);

  backend.getSettings().then((settings) => {
    if (settings?.join_code_required) {
      const field = $('[data-family-code]', root);
      if (field) field.hidden = false;
    }
  }).catch(() => {});

  const showNotice = (html) => {
    notice.innerHTML = html;
    notice.hidden = false;
  };

  forms.signin.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = forms.signin;
    const { email, password } = Object.fromEntries(new FormData(form));
    if (!email || !password) {
      showFormError(form, 'Enter your email and password.');
      return;
    }
    withBusy($('[type=submit]', form), async () => {
      try {
        const session = await backend.signIn({ email, password });
        if (session) await onSignedIn(session);
      } catch (err) {
        showFormError(form, err.message);
      }
    });
  });

  forms.signup.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = forms.signup;
    const data = Object.fromEntries(new FormData(form));
    const username = String(data.username || '').trim();
    if (username.length < 2 || username.length > 24) {
      showFormError(form, 'Display names need 2–24 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email || '').trim())) {
      showFormError(form, 'Enter a valid email address.');
      return;
    }
    if (String(data.password || '').length < 6) {
      showFormError(form, 'Passwords need at least 6 characters.');
      return;
    }
    withBusy($('[type=submit]', form), async () => {
      try {
        const result = await backend.signUp({
          email: data.email,
          password: data.password,
          username,
          familyCode: data.familyCode,
          avatarUrl: String(data.avatar || 'preset:fox'),
        });
        if (result.session) {
          await onSignedIn(result.session);
        } else {
          show('signin');
          showNotice(`${icon('check')}<div><strong>Check your inbox!</strong><br>We sent a confirmation link to <b>${esc(data.email)}</b>. Open it on this device, then sign in.</div>`);
          $('[name=email]', forms.signin).value = data.email;
        }
      } catch (err) {
        showFormError(form, err.message);
      }
    });
  });

  forms.reset.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = forms.reset;
    const { email } = Object.fromEntries(new FormData(form));
    if (!email) {
      showFormError(form, 'Enter your email address.');
      return;
    }
    withBusy($('[type=submit]', form), async () => {
      try {
        await backend.resetPassword(email);
        show('signin');
        showNotice(`${icon('check')}<div><strong>Reset link sent.</strong><br>Open the email on this device to choose a new password.</div>`);
      } catch (err) {
        showFormError(form, err.message);
      }
    });
  });

  return cleanupBackdrop;
}
