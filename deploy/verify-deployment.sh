#!/bin/bash

# ==========================================
# SCRIPT DE VERIFICAÇÃO PÓS-DEPLOY
# Sistema de CRM e Prospecção com Agentes IA
# ==========================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Função para logging
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_CHECKS++))
}

# Função para verificar e contar
check_and_count() {
    ((TOTAL_CHECKS++))
    if [ $? -eq 0 ]; then
        log_success "$1"
    else
        log_error "$1"
    fi
}

echo "🔍 Iniciando verificação pós-deploy..."
echo "========================================"

# Verificar variáveis de ambiente
log_info "Verificando configurações..."

if [ -z "$DATABASE_URL" ]; then
    ((TOTAL_CHECKS++))
    log_error "DATABASE_URL não configurada"
else
    ((TOTAL_CHECKS++))
    log_success "DATABASE_URL configurada"
fi

# Testar conexão com banco
log_info "Testando conectividade..."
((TOTAL_CHECKS++))

if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Conexão com banco de dados"
else
    log_error "Falha na conexão com banco"
fi

# Verificar tabelas principais
log_info "Verificando estrutura do banco..."

REQUIRED_TABLES=(
    "empresas"
    "profiles" 
    "user_empresas"
    "agentes_ia"
    "agente_followups"
    "agente_cadencias"
    "prospeccoes"
    "contatos"
    "clientes"
    "vendas"
    "notificacoes"
)

for table in "${REQUIRED_TABLES[@]}"; do
    ((TOTAL_CHECKS++))
    if psql "$DATABASE_URL" -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
        log_success "Tabela: $table"
    else
        log_error "Tabela: $table"
    fi
done

# Verificar funções críticas
log_info "Verificando funções do sistema..."

REQUIRED_FUNCTIONS=(
    "is_admin()"
    "get_user_active_company()"
    "get_current_user_access_type()"
    "handle_new_user()"
    "sync_contato_to_cliente()"
)

for func in "${REQUIRED_FUNCTIONS[@]}"; do
    ((TOTAL_CHECKS++))
    if psql "$DATABASE_URL" -c "SELECT $func;" > /dev/null 2>&1; then
        log_success "Função: $func"
    else
        log_error "Função: $func"
    fi
done

# Verificar RLS está habilitado
log_info "Verificando Row Level Security..."

RLS_TABLES=(
    "empresas"
    "profiles"
    "contatos"
    "clientes"
    "agentes_ia"
)

for table in "${RLS_TABLES[@]}"; do
    ((TOTAL_CHECKS++))
    RLS_STATUS=$(psql "$DATABASE_URL" -t -c "SELECT relrowsecurity FROM pg_class WHERE relname = '$table';")
    if [[ "$RLS_STATUS" == *"t"* ]]; then
        log_success "RLS habilitado: $table"
    else
        log_error "RLS não habilitado: $table"
    fi
done

# Verificar políticas RLS
log_info "Verificando políticas RLS..."

POLICY_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_policies;")
((TOTAL_CHECKS++))

if [ "$POLICY_COUNT" -gt 20 ]; then
    log_success "Políticas RLS: $POLICY_COUNT políticas encontradas"
else
    log_error "Políticas RLS: Apenas $POLICY_COUNT políticas (esperado > 20)"
fi

# Verificar triggers
log_info "Verificando triggers..."

TRIGGER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';")
((TOTAL_CHECKS++))

if [ "$TRIGGER_COUNT" -gt 5 ]; then
    log_success "Triggers: $TRIGGER_COUNT triggers encontrados"
else
    log_error "Triggers: Apenas $TRIGGER_COUNT triggers (esperado > 5)"
fi

# Verificar tipos personalizados
log_info "Verificando tipos personalizados..."

CUSTOM_TYPES=(
    "tipo_acesso"
    "status_lead"
    "origem_lead"
    "status_usuario"
)

for type in "${CUSTOM_TYPES[@]}"; do
    ((TOTAL_CHECKS++))
    if psql "$DATABASE_URL" -c "SELECT enum_range(NULL::$type);" > /dev/null 2>&1; then
        log_success "Tipo: $type"
    else
        log_error "Tipo: $type"
    fi
done

# Verificar constraints e índices importantes
log_info "Verificando constraints..."

# Verificar foreign keys principais
FK_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';")
((TOTAL_CHECKS++))

if [ "$FK_COUNT" -gt 10 ]; then
    log_success "Foreign Keys: $FK_COUNT constraints encontradas"
else
    log_error "Foreign Keys: Apenas $FK_COUNT constraints (esperado > 10)"
fi

# Teste de inserção (se possível)
log_info "Testando operações básicas..."

# Tentar criar um registro de teste
((TOTAL_CHECKS++))
TEST_RESULT=$(psql "$DATABASE_URL" -t -c "
INSERT INTO tipos_notificacao (nome, descricao) 
VALUES ('teste_deploy', 'Teste pós-deploy') 
ON CONFLICT DO NOTHING 
RETURNING id;" 2>/dev/null)

if [ ! -z "$TEST_RESULT" ]; then
    log_success "Inserção de teste"
    # Limpar o teste
    psql "$DATABASE_URL" -c "DELETE FROM tipos_notificacao WHERE nome = 'teste_deploy';" > /dev/null 2>&1
else
    log_error "Inserção de teste falhou"
fi

# Verificar storage buckets (se aplicável)
if command -v curl &> /dev/null; then
    log_info "Verificando buckets de storage..."
    ((TOTAL_CHECKS++))
    
    # Esta verificação depende da URL do Supabase estar configurada
    if [[ "$DATABASE_URL" == *"supabase"* ]]; then
        log_success "Configuração Supabase detectada"
    else
        log_warning "Não é possível verificar storage (não é Supabase)"
    fi
fi

# Relatório final
echo ""
echo "========================================"
log_info "RELATÓRIO FINAL"
echo "========================================"

SUCCESS_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo "Total de verificações: $TOTAL_CHECKS"
echo "Sucessos: $PASSED_CHECKS"
echo "Falhas: $FAILED_CHECKS"
echo "Taxa de sucesso: $SUCCESS_RATE%"
echo ""

if [ $SUCCESS_RATE -ge 90 ]; then
    log_success "DEPLOY VERIFICADO COM SUCESSO! 🎉"
    log_info "Sistema pronto para uso em produção."
elif [ $SUCCESS_RATE -ge 70 ]; then
    log_warning "DEPLOY PARCIALMENTE VERIFICADO ⚠️"
    log_info "Algumas verificações falharam, mas o sistema pode funcionar."
    log_info "Revise os erros acima e corrija se necessário."
else
    log_error "DEPLOY COM PROBLEMAS CRÍTICOS ❌"
    log_error "Muitas verificações falharam. Revise a configuração."
    exit 1
fi

echo ""
log_info "Para suporte adicional, verifique:"
echo "- Logs do Supabase Functions"
echo "- Configurações de autenticação"
echo "- Variáveis de ambiente"
echo ""

exit 0