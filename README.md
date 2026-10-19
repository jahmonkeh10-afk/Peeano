# Virtual Piano

A lightweight, static browser piano based on the supplied keyboard reference. It uses no libraries or build tools, so it can be hosted directly on GitHub Pages.

## Files
- `index.html` — page structure
- `style.css` — keyboard and page styling
- `script.js` — keyboard mapping and sound generation with the Web Audio API

## Run locally
Open `index.html` in a modern browser. Click keys or use your computer keyboard. The first white key (`1`) is the lowest note and the last white key (`m`) is the highest.

Black keys use the shifted symbols shown on the keys (for example, hold **Shift** and press **1** to play `!`). Browser audio starts after the first interaction.

## Publish with GitHub Pages
1. Create a GitHub repository.
2. Upload `index.html`, `style.css`, `script.js`, and optionally this README to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
5. Wait for the published URL shown in the Pages section.

No server or package installation is needed.
