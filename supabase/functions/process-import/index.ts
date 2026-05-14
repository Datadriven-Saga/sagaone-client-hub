import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_SIZE = 300;
const MAX_ELAPSED_MS = 120_000;

// Simple CSV parser that handles quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

const columnMappings: Record<string, string[]> = {
  nome: ['nome', 'name', 'nome completo', 'nome do cliente'],
  telefone: ['telefone', 'phone', 'celular', 'cel', 'whatsapp', 'fone', 'tel'],
  email: ['email', 'e-mail', 'mail'],
  responsavel: ['responsavel', 'vendedor', 'atendente', 'consultor', 'responsavel email'],
  codigo_proposta: ['codigo_proposta', 'codigo proposta', 'codigoproposta', 'proposalid', 'proposal_id', 'proposal id'],
};

// Normalize for matching: lowercase, remove accents, remove spaces and underscores
function normalizeForMatching(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_]+/g, '').trim();
}

function findColumnIndex(headers: string[], fieldName: string): number {
  const possibleNames = columnMappings[fieldName] || [fieldName];
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeColumnName(headers[i] || '');
    const hStripped = normalizeForMatching(headers[i] || '');
    if (possibleNames.some(name => {
      const nc = normalizeColumnName(name);
      const ns = normalizeForMatching(name);
      return h === nc || h.includes(nc) || hStripped === ns;
    })) {
      return i;
    }
  }
  return -1;
}

