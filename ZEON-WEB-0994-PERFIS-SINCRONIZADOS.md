# Zeon Web 0.9.9.4 — aparência compartilhada

A aparência pública dos perfis passa a ser armazenada no Supabase em `zeon_profile_appearances`. Apenas o proprietário pode alterar os dados (RLS), qualquer usuário autenticado pode visualizá-los. O recurso suporta temas Chama Natural e Mística, layouts, fontes, nome, frase e efeitos das notas; mantém o conteúdo original em `consivo_profiles`.

A atualização do Windows deve ser instalada e a personalização antiga salva uma vez para ser publicada. Preferências antigas da Web também podem ser publicadas com Salvar aparência. O módulo Web converte os formatos do Windows, e os arquivos de DM/P2P/mobile não são alterados. Perfis sem aparência publicada usam o visual padrão.

A tabela é implementada por migração `zeon_shared_profile_appearance_100` com RLS e grants mínimos.\n