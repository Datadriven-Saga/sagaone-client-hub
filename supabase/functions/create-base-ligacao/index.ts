import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Webhook externo para sincronização
const WEBHOOK_CRIA_BASE = 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-base-ligacao';

interface ContatoInput {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
}

interface RequestBody {
  contatos: ContatoInput[];
  id_evento: number;
  telefone_pri: string;
  empresa_id: string;
  prospeccao_id: string;
  loja?: string;
  sync_external?: boolean;
}

// Normaliza telefone para exatamente 10 dígitos (DDD + 8 dígitos, sem o 9 inicial)
const normalizePhoneTo10Digits = (phone: string | null): { valid: boolean; normalized: string; original: string } => {
  const original = phone || '';
  if (!phone) return { valid: false, normalized: '', original };
  
  let digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith('0055')) digits = digits.slice(4);
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);
  if (digits.length === 11 && digits[2] === '9') digits = digits.slice(0, 2) + digits.slice(3);
  
  if (digits.length !== 10) return { valid: false, normalized: '', original };
  if (!/^[1-9]\d$/.test(digits.slice(0, 2))) return { valid: false, normalized: '', original };
  
  return { valid: true, normalized: digits, original };
};

// Normaliza telefone mantendo formato original (apenas dígitos)
const normalizePhone = (phone: string | null): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith('0055')) digits = digits.slice(4);
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);
  return digits;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 [${requestId}] CREATE-BASE-LIGACAO - Iniciando`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const body: RequestBody = await req.json();
    const { 
      contatos, 
      id_evento, 
      telefone_pri, 
      empresa_id, 
      prospeccao_id,
      loja,
      sync_external = true 
    } = body;

    if (!contatos || contatos.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum contato fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!id_evento) {
      return new Response(
        JSON.stringify({ success: false, error: 'id_evento é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const skipLocalSave = !empresa_id;

    console.log(`📥 [${requestId}] Dados recebidos:`);
    console.log(`   ├─ Total contatos: ${contatos.length}`);
    console.log(`   ├─ ID Evento: ${id_evento}`);
    console.log(`   ├─ Telefone Pri: ${telefone_pri}`);
    console.log(`   ├─ Empresa ID: ${empresa_id}`);
    console.log(`   ├─ Prospecção ID: ${prospeccao_id}`);
    console.log(`   ├─ Loja (param): ${loja || 'N/A'}`);
    console.log(`   └─ Sync External: ${sync_external}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =====================================================
    // BUSCAR NOME DA EMPRESA (SEMPRE do banco, nunca do agente)
    // =====================================================
    let nomeEmpresa = '';
    if (empresa_id) {
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nome_empresa')
        .eq('id', empresa_id)
        .single();
      nomeEmpresa = empresaData?.nome_empresa || '';
    }
    // Fallback: usar parâmetro loja apenas se não encontrou no banco
    if (!nomeEmpresa) {
      nomeEmpresa = loja || '';
    }

    console.log(`🏪 [${requestId}] Nome da loja (empresa): "${nomeEmpresa}"`);

    const telefonePriResult = normalizePhoneTo10Digits(telefone_pri);
    const telefonePriNormalizado = telefonePriResult.normalized || telefone_pri.replace(/\D/g, '');
    const now = new Date().toISOString();

    // Validar e normalizar telefones
    const contatosValidados = contatos.map(contato => {
      const result = normalizePhoneTo10Digits(contato.telefone);
      return { ...contato, phoneResult: result };
    });
    
    const contatosValidos = contatosValidados.filter(c => c.phoneResult.valid);
    const contatosInvalidos = contatosValidados.filter(c => !c.phoneResult.valid);
    
    console.log(`📊 [${requestId}] Validação: ${contatosValidos.length} válidos, ${contatosInvalidos.length} inválidos`);

    // =====================================================
    // ETAPA 1: CRIAR/BUSCAR CONTATOS NO SUPABASE (contatos table)
    // Gerar lead_id ANTES de enviar ao webhook externo
    // =====================================================
    // Map: telefone normalizado -> { contato_id, lead_id }
    const leadIdMap = new Map<string, { contato_id: string; lead_id: number | null }>();
    let contatosCriados = 0;
    let contatosVinculados = 0;

    if (!skipLocalSave && prospeccao_id) {
      console.log(`\n📌 [${requestId}] ETAPA 1: Criando/buscando contatos na tabela 'contatos' para obter lead_id...`);

      for (const contato of contatos) {
        const telefoneNormalizado = normalizePhone(contato.telefone);
        if (!telefoneNormalizado) continue;

        // Verificar se já existe contato com esse telefone na empresa
        const { data: contatoExistente } = await supabase
          .from('contatos')
          .select('id, lead_id')
          .eq('empresa_id', empresa_id)
          .or(`telefone.ilike.%${telefoneNormalizado.slice(-9)}%`)
          .limit(1)
          .maybeSingle();

        let contatoId: string;
        let leadId: number | null = null;

        if (contatoExistente) {
          contatoId = contatoExistente.id;
          leadId = contatoExistente.lead_id;
        } else {
          // Criar novo contato
          const { data: novoContato, error: createError } = await supabase
            .from('contatos')
            .insert({
              nome: contato.nome || `Contato ${telefoneNormalizado}`,
              telefone: contato.telefone,
              email: contato.email || null,
              status: 'Novo',
              origem: 'Ligação',
              empresa_id: empresa_id,
            })
            .select('id, lead_id')
            .single();

          if (createError || !novoContato) {
            console.error(`⚠️ [${requestId}] Erro ao criar contato ${telefoneNormalizado}:`, createError);
            continue;
          }
          contatoId = novoContato.id;
          leadId = novoContato.lead_id;
          contatosCriados++;
        }

        // Guardar o mapeamento telefone -> lead_id
        const phoneKey = normalizePhoneTo10Digits(contato.telefone);
        if (phoneKey.valid) {
          leadIdMap.set(phoneKey.normalized, { contato_id: contatoId, lead_id: leadId });
        }

        // Criar vínculo com a prospecção se não existir
        const { data: vinculoExistente } = await supabase
          .from('eventos_prospeccao')
          .select('id')
          .eq('contato_id', contatoId)
          .eq('prospeccao_id', prospeccao_id)
          .maybeSingle();

        if (!vinculoExistente) {
          const { error: linkError } = await supabase
            .from('eventos_prospeccao')
            .insert({
              contato_id: contatoId,
              prospeccao_id: prospeccao_id,
              tipo_evento: 'Contato Inicial',
            });

          if (!linkError) {
            contatosVinculados++;
          }
        }
      }

      console.log(`✅ [${requestId}] Contatos criados: ${contatosCriados}, Vínculos: ${contatosVinculados}, lead_ids mapeados: ${leadIdMap.size}`);
    }

    // =====================================================
    // ETAPA 2: SALVAR EM prospect_pri_voz (com lead_id)
    // =====================================================
    let totalUpserted = 0;
    let upsertErrors: string[] = [];

    if (!skipLocalSave) {
      console.log(`\n💾 [${requestId}] ETAPA 2: Salvando em prospect_pri_voz (com lead_id)...`);

      const prospectsToUpsert = contatosValidos.map(contato => {
        const phoneNorm = contato.phoneResult.normalized;
        const mapping = leadIdMap.get(phoneNorm);
        
        return {
          telefone_lead: phoneNorm,
          id_evento: id_evento,
          nome: contato.nome || null,
          telefone_pri: telefonePriNormalizado,
          loja: nomeEmpresa,
          empresa_id: empresa_id,
          lead_id: mapping?.lead_id || null,
          ligacao_atendida: false,
          status_agendado: false,
          enviado_whatsapp: false,
          ligacao_erro: false,
          criado_em: now,
          atualizado_em: now,
        };
      });

      const batchSize = 100;
      for (let i = 0; i < prospectsToUpsert.length; i += batchSize) {
        const batch = prospectsToUpsert.slice(i, i + batchSize);
        const { error: upsertError } = await supabase
          .from('prospect_pri_voz')
          .upsert(batch, { onConflict: 'telefone_lead,id_evento' });

        if (upsertError) {
          console.error(`❌ [${requestId}] Erro no batch ${Math.floor(i / batchSize) + 1}:`, upsertError);
          upsertErrors.push(upsertError.message);
        } else {
          totalUpserted += batch.length;
        }
      }

      console.log(`✅ [${requestId}] ${totalUpserted}/${contatosValidos.length} salvos em prospect_pri_voz`);
    }

    // =====================================================
    // ETAPA 3: SINCRONIZAR COM WEBHOOK EXTERNO (com lead_id e loja correta)
    // =====================================================
    let externalSyncResult: { success: boolean; status?: number; message?: string } = { success: false };

    if (sync_external) {
      console.log(`\n🌐 [${requestId}] ETAPA 3: Sincronizando com sistema externo...`);

      const externalContatos = contatosValidos.map(c => {
        const mapping = leadIdMap.get(c.phoneResult.normalized);
        return {
          nome: c.nome || '',
          telefone: c.phoneResult.normalized,
          lead_id: mapping?.lead_id || null,
        };
      });

      const externalPayload = {
        id_evento: id_evento,
        telefone_pri: telefonePriNormalizado,
        loja: nomeEmpresa,
        total_contatos: contatosValidos.length,
        contatos: externalContatos,
      };

      console.log(`📤 [${requestId}] Payload externo (amostra):`, JSON.stringify({
        ...externalPayload,
        contatos: externalContatos.slice(0, 3).concat(externalContatos.length > 3 ? [{ nome: '...', telefone: '...', lead_id: null }] : []),
      }));

      try {
        const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
        
        const response = await fetch(WEBHOOK_CRIA_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
          },
          body: JSON.stringify(externalPayload),
        });

        const responseText = await response.text();
        console.log(`📥 [${requestId}] Resposta externa (status ${response.status}):`, responseText.substring(0, 300));

        externalSyncResult = {
          success: response.ok,
          status: response.status,
          message: responseText.substring(0, 200),
        };

        if (response.ok) {
          console.log(`✅ [${requestId}] Sincronização externa concluída com sucesso`);
        } else {
          console.warn(`⚠️ [${requestId}] Sincronização externa falhou (não crítico)`);
        }
      } catch (externalError) {
        console.error(`❌ [${requestId}] Erro na sincronização externa (não crítico):`, externalError);
        externalSyncResult = {
          success: false,
          message: String(externalError),
        };
      }
    }

    // =====================================================
    // RESULTADO FINAL
    // =====================================================
    const resultado = {
      success: true,
      summary: {
        total_contatos: contatos.length,
        validos: contatosValidos.length,
        invalidos: contatosInvalidos.length,
        supabase_salvos: totalUpserted,
        contatos_criados: contatosCriados,
        vinculos_criados: contatosVinculados,
        lead_ids_mapeados: leadIdMap.size,
        erros_supabase: upsertErrors.length,
      },
      external_sync: externalSyncResult,
      id_evento: id_evento,
      empresa_id: empresa_id,
      prospeccao_id: prospeccao_id,
    };

    console.log(`\n✅ [${requestId}] CREATE-BASE-LIGACAO concluído:`, JSON.stringify(resultado.summary));

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`❌ [${requestId}] Erro:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});