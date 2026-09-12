# 🔔 GoHighLevel Task Notifier Widget

> A polished, lightweight task-notification experience for GoHighLevel CRM users — designed to keep today's follow-ups visible, actionable, and impossible to ignore.

[![GoHighLevel](https://img.shields.io/badge/GoHighLevel-CRM-111827?style=for-the-badge)](https://www.gohighlevel.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111827)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Status](https://img.shields.io/badge/status-working-success?style=for-the-badge)](#what-it-does)

## ✨ What it does

The widget adds a persistent notification bell to GoHighLevel CRM. It focuses on the logged-in user's incomplete tasks and gives the user a fast command center without leaving the CRM workflow.

### Highlights

- 🔔 **Fixed bottom-right notification bell**
- 🔢 Live badge showing tasks due today
- 👋 Personalized greeting using the logged-in user's name
- 🚨 **Attention Required** state for overdue and today's tasks
- 🔴 Overdue tasks highlighted in red
- 🟠 Today's tasks highlighted as action-required
- 📋 Clean task-list view
- 📅 Calendar view for date-based planning
- 👤 Client/contact name displayed with the task
- ☎ Client phone number displayed when available
- 🖱️ Click a task for a detailed SweetAlert modal
- ↗️ **Open Client File** directly inside GoHighLevel
- ✅ Mark tasks complete from the widget
- 🔄 Automatic refresh
- 🧭 GoHighLevel SPA route-aware behavior
- 💾 List/Calendar preference saved locally
- 📱 Responsive CRM-friendly UI

## 🎯 The workflow

```text
GoHighLevel CRM
      │
      ▼
┌──────────────────────────┐
│     🔔 Task Notifier     │
│                          │
│  7 tasks due today       │
└────────────┬─────────────┘
             │ click
             ▼
┌──────────────────────────┐
│ 👋 Hi Bushra             │
│ You have 15 tasks left   │
│                          │
│ ⚠ Attention required     │
│ 1 overdue • 7 today      │
│                          │
│ List       Calendar      │
└────────────┬─────────────┘
             │ click task
             ▼
┌──────────────────────────┐
│ Follow Up                │
│ 👤 Client Name           │
│ ☎ +971 XX XXX XXXX       │
│                          │
│ Open Client File →       │
│                          │
│ [ Close ] [ ✓ Complete ] │
└──────────────────────────┘
```

## 🧩 Installation

The public repository deliberately does **not** contain a GoHighLevel Private Integration Token. The public `task.js` is a secure distribution loader for the controlled production build.

Add the following to the GoHighLevel Custom JavaScript area where your widget is loaded:

```html
<script
  src="https://tasks.onesol.ae/task.js?v=4.3.0"
  data-userid="YOUR_GHL_USER_ID"
  data-username="YOUR_NAME">
</script>
```

You can also use the repository loader:

```html
<script
  src="https://raw.githubusercontent.com/Haris-khan-Durrani/gohighlevel-task-notifier-widget/main/task.js"
  data-userid="YOUR_GHL_USER_ID"
  data-username="YOUR_NAME">
</script>
```

## 🔐 Security

**Never commit a real GoHighLevel Private Integration Token to a public repository or browser-delivered JavaScript.** A browser-delivered token can be inspected by anyone who can load the page.

For production, keep the token in a protected server-side proxy/API layer and expose only the minimum operations required by the widget. The public repository intentionally contains no secret.

## 🔌 API model

The production implementation is designed around the GoHighLevel task/contact workflow:

```http
POST /locations/{locationId}/tasks/search
GET  /contacts/{contactId}
PUT  /contacts/{contactId}/tasks/{taskId}/completed
```

Task search is scoped to the logged-in user, for example:

```json
{
  "assignedTo": ["GHL_USER_ID"],
  "completed": false,
  "limit": 25,
  "skip": 0
}
```

## ↗️ Open Client File

When a task has a contact ID, the widget builds the GoHighLevel contact route dynamically:

```text
/v2/location/{LOCATION_ID}/contacts/detail/{CONTACT_ID}
```

Example:

```text
https://app.gohighlevel.com/v2/location/DBIW35BNmwcduwl3pWp4/contacts/detail/QKuM9fZ3ZQbNiUms3Nt7
```

The location ID and contact ID are not hard-coded into the task action.

## 🖥️ UX principles

1. **Today first** — today's work is visually prominent.
2. **Overdue means attention** — overdue tasks are red and surfaced immediately.
3. **One click to context** — open the client's GHL file directly from the task.
4. **One click to completion** — complete a task without navigating away.
5. **Calendar when planning** — switch from execution mode to date planning.
6. **No draggable UI** — the notification bell stays fixed at the bottom-right for predictable CRM behavior.

## 📦 Repository contents

```text
.
├── task.js
├── README.md
├── LICENSE
└── .gitignore
```

`task.js` is the public distribution loader. The production implementation is hosted separately so deployment credentials are not published.

## 🚀 Roadmap

- Browser/desktop notification support
- Task priority filters
- Search and quick filtering
- Click-to-call contact action
- Task snoozing
- Team-level dashboards
- Optional sound alerts
- Server-side token proxy reference implementation

## 📄 License

MIT — see [LICENSE](LICENSE).

---

Built for teams that live inside GoHighLevel and need their follow-ups visible at the right moment.
