const item = $json;
const errors = [];

/* =========================
   HELPERS
========================= */

function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim();
  if (!s) return NaN;

  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function getFirstValue(raw) {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function normalizeText(v) {
  return String(v ?? "").trim();
}

function normalizeChoice(v) {
  if (v && typeof v === "object") {
    if (typeof v.value === "string") return v.value.trim();
    if (typeof v.label === "string") return v.label.trim();
  }
  return normalizeText(getFirstValue(v));
}

function normalizeYesNo(v) {
  const s = normalizeChoice(v).toUpperCase();
  if (["SIM", "S", "YES", "Y", "TRUE"].includes(s)) return "SIM";
  if (["NÃO", "NAO", "N", "NO", "FALSE"].includes(s)) return "NAO";
  return "";
}

// dd/mm/aaaa ou yyyy-mm-dd
function parseDateAny(v) {
  const s = normalizeText(v);
  if (!s) return null;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("/").map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function calcAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age >= 0 && age <= 120 ? age : null;
}

/* =========================
   RÓTULOS DO FORMULÁRIO
========================= */

const FIELDS = {
  nomeCompleto: "Digite seu nome completo",
  cpf: "Digite seu CPF",

  // ✅ atualizado conforme sua nova pergunta
  celular: "Digite seu número de celular, DDD + Número. Ex: 11 9...",

  email:
    "Digite seu e-mail (em caso de falhas, um e-mail será enviado solicitando o preenchimento do formulário com os dados corretos).",

  valorFinanciamento: "Digite o valor do financiamento",
  modalidade: "Qual o tipo de financiamento você pretende fazer?",
  valorImovel: "Digite o valor do imóvel",
  rendaBrutaFamiliar: "Qual a renda bruta familiar de todos os participantes?",

  possuiFGTS: "Possui FGTS?",
  saldoFGTS: "Qual o valor aproximado do saldo do FGTS em caso de utilização?",

  pretendeEntradaRecursoProprio: "Pretende dar algum valor de entrada (recurso próprio)?",
  valorEntradaRecursoProprio: "Se sim, qual valor você pretende dar de entrada",

  bancoPretendido: "Qual banco você pretende realizar seu financiamento?",
  uf: "Digite seu estado",

  dataNascimentoMaiorIdade: "Qual a data de nascimento do proponente de maior idade?",

  consentimentoLGPD:
    "Termo de consentimento. Declaro que li e concordo com o uso dos meus dados pessoais para realização de simulações de crédito imobiliário, contato pela GoodCredit e registro das informações necessárias, em conformidade com a LGPD.",
};

/* =========================
   LEITURA
========================= */

const nomeCompleto = normalizeText(item[FIELDS.nomeCompleto]);
const cpfBruto = item[FIELDS.cpf];

// ✅ leitura robusta do celular: tenta pelo novo rótulo, mas aceita o antigo também (para evitar falhas em testes antigos)
const celularBruto =
  item[FIELDS.celular] ??
  item["Digite seu número de celular"] ??
  item["Digite seu número de celular (com DDD)"] ??
  item["Whatsapp para resposta (com DDD)"] ??
  item["WhatsApp para resposta (com DDD)"] ??
  item["WhatsApp para resposta"] ??
  item["Whatsapp para resposta"] ??
  item["Celular"] ??
  item["Telefone"] ??
  "";

const emailRaw = item[FIELDS.email] ?? "";

const valorFinStr = item[FIELDS.valorFinanciamento];
const modalidade = normalizeChoice(item[FIELDS.modalidade]);

const valorImovelStr = item[FIELDS.valorImovel];
const rendaBrutaStr = item[FIELDS.rendaBrutaFamiliar];

const possuiFGTS = normalizeYesNo(item[FIELDS.possuiFGTS]);
const saldoFGTSStr = item[FIELDS.saldoFGTS];

const pretendeEntradaRP = normalizeYesNo(item[FIELDS.pretendeEntradaRecursoProprio]);
const valorEntradaRPStr = item[FIELDS.valorEntradaRecursoProprio];

const bancoPretendido = normalizeChoice(item[FIELDS.bancoPretendido]);

const ufBruto = normalizeText(item[FIELDS.uf]);
const consentLGPD = normalizeYesNo(item[FIELDS.consentimentoLGPD]);

const nascimentoMaiorIdadeRaw = normalizeText(item[FIELDS.dataNascimentoMaiorIdade]);

/* =========================
   NOME
========================= */
if (!nomeCompleto || nomeCompleto.length < 5 || !nomeCompleto.includes(" ")) {
  errors.push("Nome completo inválido. Informe nome e sobrenome.");
}

/* =========================
   CPF
========================= */
const cpf = onlyDigits(cpfBruto);

function isValidCPF(c) {
  if (!c || c.length !== 11 || /^(\d)\1+$/.test(c)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(c.charAt(i), 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(c.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(c.charAt(i), 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;

  return resto === parseInt(c.charAt(10), 10);
}

if (cpf.length !== 11 || !isValidCPF(cpf)) {
  errors.push("CPF inválido.");
}

/* =========================
   CELULAR (DDD + 9 dígitos)
========================= */
const celularSomenteDigitos = onlyDigits(celularBruto || "");
if (!/^\d{11}$/.test(celularSomenteDigitos)) {
  errors.push(`Telefone celular inválido. Informe DDD + 9 dígitos (11 dígitos).`);
} else {
  const dddNum = Number(celularSomenteDigitos.slice(0, 2));
  const terceiroDigito = celularSomenteDigitos.charAt(2);
  if (!Number.isInteger(dddNum) || dddNum < 11 || dddNum > 99) errors.push("DDD do celular inválido.");
  if (terceiroDigito !== "9") errors.push("Número de celular inválido. Use DDD + 9xxxxxxxx.");
  if (/^(\d)\1{10}$/.test(celularSomenteDigitos)) errors.push("Telefone celular inválido (sequência repetida).");
}
item.celularLimpo = celularSomenteDigitos;

/* =========================
   E-MAIL
========================= */
const emailStr = normalizeText(emailRaw);
if (!emailStr) {
  errors.push("E-mail não informado.");
} else {
  const regexEmailBoa =
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
  if (!regexEmailBoa.test(emailStr)) errors.push("E-mail em formato inválido.");
}

/* =========================
   NÚMEROS
========================= */
const valorImovel = toNumber(valorImovelStr);
const valorFinanciamento = toNumber(valorFinStr);
const rendaBrutaFamiliar = toNumber(rendaBrutaStr);

if (!Number.isFinite(valorImovel) || valorImovel <= 0) errors.push("Valor do imóvel inválido ou não informado.");
if (!Number.isFinite(valorFinanciamento) || valorFinanciamento <= 0) errors.push("Valor do financiamento inválido ou não informado.");
if (!Number.isFinite(rendaBrutaFamiliar) || rendaBrutaFamiliar <= 0) errors.push("Renda bruta familiar inválida ou não informada.");
if (Number.isFinite(valorImovel) && Number.isFinite(valorFinanciamento) && valorFinanciamento > valorImovel) {
  errors.push("Valor do financiamento maior que o valor do imóvel.");
}

/* =========================
   MODALIDADE
========================= */
if (!modalidade || modalidade.toLowerCase().includes("select")) {
  errors.push("Selecione o tipo de financiamento (Novo/Usado/Terreno).");
}

/* =========================
   FGTS
========================= */
if (!possuiFGTS) errors.push("Informe se possui FGTS (Sim ou Não).");
const saldoFGTS = toNumber(saldoFGTSStr);
const saldoFGTSFinal = (possuiFGTS === "SIM" && Number.isFinite(saldoFGTS) && saldoFGTS >= 0) ? saldoFGTS : 0;

/* =========================
   ENTRADA (RECURSO PRÓPRIO)
========================= */
if (!pretendeEntradaRP) errors.push("Informe se pretende dar entrada com recurso próprio (Sim ou Não).");

const valorEntradaRecursoProprio = toNumber(valorEntradaRPStr);
let valorEntradaRecursoProprioFinal = 0;

if (pretendeEntradaRP === "SIM") {
  if (!Number.isFinite(valorEntradaRecursoProprio) || valorEntradaRecursoProprio <= 0) {
    errors.push("Informe o valor de entrada (recurso próprio).");
  } else {
    valorEntradaRecursoProprioFinal = valorEntradaRecursoProprio;
  }
} else if (pretendeEntradaRP === "NAO") {
  valorEntradaRecursoProprioFinal = 0;
}

if (Number.isFinite(valorImovel) && valorEntradaRecursoProprioFinal > valorImovel) {
  errors.push("Valor de entrada (recurso próprio) maior que o valor do imóvel.");
}

/* =========================
   BANCO
========================= */
if (!bancoPretendido) errors.push("Selecione o banco pretendido.");

/* =========================
   UF (aceita sigla e nome)
========================= */
const ufsValidas = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO"
]);

function normalizeUF(s) {
  const raw = normalizeText(s).toUpperCase();

  if (ufsValidas.has(raw)) return raw;

  const noAccents = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map = {
    "ACRE": "AC",
    "ALAGOAS": "AL",
    "AMAPA": "AP",
    "AMAZONAS": "AM",
    "BAHIA": "BA",
    "CEARA": "CE",
    "DISTRITO FEDERAL": "DF",
    "ESPIRITO SANTO": "ES",
    "GOIAS": "GO",
    "MARANHAO": "MA",
    "MATO GROSSO": "MT",
    "MATO GROSSO DO SUL": "MS",
    "MINAS GERAIS": "MG",
    "PARA": "PA",
    "PARAIBA": "PB",
    "PARANA": "PR",
    "PERNAMBUCO": "PE",
    "PIAUI": "PI",
    "RIO DE JANEIRO": "RJ",
    "RIO GRANDE DO NORTE": "RN",
    "RIO GRANDE DO SUL": "RS",
    "RONDONIA": "RO",
    "RORAIMA": "RR",
    "SANTA CATARINA": "SC",
    "SAO PAULO": "SP",
    "SERGIPE": "SE",
    "TOCANTINS": "TO",
  };

  return map[noAccents] || "";
}

const uf = normalizeUF(ufBruto);
if (!uf) errors.push("UF inválida. Informe a sigla (SP) ou o nome (São Paulo).");

/* =========================
   DATA NASCIMENTO (MAIOR IDADE)
========================= */
const nascimentoMaiorIdade = parseDateAny(nascimentoMaiorIdadeRaw);
const idadeMaiorProponente = calcAge(nascimentoMaiorIdade);

if (!nascimentoMaiorIdade) {
  errors.push("Data de nascimento do proponente mais velho inválida ou não informada.");
} else {
  const hoje = new Date();
  if (nascimentoMaiorIdade > hoje) errors.push("Data de nascimento não pode ser futura.");
  if (idadeMaiorProponente !== null && idadeMaiorProponente < 18) errors.push("Proponente mais velho deve ter 18+ anos.");
}

/* =========================
   CONSENTIMENTO LGPD
========================= */
if (consentLGPD !== "SIM") errors.push("É necessário aceitar o termo de consentimento (LGPD) para prosseguir.");

/* =========================
   SAÍDA
========================= */
item.valid = errors.length === 0;
item.validationErrors = errors;

item.nomeCompletoNormalizado = nomeCompleto;
item.cpfLimpo = cpf;
item.emailValidado = emailStr;
item.uf = uf;

item.valorImovelNumero = valorImovel;
item.valorFinanciamentoNumero = valorFinanciamento;
item.rendaBrutaFamiliarNumero = rendaBrutaFamiliar;

item.possuiFGTSNorm = possuiFGTS;
item.saldoFGTSNumero = saldoFGTSFinal;

item.entradaRecursoProprioNorm = pretendeEntradaRP;
item.valorEntradaRecursoProprioNumero = valorEntradaRecursoProprioFinal;

// alias compatível com nós antigos
item.valorEntradaNumero = valorEntradaRecursoProprioFinal;

item.modalidade = modalidade;
item.bancoPretendido = bancoPretendido;

item.dataNascimentoMaiorIdadeRaw = nascimentoMaiorIdadeRaw;
item.idadeMaiorProponente = idadeMaiorProponente;
item.dataNascimentoMaiorIdadeISO = nascimentoMaiorIdade ? nascimentoMaiorIdade.toISOString().slice(0, 10) : null;

return [item];
