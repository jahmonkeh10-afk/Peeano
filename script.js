(() => {
  // White keys run from 1 (lowest) through m (highest), matching the reference image.
  const whiteLabels = "1234567890qwertyuiopasdfghjklzxcvbnm".split("");
  // Black-key labels are the shifted keyboard characters shown in the reference.
  const blackLabels = ["!", "@", "$", "%", "^", "*", "(", "Q", "W", "E", "T", "Y", "I", "O", "P", "S", "D", "G", "H", "J", "L", "Z", "C", "V", "B"];
  // White-key positions (0-based) after which each black key sits.
  const blackAfter = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26, 28, 29, 31, 32, 33];
  // A standard chromatic pitch sequence, starting at C3.
  const whiteMidi = [];
  let midi = 48;
  const semitoneSteps = [2, 2, 1, 2, 2, 2, 1];
  let stepIndex = 0;
  for (let i = 0; i < whiteLabels.length; i++) {
    whiteMidi.push(midi);
    midi += semitoneSteps[stepIndex % 7];
    stepIndex++;
  }

  const piano = document.getElementById("piano");
  const whiteContainer = document.getElementById("white-keys");
  const blackContainer = document.getElementById("black-keys");
  const status = document.getElementById("status");
  const volumeInput = document.getElementById("volume");
  const sustainButton = document.getElementById("sustain");
  const whiteWidth = 38;
  const blackWidth = 19;
  const keyElements = new Map();
  const activePointers = new Map();
  const pressedKeys = new Set();
  let audioContext;
  let masterGain;
  let sustain = false;
  const voices = new Map();

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

  function makeKey(label, midiNote, isBlack, index, left) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `key ${isBlack ? "black-key" : "white-key"}`;
    button.setAttribute("aria-label", `Play ${label}`);
    button.dataset.label = label;
    button.dataset.midi = midiNote;
    if (isBlack) button.style.left = `${left}px`;
    const keyLabel = document.createElement("span");
    keyLabel.className = "key-label";
    keyLabel.textContent = label;
    button.appendChild(keyLabel);
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
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

  whiteLabels.forEach((label, i) => {
    whiteContainer.appendChild(makeKey(label, whiteMidi[i], false, i, 0));
  });

  // Black-key pitch is the semitone between neighboring white keys.
  blackLabels.forEach((label, i) => {
    const after = blackAfter[i];
    if (after >= whiteLabels.length - 1) return;
    const midiNote = whiteMidi[after] + 1;
    const left = (after + 1) * whiteWidth - blackWidth / 2;
    blackContainer.appendChild(makeKey(label, midiNote, true, i, left));
  });

  function startNote(label, midiNote, button) {
    if (voices.has(label) || !setupAudio()) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 440 * Math.pow(2, (midiNote - 69) / 12);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, audioContext.currentTime + 0.015);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start();
    voices.set(label, { oscillator, gain, button });
    button.classList.add("active");
    status.textContent = `Playing ${label.toUpperCase()} · MIDI ${midiNote}`;
  }

  function stopNote(label) {
    const voice = voices.get(label);
    if (!voice) return;
    if (sustain) return;
    const now = audioContext.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, 0.06);
    voice.oscillator.stop(now + 0.25);
    voice.button.classList.remove("active");
    voices.delete(label);
    status.textContent = "Ready to play";
  }

  function releaseAll() {
    for (const label of [...voices.keys()]) {
      const voice = voices.get(label);
      const now = audioContext.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0.0001, now, 0.06);
      voice.oscillator.stop(now + 0.25);
      voice.button.classList.remove("active");
      voices.delete(label);
    }
  }

  function normalizeKey(event) {
    // Use the displayed character so shifted symbols trigger black notes.
    if (event.key.length === 1) {
      if (event.shiftKey && /^[a-z]$/.test(event.key)) return event.key.toUpperCase();
      return event.key;
    }
    return "";
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
    if (!sustain && audioContext) releaseAll();
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
