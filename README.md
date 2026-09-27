# CyberShield

Landing page responsiva para a CyberShield, uma empresa fictícia de segurança para negócios. O site está na etapa visual e foi feito com HTML e CSS puros; ainda não usa JavaScript, dependências ou backend.

## Como visualizar

Na pasta do projeto, inicie um servidor estático:

```bash
python3 -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador. Para encerrar o servidor, pressione `Ctrl+C` no terminal.

## Estrutura

```text
.
├── index.html
├── css/
│   └── style.css
└── img/
    └── data-center-unsplash.jpg
```

## O que já está pronto

- Cabeçalho e navegação responsivos.
- Destaque principal em duas colunas no desktop e empilhado em telas estreitas.
- Imagem local de data center com texto alternativo.
- Grade responsiva com quatro cartões de produtos.
- Seção de contato e rodapé estilizados.
- Estados visíveis de foco para navegação por teclado.

Os botões Email, WhatsApp e Discord são apenas visuais por enquanto; ainda não têm ações conectadas.

## Próximos passos planejados

1. Aprender JavaScript com pequenas interações aplicadas ao próprio site.
2. Implementar as interações da seção de contato.
3. Planejar autenticação por e-mail e senha com backend ou serviço apropriado.
4. Avaliar qualquer necessidade de criptografia a partir de um caso de uso definido; não implementar criptografia própria.
5. Considerar TypeScript depois de aprender os fundamentos de JavaScript.

## Créditos

A imagem de data center em `img/data-center-unsplash.jpg` é de Kevin Ache, via Unsplash.
