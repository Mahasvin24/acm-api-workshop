# API Social design notes

## Direction

Design-taste app direction: **Editorial greeting**, seed **1098648331**. No redraws. Palette and typography were kept under the brief’s existing-brand constraint. A 1100px content column, tonal blue workshop panel, plain navigation, and flat peer cards give the directory a calm community feel. The platform name and the chapter’s official logo identify the product immediately. Avenir Next/system sans keeps it independent of font downloads.

The screen answers: “What did people in this room build, and how do I call it?”

Its own element is the paired IP and port on every project, leading to a copyable Postman address. The live interaction is the real directory: search, sort, details, refresh, and copy. The sample view is explicitly separate from the real room. No fabricated online status or attendance statistics.

The exact logo URL was identified from the official website’s image link. Network DNS restrictions prevented downloading the asset locally. The HTML references the official remote image and falls back to the text wordmark. No photographs, generated imagery, or substitute logo drawings are used.

## Verification limits

The browser host was unavailable, and the design inspector could not start its local server: `listen EPERM 127.0.0.1`. Therefore no screenshots, browser interaction checks, or visual scores are claimed. The responsive CSS still needs a real-browser pass at 1440, 768, and 390 pixels before the event, including empty, sample, real, error, search, and dialog states. The built-in request tests run without binding ports.

Run locally when browser access is available:

```sh
npm start
# In another terminal, from this folder:
node /path/to/design-taste-frontend/scripts/inspect.mjs http://localhost:3000/?demo=1 --app
```

Sample projects to confirm or replace: Campus Picks, What’s for lunch?, Daily Affirmations, The Aux Cord, Gaucho Trivia, and Pet Roll Call. These are optional demonstration content, not real registrations or APIs.
