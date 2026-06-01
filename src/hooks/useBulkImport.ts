import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BulkImportProgress {
  phase: 'idle' | 'parsing' | 'importing' | 'linking' | 'done' | 'error';
  totalRecords: number;
  processedRecords: number;
  currentBatch: number;
  totalBatches: number;
  inserted: number;
  updated: number;
  linked: number;
  alreadyLinked: number;
  quarantined: number;
  errors: number;
  retries: number;
  errorDetails: string[];
}

const INITIAL_PROGRESS: BulkImportProgress = {
  phase: 'idle',
  totalRecords: 0,
  processedRecords: 0,
  currentBatch: 0,
  totalBatches: 0,
  inserted: 0,
  updated: 0,
  linked: 0,
  alreadyLinked: 0,
  quarantined: 0,
  errors: 0,
  retries: 0,
  errorDetails: [],
};

const RPC_BATCH_SIZE = 300;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const MAX_CONCURRENT = 3;

interface ContatoForImport {
  nome: string;
  telefone: string;
  email?: string;
  origem?: string;
  observacoes?: string;
  responsavel_email?: string;
  base_id?: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const useBulkImport = () => {
  const [progress, setProgress] = useState<BulkImportProgress>(INITIAL_PROGRESS);
  const abortRef = useRef(false);
  const progressRef = useRef<BulkImportProgress>(INITIAL_PROGRESS);

  const resetProgress = useCallback(() => {
    const initial = { ...INITIAL_PROGRESS, errorDetails: [] };
    setProgress(initial);
    progressRef.current = initial;
    abortRef.current = false;
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  // Send a single batch to the RPC with retry logic
  const sendBatch = useCallback(async (
    batch: ContatoForImport[],
    batchNum: number,
    empresaId: string,
    prospeccaoId: string,
    canal: string = 'whatsapp',
  ): Promise<void> => {
    // ============================================================
    // OPT-OUT EXTERNO — caminho direto desabilitado.
    // Toda importação deve passar por process-import (upload de
    // planilha) para que a lista externa de opt-out seja validada
    // server-side antes de bulk_upsert_contatos.
    // ============================================================
    const blockedMsg = 'Importação direta desabilitada. Use o fluxo de upload de planilha para garantir validação de opt-out.';
    console.warn(`🚫 Lote ${batchNum}: ${blockedMsg}`);
    const p = progressRef.current;
    p.errors += batch.length;
    p.processedRecords += batch.length;
    if (p.errorDetails.length < 200) {
      p.errorDetails.push(`Lote ${batchNum}: ${blockedMsg}`);
    }
    progressRef.current = { ...p };
    setProgress({ ...p });
    return;

    // eslint-disable-next-line no-unreachable
    let lastError = '';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const payload = batch.map(c => ({
          nome: c.nome || '',
          telefone: c.telefone,
          email: c.email || null,
          origem: c.origem || 'Outros',
          observacoes: c.observacoes || null,
          responsavel_email: c.responsavel_email || null,
          base_id: c.base_id || null,
        }));

        console.log(`📤 Lote ${batchNum}: Enviando ${batch.length} registros (tentativa ${attempt})`);

        const { data, error } = await supabase.rpc('bulk_upsert_contatos', {
          p_contatos: payload as any,
          p_empresa_id: empresaId,
          p_prospeccao_id: prospeccaoId,
          p_canal: canal,
        });

        if (error) throw error;

        const result = data as any;
        const p = progressRef.current;
        p.inserted += result.inserted || 0;
        p.updated += result.updated || 0;
        p.linked += result.linked || 0;
        p.alreadyLinked += result.already_linked || 0;
        p.quarantined += result.quarantined || 0;
        p.errors += result.errors || 0;
        p.processedRecords += batch.length;
        p.currentBatch = batchNum;

        // Capture per-record error details from RPC
        if (result.error_details && Array.isArray(result.error_details)) {
          for (const detail of result.error_details) {
            if (p.errorDetails.length < 200) {
              p.errorDetails.push(`Tel: ${detail.telefone || '?'} | Nome: ${detail.nome || '?'} | Erro: ${detail.erro}`);
            }
          }
        }

        progressRef.current = { ...p };
        setProgress({ ...p });

        console.log(`✅ Lote ${batchNum}: Sucesso (${result.inserted} novos, ${result.updated} atualizados, ${result.linked} vinculados)`);
        return;
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.error(`❌ Lote ${batchNum} tentativa ${attempt} falhou:`, lastError);

        if (attempt < MAX_RETRIES) {
          const p = progressRef.current;
          p.retries++;
          progressRef.current = { ...p };
          setProgress({ ...p });
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    // All retries failed
    const p = progressRef.current;
    p.errors += batch.length;
    p.processedRecords += batch.length;
    p.errorDetails.push(`Lote ${batchNum} falhou após ${MAX_RETRIES} tentativas: ${lastError}`);
    progressRef.current = { ...p };
    setProgress({ ...p });
    console.error(`🚫 Lote ${batchNum}: Falha permanente`);
  }, []);

  /**
   * Streaming import: accepts batches one at a time from a streaming parser.
   * Controls concurrency with a semaphore (max MAX_CONCURRENT in-flight).
   */
  const createStreamingImporter = useCallback((
    empresaId: string,
    prospeccaoId: string,
    estimatedTotal: number,
    canal: string = 'whatsapp',
  ) => {
    abortRef.current = false;
    const initial: BulkImportProgress = {
      ...INITIAL_PROGRESS,
      phase: 'importing',
      totalRecords: estimatedTotal,
      errorDetails: [],
    };
    progressRef.current = { ...initial };
    setProgress({ ...initial });

    let batchCounter = 0;
    let inFlight = 0;
    const queue: (() => Promise<void>)[] = [];
    let drainResolve: (() => void) | null = null;

    const processQueue = () => {
      while (inFlight < MAX_CONCURRENT && queue.length > 0) {
        const task = queue.shift()!;
        inFlight++;
        task().finally(() => {
          inFlight--;
          processQueue();
          if (inFlight === 0 && queue.length === 0 && drainResolve) {
            drainResolve();
          }
        });
      }
    };

    const enqueueBatch = (batch: ContatoForImport[]) => {
      if (abortRef.current) return;
      batchCounter++;
      const num = batchCounter;
      queue.push(() => sendBatch(batch, num, empresaId, prospeccaoId, canal));
      processQueue();
    };

    const updateTotal = (total: number) => {
      const p = progressRef.current;
      p.totalRecords = total;
      p.totalBatches = Math.ceil(total / RPC_BATCH_SIZE);
      progressRef.current = { ...p };
      setProgress({ ...p });
    };

    const drain = (): Promise<void> => {
      if (inFlight === 0 && queue.length === 0) return Promise.resolve();
      return new Promise(resolve => { drainResolve = resolve; });
    };

    const finalize = async (): Promise<BulkImportProgress> => {
      await drain();
      const p = progressRef.current;
      p.phase = (p.errors > 0 && p.inserted === 0 && p.updated === 0) ? 'error' : 'done';
      p.totalBatches = batchCounter;
      progressRef.current = { ...p };
      setProgress({ ...p });
      return { ...p };
    };

    const isAborted = () => abortRef.current;

    return { enqueueBatch, updateTotal, finalize, isAborted };
  }, [sendBatch]);

  /**
   * Legacy batch import (for pre-collected arrays).
   */
  const importContacts = useCallback(async (
    contatos: ContatoForImport[],
    empresaId: string,
    prospeccaoId: string,
    canal: string = 'whatsapp',
  ): Promise<BulkImportProgress> => {
    const importer = createStreamingImporter(empresaId, prospeccaoId, contatos.length, canal);
    
    for (let i = 0; i < contatos.length; i += RPC_BATCH_SIZE) {
      if (importer.isAborted()) break;
      const batch = contatos.slice(i, i + RPC_BATCH_SIZE);
      importer.enqueueBatch(batch);
    }

    return importer.finalize();
  }, [createStreamingImporter]);

  return {
    progress,
    importContacts,
    createStreamingImporter,
    resetProgress,
    abort,
    isImporting: progress.phase === 'importing' || progress.phase === 'linking',
    RPC_BATCH_SIZE,
  };
};
