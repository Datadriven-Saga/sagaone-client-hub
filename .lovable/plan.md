## Objetivo
Inserir o texto explicativo sobre funcionamento do agendamento de disparos no modal `ProgramarDisparoModal.tsx`, logo após o aviso de fuso horário existente (opção 2 aprovada pelo usuário).

## Texto a inserir
```
Escolha a data e o horário para iniciar o disparo.
Você pode enviar todos os contatos de uma vez ou dividir em lotes, por quantidade de lotes ou por tamanho de lote.

Os disparos são executados apenas entre 07h e 20h, no horário de Brasília. Caso divida em lotes, o intervalo mínimo entre eles é de 30 minutos.
```

## Implementação
1. Editar `src/components/ProgramarDisparoModal.tsx`.
2. Adicionar novo `<div>` informativo logo após o bloco `bg-amber-50` existente (linhas ~138-140).
3. Estilo: `rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900` para diferenciar visualmente do warning amber.
4. Texto formatado com quebras de linha (`<p>` ou `<br/>`).

## Verificação
- Build passa sem erros.
- Visual no preview confirma bloco posicionado corretamente abaixo do fuso horário.