// Brazilian phone normalization → padrão DDD + 8 dígitos (10 total, SEM o 9 adicional)
// Esse é o formato esperado pelos discadores e pela tabela prospect_pri_voz
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0055')) digits = digits.slice(4);
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);
  if (digits.length < 10 || digits.length > 11) return null;
  // Remove o 9º dígito adicional de celulares (mantém DDD + 8)
  if (digits.length === 11 && digits[2] === '9') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  if (digits.length !== 10) return null;
  // DDD válido (10-99)
  if (!/^[1-9]\d$/.test(digits.slice(0, 2))) return null;
  return digits;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check - accept service role key or valid JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const tokenValue = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (tokenValue !== serviceRoleKey) {
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(tokenValue);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const startTime = Date.now();

  try {
    const { import_log_id } = await req.json();

    if (!import_log_id) {
      return new Response(JSON.stringify({ error: 'import_log_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Get import log
    const { data: log, error: logError } = await supabaseAdmin
      .from('import_logs')
      .select('*')
      .eq('id', import_log_id)
      .single();

    if (logError || !log) {
      console.error('❌ Import log not found:', logError);
      return new Response(JSON.stringify({ error: 'Import log not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (log.status === 'done' || log.status === 'error') {
      return new Response(JSON.stringify({ message: 'Already finished' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🚀 Processing import ${import_log_id}, offset: ${log.current_offset}`);

    await supabaseAdmin.from('import_logs').update({
      status: 'processing',
      message: 'Baixando arquivo do servidor...',
    }).eq('id', import_log_id);

    // 3. Download file from storage
    const { data: fileData, error: fileError } = await supabaseAdmin
      .storage.from('import-files')
      .download(log.file_path);

    if (fileError || !fileData) {
      console.error('❌ File download error:', fileError);
      await supabaseAdmin.from('import_logs').update({
        status: 'error',
        message: `Erro ao baixar arquivo: ${fileError?.message || 'Arquivo não encontrado'}`,
      }).eq('id', import_log_id);
      return new Response(JSON.stringify({ error: 'File download failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Parse CSV
    const text = await fileData.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      await supabaseAdmin.from('import_logs').update({
        status: 'error',
        message: 'Arquivo vazio ou sem dados suficientes.',
      }).eq('id', import_log_id);
      return new Response(JSON.stringify({ error: 'Empty file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Parse headers
    const headers = parseCSVLine(lines[0]);
    const colIndices = {
      nome: findColumnIndex(headers, 'nome'),
      telefone: findColumnIndex(headers, 'telefone'),
      email: findColumnIndex(headers, 'email'),
      responsavel: findColumnIndex(headers, 'responsavel'),
      codigo_proposta: findColumnIndex(headers, 'codigo_proposta'),
    };

    if (colIndices.telefone === -1) {
      await supabaseAdmin.from('import_logs').update({
        status: 'error',
        message: 'Coluna "Telefone" não encontrada no arquivo.',
      }).eq('id', import_log_id);
      return new Response(JSON.stringify({ error: 'Missing phone column' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalDataRows = lines.length - 1;
    const currentOffset = log.current_offset || 0;

    if (currentOffset === 0) {
      await supabaseAdmin.from('import_logs').update({
        total_rows: totalDataRows,
        message: `Iniciando processamento de ${totalDataRows.toLocaleString('pt-BR')} registros...`,
      }).eq('id', import_log_id);
    }

    console.log(`📊 Total rows: ${totalDataRows}, starting from offset: ${currentOffset}`);

    // Accumulate stats
    let inserted = log.inserted || 0;
    let updated = log.updated || 0;
    let linked = log.linked || 0;
    let alreadyLinked = log.already_linked || 0;
    let errors = log.errors || 0;
    let quarantined = log.quarantined || 0;
    const errorDetails: string[] = Array.isArray(log.error_details) ? [...log.error_details] : [];
    let processedRows = log.processed_rows || 0;
    let responsavelApplied = log.responsavel_applied || 0;
    let responsavelSkipped = log.responsavel_skipped || 0;
    const warningDetails: any[] = Array.isArray(log.warning_details) ? [...log.warning_details] : [];

    // 5b. Fetch canal_quarentena from prospeccao (defaults to 'whatsapp')
    let canalQuarentena = 'whatsapp';
    if (log.prospeccao_id) {
      const { data: prospInfo } = await supabaseAdmin
        .from('prospeccoes')
        .select('canal_quarentena')
        .eq('id', log.prospeccao_id)
        .single();
      if (prospInfo?.canal_quarentena) {
        canalQuarentena = prospInfo.canal_quarentena;
      }
    }

    // 6. Process rows
    const seenPhones = new Set<string>();
    let batch: any[] = [];
    let batchCount = 0;
    let needsChain = false;

    for (let i = currentOffset; i < totalDataRows; i++) {
      if (Date.now() - startTime > MAX_ELAPSED_MS) {
        console.log(`⏱️ Timeout approaching at row ${i}, will self-chain`);
        if (batch.length > 0) {
          const result = await processBatch(supabaseAdmin, batch, log.empresa_id, log.prospeccao_id, canalQuarentena);
          inserted += result.inserted;
          updated += result.updated;
          linked += result.linked;
          alreadyLinked += result.already_linked;
          errors += result.errors;
          quarantined += result.quarantined;
          responsavelApplied += result.responsavel_applied;
          responsavelSkipped += result.responsavel_skipped;
          for (const w of result.warning_details) {
            if (warningDetails.length < 200) warningDetails.push(w);
          }
          processedRows += batch.length;
        }

        await supabaseAdmin.from('import_logs').update({
          current_offset: i,
          processed_rows: processedRows,
          inserted, updated, linked, already_linked: alreadyLinked,
          errors, quarantined,
          error_details: errorDetails,
          responsavel_applied: responsavelApplied,
          responsavel_skipped: responsavelSkipped,
          warning_details: warningDetails,
          message: `Processando... ${processedRows.toLocaleString('pt-BR')}/${totalDataRows.toLocaleString('pt-BR')} (continuando em nova execução)`,
        }).eq('id', import_log_id);

        needsChain = true;
        break;
      }

      const row = parseCSVLine(lines[i + 1]);
      const telefoneRaw = colIndices.telefone >= 0 ? row[colIndices.telefone] || '' : '';
      
      // Skip rows with empty/blank phone silently (not an error)
      if (!telefoneRaw.trim()) {
        processedRows++;
        continue;
      }

      const phone = normalizePhone(telefoneRaw);

      if (!phone) {
        errors++;
        processedRows++;
        if (errorDetails.length < 50) {
          errorDetails.push(`Linha ${i + 2}: Telefone inválido "${telefoneRaw}"`);
        }
        continue;
      }

      if (seenPhones.has(phone)) {
        processedRows++;
        continue;
      }
      seenPhones.add(phone);

      batch.push({
        nome: colIndices.nome >= 0 ? (row[colIndices.nome] || '').trim() : '',
        telefone: phone,
        email: colIndices.email >= 0 ? (row[colIndices.email] || '').trim() || null : null,
        origem: log.origem || 'Outros',
        observacoes: null,
        responsavel_email: colIndices.responsavel >= 0 ? (row[colIndices.responsavel] || '').trim() || null : null,
        base_id: log.base_id || null,
        codigo_proposta: colIndices.codigo_proposta >= 0 ? (row[colIndices.codigo_proposta] || '').trim() || null : null,
      });

      if (batch.length >= BATCH_SIZE) {
        batchCount++;
        console.log(`📤 Lote ${batchCount}: Enviando ${batch.length} registros...`);

        const result = await processBatch(supabaseAdmin, batch, log.empresa_id, log.prospeccao_id, canalQuarentena);
        inserted += result.inserted;
        updated += result.updated;
        linked += result.linked;
        alreadyLinked += result.already_linked;
        errors += result.errors;
        quarantined += result.quarantined;
        responsavelApplied += result.responsavel_applied;
        responsavelSkipped += result.responsavel_skipped;
        for (const w of result.warning_details) {
          if (warningDetails.length < 200) warningDetails.push(w);
        }
        processedRows += batch.length;

        // Capture per-record error details from RPC
        if (result.error_details && result.error_details.length > 0) {
          for (const detail of result.error_details) {
            if (errorDetails.length < 200) {
              const batchOffset = (batchCount - 1) * BATCH_SIZE + currentOffset;
              errorDetails.push(`Tel: ${detail.telefone || '?'} | Nome: ${detail.nome || '?'} | Erro: ${detail.erro}`);
            }
          }
        }

        console.log(`✅ Lote ${batchCount}: ${result.inserted} novos, ${result.updated} atualizados, ${result.quarantined} em quarentena`);

        await supabaseAdmin.from('import_logs').update({
          processed_rows: processedRows,
          inserted, updated, linked, already_linked: alreadyLinked,
          errors, quarantined,
          error_details: errorDetails,
          responsavel_applied: responsavelApplied,
          responsavel_skipped: responsavelSkipped,
          warning_details: warningDetails,
          message: `Processando... ${processedRows.toLocaleString('pt-BR')}/${totalDataRows.toLocaleString('pt-BR')}`,
        }).eq('id', import_log_id);

        batch = [];
      }
    }

    // Flush remaining batch
    if (!needsChain && batch.length > 0) {
      batchCount++;
      console.log(`📤 Lote final ${batchCount}: Enviando ${batch.length} registros...`);

      const result = await processBatch(supabaseAdmin, batch, log.empresa_id, log.prospeccao_id, canalQuarentena);
      inserted += result.inserted;
      updated += result.updated;
      linked += result.linked;
      alreadyLinked += result.already_linked;
      errors += result.errors;
      quarantined += result.quarantined;
      responsavelApplied += result.responsavel_applied;
      responsavelSkipped += result.responsavel_skipped;
      for (const w of result.warning_details) {
        if (warningDetails.length < 200) warningDetails.push(w);
      }
      processedRows += batch.length;

      // Capture per-record error details from final batch
      if (result.error_details && result.error_details.length > 0) {
        for (const detail of result.error_details) {
          if (errorDetails.length < 200) {
            errorDetails.push(`Tel: ${detail.telefone || '?'} | Nome: ${detail.nome || '?'} | Erro: ${detail.erro}`);
          }
        }
      }
    }

    if (needsChain) {
      console.log(`🔄 Self-chaining for remaining rows...`);
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      fetch(`${supabaseUrl}/functions/v1/process-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ import_log_id }),
      }).catch(err => console.error('Self-chain error:', err));

      return new Response(JSON.stringify({
        status: 'chaining',
        processed_rows: processedRows,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Done!
    const quarantineMsg = quarantined > 0 ? ` ${quarantined} em quarentena.` : '';
    const finalMessage = errors > 0
      ? `Importação concluída com ${errors} erros. ${inserted} novos, ${updated} atualizados, ${linked} vinculados.${quarantineMsg}`
      : `Importação concluída! ${inserted} novos, ${updated} atualizados, ${linked} vinculados ao evento.${quarantineMsg}`;

    await supabaseAdmin.from('import_logs').update({
      status: 'done',
      processed_rows: processedRows,
      inserted, updated, linked, already_linked: alreadyLinked,
      errors, quarantined,
      error_details: errorDetails,
      responsavel_applied: responsavelApplied,
      responsavel_skipped: responsavelSkipped,
      warning_details: warningDetails,
      message: finalMessage,
    }).eq('id', import_log_id);

    // 8. Create notification
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('nome_completo')
        .eq('id', log.user_id)
        .single();

      await supabaseAdmin.from('notificacoes_importacao').insert({
        empresa_id: log.empresa_id,
        solicitante_id: log.user_id,
        solicitante_nome: profile?.nome_completo || 'Usuário',
        base_nome: log.file_name,
        total_contatos: linked + alreadyLinked,
        prospeccao_id: log.prospeccao_id,
      }).then(({ error }) => {
        if (error) console.error('Notification insert error:', error);
      });
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    // 9. Sync with create-base-ligacao webhook for IA Ligação events
    if (log.prospeccao_id) {
      try {
        const { data: prospeccao } = await supabaseAdmin
          .from('prospeccoes')
          .select('canal, event_id_pri, empresa_id')
          .eq('id', log.prospeccao_id)
          .single();

        if (prospeccao && prospeccao.canal === 'Ligação' && prospeccao.event_id_pri) {
          console.log(`📞 IA Ligação detected - syncing with create-base-ligacao webhook...`);

          // Get Pri agent phone for this company via agente_empresas
          let telefonePri = '';
          const { data: agentesVinculados } = await supabaseAdmin
            .from('agente_empresas')
            .select('agente_id, agentes_ia(id, nome, telefone, ativo)')
            .eq('empresa_id', log.empresa_id);

          const agentesAtivos = (agentesVinculados || [])
            .map((ae: any) => ae.agentes_ia)
            .filter((a: any) => a && a.ativo && a.telefone);

          // Search for voice Pri agent (exclude WhatsApp variants)
          const searchPatternsVoz = ['pri - ligação', 'pri - ligacao', 'pri ligação', 'pri ligacao', 'pri-ligação', 'pri-ligacao'];
          const agentePriVoz = agentesAtivos.find((a: any) => {
            const nome = String(a?.nome || '').toLowerCase();
            return searchPatternsVoz.some(pattern => nome.includes(pattern));
          });

          if (agentePriVoz?.telefone) {
            telefonePri = agentePriVoz.telefone.replace(/\D/g, '');
          } else {
            // Fallback: search for generic "Pri" (not WhatsApp)
            const whatsappPatterns = ['whatsapp', 'wpp', 'zap'];
            const agentePriGeneric = agentesAtivos.find((a: any) => {
              const nome = String(a?.nome || '').toLowerCase().trim();
              const isPri = nome === 'pri' || nome.startsWith('pri ') || nome.startsWith('pri-');
              const isWhatsapp = whatsappPatterns.some(p => nome.includes(p));
              return isPri && !isWhatsapp;
            });
            if (agentePriGeneric?.telefone) {
              telefonePri = agentePriGeneric.telefone.replace(/\D/g, '');
            }
          }

          console.log(`📞 telefone_pri resolved: "${telefonePri}"`);

          // Fetch only the contacts from THIS import (by base_id or phones collected)
          const importedContatos: { nome: string; telefone: string; lead_id: number | null }[] = [];
          const importedPhones = [...seenPhones]; // phones processed in this import run
          
          // Query in chunks of 200 phones
          const PHONE_CHUNK = 200;
          for (let ci = 0; ci < importedPhones.length; ci += PHONE_CHUNK) {
            const phoneChunk = importedPhones.slice(ci, ci + PHONE_CHUNK);
            const { data: rows, error: fetchErr } = await supabaseAdmin
              .from('contatos')
              .select('nome, telefone, lead_id')
              .eq('empresa_id', log.empresa_id)
              .in('telefone', phoneChunk);

            if (fetchErr) {
              console.error('⚠️ Error fetching imported contacts:', fetchErr.message);
              continue;
            }

            for (const c of (rows || [])) {
              if (c.telefone) {
                importedContatos.push({
                  nome: c.nome || '',
                  telefone: c.telefone,
                  lead_id: c.lead_id || null,
                });
              }
            }
          }

          console.log(`📤 Sending ${importedContatos.length} imported contacts to create-base-ligacao (from ${importedPhones.length} phones)`);

          if (importedContatos.length > 0) {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';

            const webhookPayload = {
              contatos: importedContatos.map(c => ({
                nome: c.nome,
                telefone: c.telefone,
              })),
              id_evento: parseInt(prospeccao.event_id_pri, 10),
              telefone_pri: telefonePri,
              empresa_id: log.empresa_id,
              prospeccao_id: log.prospeccao_id,
              sync_external: true,
            };

            // Use anon key (publishable) to invoke the internal edge function via gateway.
            // Service role key fails here with UNAUTHORIZED_INVALID_JWT_FORMAT.
            const resp = await fetch(`${supabaseUrl}/functions/v1/create-base-ligacao`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(webhookPayload),
            });

            if (resp.ok) {
              const result = await resp.json();
              console.log(`✅ create-base-ligacao sync complete:`, JSON.stringify(result.summary || {}));
            } else {
              const errText = await resp.text();
              console.error(`⚠️ create-base-ligacao failed (${resp.status}): ${errText.substring(0, 300)}`);

              // Fallback: call the external webhook directly so the calling system still receives the base
              try {
                const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
                const externalPayload = {
                  id_evento: parseInt(prospeccao.event_id_pri, 10),
                  telefone_pri: telefonePri,
                  loja: '',
                  total_contatos: importedContatos.length,
                  contatos: importedContatos.map(c => ({
                    nome: c.nome,
                    telefone: c.telefone,
                    lead_id: c.lead_id,
                  })),
                };

                // Resolve store name (loja) from empresas
                const { data: empresaRow } = await supabaseAdmin
                  .from('empresas')
                  .select('nome_empresa')
                  .eq('id', log.empresa_id)
                  .single();
                externalPayload.loja = empresaRow?.nome_empresa || '';

                const directResp = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/cria-base-ligacao', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
                  },
                  body: JSON.stringify(externalPayload),
                });
                console.log(`📡 Direct webhook fallback status: ${directResp.status}`);
              } catch (directErr) {
                console.error('❌ Direct webhook fallback failed:', directErr);
              }
            }
          }
        }
      } catch (syncErr) {
        console.error('⚠️ IA Ligação sync error (non-critical):', syncErr);
      }
    }

    // 10. Clean up uploaded file
    try {
      await supabaseAdmin.storage.from('import-files').remove([log.file_path]);
      console.log('🧹 Cleaned up uploaded file');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }

    console.log(`✅ Import complete: ${inserted} inserted, ${updated} updated, ${linked} linked, ${quarantined} quarantined, ${errors} errors`);

    return new Response(JSON.stringify({
      status: 'done',
      inserted, updated, linked,
      already_linked: alreadyLinked,
      errors, quarantined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('❌ Unexpected error:', err);

    try {
      const { import_log_id } = await req.clone().json().catch(() => ({ import_log_id: null }));
      if (import_log_id) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        await supabaseAdmin.from('import_logs').update({
          status: 'error',
          message: `Erro inesperado: ${(err as Error).message}`,
        }).eq('id', import_log_id);
      }
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Process a single batch through the RPC with retry
async function processBatch(
  supabase: any,
  batch: any[],
  empresaId: string,
  prospeccaoId: string | null,
  canal: string = 'whatsapp',
): Promise<{ inserted: number; updated: number; linked: number; already_linked: number; errors: number; quarantined: number; error_details: Array<{ telefone: string; nome: string; erro: string }> }> {
  const MAX_RETRIES = 3;
  let lastError = '';

  // ==========================================================
  // PRÉ-PROCESSAMENTO: migrar telefones legados (com 9 adicional)
  // para o formato sem o 9, APENAS para os números desta importação.
  // Assim, contatos já existentes que vierem na planilha terão seu
  // telefone normalizado, e o upsert seguinte fará UPDATE (não INSERT duplicado).
  // ==========================================================
  try {
    // Para cada telefone normalizado (10 dígitos sem 9), monta o equivalente
    // legado com 9 adicional (11 dígitos). Ex: 6232001234 → 62932001234
    const legacyMap = new Map<string, string>(); // legacy(11d c/9) → novo(10d s/9)
    for (const c of batch) {
      const tel = String(c.telefone || '');
      if (tel.length === 10 && /^[1-9]\d/.test(tel)) {
        const legacy = tel.slice(0, 2) + '9' + tel.slice(2);
        legacyMap.set(legacy, tel);
      }
    }

    if (legacyMap.size > 0) {
      const legacyPhones = [...legacyMap.keys()];
      const CHUNK = 200;
      for (let i = 0; i < legacyPhones.length; i += CHUNK) {
        const chunk = legacyPhones.slice(i, i + CHUNK);
        const { data: existentes, error: fetchErr } = await supabase
          .from('contatos')
          .select('id, telefone')
          .eq('empresa_id', empresaId)
          .in('telefone', chunk);

        if (fetchErr) {
          console.warn('⚠️ Falha ao buscar telefones legados:', fetchErr.message);
          continue;
        }

        for (const row of (existentes || [])) {
          const novoTel = legacyMap.get(row.telefone);
          if (!novoTel) continue;

          // Verifica se já existe um contato com o telefone novo (sem 9) na empresa.
          const { data: jaExiste } = await supabase
            .from('contatos')
            .select('id')
            .eq('empresa_id', empresaId)
            .eq('telefone', novoTel)
            .neq('id', row.id)
            .limit(1)
            .maybeSingle();

          if (jaExiste) {
            // AMBOS existem → mesclar: mover dependências do legado para o novo e deletar o legado
            const legacyId = row.id as string;
            const novoId = jaExiste.id as string;
            try {
              // Move vínculos de eventos_prospeccao do legado para o novo (evita duplicar vínculos)
              const { data: legacyVinculos } = await supabase
                .from('eventos_prospeccao')
                .select('id, prospeccao_id')
                .eq('contato_id', legacyId);

              for (const v of (legacyVinculos || [])) {
                const { data: jaVinculado } = await supabase
                  .from('eventos_prospeccao')
                  .select('id')
                  .eq('contato_id', novoId)
                  .eq('prospeccao_id', v.prospeccao_id)
                  .limit(1)
                  .maybeSingle();
                if (jaVinculado) {
                  // Já existe vínculo no novo → apenas remove o legado
                  await supabase.from('eventos_prospeccao').delete().eq('id', v.id);
                } else {
                  await supabase.from('eventos_prospeccao').update({ contato_id: novoId }).eq('id', v.id);
                }
              }

              // Move timeline do legado para o novo
              await supabase.from('contato_timeline').update({ contato_id: novoId }).eq('contato_id', legacyId);

              // Deleta o contato legado (com 9)
              const { error: delErr } = await supabase.from('contatos').delete().eq('id', legacyId);
              if (delErr) {
                console.warn(`⚠️ Falha ao deletar legado ${row.telefone}:`, delErr.message);
              } else {
                console.log(`🔀 Mesclado: legado ${row.telefone} (${legacyId}) → novo ${novoTel} (${novoId})`);
              }
            } catch (mergeErr: any) {
              console.warn(`⚠️ Falha ao mesclar ${row.telefone} → ${novoTel}:`, mergeErr?.message || mergeErr);
            }
            continue;
          }

          // Apenas o legado existe → atualiza para o formato sem 9
          const { error: updErr } = await supabase
            .from('contatos')
            .update({ telefone: novoTel, updated_at: new Date().toISOString() })
            .eq('id', row.id);

          if (updErr) {
            console.warn(`⚠️ Falha ao normalizar telefone ${row.telefone} → ${novoTel}:`, updErr.message);
          } else {
            console.log(`📞 Telefone normalizado (importação): ${row.telefone} → ${novoTel}`);
          }
        }
      }
    }
  } catch (preErr: any) {
    console.warn('⚠️ Erro no pré-processamento de normalização:', preErr?.message || preErr);
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.rpc('bulk_upsert_contatos', {
        p_contatos: batch,
        p_empresa_id: empresaId,
        p_prospeccao_id: prospeccaoId,
        p_canal: canal,
      });

      if (error) throw error;

      return {
        inserted: data?.inserted || 0,
        updated: data?.updated || 0,
        linked: data?.linked || 0,
        already_linked: data?.already_linked || 0,
        errors: data?.errors || 0,
        quarantined: data?.quarantined || 0,
        error_details: data?.error_details || [],
      };
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.error(`❌ Batch attempt ${attempt} failed:`, lastError);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  console.error(`🚫 Batch failed permanently: ${lastError}`);
  return { inserted: 0, updated: 0, linked: 0, already_linked: 0, errors: batch.length, quarantined: 0, error_details: [{ telefone: '', nome: '', erro: `Lote inteiro falhou: ${lastError}` }] };
}
