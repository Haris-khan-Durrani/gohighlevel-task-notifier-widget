/*
 * ONESOL - GoHighLevel Task Notifier Widget v4.3.0
 *
 * Client-side task notification widget for GoHighLevel CRM.
 * IMPORTANT: Never commit a real Private Integration Token to this repository.
 * Configure your token only in your deployment environment/server-side proxy.
 */

'use strict';

(function () {
  const CONFIG = {
    LOCATION_ID: '',
    PRIVATE_TOKEN: '',
    API_BASE: 'https://services.leadconnectorhq.com',
    BELL_RIGHT: 24,
    BELL_BOTTOM: 24,
    POLL_MS: 60000
  };

  const script = document.currentScript;
  const userId = script?.dataset?.userid || '';
  const username = script?.dataset?.username || 'there';

  if (!userId) {
    console.warn('[ONESOL Task Center] Missing data-userid.');
    return;
  }

  // The complete production implementation should be served from your protected
  // deployment. This public repository intentionally does not contain secrets.
  // See README.md for the recommended architecture and installation notes.

  const style = document.createElement('style');
  style.textContent = `
    #onesol-task-notifier {
      position: fixed;
      right: ${CONFIG.BELL_RIGHT}px;
      bottom: ${CONFIG.BELL_BOTTOM}px;
      z-index: 2147483000;
      font-family: Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    }
    #onesol-task-notifier .bell {
      width: 60px;
      height: 60px;
      border: 0;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 12px 35px rgba(15,23,42,.18);
      display: grid;
      place-items: center;
      cursor: pointer;
      position: relative;
    }
    #onesol-task-notifier .bell:hover { transform: translateY(-1px); }
    #onesol-task-notifier .badge {
      position: absolute;
      right: -3px;
      top: -5px;
      min-width: 25px;
      height: 25px;
      padding: 0 7px;
      border-radius: 999px;
      background: #ef4444;
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      display: grid;
      place-items: center;
      border: 3px solid #fff;
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'onesol-task-notifier';
  root.innerHTML = `
    <button class="bell" type="button" aria-label="Open tasks">
      <span aria-hidden="true" style="font-size:28px">♧</span>
      <span class="badge">0</span>
    </button>
  `;
  document.body.appendChild(root);

  const bell = root.querySelector('.bell');
  bell.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('onesol:task-notifier-click', {
      detail: { userId, username }
    }));
  });

  console.info('[ONESOL Task Center] Widget loaded for user:', userId);
})();
