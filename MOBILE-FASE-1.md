# Zeon Web Mobile — Fase 1 (branch de testes)

Esta implementação é **Web Mobile**, não um APK e não o aplicativo Windows.
Ela usa a base Web existente (Supabase + LiveKit), mas apresenta navegação mobile própria.
**Não mesclar esta branch em `main` nem publicar o site principal antes da revisão.**

## Entregas incluídas

- Navegação inferior: **Conversas, Grupos, Chamadas, Perfil**.
- Início em Conversas, com canais **reais do grupo selecionado**.
- Pesquisa local por nome de canal, sala de voz e grupo.
- Acesso a grupos, criação de grupo e entrada por convite.
- Criação de canais de texto/voz somente quando a conta é administradora.
- Convidar/copiar código do grupo existente.
- Abertura de canais de texto e salas de voz pelo mesmo backend da Web Desktop.
- Banner para voltar à chamada ativa sem sair da navegação.
- Chat de texto, chat da chamada, microfone, câmera e botões de chamadas reaproveitados.
- Compartilhamento de tela habilitado apenas quando a API do navegador existe.
- Hub de perfil com acesso ao perfil completo, personalização, configurações e sair.
- Ajustes responsivos para chat, teclado virtual, barra inferior, safe areas e telas menores.
- Rascunho de mensagem preservado ao reconstruir a tela; tentativa de envio falha recupera texto.
- Isolamento até 740 px; estilos desktop não são substituídos.
- Sem migrações SQL, sem novas chaves, sem substituição de backend.

## Verificações automatizadas

O workflow GitHub Actions `.github/workflows/mobile-phase1.yml` executa:

- testes de contrato (arquivos, JavaScript, importações, APIs e CSS)
- testes de interação simulada com DOM (abas, pesquisa, grupos, canais, chamadas, perfil e logout)

Esses testes ajudam a detectar regressões, mas **não simulam WebRTC real, teclado nativo ou todos os navegadores**.

## Testes manuais necessários antes de publicar

Usar a branch de teste em servidor local HTTPS ou localhost, **sem mesclar em `main`**.
Preferir ao menos um Android e, se possível, um iPhone.

- [ ] Entrar, atualizar a página e continuar autenticado; sair e entrar novamente
- [ ] Abrir cada aba e navegar de volta sem perder o contexto
- [ ] Criar grupo, entrar por convite e trocar entre dois grupos
- [ ] Criar canal como administrador e verificar restrições como membro comum
- [ ] Ler e enviar mensagens de texto com duas contas reais
- [ ] Testar mensagem com erro de conexão e confirmar restauração do texto
- [ ] Abrir teclado, digitar mensagem longa, fechar teclado, rolar conversa
- [ ] Entrar numa sala de voz, silenciar/reativar microfone e testar áudio bilateral
- [ ] Abrir chat da chamada, enviar mensagens e fechar o painel
- [ ] Voltar às abas durante uma chamada e retornar à sala ativa
- [ ] Testar câmera, permissões e comportamento de áudio ao mudar de aplicativo
- [ ] Confirmar que transmissão de tela indisponível aparece desabilitada em navegador incompatível
- [ ] Abrir, editar, salvar e descartar alterações do perfil
- [ ] Testar pelo menos 320 px, 360 px, 390 px, 430 px e orientação horizontal
- [ ] Comparar Web Desktop antes/depois para confirmar ausência de regressões
- [ ] Verificar mensagens, perfis e grupos sincronizados com o aplicativo Windows

## Não faz parte da Fase 1

- Conversas privadas 1:1 (precisam de implementação própria e regras de acesso no backend)
- Notificações push e uso offline (planejados para fase posterior)
- APK/Capacitor ou recursos nativos do aplicativo Android
- Garantia de transmissão de tela e chamadas em segundo plano em todo navegador mobile

**Critério de conclusão:** código e testes automatizados aprovados, depois validação real em aparelho e autorização explícita antes de publicar.
