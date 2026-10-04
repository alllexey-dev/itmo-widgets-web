# WB-04 visual verification fixtures

These Browser pane captures contain synthetic dashboard data only, with no
login codes, cookies, real profiles or external avatars. They exercise icons
and charts at widths 375 and 1280 in both light and dark themes.

Source feature commit: `ecf4de8a2ccc2a5b265cd3ec999c390cc9723ec2`.
The local preview served built static assets and synthetic API responses only,
with no live proxy or upstream fallback.

The Browser pane injects an annotation-overlay style element that produces one
tool-owned `style-src-elem` violation (inline, empty source, line 135). The app CSP
was not relaxed. A separately owner-approved clean headless Chromium check used
fresh contexts and blocked every non-loopback request: 64 page/theme/viewport
checks, zero CSP violations and zero external request attempts. Synthetic QR,
all three dashboard charts and the self-hosted icon font were verified.

- `dashboard-375-light.jpg`: mobile light.
- `dashboard-375-dark.jpg`: mobile dark.
- `dashboard-1280-light.jpg`: desktop light.
- `dashboard-1280-dark.jpg`: desktop dark.
