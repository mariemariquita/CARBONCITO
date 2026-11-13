const grid = document.querySelector("#case-grid");
const gsap = window.gsap;
let activeItem = null;
let activeTransition = null;
let transitioningItems = [];
let transitioningElements = [];
let masonry;

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

function randomizeInitialOrder(items) {
  const matchedItems = shuffle(items.filter((item) => item.dataset.generic !== "true"));
  const genericItems = shuffle(items.filter((item) => item.dataset.generic === "true"));
  const gapCount = matchedItems.length + 1;
  const genericsPerGap = Math.floor(genericItems.length / gapCount);
  const extraGenerics = genericItems.length % gapCount;
  const gapSizes = Array(gapCount).fill(genericsPerGap);

  for (const gapIndex of shuffle(Array.from({ length: gapCount }, (_, index) => index))
    .slice(0, extraGenerics)) {
    gapSizes[gapIndex] += 1;
  }

  const orderedItems = [];
  let genericIndex = 0;
  for (let gapIndex = 0; gapIndex < gapCount; gapIndex += 1) {
    for (let count = 0; count < gapSizes[gapIndex]; count += 1) {
      orderedItems.push(genericItems[genericIndex]);
      genericIndex += 1;
    }
    if (gapIndex < matchedItems.length) {
      orderedItems.push(matchedItems[gapIndex]);
    }
  }
  return orderedItems;
}

function prepareCaseCard(item) {
  const figure = item.querySelector("figure");
  const image = figure.querySelector("img");
  const caption = figure.querySelector("figcaption");
  const title = caption.querySelector("h2");
  const button = document.createElement("button");
  const name = document.createElement("span");

  item.dataset.generic = String(image.getAttribute("src").includes("/jon-doe.gif"));
  item.dataset.image = image.getAttribute("src");
  button.className = "case-toggle";
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", `Mostrar caso: ${title.textContent.trim()}`);
  name.className = "case-name";
  name.textContent = title.textContent.trim();
  button.append(image, name);
  figure.insertBefore(button, caption);

  caption.classList.add("case-details");
  caption.hidden = true;
  button.addEventListener("click", () => toggleCase(item));
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

  if (previousItem) {
    previousItem.classList.remove("is-active");
    previousItem.querySelector(".case-toggle").setAttribute("aria-expanded", "false");
    previousItem.querySelector(".case-details").hidden = true;
  }

  activeItem = nextItem;
  if (activeItem) {
    activeItem.classList.add("is-active");
    activeItem.querySelector(".case-toggle").setAttribute("aria-expanded", "true");
    activeItem.querySelector(".case-details").hidden = false;
  }

  if (!gsap || !items.length) {
    layoutMasonry();
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

for (const item of grid.querySelectorAll(".case-item")) {
  prepareCaseCard(item);
}

for (const item of randomizeInitialOrder([...grid.querySelectorAll(".case-item")])) {
  grid.append(item);
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

if (typeof gsap !== "object") {
  console.error("No se pudo cargar GSAP; los casos cambiarán de estado sin animación.");
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
