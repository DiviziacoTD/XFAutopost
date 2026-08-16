# XenForo AutoPoster

A lightweight Google Chrome extension that automatically posts a predefined message to a specific XenForo forum thread at randomized intervals.

The extension runs in the background using the Chrome Extensions Manifest V3 APIs and does not require an external server.

## Features

* Automatically posts a predefined message to a configured XenForo thread.
* Randomized posting interval to avoid predictable automation patterns.
* Runs in the background using `chrome.alarms`.
* Opens the target thread in a background tab when a post is due.
* Detects the XenForo quick-reply editor automatically.
* Supports both:

  * `contenteditable` editors, including Froala-based XenForo editors.
  * Standard `<textarea>` reply fields.
* Checks the author of the latest post before posting.
* Can skip posting when the configured user is already the latest poster.
* Manual **Post Now** functionality.
* Enable/disable automatic posting from the extension popup.
* Displays:

  * Current status
  * Last post time
  * Next scheduled post
  * Last operation result
* Desktop notifications for successful posts, skipped posts, and errors.
* Built-in debug information to help troubleshoot selector or XenForo compatibility issues.
* Automatically closes the background tab after the operation completes.
* Stores configuration and status information locally using `chrome.storage.local`.

## How It Works

When AutoPoster is enabled, the extension creates a one-shot Chrome alarm with a randomized delay.

At each scheduled interval:

1. The extension opens the configured XenForo thread in a background tab.
2. It waits for the page to finish loading.
3. It waits briefly for JavaScript-rendered content to become available.
4. It identifies the latest post on the page.
5. It checks the latest poster against the configured skip condition.
6. If posting is allowed, it locates the quick-reply editor.
7. The configured message is inserted into the editor.
8. The reply button is located and clicked.
9. The result is stored locally.
10. A desktop notification reports the outcome.
11. The temporary tab is closed.
12. A new alarm is created with a fresh randomized delay.

## Configuration

Before installing the extension, edit `background.js`:

```javascript
const THREAD_URL = "XXXXX";
const ALARM_NAME = "autopost";
const MIN_MINUTES = 6 * 60;
const MAX_MINUTES = 7 * 60;
```

### Target Thread

Replace `THREAD_URL` with the URL of the XenForo thread you want to monitor.

The URL should point to the **last page of the thread**, for example:

```javascript
const THREAD_URL = "https://forum.example.com/threads/example/page-9999";
```

Using `/page-9999` allows XenForo to redirect the request to the current last page of the thread.

### Posting Interval

The extension uses a randomized interval between `MIN_MINUTES` and `MAX_MINUTES` to avoid predictable posting patterns.

```javascript
const MIN_MINUTES = 6 * 60;
const MAX_MINUTES = 7 * 60;
```

This schedules each post at a random time between 6 and 7 hours after the previous one.

Each interval is drawn independently, so consecutive posts will not follow a fixed schedule.

To change the range, adjust both constants. For example, to randomize between 4 and 5 hours:

```javascript
const MIN_MINUTES = 4 * 60;
const MAX_MINUTES = 5 * 60;
```

## Preventing Duplicate Posts

The extension checks the author of the latest post before submitting a reply.

The relevant section is:

```javascript
const messages = Array.from(
  document.querySelectorAll("article.message[data-author]")
);
```

It reads the `data-author` attribute of the last `<article>` element, which XenForo populates with the post author's username. This approach is reliable against false matches caused by quoted content inside posts, since it reads a DOM attribute rather than visible text.

You can configure the username that should cause the extension to skip posting by changing:

```javascript
if (lastPoster.toLowerCase().includes("XXXX")) {
```

For example:

```javascript
if (lastPoster.toLowerCase().includes("MyUsername")) {
```

If the latest post was made by that user, the extension skips the scheduled post.

This prevents the extension from continuously posting when the thread has not received a response from another user.

## Extension Popup

The popup provides a simple interface for controlling the extension.

### Status

Shows whether AutoPoster is currently active or inactive.

### Last Post

Displays the timestamp of the most recent posting attempt.

### Next Post

Displays the next scheduled execution of the Chrome alarm.

### Message

The message entered here is stored locally and used for subsequent automatic posts.

### Enable / Disable

Starts or stops the automatic posting schedule.

### Post Now

Immediately executes the posting process without waiting for the next scheduled interval. A new randomized alarm is scheduled afterward.

## Error Handling

The extension reports several common failure conditions, including:

* No reply editor found.
* No submit button found.
* Failure while executing the posting script.
* Failure while loading the target tab.
* Latest post belongs to the configured skip user.
* Unexpected JavaScript errors.

Debug information is also collected from the target page, including detected:

* `contenteditable` elements
* `<textarea>` elements
* Submit buttons
* XenForo-related attributes
* Login indicators
* Latest post author
* Editor selector used
* Submit button selected

The debug information is available from the popup when an operation has produced diagnostic data.

## Permissions

The extension uses the following Chrome permissions:

| Permission      | Purpose                                           |
| --------------- | ------------------------------------------------- |
| `alarms`        | Schedule one-shot alarms with randomized delays   |
| `storage`       | Store the message, settings, and execution status |
| `tabs`          | Open and close the temporary forum tab            |
| `scripting`     | Execute the posting logic inside the XenForo page |
| `notifications` | Display desktop notifications                     |

The extension also requires host permission for the XenForo forum it operates on.

Update `manifest.json` accordingly:

```json
"host_permissions": [
  "https://your.forum.address.here/*"
]
```

Replace the placeholder with the actual forum domain.

## Installation

This extension is currently designed for manual installation as an unpacked Chrome extension.

1. Download or clone this repository.
2. Open Chrome.
3. Navigate to:

```text
chrome://extensions/
```

4. Enable **Developer mode**.
5. Select **Load unpacked**.
6. Select the extension directory.
7. Configure `THREAD_URL`, `MIN_MINUTES`, and `MAX_MINUTES` in `background.js`.
8. Reload the extension from the Extensions page.
9. Open the extension popup.
10. Enter the message.
11. Click **Enable**.

The user must already be authenticated on the target XenForo forum.

## Project Structure

```text
XenForo AutoPoster/
├── background.js     # Background service worker and posting logic
├── manifest.json     # Chrome extension configuration
├── popup.html        # Extension popup UI
├── popup.js          # Popup logic and status handling
├── icon16.png        # 16px extension icon
├── icon48.png        # 48px extension icon
└── icon128.png       # 128px extension icon
```

## Compatibility

The posting logic is designed around the DOM structure commonly used by XenForo, including Froala-based quick-reply editors.

Because XenForo installations can differ depending on version, theme, customizations, and installed add-ons, selectors may need to be adjusted for a particular forum.

The extension does **not** use a XenForo API. It interacts with the forum through the browser page itself, in the same way a user would interact with the quick-reply interface.

## Limitations

* Designed for Chrome and Chromium-based browsers supporting Manifest V3.
* Requires an authenticated XenForo session.
* Requires the target forum to match the configured host permission.
* DOM changes to the XenForo installation may require selector updates.
* The posting interval is controlled by Chrome's alarm system and should not be considered a precise real-time scheduler.
* The extension currently targets a single configured thread.
* The target message and thread configuration are stored locally in the browser.

## Support My Projects

If you find this extension useful and would like to support more development, you can [Buy Me a Coffee](https://buymeacoffee.com/diviziacotd)

Any support is appreciated and helps keep the projects and improvements going.

## Version

Current version: **1.4.0**

## Author

**DiviziacoTD**
