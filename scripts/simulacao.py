import math
import re


def only_digits(v):
    return re.sub(r"\D", "", "" if v is None else str(v))


def to_number(v):
    if v is None:
        return math.nan

    s = str(v).strip()
    if not s:
        return math.nan

    s = s.replace(".", "").replace(",", ".")
    try:
        n = float(s)
        return n if math.isfinite(n) else math.nan
    except Exception:
        return math.nan


def norm_str(v):
    return str("" if v is None else v).strip()


def get_first_value(raw):
    if isinstance(raw, list):
        return raw[0] if raw else None
    return raw


def normalize_choice(v):
    if isinstance(v, dict):
        value = v.get("value")
        label = v.get("label")

        if isinstance(value, str):
            return value.strip()
        if isinstance(label, str):
            return label.strip()

    return norm_str(get_first_value(v))


def normalize_yes_no(v):
    s = normalize_choice(v).upper()

    if s in ["SIM", "S", "YES", "Y", "TRUE"]:
        return "SIM"
    if s in ["NÃO", "NAO", "N", "NO", "FALSE"]:
        return "NAO"
    return ""


def format_number_ptbr(n, decimals=2):
    s = f"{n:,.{decimals}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def format_currency_brl(n):
    try:
        v = float(n)
    except Exception:
        return "R$ 0,00"

    if not math.isfinite(v):
        return "R$ 0,00"

    sign = "-" if v < 0 else ""
    v = abs(v)
    return f"{sign}R$ {format_number_ptbr(v, 2)}"


def format_percent(p):
    try:
        v = float(p)
    except Exception:
        return "0,00%"

    if not math.isfinite(v):
        return "0,00%"

    return f"{format_number_ptbr(v * 100, 2)}%"


def monthly_rate_from_annual(taxa_ano):
    try:
        a = float(taxa_ano)
    except Exception:
        return math.nan

    if not math.isfinite(a) or a <= -1:
        return math.nan

    return (1 + a) ** (1 / 12) - 1


def pick_amort_system(data):
    direct = (
        data.get("sistemaAmortizador")
        or data.get("sistemaAmortizadorNorm")
        or data.get("amortizador")
        or data.get("amortizationSystem")
    )

    s = normalize_choice(direct)

    if not s:
        for key in data.keys():
            if "sistema amort" in key.lower():
                s = normalize_choice(data.get(key))
                break

    s = s.upper()
    if "PRICE" in s:
        return "PRICE"
    return "SAC"


def calc_parcela_price(pv, i, n):
    try:
        pv = float(pv)
        i = float(i)
        n = float(n)
    except Exception:
        return math.nan

    if not math.isfinite(pv) or pv <= 0:
        return math.nan
    if not math.isfinite(i) or i < 0:
        return math.nan
    if not math.isfinite(n) or n <= 0:
        return math.nan

    if i == 0:
        return pv / n

    denom = 1 - (1 + i) ** (-n)
    if denom <= 0:
        return math.nan

    return (pv * i) / denom


def calc_parcelas_sac(pv, i, n):
    try:
        pv = float(pv)
        i = float(i)
        n = float(n)
    except Exception:
        return {"primeira": math.nan, "ultima": math.nan, "amort": math.nan}

    if not math.isfinite(pv) or pv <= 0:
        return {"primeira": math.nan, "ultima": math.nan, "amort": math.nan}
    if not math.isfinite(i) or i < 0:
        return {"primeira": math.nan, "ultima": math.nan, "amort": math.nan}
    if not math.isfinite(n) or n <= 0:
        return {"primeira": math.nan, "ultima": math.nan, "amort": math.nan}

    amort = pv / n
    primeira = amort + pv * i
    saldo_antes_ultima = pv - amort * (n - 1)
    ultima = amort + saldo_antes_ultima * i

    return {"primeira": primeira, "ultima": ultima, "amort": amort}


def is_finite_number(v):
    try:
        return math.isfinite(float(v))
    except Exception:
        return False


