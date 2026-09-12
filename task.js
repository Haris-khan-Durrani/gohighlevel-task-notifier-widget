/*
 * ONESOL - GoHighLevel Task Notifier Widget
 *
 * Public distribution loader.
 *
 * The production implementation is intentionally served from the project's
 * controlled deployment rather than storing a GoHighLevel Private Integration
 * Token in this public repository.
 *
 * Usage:
 * <script
 *   src="https://tasks.onesol.ae/task.js?v=4.3.0"
 *   data-userid="YOUR_GHL_USER_ID"
 *   data-username="YOUR_NAME">
 * </script>
 */
(function () {
  'use strict';

  if (window.__ONESOL_TASK_CENTER_LOADER__) return;
  window.__ONESOL_TASK_CENTER_LOADER__ = true;

  var current = document.currentScript;
  var source = 'https://tasks.onesol.ae/task.js?v=4.3.0';

  var loader = document.createElement('script');
  loader.src = source;
  loader.async = true;

  if (current) {
    var userId = current.getAttribute('data-userid');
    var userName = current.getAttribute('data-username');
    var locationId = current.getAttribute('data-locationid');

    if (userId) loader.setAttribute('data-userid', userId);
    if (userName) loader.setAttribute('data-username', userName);
    if (locationId) loader.setAttribute('data-locationid', locationId);
  }

  loader.onload = function () {
    console.info('[ONESOL Task Center] Production widget loaded.');
  };

  loader.onerror = function () {
    console.error('[ONESOL Task Center] Unable to load production widget:', source);
  };

  document.head.appendChild(loader);
})();
