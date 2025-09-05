#!/bin/bash

# ==========================================
# DEPLOY DAS EDGE FUNCTIONS
# Sistema de CRM e Prospecção com Agentes IA
# ==========================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    log_error "Supabase CLI não está instalado"
    log_info "Instale com: npm install -g supabase"
    exit 1
fi

# Verificar se está logado
if ! supabase projects list &> /dev/null; then
    log_error "Não está logado no Supabase"
    log_info "Execute: supabase login"
    exit 1
fi

# Verificar se PROJECT_ID está configurado
if [ -z "$SUPABASE_PROJECT_ID" ]; then
    log_error "SUPABASE_PROJECT_ID não está configurada"
    log_info "Configure com: export SUPABASE_PROJECT_ID=your-project-id"
    exit 1
fi

log_info "Iniciando deploy das Edge Functions..."
log_info "Projeto: $SUPABASE_PROJECT_ID"

# Link do projeto
log_info "Conectando ao projeto..."
supabase link --project-ref $SUPABASE_PROJECT_ID

# Lista das funções para deploy
FUNCTIONS=(
    "trigger-webhook"
    "prospeccao-status"
    "prospeccao-anotacao"
    "manage-users"
    "import-empresas"
    "update-crm-ids"
    "test-webhook"
)

# Deploy de cada função
for func in "${FUNCTIONS[@]}"; do
    if [ -d "../supabase/functions/$func" ]; then
        log_info "Fazendo deploy da função: $func"
        
        if supabase functions deploy $func --project-ref $SUPABASE_PROJECT_ID; then
            log_success "Função $func deployada com sucesso"
        else
            log_error "Falha no deploy da função $func"
        fi
    else
        log_error "Função $func não encontrada no diretório"
    fi
done

# Configurar secrets (se não estiverem configurados)
log_info "Verificando secrets..."

REQUIRED_SECRETS=(
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY" 
    "SUPABASE_SERVICE_ROLE_KEY"
    "SUPABASE_DB_URL"
)

log_info "Configure os seguintes secrets no painel do Supabase:"
log_info "https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/settings/functions"

for secret in "${REQUIRED_SECRETS[@]}"; do
    echo "- $secret"
done

log_info "Para configurar via CLI:"
echo "supabase secrets set --project-ref $SUPABASE_PROJECT_ID SUPABASE_URL=https://your-project.supabase.co"

log_success "Deploy das Edge Functions concluído! 🎉"
log_info "Verifique os logs em: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/functions"