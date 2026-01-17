import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertCircle, Variable } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VariableExample {
  position: number;
  example: string;
}

interface TemplateVariablesEditorProps {
  text: string;
  examples: VariableExample[];
  onExamplesChange: (examples: VariableExample[]) => void;
  onInsertVariable: () => void;
  maxVariables?: number;
}

/**
 * Componente para gerenciar variáveis dinâmicas {{1}}, {{2}}, etc. em templates WhatsApp
 * Detecta automaticamente variáveis no texto e permite preencher valores de exemplo
 */
export function TemplateVariablesEditor({
  text,
  examples,
  onExamplesChange,
  onInsertVariable,
  maxVariables = 10,
}: TemplateVariablesEditorProps) {
  // Detectar variáveis no texto (formato {{1}}, {{2}}, etc.)
  const detectedVariables = useMemo(() => {
    const regex = /\{\{(\d+)\}\}/g;
    const matches: number[] = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const num = parseInt(match[1], 10);
      if (!matches.includes(num) && num > 0 && num <= maxVariables) {
        matches.push(num);
      }
    }
    
    return matches.sort((a, b) => a - b);
  }, [text, maxVariables]);

  // Sincronizar exemplos com variáveis detectadas
  useEffect(() => {
    const currentPositions = examples.map((e) => e.position);
    const newExamples = [...examples];
    let changed = false;

    // Adicionar exemplos para novas variáveis detectadas
    for (const pos of detectedVariables) {
      if (!currentPositions.includes(pos)) {
        newExamples.push({ position: pos, example: "" });
        changed = true;
      }
    }

    // Remover exemplos de variáveis que não existem mais
    const filteredExamples = newExamples.filter((e) =>
      detectedVariables.includes(e.position)
    );

    if (changed || filteredExamples.length !== newExamples.length) {
      onExamplesChange(
        filteredExamples.sort((a, b) => a.position - b.position)
      );
    }
  }, [detectedVariables]);

  // Atualizar valor de exemplo
  const handleExampleChange = (position: number, value: string) => {
    const updatedExamples = examples.map((e) =>
      e.position === position ? { ...e, example: value } : e
    );
    onExamplesChange(updatedExamples);
  };

  // Calcular próximo número de variável disponível
  const getNextVariableNumber = (): number => {
    if (detectedVariables.length === 0) return 1;
    return Math.max(...detectedVariables) + 1;
  };

  // Verificar se todos os exemplos estão preenchidos
  const allExamplesFilled = examples.every((e) => e.example.trim() !== "");

  if (detectedVariables.length === 0) {
    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Variable className="h-4 w-4" />
            <span className="text-sm">Nenhuma variável detectada no texto</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onInsertVariable}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar {"{{1}}"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Adiciona uma variável dinâmica ao texto</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Use variáveis como {"{{1}}"}, {"{{2}}"} para inserir dados dinâmicos (nome do cliente, valor, etc.)
        </p>
      </div>
    );
  }

  return (
    <Card className="p-4 border-primary/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Variable className="h-4 w-4 text-primary" />
          <Label className="font-medium">Variáveis Detectadas</Label>
          <Badge variant="secondary" className="text-xs">
            {detectedVariables.length} {detectedVariables.length === 1 ? "variável" : "variáveis"}
          </Badge>
        </div>
        {detectedVariables.length < maxVariables && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onInsertVariable}
          >
            <Plus className="h-3 w-3 mr-1" />
            {`{{${getNextVariableNumber()}}}`}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Preencha os valores de exemplo para cada variável. Estes valores serão usados apenas para aprovação do template na Meta.
      </p>

      <div className="space-y-3">
        {detectedVariables.map((position) => {
          const example = examples.find((e) => e.position === position);
          const isEmpty = !example?.example.trim();

          return (
            <div key={position} className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={`shrink-0 font-mono ${isEmpty ? "border-amber-500 text-amber-600" : "border-primary text-primary"}`}
              >
                {`{{${position}}}`}
              </Badge>
              <Input
                placeholder={`Valor de exemplo para {{${position}}}...`}
                value={example?.example || ""}
                onChange={(e) => handleExampleChange(position, e.target.value)}
                className={`flex-1 ${isEmpty ? "border-amber-500/50" : ""}`}
              />
            </div>
          );
        })}
      </div>

      {!allExamplesFilled && (
        <div className="flex items-center gap-2 mt-3 text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">
            Preencha todos os valores de exemplo antes de salvar
          </span>
        </div>
      )}
    </Card>
  );
}

/**
 * Helper para extrair exemplos do formato do payload Meta
 */
export function extractVariableExamples(text: string): number[] {
  const regex = /\{\{(\d+)\}\}/g;
  const positions: number[] = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (!positions.includes(num)) {
      positions.push(num);
    }
  }
  
  return positions.sort((a, b) => a - b);
}

/**
 * Constrói o objeto "example" para o payload da Meta API
 */
export function buildBodyExamplePayload(
  examples: VariableExample[]
): { body_text: string[][] } | undefined {
  if (examples.length === 0) return undefined;
  
  // Ordenar por posição e extrair apenas os valores de exemplo
  const sortedExamples = [...examples].sort((a, b) => a.position - b.position);
  const exampleValues = sortedExamples.map((e) => e.example);
  
  return {
    body_text: [exampleValues],
  };
}
