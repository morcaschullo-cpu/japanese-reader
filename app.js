const input = document.getElementById("japaneseInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const readingArea = document.getElementById("readingArea");
const savedList = document.getElementById("savedUnits");
const clearBtn = document.getElementById("clearBtn");
const openRulesEditorBtn = document.getElementById("openRulesEditor");
let tokenizer = null;

/* =========================
   ABRIR EDITOR DE REGLAS
   ========================= */
openRulesEditorBtn.addEventListener("click", () => {
  rulesEditor.open();
});

/* =========================
   LIMPIAR INPUT
   ========================= */
clearBtn.addEventListener("click", () => {
  input.value = "";
  readingArea.innerHTML = "";
});

/* =========================
   INICIALIZAR KUROMOJI
   ========================= */
kuromoji.builder({ dicPath: "kuromoji/dict" }).build((err, tk) => {
  if (err) {
    alert("Error cargando kuromoji");
    console.error(err);
    return;
  }
  tokenizer = tk;
});

/* =========================
   RENDER GUARDADOS
   ========================= */
function renderSaved() {
  savedList.innerHTML = "";

  getSavedUnits().forEach((u, i) => {
    const li = document.createElement("li");
    li.className = "saved-item";

    const text = document.createElement("span");
    text.textContent = `${u.surface} ｜ ${u.context}`;

    /* 🔎 BOTÓN TEST */
    const testBtn = document.createElement("button");
    testBtn.textContent = "test";
    testBtn.className = "test-btn";

    testBtn.addEventListener("click", () => {
      if (!tokenizer) {
        alert("Tokenizer no listo");
        return;
      }

      const tokens = tokenizer.tokenize(u.context);
      const units = buildUnits(tokens);

      text.textContent = units.join(" | ");
    });

    /* ❌ BOTÓN BORRAR */
    const del = document.createElement("button");
    del.textContent = "✕";
    del.className = "delete-btn";

    del.addEventListener("click", () => {
      if (confirm("¿Borrar esta palabra?")) {
        deleteUnit(i);
        renderSaved();
      }
    });

    li.appendChild(text);
    li.appendChild(testBtn);
    li.appendChild(del);
    savedList.appendChild(li);
  });
}

/* =========================
   UNIR BLOQUES
   ========================= */
function mergeSelectedBlocks() {
  const selected = [...document.querySelectorAll(".block.selected")];
  if (selected.length < 2) return;

  selected.sort(
    (a, b) =>
      [...readingArea.children].indexOf(a) -
      [...readingArea.children].indexOf(b)
  );

  const merged = selected.map(e => e.textContent).join("");
  const span = document.createElement("span");
  span.className = "block selected";
  span.textContent = merged;

  selected[0].before(span);
  selected.forEach(e => e.remove());

  setupBlockInteractions(span);
}

/* =========================
   SEPARAR BLOQUE
   ========================= */
function splitBlock(span) {
  [...span.textContent].forEach(ch => {
    const s = document.createElement("span");
    s.className = "block";
    s.textContent = ch;
    setupBlockInteractions(s);
    span.before(s);
  });
  span.remove();
}

/* =========================
   MENÚ BLOQUES
   ========================= */
function showActionMenu(span) {
  const selected = document.querySelectorAll(".block.selected");

  let msg = `Acción para:\n「${span.textContent}」\n\n1 = Guardar`;
  if (selected.length > 1) msg += `\n2 = Unir`;
  if (selected.length === 1) msg += `\n3 = Separar`;

  const action = prompt(msg, "1");

  if (action === "1") {
    saveUnit(
      createUnit(
        span.textContent,
        input.value.trim(),
        span.className
      )
    );
    renderSaved();
  }
  if (action === "2" && selected.length > 1) mergeSelectedBlocks();
  if (action === "3" && selected.length === 1) splitBlock(span);
}

/* =========================
   INTERACCIONES BLOQUES
   ========================= */
function setupBlockInteractions(span) {
  let blockTimer = null;

  span.addEventListener("click", () => {
    span.classList.toggle("selected");
  });

  span.addEventListener("touchstart", () => {
    blockTimer = setTimeout(() => {
      showActionMenu(span);
    }, 500);
  });

  span.addEventListener("touchend", () => {
    clearTimeout(blockTimer);
    blockTimer = null;
  });

  span.addEventListener("touchmove", () => {
    clearTimeout(blockTimer);
    blockTimer = null;
  });
}

/* =========================
   ANALIZAR TEXTO
   ========================= */
analyzeBtn.addEventListener("click", () => {
  if (!tokenizer) {
    alert("Kuromoji aún no está listo");
    return;
  }

  readingArea.innerHTML = "";
  const text = input.value.trim();
  if (!text) return;

  const tokens = tokenizer.tokenize(text);
  const units = buildUnits(tokens);

  units.forEach((u, i) => {

    // 🧠 Salto visual tras cierre fuerte
if (i > 0 && units[i - 1].endsWith("。")) {
  const br = document.createElement("br");
  readingArea.appendChild(br);
}
const span = document.createElement("span");
    span.className = "block";

    const innerTokens = tokenizer.tokenize(u);

    let hasParticle = false;
    let hasAdverb = false;
    let hasAux = false;
    let hasFinal = false;
    let hasEllipsis = false;

    innerTokens.forEach(t => {
      if (t.pos === "助詞") hasParticle = true;
      if (t.pos === "副詞") hasAdverb = true;
      if (t.pos === "助動詞") hasAux = true;
      if (["な", "か", "～"].includes(t.surface_form)) hasFinal = true;
      if (["…", "・"].includes(t.surface_form)) hasEllipsis = true;
    });

    if (hasEllipsis) span.classList.add("ellipsis");
    else if (hasFinal) span.classList.add("final");
    else if (hasAux) span.classList.add("aux");
    else if (hasAdverb) span.classList.add("adverb");
    else if (hasParticle) span.classList.add("particle");

    span.textContent = u;
    setupBlockInteractions(span);
    readingArea.appendChild(span);
  });
});

/* =========================
   INIT
   ========================= */
renderSaved();
