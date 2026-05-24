## Plano

1. Confirmar o efeito da rotação da `LOVABLE_API_KEY` no fluxo do S3.
2. Testar a função `de-para-s3` com a ação `list` para verificar se o erro `Credential not found` desapareceu.
3. Se ainda houver `401`, seguir para a próxima alternativa cirúrgica: reconectar a conexão `entra-dados-custom`.

## Critério de sucesso

- A função `de-para-s3` responde com sucesso ao `list`.
- O menu De-Para consegue ler/gravar no S3 sem novo erro de credencial.

## Detalhes técnicos

- A rotação já foi disparada e a nova chave foi gravada no projeto.
- O ponto mais importante agora é validar se as edge functions já passaram a usar a chave nova.
- Se o gateway continuar rejeitando a credencial, isso reforça que o vínculo da conexão S3 precisa ser refeito.