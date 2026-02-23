-- Renomear empresa
UPDATE public.empresas 
SET nome_empresa = 'EMPRESA ADMIN', updated_at = now()
WHERE id = 'b32ae8c9-34f6-4646-946e-2a05ff07b02b';

-- Atribuir a todos os usuários Admin e Master
INSERT INTO public.user_empresas (user_id, empresa_id, is_ativa)
VALUES 
  ('47fe90b2-3549-4d53-adcb-6be9666007fc', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('e0c2a8a2-3b34-4a0e-a872-c3318b318479', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('763cdd93-4b3b-4021-bfde-5f2622ecc802', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('e8ce5040-eef8-4c1d-bd9d-bc7295ba9f00', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('e5bc2f28-0c4d-41be-8219-f5d8119cf205', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('2ad78208-b241-4646-a520-09e739280887', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('240d8c4e-f7d2-4201-87b5-7e7873dbd218', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('e8f40b37-b4df-4b8a-819f-14cd1568f083', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('ab18cf58-cad1-48f6-b585-227235c201a4', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('11517f3d-db63-4e72-b0d6-bb8806440506', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('b5c7d7ec-0401-435c-b3e5-06a5ef8fa0f2', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('971d1703-b69e-43f3-a23d-b8fb2d6eb21a', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false),
  ('c906df49-ce02-423f-aeda-d918cfb7a77d', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', false)
ON CONFLICT (user_id, empresa_id) DO NOTHING;