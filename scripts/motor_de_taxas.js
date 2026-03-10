const item = $json;

/**
 * ==========================================================
 * MOTOR DE TAXAS — Atualizado
 * - Considera banco escolhido (Caixa/Inter/Bradesco/Itaú/Santander)
 * - Caixa: aplica MCMV (Faixas 1–4) 
 * - Se não for elegível MCMV (renda/limite imóvel/modalidade), cai para SBPE (Caixa)
 * - Passa adiante sistema amortizador (SAC/PRICE)
 * ==========================================================
 */

/** =========================
 *  CONFIG
 * ========================= */
const CONFIG = {
  // Taxas FIXAS (fora MCMV) — ajuste se quiser
  TAXAS_FIXAS_AA: {
    INTER: 0.0865,       // 8,65% a.a
    BRADESCO: 0.1090,    // 10,90% a.a (exemplo que você já usou no print)
    ITAU: 0.1154,        // 11,54% a.a
    SANTANDER: 0.1244,   // 12,44% a.a
    CAIXA_SBPE: 0.1149,  // 11,49% a.a (sua anotação de SBPE)
  },

  // Estados (para escolher taxa menor/maior quando houver 2 taxas na faixa)
  // Regra prática: Norte+Nordeste = taxa menor; demais = taxa maior
  UFS_NORTE_NORDESTE: new Set([
    "AC","AL","AP","AM","BA","CE","MA","PA","PB","PE","PI","RN","RO","RR","SE","TO"
  ]),

  // MCMV (conforme sua imagem)
  // Onde houver 2 juros, usamos:
  // - UFs Norte/Nordeste => taxaMin
  // - demais => taxaMax
  MCMV: {
    // Faixa 1: até 3.200,00 — juros 4,25% e 4,59%
    F1: {
      rendaMin: 0,
      rendaMax: 3200.0,
      taxaMin: 0.0425,
      taxaMax: 0.0459,
      novo: { ltv: 0.80, valorMaxImovel: 264000.0 },
      usado:{ ltv: 0.80, valorMaxImovel: 270000.0 },
    },

    // Faixa 2: 3.200,01 até 5.000,00 — juros 5,12% e 6,70%
    F2: {
      rendaMin: 3200.01,
      rendaMax: 5000.0,
      taxaMin: 0.0512,
      taxaMax: 0.0670,
      novo: { ltv: 0.80, valorMaxImovel: 264000.0 },
      usado:{ ltv: 0.80, valorMaxImovel: 270000.0 },
    },

    // Faixa 3: 5.000,01 até 8.600,00 — juros 7,93%
    F3: {
      rendaMin: 5000.01,
      rendaMax: 8600.0,
      taxa: 0.0793,
      novo: { ltv: 0.80, valorMaxImovel: 350000.0 },
      usado:{ ltv: 0.65, valorMaxImovel: 264000.0 },
    },

    // Faixa 4: 8.600,01 até 12.000,00 — juros 10,47%
    F4: {
      rendaMin: 8600.01,
      rendaMax: 12000.0,
      taxa: 0.1047,
      novo: { ltv: 0.80, valorMaxImovel: 500000.0 },
      usado:{ ltv: 0.60, valorMaxImovel: 500000.0 },
    },
  },
};

/** =========================
 *  HELPERS
 * ========================= */
function normStr(v) { return String(v ?? "").trim(); }
function upper(v) { return normStr(v).toUpperCase(); }
function toNumber(v) {
  const s = normStr(v);
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.,-]/g, "");
  if (cleaned.includes(",")) {
    const n = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(cleaned.replace(/\./g, ""));
  return Number.isFinite(n) ? n : 0;
}
function pick(keys, fallback = "") {
  for (const k of keys) {
    if (item[k] !== undefined && item[k] !== null && normStr(item[k]) !== "") return item[k];
  }
  return fallback;
}
function toStringArray(v) {
  if (Array.isArray(v)) return v.map((x) => normStr(x)).filter(Boolean);
  const s = normStr(v);
  return s ? [s] : [];
}
function normalizeAmortizador(raw) {
  const arr = toStringArray(raw).map(upper);
  if (arr.includes("SAC")) return "SAC";
  if (arr.includes("PRICE")) return "PRICE";
  const s = upper(raw);
  if (s.includes("SAC")) return "SAC";
  if (s.includes("PRICE")) return "PRICE";
  return "SAC"; // default
}
function detectModalidadeNovoOuUsado(mod) {
  const m = upper(mod);
  if (m.includes("USADO")) return "usado";
  if (m.includes("NOVO")) return "novo";
  // terreno ou outros
  return "";
}
function detectCenario(tipo, mod) {
  const t = upper(tipo);
  const m = upper(mod);
  if (t.includes("COMERCIAL")) return "COMERCIAL";
  if (m.includes("TERRENO")) return "TERRENO";
  return "RESIDENCIAL";
}

