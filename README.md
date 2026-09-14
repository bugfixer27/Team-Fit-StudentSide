# Team Fit — student site

A read-only, animated front end for the Riverdale Science Olympiad roster. It shows who is on
**Maroon** (Team A), **Gold** (Team B) and **Tan** (Team C), and who sits in each of the 24 events.
Nothing else from the sign-up form is displayed: just name, grade, email, team and events.

It loads the roster the moment the page opens (no reload button) using the exact same Google
Apps Script call as the leaders' Team Builder: a single `GET …/exec?token=…&action=load`.
The site never writes anything back.

## Files

```
index.html      page skeleton
config.js       apiUrl + token (the only file you should ever need to edit)
css/styles.css  all styling and motion
js/api.js       transport (mirrors the Team Builder API contract)
js/data.js      turns the load payload into people / teams / events
js/fx.js        constellation canvas, reveals, tilt, pinned horizontal gallery
js/app.js       boot, render, search, drawer
.nojekyll       tells GitHub Pages to serve the folder as-is
```

No build step, no dependencies. Fonts come from Google Fonts.

## Deploy on GitHub Pages

1. Push this folder to a GitHub repository (the repo root should contain `index.html`).
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`,
   folder **`/ (root)`**, Save.
3. The site is live at `https://<user>.github.io/<repo>/` within a minute or two.

If the leaders redeploy the Apps Script, paste the new `/exec` URL (and token, if it changed) into `config.js`.

## Run locally

```bash
python3 -m http.server 8790
```

Then open <http://localhost:8790/>. Opening `index.html` directly from disk will not work because the
scripts are ES modules.

## Keyboard

- `/` focuses search (names, emails, grades, teams, events)
- `Esc` clears search / closes the person drawer
- Click any name anywhere for their event card; click an event in the card to glide to it
