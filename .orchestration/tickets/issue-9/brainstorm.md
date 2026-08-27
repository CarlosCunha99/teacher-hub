### 2026-08-27 21:12 — dev
Given no live reviewer is available, proceed with the simplest MVP-compliant flow: enforce terms acceptance server-side before uploads, with a first-upload modal and a route for terms text.

### 2026-08-27 21:13 — agent
One issue with a UI-only gate is bypass risk; API enforcement must be authoritative. Do we also force re-acceptance on version updates?

### 2026-08-27 21:14 — dev
Yes. On terms version changes, require re-acceptance before next upload and surface a reminder banner in the upload area/settings.

### 2026-08-27 21:15 — agent
Makes sense. Keep terms text/version in app config for MVP, and persist acceptance records per teacher with timestamp+version in DB.

### 2026-08-27 21:16 — dev
Let's go with this.
