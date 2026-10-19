# Virtual Piano

A lightweight static browser piano matching the supplied keyboard layout. The `1` key is the lowest white note and `m` is the highest white note.

## Files
- `index.html` — page structure
- `style.css` — keyboard and page styling
- `script.js` — keyboard mapping, piano samples, and fallback synth

## Sound
The piano now uses the `acoustic_grand_piano` instrument from the FluidR3_GM soundfont through `soundfont-player`. The soundfont is released under Creative Commons Attribution 3.0. Reference: https://gleitz.github.io/midi-js-soundfonts/ . The site loads the player and sample files from public CDNs, so an internet connection is needed for the sampled piano sound. If samples cannot load, a synthesized fallback tone is used instead.

## Run locally
Open `index.html` in a modern browser. Audio starts after you first click a key or press a mapped key. Click keys or use your computer keyboard. The sound samples are loaded on demand after the first interaction.

Black keys use the shifted keyboard characters printed on the keys (for example, `Shift` + `1` plays `!`). Volume and sustain controls are included.

## Publish with GitHub Pages
1. Create a GitHub repository.
2. Upload `index.html`, `style.css`, `script.js`, and this README to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
5. Wait for the published URL to appear in the Pages settings.

No build step or server is required.
