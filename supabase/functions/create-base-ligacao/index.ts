import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Webhook externo para sincronização (backup)
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
  sync_external?: boolean; // Se deve sincronizar com sistema externo (default: true)
}

// Normaliza telefone para exatamente 10 dígitos (DDD + 8 dígitos, sem o 9 inicial)
const normalizePhoneTo10Digits = (phone: string | null): { valid: boolean; normalized: string; original: string } => {
  const original = phone || '';
  if (!phone) return { valid: false, normalized: '', original };
  
  let digits = phone.replace(/\D/g, '');
  
  // Remove DDI 55 se existir
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0055')) {
    digits = digits.slice(4);
  }
  
  // Remove zero inicial (0XX)
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }
  
  // Se tem 11 dígitos e o 3º é 9, remove o 9
  if (digits.length === 11 && digits[2] === '9') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  
  // Validação: deve ter exatamente 10 dígitos
  if (digits.length !== 10) {
    return { valid: false, normalized: '', original };
  }
  
  // Validação: DDD entre 11-99
  const ddd = digits.slice(0, 2);
  if (!/^[1-9]\d$/.test(ddd)) {
    return { valid: false, normalized: '', original };
  }
  
  return { valid: true, normalized: digits, original };
};

// Normaliza telefone mantendo o formato original (apenas dígitos)
// Usado para comparações e busca no banco
const normalizePhone = (phone: string | null): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  
  // Remove DDI 55 se existir
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0055')) {
    digits = digits.slice(4);
  }
  
  // Remove zero inicial (0XX)
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }
  
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

    // Validações
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

    // empresa_id é opcional para testes rápidos (só sincroniza externamente)
    const skipLocalSave = !empresa_id;

    console.log(`📥 [${requestId}] Dados recebidos:`);
    console.log(`   ├─ Total contatos: ${contatos.length}`);
    console.log(`   ├─ ID Evento: ${id_evento}`);
    console.log(`   ├─ Telefone Pri: ${telefone_pri}`);
    console.log(`   ├─ Empresa ID: ${empresa_id}`);
    console.log(`   ├─ Prospecção ID: ${prospeccao_id}`);
    console.log(`   ├─ Loja: ${loja || 'N/A'}`);
    console.log(`   └─ Sync External: ${sync_external}`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar nome da empresa se não fornecido
    let nomeEmpresa = loja || '';
    if (!nomeEmpresa && empresa_id) {
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nome_empresa')
        .eq('id', empresa_id)
        .single();
      nomeEmpresa = empresaData?.nome_empresa || '';
    }

    const telefonePriResult = normalizePhoneTo10Digits(telefone_pri);
    const telefonePriNormalizado = telefonePriResult.normalized || telefone_pri.replace(/\D/g, '');
    const now = new Date().toISOString();

    // =====================================================
    // ETAPA 1: SALVAR NO SUPABASE (FONTE PRIMÁRIA)
    // =====================================================
    let totalUpserted = 0;
    let upsertErrors: string[] = [];
    
    // 1a. Validar e normalizar telefones - filtrar inválidos
    const contatosValidados = contatos.map(contato => {
      const result = normalizePhoneTo10Digits(contato.telefone);
      return { ...contato, phoneResult: result };
    });
    
    const contatosValidos = contatosValidados.filter(c => c.phoneResult.valid);
    const contatosInvalidos = contatosValidados.filter(c => !c.phoneResult.valid);
    
    console.log(`📊 [${requestId}] Validação: ${contatosValidos.length} válidos, ${contatosInvalidos.length} inválidos`);

    // Só salva localmente se empresa_id foi fornecido
    if (!skipLocalSave) {
      console.log(`\n💾 [${requestId}] Salvando contatos no Supabase (fonte primária)...`);

      // 1b. Preparar dados para prospect_pri_voz (apenas válidos)
      const prospectsToUpsert = contatosValidos.map(contato => ({
        telefone_lead: contato.phoneResult.normalized,
        id_evento: id_evento,
        nome: contato.nome || null,
        telefone_pri: normalizePhoneTo10Digits(telefone_pri).normalized || telefone_pri.replace(/\D/g, ''),
        loja: nomeEmpresa,
        empresa_id: empresa_id,
        ligacao_atendida: false,
        status_agendado: false,
        enviado_whatsapp: false,
        ligacao_erro: false,
        criado_em: now,
        atualizado_em: now,
      }));

      // 1c. Upsert em batches para prospect_pri_voz
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

      console.log(`✅ [${requestId}] ${totalUpserted}/${contatos.length} contatos salvos em prospect_pri_voz`);
    } else {
      console.log(`⏭️ [${requestId}] Pulando salvamento local (empresa_id não fornecido - modo teste)`);
    }

    // 1d. Criar/vincular contatos na tabela contatos + eventos_prospeccao (só se tiver empresa_id e prospeccao_id)
    let contatosCriados = 0;
    let contatosVinculados = 0;

    if (!skipLocalSave && prospeccao_id) {
      console.log(`\n📌 [${requestId}] Vinculando contatos à prospecção ${prospeccao_id}...`);

      for (const contato of contatos) {
        const telefoneNormalizado = normalizePhone(contato.telefone);
        if (!telefoneNormalizado) continue;

        // Verificar se já existe contato com esse telefone na empresa
        const { data: contatoExistente } = await supabase
          .from('contatos')
          .select('id')
          .eq('empresa_id', empresa_id)
          .or(`telefone.ilike.%${telefoneNormalizado.slice(-9)}%`)
          .limit(1)
          .maybeSingle();

        let contatoId: string;

        if (contatoExistente) {
          contatoId = contatoExistente.id;
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
            .select('id')
            .single();

          if (createError || !novoContato) {
            console.error(`⚠️ [${requestId}] Erro ao criar contato ${telefoneNormalizado}:`, createError);
            continue;
          }
          contatoId = novoContato.id;
          contatosCriados++;
        }

        // Verificar se já existe vínculo
        const { data: vinculoExistente } = await supabase
          .from('eventos_prospeccao')
          .select('id')
          .eq('contato_id', contatoId)
          .eq('prospeccao_id', prospeccao_id)
          .maybeSingle();

        if (!vinculoExistente) {
          // Criar vínculo
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

      console.log(`✅ [${requestId}] Contatos criados: ${contatosCriados}, Vínculos criados: ${contatosVinculados}`);
    }

    // =====================================================
    // ETAPA 2: SINCRONIZAR COM SISTEMA EXTERNO (BACKUP)
    // =====================================================
    let externalSyncResult: { success: boolean; status?: number; message?: string } = { success: false };

    if (sync_external) {
      console.log(`\n🌐 [${requestId}] Sincronizando com sistema externo...`);

      // Enviar apenas contatos válidos para o webhook externo
      const externalPayload = {
        id_evento: id_evento,
        telefone_pri: telefonePriNormalizado,
        loja: nomeEmpresa,
        total_contatos: contatosValidos.length,
        contatos: contatosValidos.map(c => ({
          nome: c.nome || '',
          telefone: c.phoneResult.normalized,
        })),
      };

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
        supabase_salvos: totalUpserted,
        contatos_criados: contatosCriados,
        vinculos_criados: contatosVinculados,
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
