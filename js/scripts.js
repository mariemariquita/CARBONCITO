const WAVE_THRESH = 3;
const CHAR_MULT = 3;
const ANIM_STEP = 25;
const WAVE_BUF = 5;
const CHAR_DELAY = 1.2;
const LINE_DELAY = 2.5;
const CHAR_JITTER = 1000;
const LINE_JITTER = 600;
const GLITCH_MIN = 120;
const GLITCH_MAX = 450;
const FLICKER_MS = 70;
const GLITCH_COLOR = "#ffffff";
const GLYPHS = "0123456789ABCDEF:.=*+-<>¦╌";
// Retraso (ms) entre el click y la aparición del texto de bienvenida.
// 0 = el texto del sketch se convierte directamente en el texto nuevo.
const INTRO_DELAY_MS = 2000;


const rand = (min, max) => min + Math.random() * (max - min);

window.SKETCH_CONFIG = {
  fontSizeRem: 1,
  wordGapRem: 0.45,
  rowGapRem: 0.2,
  overflowWords: 3,
  overflowRows: 3,
  scrambleIntervalMs: 300,
  textOpacity: 0.8,
  scrambleChance: 0.72,
  scrambleCharacters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
};

let dictionary = [];
let dictionaryError = "";
let words = [];
let lines = [];
let glitchQueue = [];
let glitchingCharacters = [];
let glitchStartedAt = 0;
let glitchQueueIndex = 0;
let phase = "words";
let settings;
let settingsSignature = "";
let waves = [];
let previousHoveredWord = null;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("sketch");
  if (phase === "done") {
    noLoop();
  }
  canvas.elt.setAttribute("aria-label", "Palabras interactivas de ICE");
  canvas.elt.setAttribute("role", "img");
  textAlign(LEFT, BASELINE);
  refreshSettings();

  fetch("./diccionario.md")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`No se pudo cargar diccionario.md (${response.status}).`);
      }
      return response.text();
    })
    .then(async (contents) => {
      await document.fonts.load(settings.canvasFont);
      await document.fonts.ready;
      dictionary = contents.split(/\r?\n/).map((word) => word.trim()).filter(Boolean);
      if (!dictionary.length) {
        throw new Error("diccionario.md no contiene palabras.");
      }
      layoutWords();
    })
    .catch((error) => {
      dictionaryError = error.message;
      console.error("No se pudo iniciar el sketch de palabras:", error);
    });
}

function draw() {
  drawingContext.globalAlpha = 1;
  background(0);

  if (phase === "glitching") {
    drawGlitchAnimation();
    return;
  }

  if (phase === "black") {
    return;
  }

  if (dictionaryError) {
    drawingContext.font = settings.canvasFont;
    drawingContext.fillStyle = settings.color;
    drawingContext.textBaseline = "alphabetic";
    drawingContext.textAlign = "left";
    drawingContext.fillText(dictionaryError, settings.fontSize, settings.fontSize * 2);
    return;
  }

  if (!dictionary.length) {
    return;
  }

  const nextSignature = getConfigSignature();
  if (nextSignature !== settingsSignature) {
    refreshSettings();
  }

  drawingContext.font = settings.canvasFont;
  drawingContext.fillStyle = settings.color;
  drawingContext.globalAlpha = window.SKETCH_CONFIG.textOpacity;
  drawingContext.textBaseline = "alphabetic";
  drawingContext.textAlign = "left";

  updateWaveHover();
  const now = millis();
  cleanupWaves(now);

  for (const word of words) {
    const isInWave = waves.some((wave) => {
      if (word.line !== wave.line) {
        return false;
      }

      const horizontalDistance = wave.originX < word.x
        ? word.x - wave.originX
        : wave.originX > word.x + word.width
          ? wave.originX - (word.x + word.width)
          : 0;
      const distanceInCharacters = horizontalDistance / settings.characterWidth;
      const waveCharacters = Math.floor((now - wave.startedAt) / ANIM_STEP) * CHAR_MULT;
      return distanceInCharacters >= waveCharacters - WAVE_BUF &&
        distanceInCharacters <= waveCharacters + WAVE_THRESH;
    });

    if (isInWave) {
      drawWaveWord(word);
    } else {
      drawingContext.fillText(word.text, word.x, word.y, word.width);
    }
  }
}

