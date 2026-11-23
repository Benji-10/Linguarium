/**
 * Fully custom authentication screen (login, signup, password recovery,
 * new-password after recovery email, OAuth). No Netlify Identity widget
 * is used anywhere - only the headless @netlify/identity library.
 */

import { icon, esc, toast, brandLogo } from '../ui/components.mjs';
import {
  doLogin,
  doSignup,
  doRequestRecovery,
  doRecoverPassword,
  identitySettings,
  startOAuth,
} from '../core/auth.mjs';
import { getState, setState } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { flushQueue, refreshQueueCount } from '../core/sync.mjs';

const OAUTH_LABELS = {
  google: 'Google',
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  facebook: 'Facebook',
};

export function renderAuth(container) {
  let mode = 'login'; // login | signup | forgot
  const state = getState();

  const draw = () => {
    const recoveryPending = state.recoveryPending;
    container.innerHTML = authShellHtml(recoveryPending ? 'reset' : mode);
    bind();
  };

  const bind = () => {
    const form = container.querySelector('#auth-form');
    if (form) form.addEventListener('submit', onSubmit);

    // Only the buttons carry the mode toggle (the form itself has a
    // data-mode attribute used for submit routing, not for switching).
    container.querySelectorAll('button[data-mode]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        mode = el.dataset.mode;
        draw();
      }),
    );

    // Optional OAuth: rendered only when providers are configured for the site.
    identitySettings().then((settings) => {
      const slot = container.querySelector('#oauth-slot');
      if (!slot) return;
      const providers = Object.entries(settings?.providers ?? {}).filter(([k, v]) => v);
      if (providers.length === 0) {
        slot.innerHTML = '';
        return;
      }
      slot.innerHTML =
        '<div class="oauth-row"><span>or continue with</span></div>' +
        providers
          .map(
            ([key]) =>
              `<button class="btn subtle oauth-btn" data-oauth="${esc(key)}">${icon('globe').toString()}${esc(OAUTH_LABELS[key] ?? key)}</button>`,
          )
          .join('');
      slot.querySelectorAll('[data-oauth]').forEach((el) =>
        el.addEventListener('click', () => startOAuth(el.dataset.oauth)),
      );
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const current = container.querySelector('#auth-form')?.dataset.mode ?? mode;
    const btn = container.querySelector('button[type="submit"]');
    const error = container.querySelector('.form-error');
    const message = container.querySelector('.form-message');
    error.textContent = '';
    message.textContent = '';
    btn.disabled = true;

    try {
      if (current === 'reset') {
        const p1 = formValue('new-password');
        const p2 = formValue('confirm-password');
        if (p1.length < 8) throw new Error('Choose a password of at least 8 characters.');
        if (p1 !== p2) throw new Error('The two passwords do not match.');
        await doRecoverPassword(p1);
        toast('New password set. Welcome back.', 'pos');
        setState({ recoveryPending: false });
        navigate('#/');
        await postLoginSync();
        return;
      }

      const email = formValue('email');
      const password = formValue('password');

      if (current === 'login') {
        await doLogin(email, password);
        toast('Signed in.', 'pos');
        navigate('#/');
        await postLoginSync();
      } else if (current === 'signup') {
        const name = formValue('display-name');
        const confirm = formValue('confirm-password');
        if (password !== confirm) throw new Error('The two passwords do not match.');
        if (password.length < 8) throw new Error('Choose a password of at least 8 characters.');
        const user = await doSignup(email, password, name);
        if (user) {
          toast('Account created. Welcome to Linguarium.', 'pos');
          navigate('#/');
          await postLoginSync();
        } else {
          message.innerHTML =
            'Account created. <strong>Check your inbox</strong> to confirm the email address, then sign in here.';
          mode = 'login';
        }
      } else if (current === 'forgot') {
        await doRequestRecovery(email);
        message.innerHTML = 'If that address has an account, a recovery email is on its way.';
      }
    } catch (err) {
      error.textContent = err.message ?? 'Something went wrong. Please try again.';
    } finally {
      btn.disabled = false;
    }
  };

  const formValue = (id) => container.querySelector(`#${id}`)?.value?.trim() ?? '';

  draw();
  return () => {};
}

async function postLoginSync() {
  await refreshQueueCount();
  if (getState().online && getState().queueCount > 0) {
    await flushQueue({ silent: true });
    await refreshQueueCount();
  }
}

