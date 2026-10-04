# Frontend: verificação e integração

Execute na raiz do projeto:

```bash
Node.exe --test public/tests/*.test.mjs
```

Os testes usam o módulo real `api.js`. O transporte HTTP é substituído explicitamente por um fixture em memória: isso verifica cookies `same-origin`, envio/rotação do token CSRF e apresentação de erros, **não** comprova integração com um servidor real.

## Verificação realizada

- Quatro testes automatizados aprovados (API e invariantes das páginas).
- Quatro páginas abertas em Chromium, nas larguras 320, 768 e 1440 px; nenhuma apresentou rolagem horizontal.
- Campos com labels associados; botão Show/Hide atualiza o tipo do campo e `aria-pressed`.
- Menu mobile abre; links de serviço preenchem o select do formulário.
- Sem backend, o formulário mostra erro real, restaura o botão e limpa o erro ao editar.
- Dashboard apresenta erro e opção Try again quando a sessão não está disponível.
- Imagem original copiada, sem CDN, framework ou dependência de build.

## Contrato esperado

A aplicação deve ser servida pelo **mesmo origin** das rotas `/api/*`.

- `GET /api/session` → `{user, csrfToken}` e cookie de sessão HttpOnly.
- `POST /api/auth/register`, `POST /api/auth/login` → `{user, csrfToken}`.
- `POST /api/auth/logout` → `{message}`.
- `PATCH /api/profile` → `{user}`.
- `GET /api/inquiries` → `{inquiries}`.
- `POST /api/contact` → `{message, inquiry}`.
- Mutação: JSON, cookie same-origin, header `x-csrf-token`.
- Erros: HTTP 400/401/403/409/429, JSON `{message}`.

O token permanece apenas na memória do módulo. O dashboard redireciona visitantes sem sessão para `/login.html`. Conteúdo recebido da API é renderizado com `textContent`, nunca `innerHTML`.

## Checklist pendente com backend real

1. Registrar conta com senha de 15–128 caracteres; conferir redirecionamento, cookie HttpOnly e ausência de senha em logs/storage.
2. Confirmar que senhas divergentes bloqueiam o cadastro e que a validação desaparece após correção.
3. Fazer logout, login errado/correto e visitar dashboard sem sessão.
4. Salvar nome/empresa, recarregar e conferir persistência e email readonly.
5. Criar pedido autenticado, abrir dashboard, conferir conteúdo/status/data reais, atualizar a lista e verificar isolamento entre contas.
6. Criar pedido anônimo; confirmar mensagem de armazenamento local sem promessa de email ou serviço ativado.
7. Conferir mensagens de 400/403/409/429, tentativas após falha de rede e prevenção de duplo envio.
8. Executar navegação por teclado, foco visível, Escape no menu e leitor de tela.
9. Confirmar CSP `script-src 'self'` / `style-src 'self'` sem violações.

Não foi iniciado servidor na porta 3000. A visualização foi feita com servidor estático temporário em 4179; respostas de autenticação/persistência não foram simuladas como resultados reais.
