-- Inserir Pri (Prospecção)
INSERT INTO public.controle_agentes (nome_agente, tipo_agente, marca, uf, loja, cnpj, responsavel, implantador, cronograma, status)
VALUES
('Pri', 'Prospecção', 'Denza', 'DF', 'Lago Sul', '10.272.533/0009-33', 'Luiz', 'Pedro', '27/fev', NULL),
('Pri', 'Prospecção', 'Bmw Carros', 'GO', 'GYN', '20.374.616/0001-30', 'Luiz', 'Fernanda', '10/fev', 'erro'),
('Pri', 'Prospecção', 'Bmw Motos', 'GO', 'BR-153', '20.374.616/0002-10', 'Luiz', 'Fernanda', '12/fev', 'erro'),
('Pri', 'Prospecção', 'GM', 'GO', 'GYN', '14.234.954/0001-73', 'Luiz', 'João', '28/fev', 'erro'),
('Pri', 'Prospecção', 'Toyota', 'GO', 'T-7', '05.471.879/0001-73', 'Luiz', 'Moroni', NULL, 'erro'),
('Pri', 'Prospecção', 'Triumph', 'GO', 'BR-153', '26.343.161/0001-71', 'Luiz', NULL, NULL, 'erro'),
('Pri', 'Prospecção', 'Jeep', 'MG', 'UDI', '21.214.513/0001-75', 'Luiz', 'Ana', '27/fev', 'erro'),
('Pri', 'Prospecção', 'Leap Motor', 'MG', 'UDI', '11.458.618/0002-05', 'Luiz', 'Moroni', NULL, NULL),
('Pri', 'Prospecção', 'Geely', 'MT', 'VGD', '62.052.884/0001-85', 'Luiz', 'Moroni', NULL, NULL),
('Pri', 'Prospecção', 'Geely', 'RO', 'PVH', '62.914.200/0001-07', 'Luiz', 'Moroni', NULL, NULL),
('Pri', 'Prospecção', 'Primeiramão', 'RO', 'PVH', '08.748.749/0004-76', 'Luiz', 'Pedro', '25/fev', 'erro'),
('Pri', 'Prospecção', 'Renault', 'RO', 'PVH', '30.903.216/0001-28', 'Luiz', 'Fernanda', '16/fev', 'erro'),
('Pri', 'Prospecção', 'Volkswagen', 'RO', 'PVH', '08.748.749/0001-23', 'Luiz', 'Johnattan', '25/fev', 'erro');

-- Inserir Pri(Ligação)
INSERT INTO public.controle_agentes (nome_agente, tipo_agente, marca, uf, loja, cnpj, responsavel)
VALUES
('Pri(Ligação)', 'Prospecção', 'Geral', 'MG', 'VW T7', '01.104.751/0001-10', 'João'),
('Pri(Ligação)', 'Prospecção', 'Geral', 'RO', 'VW T7', '01.104.751/0001-10', 'João');

