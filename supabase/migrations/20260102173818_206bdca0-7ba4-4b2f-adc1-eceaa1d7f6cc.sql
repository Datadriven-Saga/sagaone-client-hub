-- Inserir motivos de insucesso padrão para todas as empresas
INSERT INTO public.motivos_insucesso (empresa_id, descricao, ordem, ativo)
SELECT 
    e.id,
    motivo.descricao,
    motivo.ordem,
    true
FROM public.empresas e
CROSS JOIN (
    VALUES 
        ('Cliente tem interesse em Seminovo', 1),
        ('Comercial (Valor Acima do Esperado, Avaliação do Usado)', 2),
        ('Desistência (Pesquisando, Motivo Pessoal, Compra Futura)', 3),
        ('Financeiro (Recusa, Documentação, Restrição ou Ficha Reprovada)', 4),
        ('Lead incorreto (Duplicado, Telefone incorreto, Outro Departamento)', 5),
        ('Sem contato (Indisponível, Não atende)', 6),
        ('Sem o veiculo desejado pelo cliente', 7),
        ('Cliente comprou veículo em outro lugar', 8)
) AS motivo(descricao, ordem)
WHERE NOT EXISTS (
    SELECT 1 FROM public.motivos_insucesso mi 
    WHERE mi.empresa_id = e.id AND mi.descricao = motivo.descricao
);