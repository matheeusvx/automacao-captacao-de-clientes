# Automação de Captação de Clientes no n8n

Automação desenvolvida no **n8n** para **captação de clientes via redes sociais** e **pré-atendimento de crédito imobiliário**.

O fluxo foi estruturado para funcionar de ponta a ponta, desde o preenchimento inicial do formulário até o direcionamento do lead para continuidade comercial dentro do CRM.

## Visão geral

O cliente preenche um formulário com dados básicos de contato e informações iniciais para simulação.

A automação:

- valida e padroniza os dados recebidos;
- trata CPF, e-mail, telefone e valores com **JavaScript**;
- gera uma **simulação inicial de financiamento**;
- verifica se o contato já existe no sistema;
- atualiza o cadastro quando o lead já existe ou cria um novo contato quando necessário;
- registra os dados em planilha para organização e rastreabilidade;
- envia ao cliente, via **WhatsApp**, a simulação e a orientação sobre os próximos passos;
- direciona o lead para um especialista e o inclui em painel no **CRM**;
- registra falhas de validação e dispara notificação por **e-mail** para evitar continuidade com informações inconsistentes.

## Tecnologias e integrações

- **n8n**
- **JavaScript** para tratamento e padronização de dados
- **TryaCRM**
- Node da comunidade **wts-chat**
- **Google Sheets**
- **Gmail**
- **WhatsApp**

## Objetivo da automação

Centralizar a entrada dos leads, padronizar o pré-atendimento e acelerar o primeiro retorno ao cliente, reduzindo etapas manuais e melhorando a organização operacional.

## Estrutura do repositório

```text
.
├── README.md
├── docs
│   └── PLACEHOLDERS.md
└── workflows
    └── captacao_clientes.json
```

## Arquivo do workflow

O arquivo principal do projeto está em:

`workflows/captacao_clientes.json`

Esse arquivo foi **sanitizado para publicação no GitHub**, com remoção de dados sensíveis, credenciais, URLs privadas e identificadores internos.

## Antes de usar

Antes de importar este workflow em outro ambiente, revise o arquivo `docs/PLACEHOLDERS.md` e substitua os placeholders pelos valores reais do seu ambiente.

## Importação no n8n

1. Baixe ou clone este repositório.
2. Abra o n8n.
3. Use a opção de importar workflow por arquivo.
4. Selecione `workflows/captacao_clientes.json`.
5. Reconfigure as credenciais, IDs e integrações necessárias.

## Observação

Este projeto representa uma automação prática voltada para operações comerciais e pré-atendimento no segmento de **crédito imobiliário**, com foco em agilidade, rastreabilidade e continuidade do atendimento.
