# Zeon Direct Call 0.9 – P2P independente

Motor de voz, câmera e tela via WebRTC P2P sem usar LiveKit. Sinalização via canal privado Supabase Realtime 'zeon:voice:<canal_id>'. Ver SQL de RLS no projeto. Compatível com o pacote Windows Direct 0.9. TURN não incluído: algumas redes (CGNAT/firewalls) podem exigir relé.

Esta integração mantém layout mobile e DMs existentes. Não há mais botão LK/P2P: o transporte padrão é direto.
