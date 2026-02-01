function buildUnits(tokens) {
  const units = [];
  let buffer = "";

  const flush = () => {
    if (buffer) {
      units.push(buffer);
      buffer = "";
    }
  };

  const isAdverbBlock = surf =>
    [
      "やっと","もしかして","あえて","全然","まったく",
      "ゆっくり","大分","今まで","最近","ここしばらく",
      "とても","せっかく","まあ","いや","えっと"
    ].includes(surf);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const surf = t.surface_form;
    const next = tokens[i + 1];
    const prev = tokens[i - 1];

    /* =================================================
       IGNORAR ESPACIOS / SALTOS DE LÍNEA
       ================================================= */
    if (/^\s+$/.test(surf)) {
      flush();
      continue;
    }

    /* =================================================
       MARCOS TEMPORALES CLAVE (léxicos)
       ================================================= */
    if (["今まで","最近","ここしばらく"].includes(surf)) {
      flush();
      units.push(surf);
      continue;
    }

/* =================================================
   PRIORIDAD ABSOLUTA: 大分 (bloque propio)
   ================================================= */
if (surf === "大分") {
  flush();
  units.push(surf);
  continue;
}
    /* =================================================
   CORTE LIMPIO: 大分 | お疲れ
   ================================================= */
if (surf === "お疲れ" && buffer) {
  flush();
}

/* =================================================
       🔥 PRIORIDAD ABSOLUTA: お疲れ  ← NUEVO (CLAVE)
       ================================================= */
    if (surf === "お疲れ") {
      flush();
      units.push(surf);
      continue;
    }

    /* =================================================
       🔴 PRIORIDAD ABSOLUTA: ちょっと + verbo
       ================================================= */
    if (surf === "ちょっと" && next?.pos === "動詞") {
      flush();
      buffer += surf;
      continue;
    }

    /* =================================================
       ちょっと DISCURSIVO
       ================================================= */
    if (surf === "ちょっと" && next?.pos !== "動詞") {
      flush();
      units.push("ちょっと");
      continue;
    }

    /* =================================================
       CONDICIONALES → bloque cerrado
       ================================================= */
    if (["ば","たら","なら"].includes(surf) && prev?.pos === "動詞") {
      buffer += surf;
      flush();
      continue;
    }

    /* =================================================
       CIRCUNSTANCIA 〜で
       ================================================= */
    if (
      surf === "で" &&
      (next?.pos === "名詞" ||
        (next?.pos === "接頭詞" && tokens[i + 2]?.pos === "名詞"))
    ) {
      buffer += surf;
      flush();
      continue;
    }

    /* =================================================
       MODIFICADOR LARGO: Nを Vた
       ================================================= */
    if (
      surf === "を" &&
      next?.pos === "動詞" &&
      tokens[i + 2]?.surface_form === "た"
    ) {
      buffer += surf;
      continue;
    }

    /* =================================================
       PARTÍCULAS COMPUESTAS
       ================================================= */
    if (surf === "に" && next?.surface_form === "は") {
      buffer += "には";
      i++;
      flush();
      continue;
    }

    if (surf === "で" && next?.surface_form === "は") {
      buffer += "では";
      i++;
      flush();
      continue;
    }

    /* =================================================
       EXPRESIÓN FIJA: さすがに
       ================================================= */
    if (surf === "さすが" && next?.surface_form === "に") {
      flush();
      buffer += "さすがに";
      i++;
      flush();
      continue;
    }

    /* =================================================
       VALORATIVO: 特製の
       ================================================= */
    if (surf === "特製" && next?.surface_form === "の") {
      flush();
      buffer += "特製の";
      i++;
      flush();
      continue;
    }

    /* =================================================
       INTERJECCIÓN + PAUSA (うーん……)
       ================================================= */
    if (t.pos === "副詞" && buffer && /[・…]+$/.test(buffer)) {
      flush();
      buffer += surf;
      flush();
      continue;
    }

    /* =================================================
       UNIR INTERJECCIONES TÍPICAS (え + いっ → えいっ)
       ================================================= */
    if (surf === "え" && next &&
        (next.surface_form === "いっ" || next.surface_form === "い")) {
      flush();
      buffer += surf + next.surface_form;
      i++;
      flush();
      continue;
    }

    /* =================================================
       INTERJECCIONES INDEPENDIENTES (fallback)
       ================================================= */
    if (t.pos === "感動詞") {
      flush();
      units.push(surf);
      continue;
    }

    /* =================================================
       ADVERBIOS DISCURSIVOS (bloque propio)
       ================================================= */
    if (t.pos === "副詞" && isAdverbBlock(surf)) {
      flush();
      units.push(surf);
      continue;
    }

    /* =================================================
       PREFIJOS HONORÍFICOS
       ================================================= */
    if (t.pos === "接頭詞" && next?.pos === "名詞") {
      buffer += surf;
      continue;
    }

    /* =================================================
       PAUSAS
       ================================================= */
    if (surf === "、") {
      if (buffer === "" && units.length > 0) {
        units[units.length - 1] += "、";
      } else {
        buffer += "、";
      }
      flush();
      continue;
    }

    /* =================================================
       CIERRE FUERTE
       ================================================= */
    if (["。","！","？"].includes(surf)) {
      buffer += surf;
      flush();
      continue;
    }

    /* =================================================
       ACCIÓN PREPARATORIA: Nを + Vて
       ================================================= */
    if (
      surf === "を" &&
      next?.pos === "動詞" &&
      tokens[i + 2]?.surface_form === "て"
    ) {
      buffer += surf;
      continue;
    }

    /* =================================================
       PARTÍCULAS BÁSICAS
       ================================================= */
    if (["も","が","を","に","は"].includes(surf)) {
      buffer += surf;
      flush();
      continue;
    }

    /* =================================================
       〜って
       ================================================= */
    if (surf === "って") {
      buffer += surf;
      flush();
      continue;
    }

    /* =================================================
       じゃないですか～
       ================================================= */
    if (surf === "じゃ") {
      flush();
      buffer += surf;
      continue;
    }
    if (surf === "ない" && buffer === "じゃ") {
      buffer += surf;
      continue;
    }
    if (surf === "です" && buffer === "じゃない") {
      buffer += surf;
      continue;
    }
    if (surf === "か" && buffer === "じゃないです") {
      buffer += surf;
      continue;
    }
    if (surf === "～" && buffer === "じゃないですか") {
      buffer += surf;
      flush();
      continue;
    }

    /* =================================================
       そんなわけ + verbo
       ================================================= */
    if (buffer === "そんなわけ" && t.pos === "動詞") {
      flush();
      buffer += surf;
      continue;
    }

/* =================================================
   CORTE LIMPIO ANTES DE みたいですね
   ================================================= */
if (surf === "みたい" && buffer) {
  flush();
}

    /* =================================================
       みたいですね
       ================================================= */
    if (surf === "みたい") {
      buffer += surf;
      continue;
    }
    if (surf === "です" && buffer === "みたい") {
      buffer += surf;
      continue;
    }
    if (surf === "ね" && buffer === "みたいです") {
      buffer += surf;
      flush();
      continue;
    }

    /* =================================================
       CONTENIDO NORMAL
       ================================================= */
    buffer += surf;
  }

  flush();
  return units;
}