def run_simulacao(items):
    output = []

    for entry in items:
        source_json = entry["json"] if isinstance(entry, dict) and "json" in entry else entry
        item = dict(source_json)

        banco_label = norm_str(
            item.get("bancoLabel")
            or item.get("bancoPretendidoLabel")
            or item.get("bancoPretendido")
            or ""
        )

        banco_pretendido = norm_str(item.get("bancoPretendido") or "")
        modalidade = norm_str(item.get("modalidade") or item.get("tipoFinanciamento") or "")
        cenario = "RESIDENCIAL"

        valor_imovel = (
            float(item.get("valorImovelNumero"))
            if is_finite_number(item.get("valorImovelNumero"))
            else to_number(item.get("valorImovelNumero") if item.get("valorImovelNumero") is not None else item.get("valorImovel"))
        )

        valor_financiamento_informado = (
            float(item.get("valorFinanciamentoNumero"))
            if is_finite_number(item.get("valorFinanciamentoNumero"))
            else to_number(
                item.get("valorFinanciamentoNumero")
                if item.get("valorFinanciamentoNumero") is not None
                else item.get("valorFinanciamento")
            )
        )

        renda_bruta = (
            float(item.get("rendaBrutaFamiliarNumero"))
            if is_finite_number(item.get("rendaBrutaFamiliarNumero"))
            else to_number(
                item.get("rendaBrutaFamiliarNumero")
                if item.get("rendaBrutaFamiliarNumero") is not None
                else item.get("rendaBrutaFamiliar")
            )
        )

        entrada_recursos_proprios = (
            float(item.get("valorEntradaNumero"))
            if is_finite_number(item.get("valorEntradaNumero"))
            else (
                float(item.get("valorEntradaRecursoProprioNumero"))
                if is_finite_number(item.get("valorEntradaRecursoProprioNumero"))
                else to_number(
                    item.get("valorEntradaNumero")
                    if item.get("valorEntradaNumero") is not None
                    else (
                        item.get("valorEntradaRecursoProprioNumero")
                        if item.get("valorEntradaRecursoProprioNumero") is not None
                        else item.get("valorEntrada")
                    )
                )
            )
        )

        possui_fgts_norm = item.get("possuiFGTSNorm") or item.get("possuiFGTS") or ""
        vai_usar_fgts = normalize_yes_no(possui_fgts_norm)

        saldo_fgts_numero = (
            float(item.get("saldoFGTSNumero"))
            if is_finite_number(item.get("saldoFGTSNumero"))
            else (
                float(item.get("saldoFGTS"))
                if is_finite_number(item.get("saldoFGTS"))
                else to_number(
                    item.get("saldoFGTSNumero")
                    if item.get("saldoFGTSNumero") is not None
                    else item.get("saldoFGTS")
                )
            )
        )

        fgts_considerado = (
            saldo_fgts_numero
            if vai_usar_fgts == "SIM" and is_finite_number(saldo_fgts_numero) and saldo_fgts_numero > 0
            else 0
        )

        entrada_total_considerada = (
            (entrada_recursos_proprios if is_finite_number(entrada_recursos_proprios) else 0)
            + fgts_considerado
        )

        taxa_ano = item.get("taxaAno")
        taxa_mes = item.get("taxaMes")

        taxa_ano = float(taxa_ano) if is_finite_number(taxa_ano) else to_number(taxa_ano)
        taxa_mes = float(taxa_mes) if is_finite_number(taxa_mes) else to_number(taxa_mes)

        if not is_finite_number(taxa_mes) and is_finite_number(taxa_ano):
            taxa_mes = monthly_rate_from_annual(taxa_ano)

        prazo_anos = float(item.get("prazoAnos")) if is_finite_number(item.get("prazoAnos")) else 30
        n_parcelas = float(item.get("nParcelas")) if is_finite_number(item.get("nParcelas")) else prazo_anos * 12

        sistema_amortizador = pick_amort_system(item)

        if is_finite_number(valor_financiamento_informado) and valor_financiamento_informado > 0:
            valor_financiado = valor_financiamento_informado
        elif is_finite_number(valor_imovel) and valor_imovel > 0:
            valor_financiado = valor_imovel * 0.8
        else:
            valor_financiado = math.nan

        parcela_primeira = math.nan
        parcela_ultima = math.nan
        parcela_aproximada = math.nan

        if sistema_amortizador == "PRICE":
            pmt = calc_parcela_price(valor_financiado, taxa_mes, n_parcelas)
            parcela_primeira = pmt
            parcela_ultima = pmt
            parcela_aproximada = pmt
        else:
            sac = calc_parcelas_sac(valor_financiado, taxa_mes, n_parcelas)
            parcela_primeira = sac["primeira"]
            parcela_ultima = sac["ultima"]
            parcela_aproximada = sac["primeira"]

        ltv = (
            (valor_financiado / valor_imovel)
            if is_finite_number(valor_financiado) and is_finite_number(valor_imovel) and valor_imovel > 0
            else None
        )

        comprometimento_renda_bruta = (
            (parcela_primeira / renda_bruta)
            if is_finite_number(parcela_primeira) and is_finite_number(renda_bruta) and renda_bruta > 0
            else None
        )

        banco_show = banco_label or (f"Banco {banco_pretendido}" if banco_pretendido else "Banco")
        condicao_taxa = norm_str(
            item.get("criterioSelecionado")
            or item.get("produtoSelecionado")
            or item.get("condicaoTaxa")
            or ""
        )

        linha_condicao = f"\n- Condição de taxa: {condicao_taxa}" if condicao_taxa else ""

        taxa_ano_str = format_percent(taxa_ano) if is_finite_number(taxa_ano) else "—"
        taxa_mes_str = format_percent(taxa_mes) if is_finite_number(taxa_mes) else "—"

        texto_simulacao = (
            "Simulação inicial aproximada feita por IA:\n\n"
            f"- Banco pretendido: {banco_show}\n"
            f"- Cenário: {cenario}\n"
            f"- Modalidade: {modalidade or '—'}"
            f"{linha_condicao}\n"
            f"- Valor do imóvel: {format_currency_brl(valor_imovel)}\n"
            f"- Entrada (recursos próprios): {format_currency_brl(entrada_recursos_proprios)}\n"
            f"- FGTS considerado: {format_currency_brl(fgts_considerado)}\n"
            f"- Entrada total considerada: {format_currency_brl(entrada_total_considerada)}\n"
            f"- Valor financiado estimado: {format_currency_brl(valor_financiado)}\n"
            f"- Prazo: {int(prazo_anos) if prazo_anos == int(prazo_anos) else prazo_anos} anos "
            f"({int(n_parcelas) if n_parcelas == int(n_parcelas) else n_parcelas} meses)\n"
            f"- Taxa de referência: {taxa_ano_str} a.a ({taxa_mes_str} a.m)\n"
            f"- Sistema amortizador: {sistema_amortizador} "
            f"{'(parcela decrescente)' if sistema_amortizador == 'SAC' else '(parcela fixa)'}\n"
            f"- Parcela aprox. (1ª): {format_currency_brl(parcela_primeira)}\n"
            f"- Parcela (última): {format_currency_brl(parcela_ultima)}\n"
            + (f"- Renda bruta familiar informada: {format_currency_brl(renda_bruta)}\n" if is_finite_number(renda_bruta) else "")
            + (f"- LTV (financiamento / imóvel): {format_percent(ltv)}\n" if ltv is not None else "")
            + (
                f"- Comprometimento aprox. da renda bruta: {format_percent(comprometimento_renda_bruta)}\n"
                if comprometimento_renda_bruta is not None
                else ""
            )
            + "\nObservação: Esta é uma simulação para referência. "
              "A análise detalhada pode variar conforme política vigente do banco, perfil e validação documental."
        )

        item["saldoFGTS"] = saldo_fgts_numero if is_finite_number(saldo_fgts_numero) else 0
        item["fgtsConsiderado"] = fgts_considerado
        item["entradaTotalConsiderada"] = entrada_total_considerada
        item["valorFinanciado"] = valor_financiado
        item["parcelaAproximada"] = parcela_aproximada
        item["parcelaPrimeira"] = parcela_primeira
        item["parcelaUltima"] = parcela_ultima
        item["ltv"] = ltv
        item["comprometimentoRendaBruta"] = comprometimento_renda_bruta
        item["sistemaAmortizador"] = sistema_amortizador
        item["textoSimulacao"] = texto_simulacao

        output.append({"json": item})

    return output


if __name__ == "__main__":
    exemplo = []
    resultado = run_simulacao(exemplo)
    print(resultado)