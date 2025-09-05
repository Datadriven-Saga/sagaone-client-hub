#!/bin/bash

# ==========================================
# SCRIPT DE CONFIGURAÇÃO DO BANCO DE DADOS
# Sistema de CRM e Prospecção com Agentes IA
# ==========================================

set -e

echo "🚀 Iniciando configuração do banco de dados..."

# Verificar se as variáveis de ambiente estão configuradas
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erro: DATABASE_URL não está configurada"
    echo "Configure a variável com a URL do seu banco Supabase"
    exit 1
fi

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Função para executar SQL com tratamento de erro
execute_sql() {
    local sql_file=$1
    local description=$2
    
    log_info "Executando: $description"
    
    if psql "$DATABASE_URL" -f "$sql_file" > /dev/null 2>&1; then
        log_success "$description concluído"
    else
        log_error "Falha ao executar: $description"
        log_error "Arquivo: $sql_file"
        return 1
    fi
}

# Verificar conectividade com o banco
log_info "Testando conexão com o banco de dados..."
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Conexão com o banco estabelecida"
else
    log_error "Falha na conexão com o banco de dados"
    log_error "Verifique a DATABASE_URL: $DATABASE_URL"
    exit 1
fi

# Executar migração completa
log_info "=========================================="
log_info "EXECUTANDO MIGRAÇÃO COMPLETA"
log_info "=========================================="

execute_sql "database/complete-migration.sql" "Migração das tabelas e estruturas"

# Executar políticas RLS
log_info "=========================================="
log_info "CONFIGURANDO POLÍTICAS DE SEGURANÇA"
log_info "=========================================="

execute_sql "database/rls-policies.sql" "Políticas RLS e segurança"

# Verificar se as principais tabelas foram criadas
log_info "=========================================="
log_info "VERIFICANDO ESTRUTURA CRIADA"
log_info "=========================================="

TABLES=("empresas" "profiles" "user_empresas" "agentes_ia" "prospeccoes" "contatos" "clientes")

for table in "${TABLES[@]}"; do
    if psql "$DATABASE_URL" -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
        log_success "Tabela '$table' criada e acessível"
    else
        log_warning "Problema com a tabela '$table'"
    fi
done

# Verificar funções importantes
log_info "Verificando funções do sistema..."

FUNCTIONS=("is_admin()" "get_user_active_company()" "get_current_user_access_type()")

for func in "${FUNCTIONS[@]}"; do
    if psql "$DATABASE_URL" -c "SELECT $func;" > /dev/null 2>&1; then
        log_success "Função '$func' disponível"
    else
        log_warning "Função '$func' não encontrada"
    fi
done

# Criar dados iniciais (opcional)
if [ "$1" == "--with-sample-data" ]; then
    log_info "=========================================="
    log_info "INSERINDO DADOS DE EXEMPLO"
    log_info "=========================================="
    
    if [ -f "database/sample-data.sql" ]; then
        execute_sql "database/sample-data.sql" "Dados de exemplo"
    else
        log_warning "Arquivo de dados de exemplo não encontrado"
    fi
fi

# Resumo final
echo ""
log_info "=========================================="
log_success "CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!"
log_info "=========================================="
echo ""
log_info "Próximos passos:"
echo "1. Configure as Edge Functions no Supabase"
echo "2. Configure os secrets necessários"  
echo "3. Teste a autenticação no frontend"
echo "4. Crie o primeiro usuário administrador"
echo ""
log_info "Para verificar a integridade:"
echo "./verify-deployment.sh"
echo ""

# Estatísticas
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
FUNCTION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';")

log_success "Criadas $TABLE_COUNT tabelas e $FUNCTION_COUNT funções"
log_success "Sistema pronto para deploy! 🎉"