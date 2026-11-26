// Botón "X" pixelada para cerrar cards (casos y tecnologías).
// Se coloca en el .case-item (no en la figure con scroll) para quedar fijo arriba a la derecha.
const PIXEL_X = [
  "X.....X",
  ".X...X.",
  "..X.X..",
  "...X...",
  "..X.X..",
  ".X...X.",
  "X.....X"
];

function createCardCloseButton(label, onClose) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-close";
  button.setAttribute("aria-label", label);

  const rects = PIXEL_X.flatMap((row, y) => Array.from(row).map((cell, x) =>
    cell === "X" ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ""
  )).join("");
  button.innerHTML = `<svg viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClose();
  });
  return button;
}