/** =========================
 *  LEITURA
 * ========================= */
const bancoPretendidoRaw = pick(
  ["Qual banco você pretende realizar seu financiamento?", "Banco pretendido", "bancoPretendido"],
  ""
);

const tipoFinanciamento = pick(
  ["Qual é o tipo de financiamento?", "Tipo de financiamento", "tipoFinanciamento"],
  ""
);

const modalidade = pick(
  ["Qual o tipo de financiamento você pretende fazer?", "Modalidade", "tipoOperacao"],
  ""
);

const uf = upper(pick(["Digite seu estado", "UF", "uf"], ""));

const rendaBrutaFamiliar = toNumber(
  pick(["Qual a renda bruta familiar de todos os participantes?", "Renda bruta familiar", "rendaBrutaFamiliar"], 0)
);

const valorImovel = toNumber(
  pick(["Digite o valor do imóvel", "Qual o valor do imóvel?", "valorImovel"], 0)
);

// Sistema amortizador (novo campo)
const sistemaAmortizadorRaw = pick(
  ["Sistema amortizador", "Sistema Amortizador", "Sistema amortizador *"],
  ""
);
const sistemaAmortizador = normalizeAmortizador(sistemaAmortizadorRaw);

const cenario = detectCenario(tipoFinanciamento, modalidade);

/** =========================
 *  NORMALIZA BANCO
 * ========================= */
function normalizeBanco(b) {
  const s = upper(b);
  if (s.includes("CAIXA")) return { code: "CAIXA", label: "Caixa" };
  if (s.includes("INTER")) return { code: "INTER", label: "Banco Inter" };
  if (s.includes("BRADESCO")) return { code: "BRADESCO", label: "Bradesco" };
  if (s.includes("ITA")) return { code: "ITAU", label: "Itaú" };
  if (s.includes("SANT")) return { code: "SANTANDER", label: "Santander" };
  return { code: "OUTRO", label: normStr(b) || "Outro" };
}

const banco = normalizeBanco(bancoPretendidoRaw);

/** =========================
 *  SELEÇÃO DE TAXA
 * ========================= */
let taxaAno = 0;
let taxaAnoMin = null;
let taxaAnoMax = null;

let produtoSelecionado = "";
let criterioSelecionado = "";
let ltvMaxRef = 0.8; // default
let valorMaxImovelRegra = null;

const observacoesTaxa = [];

const modalidadeNovoUsado = detectModalidadeNovoOuUsado(modalidade);

// MCMV só faz sentido em RESIDENCIAL e modalidade novo/usado
const podeTentarMCMV =
  banco.code === "CAIXA" &&
  cenario === "RESIDENCIAL" &&
  (modalidadeNovoUsado === "novo" || modalidadeNovoUsado === "usado") &&
  rendaBrutaFamiliar > 0 &&
  rendaBrutaFamiliar <= 12000;

function faixaMCMVPorRenda(renda) {
  const { F1, F2, F3, F4 } = CONFIG.MCMV;
  if (renda <= F1.rendaMax) return { faixa: "Faixa 1", key: "F1", cfg: F1 };
  if (renda <= F2.rendaMax) return { faixa: "Faixa 2", key: "F2", cfg: F2 };
  if (renda <= F3.rendaMax) return { faixa: "Faixa 3", key: "F3", cfg: F3 };
  if (renda <= F4.rendaMax) return { faixa: "Faixa 4", key: "F4", cfg: F4 };
  return null;
}

