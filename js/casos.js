const caseImages = [
  ["2026", "Artmeladze-Mamuka.gif"],
  ["2026", "Cabrera-Clemente-Alejandro.gif"],
  ["2026", "Carbonell-Betancourt-Aled_Damien.gif"],
  ["2026", "Gonzalez-Adan-Denny.gif"],
  ["2026", "Gutierrez-Reyes-Alberto.gif"],
  ["2026", "La-Parady.gif"],
  ["2026", "Lopez-Cornejo-Edwin.gif"],
  ["2026", "Lunas-Campos-Geraldo.gif"],
  ["2026", "Marchena-Carlos-Josue.gif"],
  ["2026", "Nunez-Caceres-Luis-Gustavo.gif"],
  ["2026", "Paktyawal-Nazeer-Mohammad.gif"],
  ["2026", "Perez-Jimenez-Royer.gif"],
  ["2026", "Ramos-Solano-Jose-Guadalupe.gif"],
  ["2026", "Rodriguez-Alacorta_Felix.gif"],
  ["2026", "Sanchez-Dominguez-Herber.gif"],
  ["2026", "Sim-Lorth.gif"],
  ["2026", "Trejo-Ricano-Prisciliano.gif"],
  ["2026", "Van-Bui-Tuan.gif"],
  ["2026", "Yanez-Cruz-Beltran-Luis.gif"],
  ["2025", "Avelleneda-Delgado-Abelardo.gif"],
  ["2025", "Ayala-Uribe-Ismael.gif"],
  ["2025", "Batrez-Vargas-Lorenzo-Antonio.gif"],
  ["2025", "Blaise-Marie-Ange.gif"],
  ["2025", "Chernyak-Maksym.gif"],
  ["2025", "Cruz-SIlva-Leo.gif"],
  ["2025", "Garcia-Hernandez-Miguel-Angel.gif"],
  ["2025", "Ge-Chaofeng.gif"],
  ["2025", "Gezahegn_Dejene_Serawit.gif"],
  ["2025", "Guzman-Fuentes-Norlan.gif"],
  ["2025", "Mohd-Sale-Hasan-Ali.gif"],
  ["2025", "Molina-Veya-Jesus.gif"],
  ["2025", "Nguyen-Nhon-Ngoc.gif"],
  ["2025", "Perez-Isidro.gif"],
  ["2025", "Rayo-Garzon-Brayan.gif"],
  ["2025", "Reyes-Banegas-Santos.gif"],
  ["2025", "Rodriguez-Delvin.gif"],
  ["2025", "Tineo-Martinez-Juan-Alexis.gif"],
  ["2025", "fouad_saeed.gif"],
  ["2025", "francisco_gaspar.gif"],
  ["2025", "jean_wilson.gif"],
  ["2025", "pete_sumalo.gif"]
];

const caseImageOverrides = new Map([
  ["2026/Carlos Josue Marchena-Marchena", "Marchena-Carlos-Josue.gif"]
]);

const grid = document.querySelector("#case-grid");
let activeItem = null;
let masonry;
let activeTransition = null;
let transitioningItems = [];
let transitioningElements = [];
const gsap = window.gsap;

if (typeof gsap !== "object") {
  console.error("No se pudo cargar GSAP; los casos cambiarán de estado sin animación.");
}