function authShellHtml(mode) {
  return `
  <div class="auth-wrap">
    <div class="auth-card panel">
      <div class="auth-brand">
        <span class="brand-mark large">${brandLogo().toString()}</span>
        <h1>Linguarium</h1>
        <p class="muted">A calm home for every language you learn - including the ones nobody built an app for.</p>
      </div>
      ${mode === 'reset' ? resetFormHtml() : mode === 'signup' ? signupFormHtml() : mode === 'forgot' ? forgotFormHtml() : loginFormHtml()}
      ${oauthHtml()}
      <p class="auth-footnote muted">By continuing you agree that only the data needed to run your learning -
      profile, vocabulary, progress - is stored, and that you can export or delete it at any time
      (see Settings &gt; Your data).</p>
    </div>
    <div class="auth-side">
      <div class="auth-side-card">
        <h2>What this is</h2>
        <ul class="feature-list">
          <li>${icon('book').toString()} Read real texts, click any word, keep the words you meet.</li>
          <li>${icon('review').toString()} FSRS spaced repetition - separate recognition, recall and production.</li>
          <li>${icon('globe').toString()} Any language: presets, Toki Pona, or your own custom definition.</li>
          <li>${icon('flash').toString()} AI enrichment is optional: the app is fully usable without it.</li>
          <li>${icon('offline').toString()} Works offline as an installable app; nothing is lost when you reconnect.</li>
        </ul>
      </div>
    </div>
  </div>`;
}

function loginFormHtml() {
  return `
  <form id="auth-form" data-mode="login" class="auth-form">
    <h2>Sign in</h2>
    <p class="form-error" role="alert"></p>
    <p class="form-message" role="status"></p>
    <label>Email <input id="email" type="email" required autocomplete="email" placeholder="you@example.com"></label>
    <label>Password <input id="password" type="password" required autocomplete="current-password"></label>
    <button type="submit" class="btn primary wide">Sign in</button>
    <div class="auth-alt">
      <button class="link" data-mode="forgot">Forgot the password?</button>
      <span class="dot"></span>
      <button class="link" data-mode="signup">Create an account</button>
    </div>
  </form>`;
}

function signupFormHtml() {
  return `
  <form id="auth-form" data-mode="signup" class="auth-form">
    <h2>Create an account</h2>
    <p class="form-error" role="alert"></p>
    <p class="form-message" role="status"></p>
    <label>Display name (optional) <input id="display-name" type="text" autocomplete="name" placeholder="How should we greet you?"></label>
    <label>Email <input id="email" type="email" required autocomplete="email" placeholder="you@example.com"></label>
    <label>Password <input id="password" type="password" required minlength="8" autocomplete="new-password"></label>
    <label>Confirm password <input id="confirm-password" type="password" required minlength="8" autocomplete="new-password"></label>
    <button type="submit" class="btn primary wide">Create account</button>
    <div class="auth-alt">
      <span>Already have an account?</span>
      <button class="link" data-mode="login">Sign in</button>
    </div>
  </form>`;
}

function forgotFormHtml() {
  return `
  <form id="auth-form" data-mode="forgot" class="auth-form">
    <h2>Recover the password</h2>
    <p class="muted">We will send a recovery link to your email address.</p>
    <p class="form-error" role="alert"></p>
    <p class="form-message" role="status"></p>
    <label>Email <input id="email" type="email" required autocomplete="email" placeholder="you@example.com"></label>
    <button type="submit" class="btn primary wide">Send recovery email</button>
    <div class="auth-alt">
      <button class="link" data-mode="login">Back to sign in</button>
    </div>
  </form>`;
}

function resetFormHtml() {
  return `
  <form id="auth-form" data-mode="reset" class="auth-form">
    <h2>Set a new password</h2>
    <p class="muted">You followed a recovery link. Choose a new password for your account.</p>
    <p class="form-error" role="alert"></p>
    <p class="form-message" role="status"></p>
    <label>New password <input id="new-password" type="password" required minlength="8" autocomplete="new-password"></label>
    <label>Confirm password <input id="confirm-password" type="password" required minlength="8" autocomplete="new-password"></label>
    <button type="submit" class="btn primary wide">Save new password</button>
  </form>`;
}

function oauthHtml() {
  return `<div id="oauth-slot" class="oauth-slot"></div>`;
}
