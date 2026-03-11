// Template Paused Webhook - Handles Meta-paused WhatsApp templates
// Pauses dispatches, dissociates templates, auto-duplicates via official webhook flow

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

// Helper: build Meta-compatible components from template data
function buildMetaComponents(template: {
  conteudo: string | null;
  formato: string | null;
  card_data: any;
  variable_mapping: any;
}): any[] {
  const components: any[] = [];

  // BODY
  if (template.conteudo) {
    components.push({ type: 'BODY', text: template.conteudo });
  }

  const cardData = template.card_data || {};

  // HEADER (media)
  if (cardData.videoUrl) {
    components.push({
      type: 'HEADER',
      format: 'VIDEO',
      media_url: cardData.videoUrl,
      media_type: 'video',
    });
  } else if (cardData.imagemUrl) {
    components.push({
      type: 'HEADER',
      format: 'IMAGE',
      media_url: cardData.imagemUrl,
      media_type: 'image',
    });
  } else if (cardData.audioUrl) {
    components.push({
      type: 'HEADER',
      format: 'AUDIO',
      media_url: cardData.audioUrl,
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

    // 1. Find ALL whatsapp_templates with this id_meta (across all empresas)
    const { data: templates, error: templatesErr } = await supabase
      .from('whatsapp_templates')
      .select('id, nome, empresa_id, pri_telefone, conteudo, formato, categoria, card_data, variable_mapping, agente_id, departamento_id, template_id_pri, category_meta')
      .eq('id_meta', id_meta);

    if (templatesErr) throw templatesErr;

    if (!templates || templates.length === 0) {
      console.log(`⚠️ Nenhum template encontrado com id_meta=${id_meta}`);
      return new Response(
        JSON.stringify({ success: false, message: 'Template não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontrados ${templates.length} template(s) com id_meta=${id_meta}`);

    // 2. Update all templates status_meta to PAUSED
    const templateIds = templates.map(t => t.id);
    await supabase
      .from('whatsapp_templates')
      .update({ status_meta: 'PAUSED' })
      .in('id', templateIds);

    // 3. Find ALL prospeccoes (IA WhatsApp) referencing any of these template UUIDs
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

            // NULL out the template field and set disparos_pausados
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

    // 5. Cancel active campaign_jobs for affected prospeccoes
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

    // 6. Check if there's already a pending log entry for this id_meta
    const { data: existingLog } = await supabase
      .from('template_pausado_log')
      .select('id, status, template_duplicado_id')
      .eq('id_meta_original', id_meta)
      .in('status', ['pending_duplicate', 'awaiting_approval'])
      .maybeSingle();

    if (existingLog) {
      console.log(`♻️ Reusando log existente: ${existingLog.id} (status: ${existingLog.status})`);
      const { data: currentLog } = await supabase
        .from('template_pausado_log')
        .select('eventos_impactados')
        .eq('id', existingLog.id)
        .single();

      const currentEventos = (currentLog?.eventos_impactados as any[]) || [];
      const mergedEventos = [...currentEventos];
      for (const evt of eventosImpactados) {
        if (!mergedEventos.some(e => e.prospeccao_id === evt.prospeccao_id && e.campo === evt.campo)) {
          mergedEventos.push(evt);
        }
      }

      await supabase
        .from('template_pausado_log')
        .update({ eventos_impactados: mergedEventos, updated_at: new Date().toISOString() })
        .eq('id', existingLog.id);

      return new Response(
        JSON.stringify({
          success: true,
          reused_log: existingLog.id,
          templates_paused: templates.length,
          events_impacted: eventosImpactados.length,
          jobs_cancelled: prospeccaoIdsAfetados.size,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Duplicate templates - create new versions per empresa
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

    // Create duplicate for each empresa that had a template
    // REGRA CRÍTICA: Mesma lógica do frontend - template só persiste se webhook retornar template_id_pri
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
      // 7a. Insert template provisoriamente (mesmo padrão do frontend)
      const { data: newTemplate, error: insertErr } = await supabase
        .from('whatsapp_templates')
        .insert({
          nome: newName,
          empresa_id: empresaId,
          categoria: sourceTemplate.categoria,
          formato: sourceTemplate.formato,
          conteudo: sourceTemplate.conteudo,
          card_data: sourceTemplate.card_data,
          variable_mapping: sourceTemplate.variable_mapping,
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

      // 7b. Chamar webhook (OBRIGATÓRIO - mesma regra do frontend)
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
          components: buildMetaComponents(sourceTemplate),
        },
        empresa_id: empresaId,
        agente_id: sourceTemplate.agente_id,
        agente_nome: agenteData.nome,
        pri_telefone: telefoneLimpo,
        pri_dealer_id: agenteData.dealer_id || null,
        pri_status: agenteData.ativo ? 'Ativo' : 'Inativo',
        variable_mapping: sourceTemplate.variable_mapping || {},
      };

      // Chamar trigger-webhook (mesmo fluxo do frontend)
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

        // Verificar se algum webhook foi disparado
        if (!parsed?.webhooks_disparados || parsed.webhooks_disparados === 0) {
          throw new Error('Nenhum gatilho ativo encontrado para novo_template_whatsapp nesta empresa. Verifique a configuração dos gatilhos.');
        }

        // Extrair resposta do webhook externo (mesmo padrão do frontend)
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

      // 7c. VALIDAÇÃO CRÍTICA: template_id_pri é OBRIGATÓRIO (mesma regra do frontend)
      if (!returnedTemplateIdPri) {
        console.error(`❌ template_id_pri não retornado pelo webhook - ROLLBACK do template ${insertedId}`);
        await supabase.from('whatsapp_templates').delete().eq('id', insertedId);
        console.log(`  🗑️ Template ${insertedId} removido (sem template_id_pri)`);
        continue;
      }

      // 7d. Atualizar template com IDs retornados pelo webhook
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

    if (!webhookSuccess) {
      console.error('❌ Nenhum template duplicado foi confirmado pelo webhook - todos sofreram rollback');
    }

    // 8. Save log entry - status depende do resultado do webhook
    const logStatus = webhookSuccess ? 'awaiting_approval' : 'failed';
    const { data: logEntry, error: logErr } = await supabase
      .from('template_pausado_log')
      .insert({
        id_meta_original: id_meta,
        template_original_id: originalTemplate.id,
        template_duplicado_id: firstDuplicateId,
        status: logStatus,
        eventos_impactados: eventosImpactados,
        pri_telefone: originalTemplate.pri_telefone,
      })
      .select('id')
      .single();

    if (logErr) {
      console.error('❌ Erro ao criar log:', logErr);
    } else {
      console.log(`📝 Log criado: ${logEntry?.id} (status: ${logStatus})`);
    }

    return new Response(
      JSON.stringify({
        success: webhookSuccess,
        templates_paused: templates.length,
        events_impacted: eventosImpactados.length,
        jobs_cancelled: prospeccaoIdsAfetados.size,
        duplicate_name: newName,
        duplicate_ids: duplicatedTemplateIds,
        webhook_validated: webhookSuccess,
        log_id: logEntry?.id,
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
