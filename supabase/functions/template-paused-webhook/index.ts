// Template Paused Webhook - Handles Meta-paused WhatsApp templates
// Pauses dispatches, dissociates templates, auto-duplicates

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
      // Update eventos_impactados with new ones
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
    const originalTemplate = templates[0]; // Use first as source for duplication
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
    const duplicatedTemplateIds: string[] = [];
    const uniqueEmpresas = new Map<string, typeof templates[0]>();
    for (const t of templates) {
      if (!uniqueEmpresas.has(t.empresa_id)) {
        uniqueEmpresas.set(t.empresa_id, t);
      }
    }

    let firstDuplicateId: string | null = null;

    for (const [empresaId, sourceTemplate] of uniqueEmpresas) {
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
          status_meta: null, // pending approval
          ativo: true,
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error(`❌ Erro ao duplicar template para empresa ${empresaId}:`, insertErr);
        continue;
      }

      if (newTemplate) {
        duplicatedTemplateIds.push(newTemplate.id);
        if (!firstDuplicateId) firstDuplicateId = newTemplate.id;
        console.log(`  ✅ Template duplicado criado: ${newTemplate.id} para empresa ${empresaId}`);
      }
    }

    // 8. Save log entry
    const { data: logEntry, error: logErr } = await supabase
      .from('template_pausado_log')
      .insert({
        id_meta_original: id_meta,
        template_original_id: originalTemplate.id,
        template_duplicado_id: firstDuplicateId,
        status: firstDuplicateId ? 'awaiting_approval' : 'failed',
        eventos_impactados: eventosImpactados,
        pri_telefone: originalTemplate.pri_telefone,
      })
      .select('id')
      .single();

    if (logErr) {
      console.error('❌ Erro ao criar log:', logErr);
    } else {
      console.log(`📝 Log criado: ${logEntry?.id}`);
    }

    // 9. Try to register duplicate on Meta via external-webhook-proxy
    // This is best-effort - if it fails, the template will need manual registration
    if (firstDuplicateId && originalTemplate.pri_telefone) {
      try {
        console.log('🔗 Registrando template duplicado na Meta via webhook...');
        // The actual Meta registration would happen through the existing
        // template creation webhook flow. For now, log intent.
        console.log('   → Template duplicado precisa ser registrado na Meta manualmente ou via sync');
      } catch (webhookErr) {
        console.error('⚠️ Erro ao registrar na Meta (não-crítico):', webhookErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        templates_paused: templates.length,
        events_impacted: eventosImpactados.length,
        jobs_cancelled: prospeccaoIdsAfetados.size,
        duplicate_name: newName,
        duplicate_ids: duplicatedTemplateIds,
        log_id: logEntry?.id,
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
