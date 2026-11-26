const grid = document.querySelector("#case-grid");
const status = document.querySelector("#technology-status");
const gsap = window.gsap;
let activeItem = null;
let activeTransition = null;
let masonry;

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function parseTechnologies(markdown) {
  const sections = markdown.split(/^(?=\*\*[^*].+\*\*$)/m).filter((section) => section.trim());

  return sections.map((section) => {
    const lines = section.trim().split(/\r?\n/);
    const title = lines.shift().match(/^\*\*(.+)\*\*$/)?.[1];
    if (!title) {
      throw new Error("Se encontró una sección sin título de tecnología.");
    }

    const metadata = [];
    const paragraphs = [];
    let paragraphLines = [];

    function finishParagraph() {
      if (paragraphLines.length) {
        paragraphs.push(paragraphLines.join(" ").trim());
        paragraphLines = [];
      }
    }

    for (const line of lines) {
      const metadataMatch = line.match(/^- \*\*(.+?):\*\* (.+)$/);
      if (metadataMatch) {
        finishParagraph();
        metadata.push(metadataMatch.slice(1));
      } else if (line.trim()) {
        paragraphLines.push(line.trim());
      } else {
        finishParagraph();
      }
    }
    finishParagraph();

    return { title, metadata, paragraphs };
  });
}

function createTechnologyCard(technology) {
  const item = document.createElement("article");
  const figure = document.createElement("figure");
  const button = document.createElement("button");
  const name = document.createElement("span");
  const details = document.createElement("figcaption");
  const heading = document.createElement("h2");
  const metadata = document.createElement("ul");

  item.className = "case-item technology-item";
  figure.className = "technology-figure";
  button.className = "case-toggle";
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", `Mostrar información: ${technology.title}`);
  name.className = "case-name";
  name.textContent = technology.title;
  button.append(name);

  details.className = "case-details";
  details.hidden = true;
  heading.textContent = technology.title;
  metadata.className = "case-metadata";

  for (const [label, value] of technology.metadata) {
    const entry = document.createElement("li");
    entry.innerHTML = `<strong>${formatInlineMarkdown(label)}:</strong> ${formatInlineMarkdown(value)}`;
    metadata.append(entry);
  }

  details.append(heading);
  if (technology.metadata.length) {
    details.append(metadata);
  }
  for (const paragraph of technology.paragraphs) {
    const description = document.createElement("p");
    description.innerHTML = formatInlineMarkdown(paragraph);
    details.append(description);
  }

  figure.append(button, details);
  item.append(figure, createCardCloseButton(`Cerrar información: ${technology.title}`, () => {
    if (activeItem === item) {
      toggleTechnology(item);
    }
  }));
  button.addEventListener("click", () => toggleTechnology(item));
  return item;
}

function layoutMasonry() {
  requestAnimationFrame(() => masonry?.layout());
}

function toggleTechnology(selectedItem) {
  const previousItem = activeItem;
  activeItem = selectedItem === previousItem ? null : selectedItem;
  activeTransition?.kill();
  activeTransition = null;

  if (previousItem) {
    previousItem.classList.remove("is-active");
    previousItem.querySelector(".case-toggle").setAttribute("aria-expanded", "false");
    previousItem.querySelector(".case-details").hidden = true;
  }

  if (activeItem) {
    activeItem.classList.add("is-active");
    activeItem.querySelector(".case-toggle").setAttribute("aria-expanded", "true");
    activeItem.querySelector(".case-details").hidden = false;
    activeItem.querySelector(".card-close").focus();
  } else if (previousItem) {
    previousItem.querySelector(".case-toggle").focus();
  }

  if (!gsap) {
    layoutMasonry();
    return;
  }

  const items = [...new Set([previousItem, activeItem].filter(Boolean))];
  const widths = items.map((item) => item.getBoundingClientRect().width);
  const targetWidths = items.map((item) => getComputedStyle(item).width);
  gsap.set(items, { width: (index) => `${widths[index]}px` });
  activeTransition = gsap.to(items, {
    width: (index) => targetWidths[index],
    duration: 0.45,
    ease: "power2.inOut",
    onUpdate: () => masonry?.layout(),
    onComplete: () => {
      gsap.set(items, { clearProps: "width" });
      activeTransition = null;
      masonry?.layout();
    }
  });
}

async function loadTechnologies() {
  try {
    const response = await fetch("./tecnologias.md");
    if (!response.ok) {
      throw new Error(`No se pudo leer tecnologias.md (HTTP ${response.status}).`);
    }

    const technologies = parseTechnologies(await response.text());
    if (!technologies.length) {
      throw new Error("tecnologias.md no contiene tecnologías.");
    }

    for (const technology of technologies) {
      grid.append(createTechnologyCard(technology));
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
      console.error("No se pudo cargar Masonry; las tecnologías se mostrarán sin el reacomodo masonry.");
    }

    status.textContent = "";
    grid.setAttribute("aria-busy", "false");
  } catch (error) {
    console.error("No se pudieron cargar las tecnologías.", error);
    status.textContent = "No se pudieron cargar las tecnologías. Abre esta página desde el servidor del sitio e inténtalo de nuevo.";
    grid.setAttribute("aria-busy", "false");
  }
}

loadTechnologies();

window.addEventListener("resize", () => {
  activeTransition?.kill();
  activeTransition = null;
  if (activeItem) {
    gsap?.set(activeItem, { clearProps: "width" });
  }
  layoutMasonry();
});