function drawWaveWord(word) {
  const originalCharacters = Array.from(word.text);
  const scrambledCharacters = Array.from(getScrambledWord(word));
  let prefix = "";

  for (let index = 0; index < scrambledCharacters.length; index += 1) {
    const character = scrambledCharacters[index];
    drawingContext.globalAlpha = character === originalCharacters[index]
      ? window.SKETCH_CONFIG.textOpacity
      : 1;
    drawingContext.fillText(character, word.x + drawingContext.measureText(prefix).width, word.y);
    prefix += character;
  }

  drawingContext.globalAlpha = window.SKETCH_CONFIG.textOpacity;
}

function updateWaveHover() {
  const pointerIsOnCanvas = mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
  const hoveredLine = pointerIsOnCanvas
    ? lines.find((line) => mouseY >= line[0].y - settings.fontSize && mouseY <= line[0].y + settings.fontSize * 0.2)
    : null;
  const hoveredWord = hoveredLine?.find((word) => mouseX >= word.x && mouseX <= word.x + word.width) || null;

  if (hoveredWord && (hoveredWord !== previousHoveredWord || waves.length === 0)) {
    const maxWaveDistance = Math.max(
      mouseX - hoveredLine[0].x,
      hoveredLine[hoveredLine.length - 1].x + hoveredLine[hoveredLine.length - 1].width - mouseX
    );
    const maxWaveCharacters = maxWaveDistance / settings.characterWidth;
    const duration = Math.ceil(maxWaveCharacters / CHAR_MULT) * ANIM_STEP;
    waves.push({ line: hoveredLine, originX: mouseX, startedAt: millis(), duration });
  }
  previousHoveredWord = hoveredWord;
}

function cleanupWaves(now) {
  waves = waves.filter((wave) => now - wave.startedAt < wave.duration);
}

function mouseMoved() {
  if (phase === "words" && dictionary.length) {
    updateWaveHover();
  }
}

