# Zeon — Web Beta (versão de testes)

Esta é a primeira versão **para navegador** a partir do projeto Consivo/Zeon original. Ela reutiliza a interface de grupos, chat, perfis personalizados (incluindo os efeitos e o layout responsivo) e chamadas de voz/vídeo com LiveKit.

## O que pode funcionar nesta versão

- Entrar ou criar conta no **mesmo Supabase** do aplicativo Windows.
- Visualizar/criar grupos e canais, entrar por convite e trocar mensagens.
- Visualizar e editar o perfil (cores, cards, imagens e efeitos) com o backend atual.
- Entrar em chamadas de voz e, quando o LiveKit estiver configurado, usar microfone, câmera e compartilhar tela. O navegador mostra seu próprio diálogo para escolher o que compartilhar.
- Acessar em celular pelo navegador com layout adaptável (ainda **não** é um aplicativo Android/iOS).

A janela flutuante específica do Electron/Windows **não existe no navegador**. A qualidade da captura depende do navegador, e alguns recursos de áudio da transmissão variam por plataforma.

## Rodar localmente

Não abra `index.html` dando dois cliques: o site precisa ser servido por HTTP/HTTPS para carregar `zeon-public-config.json`.

Você pode abrir esta pasta pelo VS Code e iniciar com a extensão Live Server, ou, caso tenha Python instalado, executar:

```sh
python -m http.server 8080
```

Abra `http://localhost:8080` no navegador. **Microfone, câmera e compartilhamento de tela precisam de contexto seguro**: `localhost` funciona para desenvolvimento; para testar com o Kay, hospede usando HTTPS.

## Publicar em Vercel para testar com o Kay

1. Crie um novo repositório GitHub para a versão web (ou use um projeto separado na Vercel). Inclua os **arquivos desta pasta na raiz do repositório**, não a pasta Windows com Electron.
2. Na Vercel, importe o repositório e use o tipo **Other** / site estático, sem comando de build. A pasta de saída é a própria raiz (`.`).
3. Publique: a Vercel fornecerá uma URL com HTTPS.
4. Abra a URL, entre na sua conta. Peça ao Kay que **crie a própria conta** e confirme o e-mail caso o Supabase exija.
5. No seu grupo, copie o **código de convite** usando Convidar. Envie a ele por mensagem privada. Ele poderá usar o botão de entrar por convite.

O arquivo `zeon-public-config.json` já usa a **URL e a chave publicável** que vieram no seu ZIP original, para apontar à mesma base do Windows. Chaves publicáveis são próprias para clientes web. **Nunca coloque `service_role`, `sb_secret_*`, senhas nem segredos do LiveKit neste projeto.**

## Verificações necessárias antes de compartilhar a URL

- No Supabase, confirme RLS nas tabelas `groups`, `group_members`, `channels`, `messages`, `consivo_profiles` e no bucket `consivo-profile-media`. Um usuário não pode ler mensagens nem entrar em salas de grupos dos quais não participa.
- Verifique a Edge Function `consivo-livekit-token`, suas permissões, CORS e disponibilidade. Tokens do LiveKit devem ser assinados **somente no servidor**.
- Teste com **duas contas reais** em navegadores distintos: registro, confirmação de email, convite, mensagens, chamada, microfone/câmera, transmissão, perfil, logout e atualização da página.
- Faça backup da base de dados antes de migrar o servidor. Este pacote **não altera o banco** e não inclui SQL de migração.
- Configure monitoramento e limites de custo no Supabase/LiveKit antes da divulgação pública. Esta versão é **beta privada**, não 1.0.

## Como o código foi organizado

- `index.html`, `styles.css`, `unified.css`, `unified.js`: base da interface já existente.
- `profile-v080.css`, `profile-v080.js`: versão mais recente do perfil e seus efeitos.
- `web-responsive.css`: comportamento responsivo (desktop, notebook, tablet e celular).
- `web-bridge.js`: substitui o acesso IPC do Electron por requisições REST HTTPS autenticadas ao Supabase.
- `zeon-public-config.json`: configuração **pública** do Supabase.
- `livekit.bundle.js`: biblioteca de chamadas já utilizada no aplicativo.
- `vercel.json`: cabeçalhos básicos de segurança para a hospedagem.

### Notas técnicas

- As tabelas e APIs internas ainda contêm o nome `consivo` para preservar a compatibilidade dos dados existentes. O nome exibido na interface é **Zeon**.
- A sessão da versão web fica salva **no armazenamento local do navegador** deste domínio; não compartilhe o dispositivo sem sair da conta. Não armazene senhas no código.
- Esta versão não tem comunicação entre janelas (Electron IPC), nem instalador Windows.
- Os testes locais incluíram layout simulado em 1440×850 e 390×844 e verificações do adaptador de API com respostas simuladas. **Ainda não foi validado o funcionamento remoto real entre dois usuários.**
