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
  errors: 0,
  retries: 0,
  errorDetails: [],
};

const RPC_BATCH_SIZE = 500; // Records per RPC call
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

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

  const resetProgress = useCallback(() => {
    setProgress(INITIAL_PROGRESS);
    abortRef.current = false;
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  /**
   * Imports contacts in bulk using the server-side RPC for idempotent upserts.
   * Processes in chunks of RPC_BATCH_SIZE with retry logic.
   */
  const importContacts = useCallback(async (
    contatos: ContatoForImport[],
    empresaId: string,
    prospeccaoId: string,
  ): Promise<BulkImportProgress> => {
    abortRef.current = false;
    const totalBatches = Math.ceil(contatos.length / RPC_BATCH_SIZE);

    const currentProgress: BulkImportProgress = {
      ...INITIAL_PROGRESS,
      phase: 'importing',
      totalRecords: contatos.length,
      totalBatches,
    };
    setProgress({ ...currentProgress });

    for (let i = 0; i < contatos.length; i += RPC_BATCH_SIZE) {
      if (abortRef.current) {
        currentProgress.phase = 'error';
        currentProgress.errorDetails.push('Importação cancelada pelo usuário');
        setProgress({ ...currentProgress });
        return currentProgress;
      }

      const batch = contatos.slice(i, i + RPC_BATCH_SIZE);
      const batchNum = Math.floor(i / RPC_BATCH_SIZE) + 1;
      currentProgress.currentBatch = batchNum;
      setProgress({ ...currentProgress });

      let success = false;
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

          const { data, error } = await supabase.rpc('bulk_upsert_contatos', {
            p_contatos: payload as any,
            p_empresa_id: empresaId,
            p_prospeccao_id: prospeccaoId,
          });

          if (error) throw error;

          const result = data as any;
          currentProgress.inserted += result.inserted || 0;
          currentProgress.updated += result.updated || 0;
          currentProgress.linked += result.linked || 0;
          currentProgress.alreadyLinked += result.already_linked || 0;
          currentProgress.errors += result.errors || 0;
          currentProgress.processedRecords += batch.length;
          success = true;
          break;
        } catch (err: any) {
          lastError = err?.message || String(err);
          console.error(`❌ Batch ${batchNum} attempt ${attempt} failed:`, lastError);
          
          if (attempt < MAX_RETRIES) {
            currentProgress.retries++;
            setProgress({ ...currentProgress });
            await sleep(RETRY_DELAY_MS * attempt);
          }
        }
      }

      if (!success) {
        currentProgress.errors += batch.length;
        currentProgress.processedRecords += batch.length;
        currentProgress.errorDetails.push(
          `Lote ${batchNum} falhou após ${MAX_RETRIES} tentativas: ${lastError}`
        );
      }

      setProgress({ ...currentProgress });
    }

    currentProgress.phase = currentProgress.errors > 0 && currentProgress.inserted === 0 && currentProgress.updated === 0
      ? 'error'
      : 'done';
    setProgress({ ...currentProgress });
    return currentProgress;
  }, []);

  return {
    progress,
    importContacts,
    resetProgress,
    abort,
    isImporting: progress.phase === 'importing' || progress.phase === 'linking',
  };
};
