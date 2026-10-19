(() => {
  // White-key mapping follows the reference: 1 is the lowest note and m is the highest.
  const whiteLabels = "1234567890qwertyuiopasdfghjklzxcvbnm".split("");
  const blackLabels = ["!", "@", "$", "%", "^", "*", "(", "Q", "W", "E", "T", "Y", "I", "O", "P", "S", "D", "G", "H", "J", "L", "Z", "C", "V", "B"];
  const blackAfter = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26, 28, 29, 31, 32, 33];
  const whiteWidth = 38;
  const blackWidth = 19;
  const whiteMidi = [];
  let midi = 48; // C3
  const semitoneSteps = [2, 2, 1, 2, 2, 2, 1];
  for (let i = 0; i < whiteLabels.length; i++) {
    whiteMidi.push(midi);
    midi += semitoneSteps[i % 7];
  }

  const piano = document.getElementById("piano");
  const whiteContainer = document.getElementById("white-keys");
  const blackContainer = document.getElementById("black-keys");
  const status = document.getElementById("status");
  const volumeInput = document.getElementById("volume");
  const sustainButton = document.getElementById("sustain");
  const keyElements = new Map();
  const activePointers = new Map();
  const pressedKeys = new Set();
  const heldLabels = new Set();
  const voices = new Map();
  let audioContext;
  let masterGain;
  let soundfontInstrument;
  let instrumentPromise;
  let sustain = false;

  piano.style.setProperty("--key-count", whiteLabels.length);

  function setupAudio() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        status.textContent = "Your browser does not support Web Audio.";
        return false;
      }
      audioContext = new AudioCtx();
      masterGain = audioContext.createGain();
      masterGain.gain.value = Number(volumeInput.value);
      masterGain.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return true;
  }

  function loadPiano() {
    if (soundfontInstrument) return Promise.resolve(soundfontInstrument);
    if (instrumentPromise) return instrumentPromise;
    if (!window.Soundfont) return Promise.resolve(null);

    status.textContent = "Loading acoustic piano samples…";
    // Limit decoded notes to this keyboard's range to keep startup lighter.
    const notes = Array.from({ length: 61 }, (_, index) => index + 48);
    instrumentPromise = window.Soundfont.instrument(audioContext, "acoustic_grand_piano", {
      soundfont: "FluidR3_GM",
      format: "mp3",
      destination: masterGain,
      notes
    }).then(instrument => {
      soundfontInstrument = instrument;
      status.textContent = "Acoustic piano ready · play a note";
      return instrument;
    }).catch(error => {
      console.warn("Could not load the piano soundfont; using the built-in fallback.", error);
      status.textContent = "Using built-in piano fallback";
      return null;
    });
    return instrumentPromise;
  }

  function makeKey(label, midiNote, isBlack, left = 0) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `key ${isBlack ? "black-key" : "white-key"}`;
    button.setAttribute("aria-label", `Play key ${label}`);
    button.dataset.label = label;
    button.dataset.midi = midiNote;
    if (isBlack) button.style.left = `${left}px`;

    const keyLabel = document.createElement("span");
    keyLabel.className = "key-label";
    keyLabel.textContent = label;
    button.appendChild(keyLabel);

    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      activePointers.set(event.pointerId, label);
      startNote(label, midiNote, button);
    });
    const endPointer = event => {
      const held = activePointers.get(event.pointerId);
      if (held) {
        activePointers.delete(event.pointerId);
        stopNote(held);
      }
    };
    button.addEventListener("pointerup", endPointer);
    button.addEventListener("pointercancel", endPointer);
    button.addEventListener("lostpointercapture", endPointer);

    keyElements.set(label, { button, midiNote });
    return button;
  }

  whiteLabels.forEach((label, index) => {
    whiteContainer.appendChild(makeKey(label, whiteMidi[index], false));
  });

  blackLabels.forEach((label, index) => {
    const after = blackAfter[index];
    const blackMidi = whiteMidi[after] + 1;
    const left = (after + 1) * whiteWidth - blackWidth / 2;
    blackContainer.appendChild(makeKey(label, blackMidi, true, left));
  });

  // A small additive synth is used only if the sampled piano cannot be loaded.
  function startFallbackVoice(label, midiNote, button) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    const partials = [1, 2, 3, 4, 5];
    const levels = [0.55, 0.23, 0.12, 0.065, 0.035];
    const nodes = [];
    partials.forEach((partial, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * partial;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(levels[index] * 0.18, now + 0.012);
      gain.gain.setTargetAtTime(0.0001, now + 0.12, 0.9 + index * 0.18);
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(now);
      nodes.push({ oscillator, gain });
    });
    voices.set(label, {
      button,
      stop: () => {
        const now = audioContext.currentTime;
        nodes.forEach(({ oscillator, gain }) => {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setTargetAtTime(0.0001, now, 0.075);
          try { oscillator.stop(now + 0.3); } catch (_) {}
        });
      }
    });
    button.classList.add("active");
  }

  async function startNote(label, midiNote, button) {
    heldLabels.add(label);
    if (voices.has(label) || !setupAudio()) return;
    const instrument = await loadPiano();
    // Don't start a late note if the user already released the key during loading.
    if (!heldLabels.has(label) && !sustain) return;
    if (voices.has(label)) return;

    if (instrument) {
      try {
        const node = instrument.play(midiNote, audioContext.currentTime, {
          gain: 0.92,
          attack: 0.005,
          release: 0.22
        });
        voices.set(label, {
          button,
          stop: () => {
            try { node.stop(audioContext.currentTime); } catch (_) {}
          }
        });
      } catch (error) {
        console.warn("Sample playback failed; using fallback sound.", error);
        startFallbackVoice(label, midiNote, button);
      }
    } else {
      startFallbackVoice(label, midiNote, button);
    }
    button.classList.add("active");
    status.textContent = `Playing ${label.toUpperCase()} · MIDI ${midiNote}`;
  }

  function stopNote(label) {
    heldLabels.delete(label);
    const voice = voices.get(label);
    if (!voice || sustain) return;
    voice.stop();
    voice.button.classList.remove("active");
    voices.delete(label);
    status.textContent = soundfontInstrument ? "Acoustic piano ready · play a note" : "Ready to play";
  }

  function releaseAll() {
    for (const [label, voice] of voices) {
      voice.stop();
      voice.button.classList.remove("active");
      voices.delete(label);
    }
  }

  function normalizeKey(event) {
    if (event.key.length !== 1) return "";
    if (event.shiftKey && /^[a-z]$/.test(event.key)) return event.key.toUpperCase();
    return event.key;
  }

  document.addEventListener("keydown", event => {
    if (event.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const label = normalizeKey(event);
    const item = keyElements.get(label);
    if (!item) return;
    event.preventDefault();
    pressedKeys.add(label);
    startNote(label, item.midiNote, item.button);
  });

  document.addEventListener("keyup", event => {
    const label = normalizeKey(event);
    if (pressedKeys.has(label)) {
      pressedKeys.delete(label);
      stopNote(label);
    }
  });

  window.addEventListener("blur", () => {
    pressedKeys.clear();
    heldLabels.clear();
    if (!sustain) releaseAll();
  });

  volumeInput.addEventListener("input", () => {
    if (masterGain) masterGain.gain.value = Number(volumeInput.value);
  });

  sustainButton.addEventListener("click", () => {
    sustain = !sustain;
    sustainButton.setAttribute("aria-pressed", String(sustain));
    sustainButton.textContent = `Sustain: ${sustain ? "On" : "Off"}`;
    if (!sustain) releaseAll();
  });
})();
