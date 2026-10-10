# Pomodoro Garden — starter website

A no-build, single-file starter app for the Pomodoro Garden concept.

## Run it
1. Unzip this folder.
2. Open `index.html` in a modern browser (Chrome, Firefox, Safari, or Edge).
3. For a more realistic development setup, serve the folder with any static web server (for example VS Code's Live Server extension).

## Included
- Focus, short-break, and long-break timers
- Pause, reset, and skip controls
- Custom timer durations in Settings
- Task list with completion and deletion
- Local session history and CSV export
- Daily/weekly progress summary
- Alarm sound generated with the Web Audio API (no audio API key)
- Optional phone-away prompt
- `.ics` calendar event download (manual import, not account sync)
- Browser-local persistence using `localStorage`
- Responsive layout for desktop and mobile

## Important limitations
- Data stays in the current browser/device. It is not synced between devices and can be erased if browser data is cleared.
- Browsers can throttle timers when a tab is backgrounded and may restrict audio until the user interacts with the page. This starter recalculates remaining time from a timestamp to reduce timer drift, but it cannot guarantee an alarm if the browser/device is suspended or the tab is closed.
- The app uses browser alerts for end-of-session notifications. For a polished release, replace these with in-app toast/dialog UI.
- The weekly chart is a lightweight visual summary, not a full analytics system.
- Calendar support only downloads an `.ics` file. Two-way sync requires OAuth and a provider API.

## Do you need APIs?
Not for the first version. Timer, tasks, alarms, and local statistics work in the browser.
Consider adding:
- **Backend + database** (e.g. Supabase or Firebase) only if users need accounts, cloud sync, shared data, or cross-device history.
- **Authentication** through that backend if users sign in.
- **Google Calendar API** or **Microsoft Graph** only for direct calendar read/write sync. Keep OAuth tokens secure and never put a service-role secret in front-end code.
- **Web Push** and a server if you need notifications while the site is closed. Browser notifications alone do not reliably wake a closed site.
- **Analytics** only if you need product usage insights, with clear privacy disclosure and consent where required.

## Before publishing
- Test on mobile and desktop, including backgrounding the browser.
- Add accessible labels and keyboard focus states to all controls.
- Decide how you will handle time zones and daylight-saving changes for calendar sync.
- Add privacy policy/terms if collecting accounts, analytics, or personal data.
- Add a proper PWA manifest/service worker if installability/offline behavior is desired.
- Consider replacing `alert()` / `confirm()` with accessible custom dialogs.
- Test the timer's finish/skip behavior and data export before relying on it.