if (podeTentarMCMV) {
  const faixaInfo = faixaMCMVPorRenda(rendaBrutaFamiliar);

  if (faixaInfo) {
    const regraImovel = faixaInfo.cfg[modalidadeNovoUsado];
    valorMaxImovelRegra = regraImovel?.valorMaxImovel ?? null;
    ltvMaxRef = regraImovel?.ltv ?? 0.8;

    // Elegibilidade por valor do imóvel
    const elegivelValorImovel =
      valorImovel > 0 && valorMaxImovelRegra !== null ? (valorImovel <= valorMaxImovelRegra) : true;

    if (elegivelValorImovel) {
      // Taxa
      if (faixaInfo.cfg.taxa !== undefined) {
        taxaAno = faixaInfo.cfg.taxa;
      } else {
        // Faixa com taxaMin/taxaMax
        const isNorteNordeste = CONFIG.UFS_NORTE_NORDESTE.has(uf);
        taxaAnoMin = faixaInfo.cfg.taxaMin;
        taxaAnoMax = faixaInfo.cfg.taxaMax;
        taxaAno = isNorteNordeste ? taxaAnoMin : taxaAnoMax;

        observacoesTaxa.push(
          `Faixa possui 2 taxas: ${((taxaAnoMin*100).toFixed(2)).replace(".", ",")}% e ${((taxaAnoMax*100).toFixed(2)).replace(".", ",")}% a.a. (seleção por UF).`
        );
      }

      produtoSelecionado = `Caixa MCMV ${faixaInfo.faixa}`;
      criterioSelecionado = `Caixa MCMV ${faixaInfo.faixa}`;
      observacoesTaxa.push(
        `Regra MCMV (${faixaInfo.faixa}) — ${modalidadeNovoUsado.toUpperCase()}: LTV máx ${Math.round(ltvMaxRef*100)}% e valor do imóvel até R$ ${valorMaxImovelRegra?.toFixed(2) ?? "—"}.`
      );
    } else {
      // Não elegível por valor do imóvel -> SBPE
      taxaAno = CONFIG.TAXAS_FIXAS_AA.CAIXA_SBPE;
      produtoSelecionado = "Caixa SBPE";
      criterioSelecionado = "Caixa SBPE";
      observacoesTaxa.push(
        `Não elegível ao MCMV: valor do imóvel (R$ ${valorImovel.toFixed(2)}) acima do limite da ${faixaInfo.faixa} para ${modalidadeNovoUsado.toUpperCase()} (até R$ ${valorMaxImovelRegra.toFixed(2)}).`
      );
    }
  } else {
    // renda não encaixou (deveria não acontecer pois <= 12000)
    taxaAno = CONFIG.TAXAS_FIXAS_AA.CAIXA_SBPE;
    produtoSelecionado = "Caixa SBPE";
    criterioSelecionado = "Caixa SBPE";
    observacoesTaxa.push("Renda não enquadrou em faixa MCMV. Aplicada taxa SBPE.");
  }
} else {
  // Bancos fora MCMV (ou Caixa fora condições)
  if (banco.code === "CAIXA") {
    taxaAno = CONFIG.TAXAS_FIXAS_AA.CAIXA_SBPE;
    produtoSelecionado = "Caixa SBPE";
    criterioSelecionado = "Caixa SBPE";
  } else if (banco.code === "INTER") {
    taxaAno = CONFIG.TAXAS_FIXAS_AA.INTER;
    produtoSelecionado = "Inter Base";
    criterioSelecionado = "Inter Base";
  } else if (banco.code === "BRADESCO") {
    taxaAno = CONFIG.TAXAS_FIXAS_AA.BRADESCO;
    produtoSelecionado = "Bradesco Prime";
    criterioSelecionado = "Bradesco Prime";
  } else if (banco.code === "ITAU") {
    taxaAno = CONFIG.TAXAS_FIXAS_AA.ITAU;
    produtoSelecionado = "Itaú";
    criterioSelecionado = "Itaú";
  } else if (banco.code === "SANTANDER") {
    taxaAno = CONFIG.TAXAS_FIXAS_AA.SANTANDER;
    produtoSelecionado = "Santander";
    criterioSelecionado = "Santander";
  } else {
    // fallback
    taxaAno = 0.11;
    produtoSelecionado = "Taxa padrão";
    criterioSelecionado = "Taxa padrão";
    observacoesTaxa.push("Banco não identificado. Aplicada taxa padrão 11% a.a.");
  }
}

/** =========================
 *  SAÍDA PARA PRÓXIMO NODE
 * ========================= */
const taxaMes = taxaAno > 0 ? (taxaAno / 12) : 0;

return [
  {
    ...item,

    // Banco
    bancoPretendido: banco.label,
    bancoCodigo: banco.code,

    // Sistema amortizador
    sistemaAmortizador,

    // Cenário
    tipoFinanciamento,
    modalidade,
    cenario,

    // Taxas escolhidas
    motorTaxaOk: taxaAno > 0,
    taxaAno,
    taxaMes,
    taxaAnoMin,
    taxaAnoMax,

    // Labels “bonitos”
    fonteTaxaLabel: banco.label,
    produtoSelecionado,
    criterioSelecionado,

    // Regras MCMV/LTV
    ltvMaxRef,
    valorMaxImovelRegra,

    observacoesTaxa,
  },
];