-- Inserir Silvia (Seguros)
INSERT INTO public.controle_agentes (nome_agente, tipo_agente, marca, uf, loja, cnpj, responsavel, implantador)
VALUES
('Silvia', 'Seguros', 'Byd', 'DF', 'Park Sul', '10.272.533/0002-67', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Fiat', 'DF', 'Park Sul', '09.348.217/0004-04', 'Johnattan', 'Luiz'),
('Silvia', 'Seguros', 'Hyundai', 'DF', 'Taguatinga', '12.657.826/0008-83', 'Johnattan', 'Luiz'),
('Silvia', 'Seguros', 'Jeep', 'DF', 'Asa Norte', '19.945.014/0006-10', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Nissan', 'DF', 'Taguatinga', '11.727.257/0002-47', 'Johnattan', 'Moroni'),
('Silvia', 'Seguros', 'Primeiramão', 'DF', 'Park Sul', '09.102.044/0012-50', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Denza', 'DF', 'Lago Sul', '10.272.533/0009-33', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Toyota', 'DF', 'Asa Norte', '05.471.879/0005-05', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Volkswagen', 'DF', 'Park Sul', '01.104.751/0004-63', 'Johnattan', 'Johnattan'),
('Silvia', 'Seguros', 'Bmw Carros', 'GO', 'GYN', '20.374.616/0001-30', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Bmw Motos', 'GO', 'BR-153', '20.374.616/0002-10', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Byd', 'GO', 'Marista', '10.272.533/0001-86', 'Johnattan', NULL),
('Silvia', 'Seguros', 'GM', 'GO', 'GYN', '14.234.954/0001-73', 'Johnattan', 'João'),
('Silvia', 'Seguros', 'Hyundai', 'GO', 'T-9', '12.657.826/0005-30', 'Johnattan', 'Luiz'),
('Silvia', 'Seguros', 'Jeep', 'GO', 'T-9', '19.945.014/0003-78', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Nissan', 'GO', '85', '11.727.257/0006-70', 'Johnattan', 'Moroni'),
('Silvia', 'Seguros', 'Primeiramão', 'GO', 'Galpão', '09.102.044/0030-31', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Ram', 'GO', 'House', '19.945.014/0004-59', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Toyota', 'GO', 'T-7', '05.471.879/0001-73', 'Johnattan', 'Moroni'),
('Silvia', 'Seguros', 'Triumph', 'GO', 'BR-153', '26.343.161/0001-71', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Citroen', 'MG', 'UDI', '11.458.618/0001-16', 'Johnattan', 'João'),
('Silvia', 'Seguros', 'Jeep', 'MG', 'UDI', '21.214.513/0001-75', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Leap Motor', 'MG', 'UDI', '11.458.618/0002-05', 'Johnattan', 'Moroni'),
('Silvia', 'Seguros', 'Primeiramão', 'MG', 'Digital UDI', '08.748.749/0006-38', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Ram', 'MG', 'UDI', '21.214.513/0001-75', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Volkswagen', 'MG', 'UDI', '03.947.095/0001-43', 'Johnattan', 'Johnattan'),
('Silvia', 'Seguros', 'Byd', 'MT', 'CBA', '21.333.642/0002-63', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Geely', 'MT', 'VGD', '62.052.884/0001-85', 'Johnattan', 'Moroni'),
('Silvia', 'Seguros', 'Gm', 'MT', 'VGD', '20.379.987/0001-04', 'Johnattan', 'João'),
('Silvia', 'Seguros', 'Hyundai', 'MT', 'CBA', '22.280.413/0002-90', 'Johnattan', 'Luiz'),
('Silvia', 'Seguros', 'Jaguar Land Rover', 'MT', 'CBA', '21.333.642/0001-82', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Nissan', 'MT', 'VGD', '11.748.698/0001-44', 'Johnattan', 'Moroni'),
('Silvia', 'Seguros', 'Primeiramão', 'MT', 'CBA', '08.860.168/0002-60', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Renault', 'MT', 'VGD', '08.860.168/0001-89', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Mitsubishi', 'MT', 'CBA', '74.150.889/0001-20', 'Johnattan', 'João'),
('Silvia', 'Seguros', 'Byd', 'RO', 'PVH', '50.071.859/0001-60', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Geely', 'RO', 'PVH', '62.914.200/0001-07', 'Johnattan', 'Moroni'),
('Silvia', 'Seguros', 'Hyundai', 'RO', 'PVH', '21.428.039/0001-84', 'Johnattan', 'Luiz'),
('Silvia', 'Seguros', 'Primeiramão', 'RO', 'PVH', '08.748.749/0004-76', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Renault', 'RO', 'PVH', '30.903.216/0001-28', 'Johnattan', NULL),
('Silvia', 'Seguros', 'Volkswagen', 'RO', 'PVH', '08.748.749/0001-23', 'Johnattan', 'Johnattan');

-- Inserir Steve (Projetos TI)
INSERT INTO public.controle_agentes (nome_agente, tipo_agente, marca, uf, loja, cnpj, responsavel)
VALUES
('Steve', 'Projetos Ti', 'Geral', 'GO', 'PVH', '08.748.749/0001-23', 'Moroni');