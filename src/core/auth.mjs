/**
 * Authentication UI controller.
 *
 * Uses the headless @netlify/identity package (never the default widget):
 * every screen - login, signup, email confirmation, password recovery,
 * OAuth - is custom UI in views/auth.mjs. This module only translates the
 * library's errors into friendly messages and exposes clean actions.
 */

import {
  login as identityLogin,
  signup as identitySignup,
  logout as identityLogout,
  getUser,
  onAuthChange,
  handleAuthCallback,
  getSettings,
  requestPasswordRecovery,
  recoverPassword,
  updateUser,
  oauthLogin,
  refreshSession,
} from '@netlify/identity';

import { setState } from './store.mjs';

let unsubscribed = null;

function friendly(err, fallback) {
  const msg = err?.message ?? '';
  const status = err?.status;
  if (status === 400 || status === 401) {
    if (/email|password|credential|invalid/i.test(msg)) {
      return 'That email and password combination does not match an account.';
    }
    return msg || fallback;
  }
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status === 422) return msg || 'The input was not accepted. Please check the form.';
  return msg || fallback;
}

/** Process confirmation/recovery/OAuth tokens in the URL, then restore session. */
export async function bootAuth() {
  let callback = null;
  try {
    callback = await handleAuthCallback();
  } catch (err) {
    console.warn('[auth] callback handling failed', err);
  }
  let user = null;
  try {
    user = await getUser();
  } catch (err) {
    console.warn('[auth] session restore failed', err);
  }
  setState({ user, recoveryPending: callback?.type === 'recovery' ? true : false });

  if (!unsubscribed) {
    unsubscribed = onAuthChange((event, user) => {
      setState({ user: user ?? null, authEvent: event });
    });
  }
  return { user, callback };
}

export async function currentUser() {
  try {
    return await getUser();
  } catch {
    return null;
  }
}

export async function identitySettings() {
  try {
    return await getSettings();
  } catch {
    return { autoconfirm: true, disableSignup: false, providers: {} };
  }
}

export async function doLogin(email, password) {
  try {
    const user = await identityLogin(email.trim(), password);
    setState({ user });
    return user;
  } catch (err) {
    throw new Error(friendly(err, 'Sign-in failed. Please try again.'));
  }
}

export async function doSignup(email, password, displayName) {
  try {
    const user = await identitySignup(email.trim(), password, displayName ? { full_name: displayName } : undefined);
    setState({ user: user ?? null });
    return user;
  } catch (err) {
    throw new Error(friendly(err, 'Sign-up failed. Please try again.'));
  }
}

export async function doLogout() {
  try {
    await identityLogout();
  } catch (err) {
    console.warn('[auth] logout failed', err);
  }
  setState({ user: null, profiles: [], entries: [], texts: [], collections: [] });
}

export async function doRequestRecovery(email) {
  try {
    await requestPasswordRecovery(email.trim());
    return true;
  } catch (err) {
    throw new Error(friendly(err, 'Could not send the recovery email. Please try again.'));
  }
}

/** Redeem a recovery token (arrives as a hash after clicking the email link). */
export async function doRecoverPassword(newPassword) {
  try {
    const user = await recoverPassword(undefined, newPassword);
    setState({ user: user ?? null, recoveryPending: false });
    return user;
  } catch (err) {
    throw new Error(friendly(err, 'Could not set the new password. Please try again.'));
  }
}

export async function doUpdateDisplayName(name) {
  try {
    const user = await updateUser({ data: { full_name: name } });
    setState({ user });
    return user;
  } catch (err) {
    throw new Error(friendly(err, 'Could not update your profile.'));
  }
}

export async function doPasswordChange(newPassword) {
  try {
    await updateUser({ password: newPassword });
    return true;
  } catch (err) {
    throw new Error(friendly(err, 'Could not change the password.'));
  }
}

export function startOAuth(provider) {
  return oauthLogin(provider); // navigates away
}

export async function refreshNow() {
  try {
    await refreshSession();
    const user = await getUser();
    setState({ user });
    return user;
  } catch {
    return null;
  }
}
