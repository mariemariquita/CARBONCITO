const WAVE_THRESH = 1; // Grosor del borde delantero de la onda, en caracteres.
const CHAR_MULT = 1; // Distancia que avanza la onda en cada paso, en caracteres.
const ANIM_STEP = 60; // Intervalo entre pasos en ms; aumentarlo ralentiza la onda.
const WAVE_BUF = 1; // Estela detras del borde delantero, en caracteres.
const CHAR_DELAY = 1.2;
const LINE_DELAY = 2.5;
const CHAR_JITTER = 1000;
const LINE_JITTER = 600;
const GLITCH_MIN = 120;
const GLITCH_MAX = 450;
const FLICKER_MS = 70;
const GLITCH_COLOR = "#ffffff";
const GLYPHS = "0123456789ABCDEF:.=*+-<>¦╌";


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
    if (waves.length) {
      drawWaveWord(word, now);
    } else {
      drawingContext.fillText(word.text, word.x, word.y, word.width);
    }
  }
}

function drawWaveWord(word, now) {
  const originalCharacters = Array.from(word.text);
  const scrambledCharacters = Array.from(getScrambledWord(word));

  for (let index = 0; index < word.characters.length; index += 1) {
    const position = word.characters[index];
    const isInWave = waves.some((wave) => {
      const radius = Math.floor((now - wave.startedAt) / ANIM_STEP) *
        CHAR_MULT * settings.characterWidth;
      const distance = Math.hypot(position.centerX - wave.originX, position.centerY - wave.originY);
      return distance >= Math.max(0, radius - WAVE_BUF * settings.characterWidth) &&
        distance <= radius + WAVE_THRESH * settings.characterWidth;
    });
    const character = isInWave ? scrambledCharacters[index] : originalCharacters[index];
    drawingContext.globalAlpha = character === originalCharacters[index]
      ? window.SKETCH_CONFIG.textOpacity
      : 1;
    drawingContext.fillText(character, position.x, word.y);
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
    const maxWaveDistance = Math.hypot(
      Math.max(mouseX, width - mouseX),
      Math.max(mouseY, height - mouseY)
    );
    const maxWaveCharacters = maxWaveDistance / (CHAR_MULT * settings.characterWidth);
    const duration = Math.ceil(maxWaveCharacters) * ANIM_STEP;
    waves.push({ originX: mouseX, originY: mouseY, startedAt: millis(), duration });
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
        characters: [],
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
      let prefix = "";
      word.characters = Array.from(word.text, (character) => {
        const characterX = word.x + drawingContext.measureText(prefix).width;
        prefix += character;
        const metrics = drawingContext.measureText(character);
        return {
          x: characterX,
          centerX: characterX + metrics.width / 2,
          centerY: word.y + (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2
        };
      });
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