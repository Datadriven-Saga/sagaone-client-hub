import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista de empresas do CSV - atualizada em 12/01/2026
const empresasCSV = [
  { cnpj: "08.748.749/0004-76", nome: "SN RO BR", marca: "SEMINOVOS", uf: "RO", crm_id: "36510", cidade: "PORTO VELHO" },
  { cnpj: "08.748.749/0006-38", nome: "SN RO DIGITAL", marca: "SEMINOVOS", uf: "RO", crm_id: "31991", cidade: "PORTO VELHO" },
  { cnpj: "08.748.749/0002-04", nome: "SN RO PREMIUM", marca: "SEMINOVOS", uf: "RO", crm_id: "18376", cidade: "PORTO VELHO" },
  { cnpj: "08.748.749/0003-95", nome: "SN RO REPASSE", marca: "SEMINOVOS", uf: "RO", crm_id: "71335", cidade: "PORTO VELHO" },
  { cnpj: "08.748.749/0001-23", nome: "VW PVH", marca: "VOLKSWAGEN", uf: "RO", crm_id: "18352", cidade: "CUIABÁ" },
  { cnpj: "21.428.039/0001-84", nome: "HYUNDAI PVH", marca: "HYUNDAI", uf: "RO", crm_id: "18367", cidade: "PORTO VELHO" },
  { cnpj: "03.267.961/0004-06", nome: "SN MG AFONSO PENA", marca: "SEMINOVOS", uf: "MG", crm_id: "22603", cidade: "UBERLÂNDIA" },
  { cnpj: "03.267.961/0003-17", nome: "SN MG OFF ROAD", marca: "SEMINOVOS", uf: "MG", crm_id: "5155", cidade: "UBERLÂNDIA" },
  { cnpj: "03.267.961/0002-36", nome: "SN MG DIGITAL", marca: "SEMINOVOS", uf: "MG", crm_id: "22601", cidade: "UBERLÂNDIA" },
  { cnpj: "03.267.961/0001-55", nome: "VW UDI MATRIZ", marca: "VOLKSWAGEN", uf: "MG", crm_id: "35646", cidade: "UBERLÂNDIA" },
  { cnpj: "11.458.618/0001-16", nome: "CITROEN UDI", marca: "CITROEN", uf: "MG", crm_id: "35647", cidade: "UBERLÂNDIA" },
  { cnpj: "33.863.628/0001-70", nome: "MOOVE GO", marca: "MOOVE", uf: "GO", crm_id: "54939", cidade: "GOIÂNIA" },
  { cnpj: "20.374.616/0001-30", nome: "BMW GYN", marca: "BMW", uf: "GO", crm_id: "18412", cidade: "GOIÂNIA" },
  { cnpj: "20.374.616/0002-10", nome: "BMW MOTOS", marca: "BMW MOTOS", uf: "GO", crm_id: "52368", cidade: "GOIÂNIA" },
  { cnpj: "09.102.044/0011-79", nome: "SN DF ASA NORTE", marca: "SEMINOVOS", uf: "DF", crm_id: "31994", cidade: "BRASÍLIA" },
  { cnpj: "09.102.044/0015-00", nome: "SN DF COLORADO", marca: "SEMINOVOS", uf: "DF", crm_id: "18407", cidade: "BRASÍLIA" },
  { cnpj: "09.102.044/0014-11", nome: "SN DF CONTAINER", marca: "SEMINOVOS", uf: "DF", crm_id: "18403", cidade: "BRASÍLIA" },
  { cnpj: "09.102.044/0008-73", nome: "SN DF GAMA", marca: "SEMINOVOS", uf: "DF", crm_id: "18409", cidade: "BRASÍLIA" },
  { cnpj: "09.102.044/0016-83", nome: "SN DF GUARA", marca: "SEMINOVOS", uf: "DF", crm_id: "18410", cidade: "BRASÍLIA" },
  { cnpj: "09.102.044/0010-98", nome: "SN DF JD BOTANICO", marca: "SEMINOVOS", uf: "DF", crm_id: "34885", cidade: "BRASÍLIA" },
  { cnpj: "09.102.044/0012-50", nome: "SN DF PARK SUL", marca: "SEMINOVOS", uf: "DF", crm_id: "18404", cidade: "BRASÍLIA" },
  { cnpj: "09.102.044/0019-26", nome: "SN DF SADIF", marca: "SEMINOVOS", uf: "DF", crm_id: "18408", cidade: "BRASÍLIA" },
  { cnpj: "09.102.044/0017-64", nome: "SN DF SCIA", marca: "SEMINOVOS", uf: "DF", crm_id: "18406", cidade: "BRASÍLIA" },
  { cnpj: "09.102.044/0009-54", nome: "SN DF TGT", marca: "SEMINOVOS", uf: "DF", crm_id: "18414", cidade: "BRASÍLIA" },
  { cnpj: "09.102.044/0018-45", nome: "SN DF VLP", marca: "SEMINOVOS", uf: "DF", crm_id: "18417", cidade: "VALPARAÍSO DE GOIÁS" },
  { cnpj: "09.102.044/0025-74", nome: "SN GO ANAPOLIS", marca: "SEMINOVOS", uf: "GO", crm_id: "18415", cidade: "ANÁPOLIS" },
  { cnpj: "09.102.044/0026-55", nome: "SN GO BURITI", marca: "SEMINOVOS", uf: "GO", crm_id: "18405", cidade: "GOIÂNIA" },
  { cnpj: "09.102.044/0028-17", nome: "SN GO CJ", marca: "SEMINOVOS", uf: "GO", crm_id: "70950", cidade: "GOIÂNIA" },
  { cnpj: "09.102.044/0022-21", nome: "SN GO OFF ROAD 85", marca: "SEMINOVOS", uf: "GO", crm_id: "31990", cidade: "GOIÂNIA" },
  { cnpj: "09.102.044/0020-60", nome: "SN GO OFF ROAD T7", marca: "SEMINOVOS", uf: "GO", crm_id: "18416", cidade: "GOIÂNIA" },
  { cnpj: "09.102.044/0029-06", nome: "SN GO PASSEIO", marca: "SEMINOVOS", uf: "GO", crm_id: "76125", cidade: "GOIÂNIA" },
  { cnpj: "09.102.044/0027-36", nome: "SN GO RVD", marca: "SEMINOVOS", uf: "GO", crm_id: "53566", cidade: "RIO VERDE" },
  { cnpj: "09.102.044/0023-02", nome: "SN GO T7", marca: "SEMINOVOS", uf: "GO", crm_id: "18413", cidade: "GOIÂNIA" },
  { cnpj: "21.333.642/0002-63", nome: "BYD CBA", marca: "BYD", uf: "MT", crm_id: "72176", cidade: "CUIABÁ" },
  { cnpj: "21.333.642/0004-25", nome: "BYD RONDONÓPOLIS", marca: "BYD", uf: "MT", crm_id: "86776", cidade: "RONDONÓPOLIS" },
  { cnpj: "21.333.642/0003-44", nome: "BYD SINOP", marca: "BYD", uf: "MT", crm_id: "86642", cidade: "SINOP" },
  { cnpj: "21.333.642/0005-06", nome: "BYD VGD", marca: "BYD", uf: "MT", crm_id: "86646", cidade: "CUIABÁ" },
  { cnpj: "00.283.283/0001-26", nome: "CORRETORA-SAGA CORRETORA", marca: "CORRETORA", uf: "GO", crm_id: "54858", cidade: "GOIÂNIA" },
  { cnpj: "19.945.014/0002-97", nome: "JEEP ANA", marca: "JEEP", uf: "GO", crm_id: "18355", cidade: "ANÁPOLIS" },
  { cnpj: "19.945.014/0006-10", nome: "JEEP ASA NORTE", marca: "JEEP", uf: "DF", crm_id: "18373", cidade: "BRASÍLIA" },
  { cnpj: "19.945.014/0001-06", nome: "JEEP BR", marca: "JEEP", uf: "GO", crm_id: "18354", cidade: "GOIÂNIA" },
  { cnpj: "19.945.014/0005-30", nome: "JEEP COLORADO", marca: "JEEP", uf: "DF", crm_id: "18372", cidade: "BRASÍLIA" },
  { cnpj: "19.945.014/0003-78", nome: "JEEP T9", marca: "JEEP", uf: "GO", crm_id: "18357", cidade: "GOIÂNIA" },
  { cnpj: "19.945.014/0007-00", nome: "JEEP TGT", marca: "JEEP", uf: "DF", crm_id: "18375", cidade: "BRASÍLIA" },
  { cnpj: "19.945.014/0004-59", nome: "RAM HOUSE", marca: "RAM", uf: "GO", crm_id: "18356", cidade: "GOIÂNIA" },
  { cnpj: "19.945.014/0009-63", nome: "SN DF JEEP SCIA", marca: "SEMINOVOS", uf: "DF", crm_id: "69777", cidade: "BRASÍLIA" },
  { cnpj: "11.727.257/0006-70", nome: "NISSAN 85", marca: "NISSAN", uf: "GO", crm_id: "18431", cidade: "GOIÂNIA" },
  { cnpj: "11.727.257/0005-90", nome: "NISSAN ANA", marca: "NISSAN", uf: "GO", crm_id: "18386", cidade: "ANÁPOLIS" },
  { cnpj: "11.727.257/0003-28", nome: "NISSAN BR", marca: "NISSAN", uf: "GO", crm_id: "18389", cidade: "GOIÂNIA" },
  { cnpj: "11.727.257/0001-66", nome: "NISSAN COLORADO", marca: "NISSAN", uf: "DF", crm_id: "18388", cidade: "BRASÍLIA" },
  { cnpj: "11.727.257/0004-09", nome: "NISSAN RVD", marca: "NISSAN", uf: "GO", crm_id: "18390", cidade: "RIO VERDE" },
  { cnpj: "11.727.257/0002-47", nome: "NISSAN TGT", marca: "NISSAN", uf: "DF", crm_id: "18391", cidade: "BRASÍLIA" },
  { cnpj: "13.243.978/0002-07", nome: "KIA PARK SUL", marca: "KIA", uf: "DF", crm_id: "18377", cidade: "BRASÍLIA" },
  { cnpj: "13.243.978/0001-26", nome: "SN DF OUTLET", marca: "SEMINOVOS", uf: "DF", crm_id: "102155", cidade: "BRASÍLIA" },
  { cnpj: "20.379.987/0006-19", nome: "GM CBA", marca: "GM", uf: "MT", crm_id: "9055", cidade: "CUIABÁ" },
  { cnpj: "20.379.987/0003-76", nome: "GM CS", marca: "GM", uf: "MT", crm_id: "9053", cidade: "CÁCERES" },
  { cnpj: "20.379.987/0001-04", nome: "GM VGD", marca: "GM", uf: "MT", crm_id: "9057", cidade: "VÁRZEA GRANDE" },
  { cnpj: "21.333.642/0001-82", nome: "JAGUAR LAND ROVER CBA", marca: "JAGUAR", uf: "MT", crm_id: "72178", cidade: "CUIABÁ" },
  { cnpj: "11.748.698/0002-25", nome: "NISSAN CBA", marca: "NISSAN", uf: "MT", crm_id: "31491", cidade: "CUIABÁ" },
  { cnpj: "11.748.698/0003-06", nome: "NISSAN TANGARÁ", marca: "NISSAN", uf: "MT", crm_id: "63957", cidade: "TANGARÁ DA SERRA" },
  { cnpj: "11.748.698/0001-44", nome: "NISSAN VGD", marca: "NISSAN", uf: "MT", crm_id: "18387", cidade: "VÁRZEA GRANDE" },
  { cnpj: "05.471.879/0002-54", nome: "TOYOTA ANA", marca: "TOYOTA", uf: "GO", crm_id: "18384", cidade: "ANÁPOLIS" },
  { cnpj: "05.471.879/0005-05", nome: "TOYOTA ASA NORTE", marca: "TOYOTA", uf: "DF", crm_id: "18425", cidade: "BRASÍLIA" },
  { cnpj: "05.471.879/0003-35", nome: "TOYOTA BURITI", marca: "TOYOTA", uf: "GO", crm_id: "18426", cidade: "APARECIDA DE GOIÂNIA" },
  { cnpj: "05.471.879/0004-16", nome: "TOYOTA COLORADO", marca: "TOYOTA", uf: "DF", crm_id: "18427", cidade: "BRASÍLIA" },
  { cnpj: "05.471.879/0010-64", nome: "TOYOTA GOIANÉSIA", marca: "TOYOTA", uf: "GO", crm_id: "88179", cidade: "GOIANÉSIA" },
  { cnpj: "05.471.879/0001-73", nome: "TOYOTA GYN", marca: "TOYOTA", uf: "GO", crm_id: "18383", cidade: "GOIÂNIA" },
  { cnpj: "05.471.879/0013-07", nome: "SN GO OFF ROAD 85", marca: "SEMINOVOS", uf: "GO", crm_id: "63864", cidade: "GOIÂNIA" },
  { cnpj: "05.471.879/0012-26", nome: "SN GO OFF ROAD T7", marca: "SEMINOVOS", uf: "GO", crm_id: "63865", cidade: "GOIÂNIA" },
  { cnpj: "12.657.826/0011-89", nome: "HYUNDAI GAMA", marca: "HYUNDAI", uf: "DF", crm_id: "36517", cidade: "BRASÍLIA" },
  { cnpj: "12.657.826/0007-00", nome: "HYUNDAI ANA", marca: "HYUNDAI", uf: "GO", crm_id: "18365", cidade: "ANÁPOLIS" },
  { cnpj: "12.657.826/0006-11", nome: "HYUNDAI CJ", marca: "HYUNDAI", uf: "GO", crm_id: "18366", cidade: "GOIÂNIA" },
  { cnpj: "12.657.826/0009-64", nome: "HYUNDAI SIA", marca: "HYUNDAI", uf: "DF", crm_id: "18363", cidade: "BRASÍLIA" },
  { cnpj: "12.657.826/0005-30", nome: "HYUNDAI T9", marca: "HYUNDAI", uf: "GO", crm_id: "18371", cidade: "GOIÂNIA" },
  { cnpj: "12.657.826/0008-83", nome: "HYUNDAI TGT", marca: "HYUNDAI", uf: "DF", crm_id: "18368", cidade: "BRASÍLIA" },
  { cnpj: "12.657.826/0012-60", nome: "SN DF HYUNDAI GAMA", marca: "SEMINOVOS", uf: "DF", crm_id: "69775", cidade: "BRASÍLIA" },
  { cnpj: "30.903.216/0001-28", nome: "RENAULT PVH", marca: "RENAULT", uf: "RO", crm_id: "18401", cidade: "PORTO VELHO" },
  { cnpj: "21.214.513/0001-75", nome: "JEEP UDI", marca: "JEEP", uf: "MG", crm_id: "18374", cidade: "UBERLÂNDIA" },
  { cnpj: "08.860.168/0006-93", nome: "RENAULT CBA", marca: "RENAULT", uf: "MT", crm_id: "53766", cidade: "CUIABÁ" },
  { cnpj: "08.860.168/0001-89", nome: "RENAULT VGD", marca: "RENAULT", uf: "MT", crm_id: "53764", cidade: "VÁRZEA GRANDE" },
  { cnpj: "08.860.168/0002-60", nome: "SN MT CBA", marca: "SEMINOVOS", uf: "MT", crm_id: "18418", cidade: "CUIABÁ" },
  { cnpj: "08.860.168/0004-21", nome: "SN MT OFF ROAD", marca: "SEMINOVOS", uf: "MT", crm_id: "1592", cidade: "CUIABÁ" },
  { cnpj: "16.803.158/0012-92", nome: "CITROEN BSB", marca: "CITROEN", uf: "DF", crm_id: "53589", cidade: "BRASÍLIA" },
  { cnpj: "16.803.158/0001-30", nome: "CITROEN SIA", marca: "CITROEN", uf: "DF", crm_id: "31486", cidade: "BRASÍLIA" },
  { cnpj: "16.803.158/0004-82", nome: "CITROEN TGT", marca: "CITROEN", uf: "DF", crm_id: "18395", cidade: "BRASÍLIA" },
  { cnpj: "16.803.158/0007-25", nome: "SN GO CITROEN", marca: "SEMINOVOS", uf: "GO", crm_id: "31992", cidade: "GOIÂNIA" },
  { cnpj: "34.779.837/0001-00", nome: "CHERY VLP", marca: "CHERY", uf: "DF", crm_id: "34866", cidade: "VALPARAÍSO DE GOIÁS" },
  { cnpj: "19.945.014/0002-97", nome: "RAM ANA", marca: "RAM", uf: "GO", crm_id: "67169", cidade: "ANÁPOLIS" },
  { cnpj: "19.945.014/0001-06", nome: "RAM BR", marca: "RAM", uf: "GO", crm_id: "67166", cidade: "GOIÂNIA" },
  { cnpj: "21.214.513/0001-75", nome: "RAM UDI", marca: "RAM", uf: "MG", crm_id: "70952", cidade: "UBERLÂNDIA" },
  { cnpj: "09.348.217/0007-57", nome: "SADIF - DEPOSITO DF", marca: "OUTROS", uf: "DF", crm_id: "29958", cidade: "BRASÍLIA" },
  { cnpj: "09.348.217/0006-76", nome: "FIAT COLORADO", marca: "FIAT", uf: "DF", crm_id: "7126", cidade: "BRASÍLIA" },
  { cnpj: "09.348.217/0003-23", nome: "FIAT GAMA", marca: "FIAT", uf: "DF", crm_id: "7122", cidade: "BRASÍLIA" },
  { cnpj: "09.348.217/0004-04", nome: "FIAT PARK SUL", marca: "FIAT", uf: "DF", crm_id: "7125", cidade: "BRASÍLIA" },
  { cnpj: "09.348.217/0001-61", nome: "FIAT SIA", marca: "FIAT", uf: "DF", crm_id: "7119", cidade: "BRASÍLIA" },
  { cnpj: "01.104.751/0007-06", nome: "SAGA - HYUNDAI T9", marca: "HYUNDAI", uf: "GO", crm_id: "18362", cidade: "GOIÂNIA" },
  { cnpj: "01.104.751/0023-26", nome: "VW BURITI", marca: "VOLKSWAGEN", uf: "GO", crm_id: "70951", cidade: "APARECIDA DE GOIÂNIA" },
  { cnpj: "01.104.751/0006-25", nome: "SAGA - VW BURITI (FECHADA)", marca: "VOLKSWAGEN", uf: "GO", crm_id: "18353", cidade: "APARECIDA DE GOIÂNIA" },
  { cnpj: "01.104.751/0011-92", nome: "VW CIDADE", marca: "VOLKSWAGEN", uf: "DF", crm_id: "18433", cidade: "BRASÍLIA" },
  { cnpj: "01.104.751/0014-35", nome: "VW GAMA", marca: "VOLKSWAGEN", uf: "DF", crm_id: "18434", cidade: "BRASÍLIA" },
  { cnpj: "01.104.751/0004-63", nome: "VW PARK SUL", marca: "VOLKSWAGEN", uf: "DF", crm_id: "18432", cidade: "BRASÍLIA" },
  { cnpj: "01.104.751/0001-10", nome: "VW T7", marca: "VOLKSWAGEN", uf: "GO", crm_id: "18424", cidade: "GOIÂNIA" },
  { cnpj: "01.104.751/0009-78", nome: "HYUNDAI IMPORTS PARK SUL", marca: "HYUNDAI IMPORTADOS", uf: "DF", crm_id: "18364", cidade: "BRASÍLIA" },
  { cnpj: "22.280.413/0002-90", nome: "HYUNDAI CBA", marca: "HYUNDAI", uf: "MT", crm_id: "9859", cidade: "CUIABÁ" },
  { cnpj: "22.280.413/0001-00", nome: "HYUNDAI VGD", marca: "HYUNDAI", uf: "MT", crm_id: "18369", cidade: "VÁRZEA GRANDE" },
  { cnpj: "10.272.533/0004-29", nome: "BYD LAGO SUL", marca: "BYD", uf: "DF", crm_id: "15828", cidade: "BRASÍLIA" },
  { cnpj: "10.272.533/0001-86", nome: "BYD GYN", marca: "BYD", uf: "GO", crm_id: "15836", cidade: "GOIÂNIA" },
  { cnpj: "10.272.533/0002-67", nome: "BYD PARK SUL", marca: "BYD", uf: "DF", crm_id: "15827", cidade: "BRASÍLIA" },
  { cnpj: "10.272.533/0005-00", nome: "BYD TGT", marca: "BYD", uf: "DF", crm_id: "86643", cidade: "BRASÍLIA" },
  { cnpj: "20.374.616/0005-63", nome: "CRT GO (MUNIQUE)", marca: "SEMINOVOS", uf: "GO", crm_id: "34163", cidade: "GOIÂNIA" },
  { cnpj: "15.635.814/0017-37", nome: "SN DF PARK SUL", marca: "SEMINOVOS", uf: "DF", crm_id: "18421", cidade: "BRASÍLIA" },
  { cnpj: "15.635.814/0007-65", nome: "SN MT PANTANAL", marca: "SEMINOVOS", uf: "MT", crm_id: "18422", cidade: "CUIABÁ" },
  { cnpj: "74.150.889/0001-20", nome: "MITSUBISHI CBA", marca: "MITSUBISHI", uf: "MT", crm_id: "20429", cidade: "CUIABÁ" },
  { cnpj: "26.343.161/0001-71", nome: "TRIUMPH GYN", marca: "TRIUMPH", uf: "GO", crm_id: "31988", cidade: "GOIÂNIA" },
  { cnpj: "14.234.954/0002-54", nome: "GM BURITI", marca: "GM", uf: "GO", crm_id: "18430", cidade: "APARECIDA DE GOIÂNIA" },
  { cnpj: "14.234.954/0001-73", nome: "GM GYN", marca: "GM", uf: "GO", crm_id: "18429", cidade: "GOIÂNIA" },
  { cnpj: "33.896.745/0001-30", nome: "RENAULT PARK SUL", marca: "RENAULT", uf: "DF", crm_id: "31492", cidade: "BRASÍLIA" },
  { cnpj: "33.896.745/0003-00", nome: "SN GO OUTLET", marca: "SEMINOVOS", uf: "GO", crm_id: "102099", cidade: "GOIÂNIA" },
  { cnpj: "50.071.859/0001-60", nome: "BYD PVH", marca: "BYD", uf: "RO", crm_id: "66479", cidade: "PORTO VELHO" },
  { cnpj: "52.853.118/0001-66", nome: "MOOVE SP", marca: "MOOVE", uf: "SP", crm_id: "54939", cidade: "SÃO PAULO" },
  { cnpj: "08.860.168/0001-892", nome: "SN MT VGD", marca: "SEMINOVOS", uf: "MT", crm_id: "18400", cidade: "VÁRZEA GRANDE" },
  { cnpj: "08.860.168/0006-932", nome: "SN MT COXIPÓ", marca: "SEMINOVOS", uf: "MT", crm_id: "37571", cidade: "CUIABÁ" },
  { cnpj: "21.333.642/0001-822", nome: "SN MT PREMIUM", marca: "SEMINOVOS", uf: "MT", crm_id: "18379", cidade: "CUIABÁ" },
  { cnpj: "08.860.168/0008-55", nome: "SN MT F CORREA", marca: "SEMINOVOS", uf: "MT", crm_id: "88180", cidade: "CUIABÁ" },
  { cnpj: "20.374.616/0002-102", nome: "BMW MOTOS PRIMEIRA MÃO", marca: "SEMINOVOS", uf: "GO", crm_id: "18351", cidade: "GOIÂNIA" },
  { cnpj: "03.267.961/0001-552", nome: "SN MG JOAO NAVES", marca: "SEMINOVOS", uf: "MG", crm_id: "22602", cidade: "UBERLÂNDIA" },
  { cnpj: "20.379.987/0009-61", nome: "GM CONTAINER", marca: "GM", uf: "MT", crm_id: "92807", cidade: "CUIABÁ" },
  { cnpj: "09.102.044/0030-31", nome: "SN GO GALPÃO", marca: "SEMINOVOS", uf: "GO", crm_id: "94246", cidade: "GOIÂNIA" },
  { cnpj: "10.272.533/0007-71", nome: "BYD CJ", marca: "BYD", uf: "GO", crm_id: "96522", cidade: "GOIÂNIA" },
  { cnpj: "21.333.642/0007-78", nome: "BYD CS", marca: "BYD", uf: "MT", crm_id: "96435", cidade: "CÁCERES" },
  { cnpj: "21.214.513/0001-75", nome: "SN MG OUTLET", marca: "SEMINOVOS", uf: "MG", crm_id: "102027", cidade: "UBERLÂNDIA" },
  { cnpj: "22.280.413/0001-00", nome: "SN MT OUTLET", marca: "SEMINOVOS", uf: "MT", crm_id: "101714", cidade: "CUIABÁ" },
  { cnpj: "50.071.859/0001-60", nome: "SN RO OUTLET", marca: "SEMINOVOS", uf: "RO", crm_id: "102158", cidade: "PORTO VELHO" },
  { cnpj: "74.150.889/0003-91", nome: "MITSUBISHI RONDONÓPOLIS", marca: "MITSUBISHI", uf: "MT", crm_id: "86644", cidade: "RONDONÓPOLIS" },
  { cnpj: "62.052.884/0001-85", nome: "GEELY VGD", marca: "GEELY", uf: "MT", crm_id: "105723", cidade: "VÁRZEA GRANDE" },
  { cnpj: "11.458.618/0002-05", nome: "LEAP UDI", marca: "LEAP", uf: "MG", crm_id: "105721", cidade: "UBERLÂNDIA" },
  { cnpj: "62.914.200/0001-07", nome: "GEELY PVH", marca: "GEELY", uf: "RO", crm_id: "105722", cidade: "PORTO VELHO" },
  { cnpj: "10.272.533/0009-33", nome: "DENZA LAGO SUL", marca: "DENZA", uf: "DF", crm_id: "107712", cidade: "BRASÍLIA" },
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting empresas sync...');
    
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autenticação não fornecido');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tipo_acesso')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.tipo_acesso !== 'Administrador') {
      throw new Error('Apenas administradores podem sincronizar empresas');
    }

    // Get current empresas
    const { data: currentEmpresas, error: fetchError } = await supabase
      .from('empresas')
      .select('id, cnpj, crm_id');

    if (fetchError) {
      throw new Error(`Erro ao buscar empresas: ${fetchError.message}`);
    }

    console.log(`Found ${currentEmpresas?.length || 0} existing empresas`);

    // Build maps for comparison - using crm_id as the main identifier
    const csvByCrmId = new Map(empresasCSV.map(e => [e.crm_id, e]));
    const currentByCrmId = new Map(currentEmpresas?.map(e => [e.crm_id, e]) || []);

    const results = {
      added: [] as Array<{ nome: string; crm_id: string; status: string }>,
      updated: [] as Array<{ nome: string; crm_id: string; status: string }>,
      deleted: [] as Array<{ id: string; crm_id: string; status: string }>,
      errors: [] as Array<{ nome?: string; crm_id?: string; error: string }>,
    };

    // 1. Delete empresas not in CSV (except "Empresa Padrão")
    for (const [crm_id, empresa] of currentByCrmId) {
      if (crm_id && !csvByCrmId.has(crm_id)) {
        console.log(`Deleting empresa with crm_id ${crm_id}...`);
        const { error: deleteError } = await supabase
          .from('empresas')
          .delete()
          .eq('id', empresa.id);

        if (deleteError) {
          results.errors.push({ crm_id: crm_id || '', error: deleteError.message });
        } else {
          results.deleted.push({ id: empresa.id, crm_id: crm_id || '', status: 'deleted' });
        }
      }
    }

    // 2. Add or update empresas from CSV
    for (const empresa of empresasCSV) {
      const existingByCrmId = currentByCrmId.get(empresa.crm_id);

      if (existingByCrmId) {
        // Update existing
        console.log(`Updating empresa ${empresa.nome}...`);
        const { error: updateError } = await supabase
          .from('empresas')
          .update({
            nome_empresa: empresa.nome,
            cnpj: empresa.cnpj,
            marca: empresa.marca,
            uf: empresa.uf,
            cidade: empresa.cidade,
            grupo_empresarial: 'SAGA',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingByCrmId.id);

        if (updateError) {
          results.errors.push({ nome: empresa.nome, crm_id: empresa.crm_id, error: updateError.message });
        } else {
          results.updated.push({ nome: empresa.nome, crm_id: empresa.crm_id, status: 'updated' });
        }
      } else {
        // Insert new
        console.log(`Adding empresa ${empresa.nome}...`);
        const { error: insertError } = await supabase
          .from('empresas')
          .insert({
            nome_empresa: empresa.nome,
            cnpj: empresa.cnpj,
            marca: empresa.marca,
            uf: empresa.uf,
            cidade: empresa.cidade,
            crm_id: empresa.crm_id,
            grupo_empresarial: 'SAGA',
          });

        if (insertError) {
          results.errors.push({ nome: empresa.nome, crm_id: empresa.crm_id, error: insertError.message });
        } else {
          results.added.push({ nome: empresa.nome, crm_id: empresa.crm_id, status: 'added' });
        }
      }
    }

    console.log('Sync completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          added: results.added.length,
          updated: results.updated.length,
          deleted: results.deleted.length,
          errors: results.errors.length,
        },
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-empresas:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
