import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertCircle, Variable, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Campos disponíveis para mapeamento de variáveis
export const availableFields = [
  { value: "nome_cliente", label: "Nome do Cliente", example: "João Silva" },
  { value: "empresa", label: "Empresa", example: "Empresa XYZ" },
  { value: "marca", label: "Marca", example: "Toyota" },
  { value: "data_atual", label: "Data Atual", example: "17/01/2026" },
  { value: "nome_prospeccao", label: "Nome Prospecção", example: "Feirão Janeiro" },
  { value: "data_inicio", label: "Data Início", example: "20/01/2026" },
  { value: "data_fim", label: "Data Fim", example: "25/01/2026" },
  { value: "telefone", label: "Telefone", example: "(11) 99999-9999" },
  { value: "vendedor_nome", label: "Nome do Vendedor", example: "Carlos Santos" },
  { value: "valor_potencial", label: "Valor Potencial", example: "R$ 50.000" },
];

export interface VariableMapping {
  position: number;
  field: string; // Campo de dados (nome_cliente, empresa, etc.)
  example: string; // Valor de exemplo para aprovação Meta
}

interface TemplateVariablesEditorProps {
  text: string;
  variables: VariableMapping[];
  onVariablesChange: (variables: VariableMapping[]) => void;
  onInsertVariable: () => void;
  maxVariables?: number;
}

/**
 * Componente para gerenciar variáveis dinâmicas {{1}}, {{2}}, etc. em templates WhatsApp
 * Permite mapear cada variável para um campo de dados do sistema
 */
export function TemplateVariablesEditor({
  text,
  variables,
  onVariablesChange,
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

  // Sincronizar variáveis com as detectadas no texto
  useEffect(() => {
    const currentPositions = variables.map((v) => v.position);
    const newVariables = [...variables];
    let changed = false;

    // Adicionar mapeamentos para novas variáveis detectadas
    for (const pos of detectedVariables) {
      if (!currentPositions.includes(pos)) {
        newVariables.push({ position: pos, field: "", example: "" });
        changed = true;
      }
    }

    // Remover mapeamentos de variáveis que não existem mais
    const filteredVariables = newVariables.filter((v) =>
      detectedVariables.includes(v.position)
    );

    if (changed || filteredVariables.length !== newVariables.length) {
      onVariablesChange(
        filteredVariables.sort((a, b) => a.position - b.position)
      );
    }
  }, [detectedVariables]);

  // Atualizar campo mapeado
  const handleFieldChange = (position: number, field: string) => {
    const fieldInfo = availableFields.find(f => f.value === field);
    const updatedVariables = variables.map((v) =>
      v.position === position 
        ? { ...v, field, example: fieldInfo?.example || "" } 
        : v
    );
    onVariablesChange(updatedVariables);
  };

  // Atualizar valor de exemplo
  const handleExampleChange = (position: number, example: string) => {
    const updatedVariables = variables.map((v) =>
      v.position === position ? { ...v, example } : v
    );
    onVariablesChange(updatedVariables);
  };

  // Calcular próximo número de variável disponível
  const getNextVariableNumber = (): number => {
    if (detectedVariables.length === 0) return 1;
    return Math.max(...detectedVariables) + 1;
  };

  // Verificar se todos os campos estão preenchidos
  const allFieldsMapped = variables.every((v) => v.field.trim() !== "");
  const allExamplesFilled = variables.every((v) => v.example.trim() !== "");

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
          <Label className="font-medium">Mapeamento de Variáveis</Label>
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

      <div className="flex items-start gap-2 mb-3 p-2 bg-blue-50 rounded-md border border-blue-200">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Selecione qual dado do contato será inserido em cada variável. 
          O exemplo é usado apenas para aprovação do template na Meta.
        </p>
      </div>

      <div className="space-y-3">
        {detectedVariables.map((position) => {
          const variable = variables.find((v) => v.position === position);
          const isEmpty = !variable?.field;

          return (
            <div key={position} className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={`shrink-0 font-mono ${isEmpty ? "border-amber-500 text-amber-600" : "border-primary text-primary"}`}
              >
                {`{{${position}}}`}
              </Badge>
              <Select
                value={variable?.field || ""}
                onValueChange={(value) => handleFieldChange(position, value)}
              >
                <SelectTrigger className={`w-48 ${isEmpty ? "border-amber-500/50" : ""}`}>
                  <SelectValue placeholder="Selecione o campo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Exemplo para Meta..."
                value={variable?.example || ""}
                onChange={(e) => handleExampleChange(position, e.target.value)}
                className="flex-1"
              />
            </div>
          );
        })}
      </div>

      {(!allFieldsMapped || !allExamplesFilled) && (
        <div className="flex items-center gap-2 mt-3 text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">
            {!allFieldsMapped 
              ? "Selecione um campo para cada variável" 
              : "Preencha todos os valores de exemplo"}
          </span>
        </div>
      )}
    </Card>
  );
}

/**
 * Helper para extrair posições de variáveis do texto
 */
export function extractVariablePositions(text: string): number[] {
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
  variables: VariableMapping[]
): { body_text: string[][] } | undefined {
  if (variables.length === 0) return undefined;
  
  // Ordenar por posição e extrair apenas os valores de exemplo
  const sortedVariables = [...variables].sort((a, b) => a.position - b.position);
  const exampleValues = sortedVariables.map((v) => v.example);
  
  // Verificar se todos os exemplos estão preenchidos
  if (exampleValues.some(e => !e.trim())) return undefined;
  
  return {
    body_text: [exampleValues],
  };
}

/**
 * Constrói o mapeamento de variáveis para armazenamento
 */
export function buildVariableMappingPayload(
  variables: VariableMapping[]
): Record<number, string> {
  const mapping: Record<number, string> = {};
  for (const v of variables) {
    if (v.field) {
      mapping[v.position] = v.field;
    }
  }
  return mapping;
}