function getTokens(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

function createMetadata(record) {
  const details = document.createElement("div");
  details.className = "case-details";
  details.hidden = true;

  const heading = document.createElement("h2");
  heading.textContent = record?.name || "Información del caso";
  details.append(heading);

  if (record && Object.keys(record.metadata).length) {
    const list = document.createElement("dl");
    for (const [label, value] of Object.entries(record.metadata)) {
      const entry = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = `${label}:`;
      description.textContent = value;
      entry.append(term, description);
      list.append(entry);
    }
    details.append(list);
  }

  const summary = document.createElement("p");
  summary.textContent = record?.description || "No hay una ficha detallada disponible para este caso.";
  details.append(summary);
  return details;
}

function createCaseCard(record, imageMatch) {
  const imagePath = imageMatch
    ? `./img/casos-${imageMatch[0]}/${imageMatch[1]}`
    : "./img/jon-doe.gif";
  const item = document.createElement("article");
  item.className = "case-item";
  item.dataset.image = imagePath;
  item.dataset.generic = String(!imageMatch);

  const button = document.createElement("button");
  button.className = "case-toggle";
  button.type = "button";
  button.setAttribute("aria-expanded", "false");

  const image = document.createElement("img");
  image.src = imagePath;
  image.alt = `Retrato de ${record.name}`;
  image.loading = "lazy";

  const name = document.createElement("span");
  name.className = "case-name";
  name.textContent = record.name;
  button.setAttribute("aria-label", `Mostrar caso: ${name.textContent}`);
  button.append(image, name);

  item.append(button, createMetadata(record));
  button.addEventListener("click", () => toggleCase(item));
  grid.append(item);
  return item;
}

function toggleCase(selectedItem) {
  const previousItem = activeItem;
  const nextItem = selectedItem === previousItem ? null : selectedItem;
  const items = [...new Set([...transitioningItems, previousItem, selectedItem].filter(Boolean))];
  const elements = items.flatMap((item) => [item, item.querySelector(".case-toggle")]);
  const startingWidths = new Map(
    elements.map((element) => [element, element.getBoundingClientRect().width])
  );

  activeTransition?.kill();
  activeTransition = null;
  gsap?.set(elements, { clearProps: "width" });

  if (activeItem) {
    activeItem.classList.remove("is-active");
    activeItem.querySelector(".case-toggle").setAttribute("aria-expanded", "false");
    activeItem.querySelector(".case-details").hidden = true;
  }

  activeItem = nextItem;
  if (activeItem) {
    activeItem.classList.add("is-active");
    activeItem.querySelector(".case-toggle").setAttribute("aria-expanded", "true");
    activeItem.querySelector(".case-details").hidden = false;
  }

  if (!gsap || !items.length) {
    layoutMasonry();
    if (activeItem) {
      // activeItem.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  const targetWidths = elements.map((element) => getComputedStyle(element).width);
  gsap.set(elements, {
    width: (index) => `${startingWidths.get(elements[index])}px`
  });
  transitioningItems = items;
  transitioningElements = elements;
  activeTransition = gsap.timeline({
    onUpdate: layoutMasonryNow,
    onComplete: () => {
      gsap.set(elements, { clearProps: "width" });
      transitioningItems = [];
      transitioningElements = [];
      activeTransition = null;
      layoutMasonryNow();
      if (activeItem === selectedItem) {
        // selectedItem.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  });
  activeTransition.to(elements, {
    width: (index) => targetWidths[index],
    duration: 0.45,
    ease: "power2.inOut"
  }, 0);
}

function layoutMasonry() {
  requestAnimationFrame(() => masonry?.layout());
}

function layoutMasonryNow() {
  masonry?.layout();
}

function parseCaseRecords(contents) {
  const records = [];
  const sections = contents.split(/^#\s+/m).slice(1);

  for (const section of sections) {
    const year = section.match(/^(\d{4})/)?.[1] || "";
    const body = section.replace(/^\d{4}\s*/, "");
    const headings = [...body.matchAll(/^\*\*([^*\n]+)\*\*\s*$/gm)];

    headings.forEach((heading, index) => {
      const end = headings[index + 1]?.index ?? body.length;
      const block = body.slice(heading.index, end).replace(/^\*\*[^*\n]+\*\*\s*/, "");
      const metadata = {};
      const metadataPattern = /^\s*-\s*\*\*([^*]+):\*\*\s*(.+)\s*$/gm;
      let metadataMatch;
      while ((metadataMatch = metadataPattern.exec(block))) {
        metadata[metadataMatch[1].trim()] = metadataMatch[2].trim();
      }

      const description = block.replace(metadataPattern, "").trim();
      records.push({ name: heading[1].trim(), year, metadata, description });
    });
  }

  return records;
}

function matchImage(record, assignedImages) {
  const override = caseImageOverrides.get(`${record.year}/${record.name}`);
  if (override && caseImages.some(([year, filename]) =>
    year === record.year &&
    filename === override &&
    !assignedImages.has(`${year}/${filename}`)
  )) {
    return [record.year, override];
  }

  const recordTokens = new Set(getTokens(record.name));
  let bestImage = null;
  let bestScore = 0;
  let hasTie = false;

  for (const [year, filename] of caseImages) {
    const imageKey = `${year}/${filename}`;
    if (year !== record.year || assignedImages.has(imageKey)) {
      continue;
    }

    const sharedTokens = getTokens(filename.replace(/\.gif$/i, ""))
      .filter((token) => recordTokens.has(token)).length;
    if (sharedTokens > bestScore) {
      bestImage = [year, filename];
      bestScore = sharedTokens;
      hasTie = false;
    } else if (sharedTokens > 0 && sharedTokens === bestScore) {
      hasTie = true;
    }
  }

  return bestScore >= 2 && !hasTie ? bestImage : null;
}

function shuffle(items) {
  const shuffledItems = [...items];
  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledItems[index], shuffledItems[swapIndex]] = [
      shuffledItems[swapIndex],
      shuffledItems[index]
    ];
  }
  return shuffledItems;
}

function randomizeCaseOrder(matchedRecords, fallbackRecords) {
  const shuffledMatched = shuffle(matchedRecords);
  const shuffledFallbacks = shuffle(fallbackRecords);
  const gapCount = shuffledMatched.length + 1;
  const fallbacksPerGap = Math.floor(shuffledFallbacks.length / gapCount);
  const extraFallbacks = shuffledFallbacks.length % gapCount;
  const gapSizes = Array(gapCount).fill(fallbacksPerGap);

  for (const gapIndex of shuffle(Array.from({ length: gapCount }, (_, index) => index))
    .slice(0, extraFallbacks)) {
    gapSizes[gapIndex] += 1;
  }

  const orderedRecords = [];
  let fallbackIndex = 0;
  for (let gapIndex = 0; gapIndex < gapCount; gapIndex += 1) {
    for (let count = 0; count < gapSizes[gapIndex]; count += 1) {
      orderedRecords.push(shuffledFallbacks[fallbackIndex]);
      fallbackIndex += 1;
    }
    if (gapIndex < shuffledMatched.length) {
      orderedRecords.push(shuffledMatched[gapIndex]);
    }
  }
  return orderedRecords;
}

function fillCaseRecords(records) {
  const assignedImages = new Set();
  const matchedRecords = [];
  const fallbackRecords = [];

  for (const record of records) {
    const imageMatch = matchImage(record, assignedImages);
    if (imageMatch) {
      assignedImages.add(`${imageMatch[0]}/${imageMatch[1]}`);
      matchedRecords.push([record, imageMatch]);
    } else {
      fallbackRecords.push([record, null]);
    }
  }

  const orderedRecords = randomizeCaseOrder(matchedRecords, fallbackRecords);
  orderedRecords.forEach((record) => createCaseCard(...record));
  masonry?.reloadItems();
  layoutMasonry();
}

if (typeof window.Masonry === "function") {
  masonry = new window.Masonry(grid, {
    itemSelector: ".case-item",
    columnWidth: ".grid-sizer",
    percentPosition: true,
    horizontalOrder: true,
    transitionDuration: "0s"
  });
} else {
  console.error("No se pudo cargar Masonry; los casos se mostrarán sin el reacomodo masonry.");
}

window.addEventListener("resize", () => {
  activeTransition?.kill();
  activeTransition = null;
  if (transitioningElements.length) {
    gsap?.set(transitioningElements, { clearProps: "width" });
    transitioningItems = [];
    transitioningElements = [];
  }
  layoutMasonry();
});

fetch("./casos.md")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`No se pudo cargar casos.md (${response.status}).`);
    }
    return response.text();
  })
  .then(parseCaseRecords)
  .then(fillCaseRecords)
  .catch((error) => {
    console.error("No se pudieron cargar las fichas de casos:", error);
  });
