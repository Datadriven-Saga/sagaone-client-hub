import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DispararProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalContatos: number;
  disparadosCount: number;
  isCompleted: boolean;
  isProcessing: boolean;
}

const DispararProgressModal: React.FC<DispararProgressModalProps> = ({
  isOpen,
  onClose,
  totalContatos,
  disparadosCount,
  isCompleted,
  isProcessing
}) => {
  const [displayedCount, setDisplayedCount] = useState(0);
  const [dots, setDots] = useState('');
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const dotsRef = useRef<NodeJS.Timeout | null>(null);

  // Animação de contagem incremental
  useEffect(() => {
    if (!isOpen) return;

    // Atualizar contagem a cada 5 segundos ou quando disparadosCount mudar
    const updateCount = () => {
      setDisplayedCount(disparadosCount);
    };

    updateCount();

    // Intervalo de atualização a cada 5 segundos
    animationRef.current = setInterval(() => {
      setDisplayedCount(disparadosCount);
    }, 5000);

    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, [isOpen, disparadosCount]);

  // Animação dos pontos
  useEffect(() => {
    if (!isOpen || isCompleted) return;

    dotsRef.current = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => {
      if (dotsRef.current) clearInterval(dotsRef.current);
    };
  }, [isOpen, isCompleted]);

  // Reset quando fechar
  useEffect(() => {
    if (!isOpen) {
      setDisplayedCount(0);
      setDots('');
    }
  }, [isOpen]);

  const progress = totalContatos > 0 ? (displayedCount / totalContatos) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-semibold">
            {isCompleted ? 'Disparo Concluído!' : 'Disparando Mensagens'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-6">
          {/* Ícone animado */}
          <div className={cn(
            "relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-500",
            isCompleted 
              ? "bg-green-100 dark:bg-green-900/30" 
              : "bg-primary/10"
          )}>
            {isCompleted ? (
              <Check className="w-12 h-12 text-green-600 dark:text-green-400 animate-scale-in" />
            ) : (
              <>
                <Send className="w-10 h-10 text-primary animate-pulse" />
                {/* Círculo de progresso */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="4"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
              </>
            )}
          </div>

          {/* Status text */}
          <div className="text-center space-y-2">
            {isCompleted ? (
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                Todos os disparos foram realizados!
              </p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  Enviando mensagens{dots}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Atualizando a cada 5 segundos
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Contador */}
          <div className="bg-muted/50 rounded-lg px-6 py-4 min-w-[200px]">
            <div className="text-center">
              <span className="text-4xl font-bold text-primary tabular-nums">
                {displayedCount.toLocaleString('pt-BR')}
              </span>
              <span className="text-2xl text-muted-foreground mx-2">/</span>
              <span className="text-2xl text-muted-foreground tabular-nums">
                {totalContatos.toLocaleString('pt-BR')}
              </span>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-1">
              {isCompleted ? 'contatos disparados' : 'contatos processados'}
            </p>
          </div>

          {/* Barra de progresso */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-1000 ease-out rounded-full",
                isCompleted ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {/* Botão fechar */}
          <Button
            variant="outline"
            onClick={onClose}
            className="mt-2"
          >
            <X className="w-4 h-4 mr-2" />
            {isCompleted ? 'Fechar' : 'Deixar em segundo plano'}
          </Button>

          {!isCompleted && (
            <p className="text-xs text-muted-foreground text-center">
              O envio continuará mesmo se você fechar esta janela
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DispararProgressModal;
