# Zeon Web/Desktop + Web Mobile — Fase 1.2

O monitor existente de recepção continua na barra inferior da chamada e ganha uma seção **Fluidez e resolução**, com histórico de resoluções (incluindo o instante de chegada a 720p), taxa de quadros descartados em duas camadas: WebRTC (`framesDropped`) e reprodução (`getVideoPlaybackQuality`), além de eventos de congelamento quando disponíveis.

O diagnóstico indica hipóteses, não causas garantidas, e não altera o motor de vídeo. O relatório copiado combina Fase 1.1 com 1.2 e não inclui IPs, nomes, credenciais, SSRC nem mídia.

No Windows, a opção experimental de nitidez inicial tem retorno automático em oito segundos e pode ser desligada. Para avaliar, faça testes A/B com a mesma cena e segunda conta Web ou mobile.
