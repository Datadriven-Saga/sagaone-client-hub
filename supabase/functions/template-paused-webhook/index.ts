// Template Paused Webhook - Handles Meta-paused WhatsApp templates
// Pauses dispatches, dissociates templates, auto-duplicates via official webhook flow
// CRITICAL: Uses atomic INSERT...ON CONFLICT on template_pausado_log as mutex to prevent duplicate recovery

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Template fields on prospeccoes that can reference a whatsapp_template
const TEMPLATE_FIELDS = [
  'template_prospeccao_id',
  'template_agendado_id',
  'template_nao_agendado_id',
  'template_agendado_48h_id',
  'template_agendado_24h_id',
] as const;

// Helper: format name for Meta (same as frontend formatNameForMeta)
function formatNameForMeta(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// Helper: map categoria to Meta format
function mapCategoriaToMeta(categoria: string): string {
  const mapping: Record<string, string> = {
    marketing: 'MARKETING',
    utilidade: 'UTILITY',
    autenticacao: 'AUTHENTICATION',
  };
  return mapping[categoria] || 'MARKETING';
}

// Helper: default example values for known variable names
const DEFAULT_VARIABLE_EXAMPLES: Record<string, string> = {
  nome: 'João',
  nome_cliente: 'João',
  primeiro_nome: 'João',
  email: 'cliente@email.com',
  telefone: '11999999999',
  empresa: 'Empresa Exemplo',
  loja: 'Loja Centro',
  marca: 'Toyota',
  modelo: 'Corolla',
  vendedor: 'Carlos',
  data: '15/03/2026',
  horario: '14:00',
};

// Helper: build variable examples from variable_mapping + stored examples
function buildVariableExamples(
  variableMapping: Record<string, string> | null,
  exemplosVarDb: Record<string, string> | null,
): Record<string, string> {
  const examples: Record<string, string> = {};
  if (!variableMapping) return examples;

  for (const [position, fieldName] of Object.entries(variableMapping)) {
    if (exemplosVarDb && exemplosVarDb[position]) {
      examples[position] = exemplosVarDb[position];
    } else {
      const normalizedField = (fieldName || '').toLowerCase().replace(/[^a-z_]/g, '');
      examples[position] = DEFAULT_VARIABLE_EXAMPLES[normalizedField] || `Exemplo ${position}`;
    }
  }
  return examples;
}

// Helper: slightly modify template body text to avoid Meta duplicate rejection
function tweakBodyText(text: string): string {
  if (!text) return text;

  let modified = text;

  // 1. Remove emojis (unicode emoji ranges)
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
  modified = modified.replace(emojiRegex, '').replace(/  +/g, ' ').trim();

  // 2. If text has sentences (period followed by space+capital), add a line break after the first one
  const sentenceBreak = modified.replace(/(\.\s)(?=[A-ZÀ-Ú])/, '.\n');
  if (sentenceBreak !== modified) {
    modified = sentenceBreak;
  }

  // 3. If nothing changed at all, append a subtle zero-impact change
  if (modified === text) {
    modified = modified + ' ';
  }

  return modified;
}

// Helper: fetch media URL and convert to base64
async function fetchMediaAsBase64(url: string): Promise<{ base64: string; mimeType: string; size: number } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`❌ Erro ao baixar mídia: ${response.status} ${response.statusText}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    
    return { base64, mimeType, size: uint8Array.length };
  } catch (error) {
    console.error('❌ Erro ao converter mídia para base64:', error);
    return null;
  }
}

// Helper: build Meta-compatible components from template data (with base64 media like frontend)
async function buildMetaComponents(template: {
  conteudo: string | null;
  formato: string | null;
  card_data: any;
  variable_mapping: any;
  exemplos_variaveis?: any;
}, options?: { tweakText?: boolean }): Promise<any[]> {
  const components: any[] = [];

  // BODY
  if (template.conteudo) {
    const bodyText = options?.tweakText ? tweakBodyText(template.conteudo) : template.conteudo;
    const bodyComponent: any = { type: 'BODY', text: bodyText };

    const varExamples = buildVariableExamples(
      template.variable_mapping,
      template.exemplos_variaveis,
    );
    if (Object.keys(varExamples).length > 0) {
      const sortedValues = Object.keys(varExamples)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(k => varExamples[k]);
      bodyComponent.example = { body_text: [sortedValues] };
    }

    components.push(bodyComponent);
  }

  // HEADER (media)
  const cardData = template.card_data || {};
  if (cardData.videoUrl) {
    console.log('📥 Baixando vídeo para base64...');
    const mediaData = await fetchMediaAsBase64(cardData.videoUrl);
    components.push({
      type: 'HEADER',
      format: 'VIDEO',
      media_url: cardData.videoUrl,
      media_base64: mediaData?.base64 || null,
      media_mime_type: cardData.videoMimeType || mediaData?.mimeType || 'video/mp4',
      media_type: 'video',
    });
  } else if (cardData.imagemUrl) {
    console.log('📥 Baixando imagem para base64...');
    const mediaData = await fetchMediaAsBase64(cardData.imagemUrl);
    components.push({
      type: 'HEADER',
      format: 'IMAGE',
      media_url: cardData.imagemUrl,
      media_base64: mediaData?.base64 || null,
      media_mime_type: mediaData?.mimeType || null,
      media_type: 'image',
    });
  } else if (cardData.audioUrl) {
    console.log('📥 Baixando áudio para base64...');
    const mediaData = await fetchMediaAsBase64(cardData.audioUrl);
    components.push({
      type: 'HEADER',
      format: 'AUDIO',
      media_url: cardData.audioUrl,
      media_base64: mediaData?.base64 || null,
      media_mime_type: mediaData?.mimeType || null,
      media_type: 'audio',
    });
  } else if (cardData.textoCabecalho) {
    components.push({
      type: 'HEADER',
      format: 'TEXT',
      text: cardData.textoCabecalho,
    });
  }

  // BUTTONS
  if (cardData.botoes && cardData.botoes.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: cardData.botoes.map((btn: any) => {
        const isUrl = btn.buttonId && (btn.buttonId.startsWith('http') || btn.buttonId.includes('://'));
        if (isUrl) {
          return { type: 'URL', text: btn.nome, url: btn.buttonId };
        }
        return { type: 'QUICK_REPLY', text: btn.nome };
      }),
    });
  }

  return components;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { id_meta } = await req.json();

    if (!id_meta) {
      return new Response(
        JSON.stringify({ error: 'id_meta é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔴 Template pausado pela Meta: id_meta=${id_meta}`);

    // =====================================================================
    // STEP 1: ATOMIC LOCK — Try to claim this id_meta for recovery.
    // The unique partial index on (id_meta_original) WHERE status NOT IN
    // ('failed','resolved','cancelled') guarantees only ONE active recovery.
    // If another execution already claimed it, the INSERT fails with 23505.
    // =====================================================================
    const { data: lockEntry, error: lockErr } = await supabase
      .from('template_pausado_log')
      .insert({
        id_meta_original: String(id_meta),
        status: 'pending_duplicate',
        eventos_impactados: [],
      })
      .select('id')
      .single();

    if (lockErr) {
      // Check if it's a unique violation (23505) — means recovery already in progress
      const errMsg = lockErr.message || '';
      const errCode = (lockErr as any)?.code || '';
      if (errCode === '23505' || errMsg.includes('duplicate key') || errMsg.includes('unique constraint') || errMsg.includes('idx_template_pausado_log_active_recovery')) {
        console.log(`🔒 Recovery already in progress for id_meta=${id_meta} — skipping`);

        // Fetch the existing active log for reference
        const { data: existingLog } = await supabase
          .from('template_pausado_log')
          .select('id, status, template_duplicado_id, created_at')
          .eq('id_meta_original', String(id_meta))
          .not('status', 'in', '("failed","resolved","cancelled")')
          .limit(1)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            success: true,
            action: 'ignored_duplicate_request',
            reason: 'existing_replacement_already_pending_approval',
            existing_log_id: existingLog?.id || null,
            existing_log_status: existingLog?.status || null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Other insert error — log and continue cautiously
      console.error('❌ Erro ao criar lock entry:', lockErr);
      throw lockErr;
    }

    const logId = lockEntry!.id;
    console.log(`🔐 Lock acquired: log_id=${logId} for id_meta=${id_meta}`);

    // =====================================================================
    // STEP 2: Find and pause all templates with this id_meta
    // =====================================================================
    const { data: templates, error: templatesErr } = await supabase
      .from('whatsapp_templates')
      .select('id, nome, empresa_id, pri_telefone, conteudo, formato, categoria, card_data, variable_mapping, agente_id, departamento_id, template_id_pri, category_meta, exemplos_variaveis')
      .eq('id_meta', id_meta);

    if (templatesErr) throw templatesErr;

    if (!templates || templates.length === 0) {
      console.log(`⚠️ Nenhum template encontrado com id_meta=${id_meta}`);
      // Mark lock as resolved since there's nothing to do
      await supabase.from('template_pausado_log').update({ status: 'resolved', updated_at: new Date().toISOString() }).eq('id', logId);
      return new Response(
        JSON.stringify({ success: false, message: 'Template não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontrados ${templates.length} template(s) com id_meta=${id_meta}`);

    // Update all templates status_meta to PAUSED
    const templateIds = templates.map(t => t.id);
    await supabase
      .from('whatsapp_templates')
      .update({ status_meta: 'PAUSED' })
      .in('id', templateIds);

    // Update log with template_original_id and pri_telefone
    await supabase.from('template_pausado_log').update({
      template_original_id: templates[0].id,
      pri_telefone: templates[0].pri_telefone,
      updated_at: new Date().toISOString(),
    }).eq('id', logId);

    // =====================================================================
    // STEP 3: Find and pause all affected prospeccoes
    // =====================================================================
    const eventosImpactados: Array<{ prospeccao_id: string; empresa_id: string; campo: string }> = [];
    const prospeccaoIdsAfetados = new Set<string>();

    for (const template of templates) {
      for (const campo of TEMPLATE_FIELDS) {
        const { data: prospeccoes, error: prospErr } = await supabase
          .from('prospeccoes')
          .select('id, empresa_id, canal')
          .eq(campo, template.id)
          .ilike('canal', '%whatsapp%');

        if (prospErr) {
          console.error(`Erro ao buscar prospeccoes pelo campo ${campo}:`, prospErr);
          continue;
        }

        if (prospeccoes && prospeccoes.length > 0) {
          for (const p of prospeccoes) {
            eventosImpactados.push({
              prospeccao_id: p.id,
              empresa_id: p.empresa_id,
              campo,
            });
            prospeccaoIdsAfetados.add(p.id);

            await supabase
              .from('prospeccoes')
              .update({ [campo]: null, disparos_pausados: true })
              .eq('id', p.id);

            console.log(`  ✅ Prospeccao ${p.id}: campo ${campo} desassociado, disparos pausados`);
          }
        }
      }
    }

    console.log(`📊 Total de eventos impactados: ${eventosImpactados.length}`);

    // Update log with eventos_impactados
    await supabase.from('template_pausado_log').update({
      eventos_impactados: eventosImpactados,
      updated_at: new Date().toISOString(),
    }).eq('id', logId);

    // =====================================================================
    // STEP 4: Cancel active campaign_jobs for affected prospeccoes
    // =====================================================================
    if (prospeccaoIdsAfetados.size > 0) {
      const prosIds = Array.from(prospeccaoIdsAfetados);
      const { data: activeJobs } = await supabase
        .from('campaign_jobs')
        .select('id')
        .in('prospeccao_id', prosIds)
        .in('status', ['pending', 'processing']);

      if (activeJobs && activeJobs.length > 0) {
        const jobIds = activeJobs.map(j => j.id);
        await supabase
          .from('campaign_jobs')
          .update({ status: 'cancelled', error_message: 'Template pausado pela Meta' })
          .in('id', jobIds);
        console.log(`🛑 ${activeJobs.length} campaign_jobs cancelados`);
      }
    }

    // =====================================================================
    // STEP 5: Duplicate templates — one per empresa
    // =====================================================================
    const originalTemplate = templates[0];
    const originalName = originalTemplate.nome;

    // Determine next version name
    const baseName = originalName.replace(/_v\d+$/, '');
    const { data: existingVersions } = await supabase
      .from('whatsapp_templates')
      .select('nome')
      .like('nome', `${baseName}_v%`)
      .eq('pri_telefone', originalTemplate.pri_telefone || '');

    let maxVersion = 1;
    if (existingVersions) {
      for (const ev of existingVersions) {
        const match = ev.nome.match(/_v(\d+)$/);
        if (match) {
          const ver = parseInt(match[1], 10);
          if (ver > maxVersion) maxVersion = ver;
        }
      }
    }
    const newName = `${baseName}_v${maxVersion + 1}`;
    console.log(`📋 Nome do template duplicado: ${newName}`);

    const duplicatedTemplateIds: string[] = [];
    const uniqueEmpresas = new Map<string, typeof templates[0]>();
    for (const t of templates) {
      if (!uniqueEmpresas.has(t.empresa_id)) {
        uniqueEmpresas.set(t.empresa_id, t);
      }
    }

    let firstDuplicateId: string | null = null;
    let webhookSuccess = false;

    for (const [empresaId, sourceTemplate] of uniqueEmpresas) {
      // Insert template provisionally
      const { data: newTemplate, error: insertErr } = await supabase
        .from('whatsapp_templates')
        .insert({
          nome: newName,
          empresa_id: empresaId,
          categoria: sourceTemplate.categoria,
          formato: sourceTemplate.formato,
          conteudo: tweakBodyText(sourceTemplate.conteudo || ''),
          card_data: sourceTemplate.card_data,
          variable_mapping: sourceTemplate.variable_mapping,
          exemplos_variaveis: sourceTemplate.exemplos_variaveis || {},
          agente_id: sourceTemplate.agente_id,
          departamento_id: sourceTemplate.departamento_id,
          pri_telefone: sourceTemplate.pri_telefone,
          status: 'ativo',
          status_meta: null,
          ativo: true,
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error(`❌ Erro ao duplicar template para empresa ${empresaId}:`, insertErr);
        continue;
      }

      if (!newTemplate) continue;

      const insertedId = newTemplate.id;
      console.log(`  📋 Template provisório criado: ${insertedId} para empresa ${empresaId}`);

      // Call webhook (MANDATORY)
      if (!sourceTemplate.agente_id) {
        console.error(`❌ Template sem agente_id - rollback do template ${insertedId}`);
        await supabase.from('whatsapp_templates').delete().eq('id', insertedId);
        continue;
      }

      const { data: agenteData } = await supabase
        .from('agentes_ia')
        .select('id, nome, telefone, dealer_id, ativo')
        .eq('id', sourceTemplate.agente_id)
        .single();

      if (!agenteData) {
        console.error(`❌ Agente ${sourceTemplate.agente_id} não encontrado - rollback do template ${insertedId}`);
        await supabase.from('whatsapp_templates').delete().eq('id', insertedId);
        continue;
      }

      const telefoneLimpo = agenteData.telefone?.replace(/\D/g, '') || sourceTemplate.pri_telefone || '';
      const hasVariables = /\{\{\d+\}\}/.test(sourceTemplate.conteudo || '');

      const webhookPayload = {
        provider: 'meta_whatsapp',
        action: 'create_message_template',
        waba_id: '',
        tem_variavel: hasVariables ? 'Sim' : 'Não',
        payload: {
          name: formatNameForMeta(newName),
          language: 'pt_BR',
          category: mapCategoriaToMeta(sourceTemplate.categoria || 'marketing'),
          components: await buildMetaComponents(sourceTemplate, { tweakText: true }),
        },
        empresa_id: empresaId,
        agente_id: sourceTemplate.agente_id,
        agente_nome: agenteData.nome,
        pri_telefone: telefoneLimpo,
        pri_dealer_id: agenteData.dealer_id || null,
        pri_status: agenteData.ativo ? 'Ativo' : 'Inativo',
        variable_mapping: sourceTemplate.variable_mapping || {},
        template_id_pri_original: sourceTemplate.template_id_pri || null,
      };

      // Call trigger-webhook
      const triggerUrl = `${supabaseUrl}/functions/v1/trigger-webhook`;

      let returnedTemplateIdPri: string | null = null;
      let webhookResponseData: Record<string, any> | null = null;

      try {
        console.log(`🔗 Chamando trigger-webhook para empresa ${empresaId}...`);

        const triggerResponse = await fetch(triggerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
          },
          body: JSON.stringify({
            gatilho: 'novo_template_whatsapp',
            dados: webhookPayload,
          }),
        });

        const triggerResultText = await triggerResponse.text();
        console.log(`📨 trigger-webhook resposta (${triggerResponse.status}):`, triggerResultText.substring(0, 1000));

        if (!triggerResponse.ok) {
          throw new Error(`trigger-webhook retornou status ${triggerResponse.status}`);
        }

        const parsed = JSON.parse(triggerResultText);

        if (!parsed?.webhooks_disparados || parsed.webhooks_disparados === 0) {
          throw new Error('Nenhum gatilho ativo encontrado para novo_template_whatsapp nesta empresa. Verifique a configuração dos gatilhos.');
        }

        const webhookResponse = parsed?.webhook_response;
        if (webhookResponse) {
          returnedTemplateIdPri = webhookResponse.template_id_pri || webhookResponse.id || null;
          webhookResponseData = {
            template_id_pri: returnedTemplateIdPri,
            id_meta: webhookResponse.id_meta || webhookResponse.id || null,
            status_meta: webhookResponse.status_meta || webhookResponse.status || null,
            category_meta: webhookResponse.category_meta || webhookResponse.category || null,
          };
        }
      } catch (webhookErr) {
        console.error(`❌ Erro no webhook para empresa ${empresaId}:`, webhookErr);
      }

      // CRITICAL VALIDATION: template_id_pri is MANDATORY
      if (!returnedTemplateIdPri) {
        console.error(`❌ template_id_pri não retornado pelo webhook - ROLLBACK do template ${insertedId}`);
        await supabase.from('whatsapp_templates').delete().eq('id', insertedId);
        console.log(`  🗑️ Template ${insertedId} removido (sem template_id_pri)`);
        continue;
      }

      // Update template with IDs from webhook
      const { error: updateErr } = await supabase
        .from('whatsapp_templates')
        .update({
          template_id_pri: webhookResponseData!.template_id_pri,
          id_meta: webhookResponseData!.id_meta,
          status_meta: webhookResponseData!.status_meta,
          category_meta: webhookResponseData!.category_meta,
        })
        .eq('id', insertedId);

      if (updateErr) {
        console.error(`❌ Erro ao atualizar template ${insertedId} com dados da Meta:`, updateErr);
      } else {
        console.log(`  ✅ Template ${insertedId} confirmado com template_id_pri=${returnedTemplateIdPri}`);
      }

      duplicatedTemplateIds.push(insertedId);
      if (!firstDuplicateId) firstDuplicateId = insertedId;
      webhookSuccess = true;
    }

    // =====================================================================
    // STEP 6: Update log with final result
    // =====================================================================
    const logStatus = webhookSuccess ? 'awaiting_approval' : 'failed';
    await supabase
      .from('template_pausado_log')
      .update({
        template_duplicado_id: firstDuplicateId,
        status: logStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', logId);

    if (!webhookSuccess) {
      console.error('❌ Nenhum template duplicado foi confirmado pelo webhook - todos sofreram rollback');
    }

    console.log(`📝 Log ${logId} atualizado (status: ${logStatus})`);

    return new Response(
      JSON.stringify({
        success: webhookSuccess,
        templates_paused: templates.length,
        events_impacted: eventosImpactados.length,
        jobs_cancelled: prospeccaoIdsAfetados.size,
        duplicate_name: newName,
        duplicate_ids: duplicatedTemplateIds,
        webhook_validated: webhookSuccess,
        log_id: logId,
        log_status: logStatus,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no template-paused-webhook:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