function refreshSettings() {
  const rootStyle = getComputedStyle(document.documentElement);
  const config = window.SKETCH_CONFIG;
  const rem = parseFloat(rootStyle.fontSize) || 16;
  const fontFamily = rootStyle.getPropertyValue("--text-font-family").trim();
  const fontWeight = rootStyle.getPropertyValue("--text-font-weight").trim();
  const fontStyle = rootStyle.getPropertyValue("--text-font-style").trim();
  const fontSize = config.fontSizeRem * rem;

  settings = {
    fontSize,
    lineHeight: fontSize * 1.2 + config.rowGapRem * rem,
    wordGap: config.wordGapRem * rem,
    overflow: Math.max(0, config.overflowWords) * fontSize * 4,
    characterWidth: fontSize * 0.6,
    color: rootStyle.getPropertyValue("--text-color").trim(),
    canvasFont: `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
  };
  settingsSignature = getConfigSignature();
  layoutWords();
}

function getConfigSignature() {
  const config = window.SKETCH_CONFIG;
  const rootStyle = getComputedStyle(document.documentElement);
  return [
    config.fontSizeRem,
    config.wordGapRem,
    config.rowGapRem,
    config.overflowWords,
    config.overflowRows,
    config.scrambleIntervalMs,
    config.textOpacity,
    rootStyle.getPropertyValue("--text-font-family"),
    rootStyle.getPropertyValue("--text-font-weight"),
    rootStyle.getPropertyValue("--text-font-style"),
    rootStyle.getPropertyValue("--text-color")
  ].join("|");
}

function layoutWords() {
  words = [];
  lines = [];
  if (!dictionary.length || !settings) {
    return;
  }

  drawingContext.font = settings.canvasFont;
  const lineHeight = settings.lineHeight;
  const rowCount = Math.ceil(height / lineHeight) + window.SKETCH_CONFIG.overflowRows * 2;
  const firstBaseline = (height - (rowCount - 1) * lineHeight) / 2 + settings.fontSize;
  let wordIndex = 0;

  for (let row = 0; row < rowCount; row += 1) {
    const line = [];
    let lineWidth = 0;
    while (lineWidth < width + settings.overflow * 2) {
      const word = dictionary[wordIndex % dictionary.length].trim();
      const wordWidth = drawingContext.measureText(word).width;
      const boundedWidth = Math.ceil(wordWidth);
      line.push({
        text: word,
        width: boundedWidth,
        index: line.length,
        line,
        scrambledText: "",
        scrambledAt: -Infinity
      });
      lineWidth += boundedWidth + settings.wordGap;
      wordIndex += 1;
    }

    lineWidth -= settings.wordGap;
    let x = (width - lineWidth) / 2;
    const baseline = firstBaseline + row * lineHeight;
    for (const word of line) {
      word.x = x;
      word.y = baseline;
      words.push(word);
      x += word.width + settings.wordGap;
    }
    lines.push(line);
  }
}

function distanceToWord(x, y, word) {
  const left = Math.max(word.x - x, 0, x - (word.x + word.width));
  const top = Math.max(word.y - settings.fontSize - y, 0, y - (word.y + settings.fontSize * 0.2));
  return Math.hypot(left, top);
}

function scramble(word) {
  return Array.from(word, (character) => {
    if (Math.random() > window.SKETCH_CONFIG.scrambleChance) {
      return character;
    }
    const letters = window.SKETCH_CONFIG.scrambleCharacters;
    return letters.charAt(Math.floor(Math.random() * letters.length));
  }).join("");
}

function getScrambledWord(word) {
  const now = millis();
  if (now - word.scrambledAt >= window.SKETCH_CONFIG.scrambleIntervalMs) {
    word.scrambledText = scramble(word.text);
    word.scrambledAt = now;
  }
  return word.scrambledText;
}

function mousePressed() {
  if (phase !== "words") {
    return;
  }

  phase = "glitching";
  glitchStartedAt = performance.now();
  glitchQueueIndex = 0;
  glitchQueue = [];
  glitchingCharacters = [];
  drawingContext.font = settings.canvasFont;
  const lineOffsets = new Map();

  for (const word of words) {
    word.glitchCharacters = [];
    let prefix = "";

    Array.from(word.text).forEach((character) => {
      const characterStart = drawingContext.measureText(prefix).width;
      prefix += character;
      const characterEnd = drawingContext.measureText(prefix).width;
      const left = word.x + characterStart;
      const right = word.x + characterEnd;
      const metrics = drawingContext.measureText(character);
      const centerX = (left + right) / 2;
      const centerY = word.y + (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2;
      const glyph = {
        character,
        x: left,
        y: word.y,
        started: false,
        ended: false,
        nextFlicker: 0,
        symbol: character
      };
      word.glitchCharacters.push(glyph);

      if (right < 0 || left > width || centerY < 0 || centerY > height) {
        glyph.ended = true;
        return;
      }

      const lineKey = Math.round(word.y);
      if (!lineOffsets.has(lineKey)) {
        lineOffsets.set(lineKey, rand(0, LINE_JITTER));
      }
      glyph.start = Math.abs(centerY - mouseY) * LINE_DELAY +
        Math.abs(centerX - mouseX) * CHAR_DELAY +
        lineOffsets.get(lineKey) +
        rand(0, CHAR_JITTER);
      glyph.duration = rand(GLITCH_MIN, GLITCH_MAX);
      glitchQueue.push(glyph);
    });
  }

  glitchQueue.sort((first, second) => first.start - second.start);
  startIntroHandoff(glitchQueue, glitchStartedAt, mouseX, mouseY);
}

function drawGlitchAnimation() {
  drawingContext.font = settings.canvasFont;
  drawingContext.fillStyle = GLITCH_COLOR || settings.color;
  drawingContext.globalAlpha = window.SKETCH_CONFIG.textOpacity;
  drawingContext.textBaseline = "alphabetic";
  drawingContext.textAlign = "left";

  const elapsed = performance.now() - glitchStartedAt;
  while (glitchQueueIndex < glitchQueue.length && glitchQueue[glitchQueueIndex].start <= elapsed) {
    const glyph = glitchQueue[glitchQueueIndex];
    glyph.started = true;
    glyph.endsAt = elapsed + glyph.duration;
    glyph.nextFlicker = elapsed;
    glitchingCharacters.push(glyph);
    glitchQueueIndex += 1;
  }

  for (const word of words) {
    for (const glyph of word.glitchCharacters || []) {
      if (glyph.ended) {
        continue;
      }

      if (!glyph.started) {
        drawingContext.fillStyle = settings.color;
        drawingContext.fillText(glyph.character, glyph.x, glyph.y);
        continue;
      }

      if (elapsed >= glyph.endsAt) {
        glyph.ended = true;
        continue;
      }

      if (elapsed >= glyph.nextFlicker) {
        glyph.symbol = GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
        glyph.nextFlicker = elapsed + FLICKER_MS;
      }

      if (glyph.handoff) {
        continue;
      }

      drawingContext.fillStyle = GLITCH_COLOR || settings.color;
      drawingContext.fillText(glyph.symbol, glyph.x, glyph.y);
    }
  }

  if (glitchQueueIndex >= glitchQueue.length && glitchingCharacters.every((glyph) => glyph.ended)) {
    phase = "black";
    glitchQueue = [];
    glitchingCharacters = [];
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (phase === "words") {
    refreshSettings();
  }
}

// --- Glitch sobre texto del DOM (mismo efecto que el sketch) ---

function splitIntoGlyphs(root, initialState) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  const glyphs = [];
  for (const node of textNodes) {
    if (!node.textContent.trim()) {
      continue;
    }
    const fragment = document.createDocumentFragment();
    for (const part of node.textContent.split(/(\s+)/)) {
      if (!part) {
        continue;
      }
      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        continue;
      }
      for (const character of Array.from(part)) {
        const span = document.createElement("span");
        span.className = initialState ? `glitch-glyph ${initialState}` : "glitch-glyph";
        span.textContent = character;
        fragment.appendChild(span);
        glyphs.push({ el: span, character });
      }
    }
    node.replaceWith(fragment);
  }
  return glyphs;
}

function computeGlitchStart(centerX, centerY, lineKey, lineOffsets, originX, originY) {
  if (!lineOffsets.has(lineKey)) {
    lineOffsets.set(lineKey, rand(0, LINE_JITTER));
  }
  return Math.abs(centerY - originY) * LINE_DELAY +
    Math.abs(centerX - originX) * CHAR_DELAY +
    lineOffsets.get(lineKey) +
    rand(0, CHAR_JITTER);
}

// mode "in": el carácter aparece glitcheando y se fija en su letra.
// mode "out": el carácter glitchea y desaparece.
function runDomGlitch(glyphs, originX, originY, mode) {
  const lineOffsets = new Map();
  for (const glyph of glyphs) {
    const rect = glyph.el.getBoundingClientRect();
    glyph.start = computeGlitchStart(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      Math.round(rect.top),
      lineOffsets,
      originX,
      originY
    );
  }

  const firstStart = glyphs.reduce((min, glyph) => Math.min(min, glyph.start), Infinity);
  for (const glyph of glyphs) {
    glyph.start -= firstStart;
    glyph.end = glyph.start + rand(GLITCH_MIN, GLITCH_MAX);
  }
  return animateDomGlyphs(glyphs, mode, performance.now());
}

// Anima glifos del DOM con tiempos ya calculados (glyph.start / glyph.end, en ms desde startedAt).
function animateDomGlyphs(glyphs, mode, startedAt) {
  const queue = [...glyphs].sort((first, second) => first.start - second.start);

  return new Promise((resolve) => {
    if (!queue.length) {
      resolve();
      return;
    }

    let queueIndex = 0;
    let active = [];

    const step = () => {
      const elapsed = performance.now() - startedAt;

      while (queueIndex < queue.length && queue[queueIndex].start <= elapsed) {
        const glyph = queue[queueIndex];
        glyph.nextFlicker = elapsed;
        glyph.el.classList.remove("is-pending", "is-gone");
        glyph.el.classList.add("is-glitching");
        active.push(glyph);
        queueIndex += 1;
      }

      active = active.filter((glyph) => {
        if (elapsed >= glyph.end) {
          glyph.el.textContent = glyph.character;
          glyph.el.classList.remove("is-glitching");
          if (mode === "out") {
            glyph.el.classList.add("is-gone");
          }
          return false;
        }
        if (elapsed >= glyph.nextFlicker) {
          glyph.el.textContent = GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
          glyph.nextFlicker = elapsed + FLICKER_MS;
        }
        return true;
      });

      if (queueIndex >= queue.length && !active.length) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  });
}

// --- Flujo: sketch → texto de bienvenida → home ---

const sketchEl = document.getElementById("sketch");
const introSection = document.getElementById("intro-text");
const introCopy = introSection.querySelector(".intro-copy");
const introCta = introSection.querySelector(".intro-cta");
const homeEl = document.getElementById("home");

const introGlyphs = splitIntoGlyphs(introCopy, "is-pending");
const homeGlyphs = Array.from(homeEl.querySelectorAll("[data-glitch]"))
  .flatMap((element) => splitIntoGlyphs(element, "is-pending"));

// El texto del sketch se convierte en el texto de bienvenida: cada carácter nuevo
// arranca cuando arranca el último carácter del sketch que tiene debajo y se fija
// cuando todos esos terminaron. Lo que no queda bajo el texto se apaga a negro.
function startIntroHandoff(canvasGlyphs, startedAt, originX, originY) {
  if (introSection.classList.contains("is-visible")) {
    return;
  }

  introSection.classList.add("is-visible");
  introSection.removeAttribute("aria-hidden");
  sketchEl.style.cursor = "default";

  const fontSize = settings ? settings.fontSize : 16;
  const rows = new Map();
  for (const glyph of canvasGlyphs) {
    const key = Math.round(glyph.y);
    if (!rows.has(key)) {
      rows.set(key, []);
    }
    rows.get(key).push(glyph);
  }
  const rowEntries = [...rows.entries()];
  const lineOffsets = new Map();

  for (const glyph of introGlyphs) {
    const rect = glyph.el.getBoundingClientRect();
    let latest = null;
    let lastEnd = 0;

    for (const [baseline, row] of rowEntries) {
      const rowTop = baseline - fontSize * 0.8;
      const rowBottom = baseline + fontSize * 0.2;
      if (rowBottom < rect.top || rowTop > rect.bottom) {
        continue;
      }
      for (const canvasGlyph of row) {
        const right = canvasGlyph.x + fontSize * 0.6;
        if (right < rect.left || canvasGlyph.x > rect.right) {
          continue;
        }
        lastEnd = Math.max(lastEnd, canvasGlyph.start + canvasGlyph.duration);
        if (!latest || canvasGlyph.start > latest.start) {
          latest = canvasGlyph;
        }
      }
    }

    if (latest) {
      // Sin retraso, el carácter del sketch cede su lugar al nuevo; con retraso,
      // termina su glitch normal y el nuevo aparece después sobre negro.
      latest.handoff = INTRO_DELAY_MS <= 0;
      glyph.start = latest.start;
      // +1 cuadro de margen: el sketch fija su fin en el cuadro en que arranca cada glifo.
      glyph.end = Math.max(lastEnd + 34, glyph.start + rand(GLITCH_MIN, GLITCH_MAX));
    } else {
      glyph.start = computeGlitchStart(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        Math.round(rect.top),
        lineOffsets,
        originX,
        originY
      );
      glyph.end = glyph.start + rand(GLITCH_MIN, GLITCH_MAX);
    }
  }

  animateDomGlyphs(introGlyphs, "in", startedAt + Math.max(0, INTRO_DELAY_MS)).then(() => {
    introSection.classList.add("is-complete");
    introCta.removeAttribute("tabindex");
  });
}

function showHome() {
  sketchEl.hidden = true;
  homeEl.hidden = false;
  if (typeof noLoop === "function") {
    noLoop();
  }
}

let leavingIntro = false;

introCta.addEventListener("click", (event) => {
  event.preventDefault();
  if (leavingIntro) {
    return;
  }
  leavingIntro = true;

  // Con teclado no hay coordenadas: se usa el centro de la flecha.
  const ctaRect = introCta.getBoundingClientRect();
  const originX = event.clientX || ctaRect.left + ctaRect.width / 2;
  const originY = event.clientY || ctaRect.top + ctaRect.height / 2;

  introSection.classList.remove("is-complete");
  introCta.setAttribute("tabindex", "-1");
  introCta.blur();

  runDomGlitch(introGlyphs, originX, originY, "out").then(() => {
    showHome();
    history.replaceState(null, "", "#home");
    runDomGlitch(homeGlyphs, originX, originY, "in");
  });
});

// Volver al home desde otras páginas (index.html#home) salta la bienvenida.
if (location.hash === "#home") {
  phase = "done";
  for (const glyph of homeGlyphs) {
    glyph.el.classList.remove("is-pending");
  }
  showHome();
}
