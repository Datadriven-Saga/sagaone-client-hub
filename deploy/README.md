# 📦 Pacote de Deploy - Sistema de CRM e Prospecção

## 🎯 Visão Geral

Este pacote contém todos os arquivos e configurações necessárias para fazer o deploy completo do Sistema de CRM e Prospecção em produção.

## 📋 Pré-requisitos

- [ ] Conta no Supabase (plano gratuito ou pago)
- [ ] Node.js 18+ instalado
- [ ] Acesso administrativo ao projeto
- [ ] Domínio configurado (opcional)

## 🚀 Processo de Deploy

### 1. Configuração do Supabase

1. **Crie um novo projeto no Supabase:**
   ```bash
   # Acesse https://supabase.com/dashboard
   # Clique em "New Project"
   # Anote as credenciais: PROJECT_ID, ANON_KEY, URL
   ```

2. **Configure as variáveis de ambiente:**
   ```bash
   cp .env.example .env
   # Edite o arquivo .env com suas credenciais
   ```

### 2. Execução das Migrações

Execute o script de migração para configurar o banco de dados:

```bash
cd deploy
chmod +x setup-database.sh
./setup-database.sh
```

### 3. Configuração das Políticas RLS

Execute as políticas de segurança:

```bash
psql -h YOUR_DB_HOST -U postgres -d postgres -f database/rls-policies.sql
```

### 4. Deploy da Aplicação

#### Opção A: Deploy via Lovable (Recomendado)
1. Abra o projeto no Lovable
2. Clique em "Share" → "Publish"
3. Configure domínio personalizado se necessário

#### Opção B: Deploy Manual
```bash
npm install
npm run build
# Deploy dos arquivos da pasta dist/ para seu servidor
```

## 🔧 Configurações Importantes

### Edge Functions

As seguintes Edge Functions precisam ser deployadas:

- `trigger-webhook` - Disparo de webhooks para agentes IA
- `prospeccao-status` - Gerenciamento de status de prospecção
- `prospeccao-anotacao` - Sistema de anotações
- `manage-users` - Gerenciamento de usuários
- `import-empresas` - Importação de empresas
- `update-crm-ids` - Atualização de IDs do CRM

### Secrets Necessários

Configure os seguintes secrets no Supabase:

```bash
# No painel do Supabase → Settings → Functions
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DB_URL=your_database_url
```

## 📊 Estrutura do Banco de Dados

### Tabelas Principais

- **empresas** - Dados das empresas
- **profiles** - Perfis dos usuários
- **user_empresas** - Associação usuário-empresa
- **agentes_ia** - Configuração dos agentes IA
- **prospeccoes** - Campanhas de prospecção
- **contatos** - Base de contatos/leads
- **clientes** - Clientes convertidos
- **vendas** - Registro de vendas

### Recursos Importantes

- **RLS (Row Level Security)** configurado para todas as tabelas
- **Triggers** para auditoria e sincronização
- **Functions** para lógica de negócio complexa
- **Políticas de acesso** baseadas em empresa e tipo de usuário

## 🔐 Configurações de Segurança

### 1. Configuração de Auth

```sql
-- Configurar providers de autenticação no painel do Supabase
-- Auth → Providers → Email (habilitado)
-- Auth → Settings → Site URL: seu_dominio.com
```

### 2. Políticas RLS

Todas as tabelas possuem políticas RLS configuradas para:
- Isolamento por empresa
- Controle de acesso por tipo de usuário
- Auditoria de ações sensíveis

## 📱 Funcionalidades Principais

### Sistema de Agentes IA

- ✅ Agentes configuráveis por empresa
- ✅ Followups automáticos
- ✅ Integração com webhooks
- ✅ Cadências de contato

### CRM Completo

- ✅ Gestão de leads e clientes
- ✅ Pipeline de vendas
- ✅ Relatórios e métricas
- ✅ Sistema de notificações

### Multi-empresa

- ✅ Isolamento completo de dados
- ✅ Gestão de usuários por empresa
- ✅ Configurações independentes

## 🔍 Verificação Pós-Deploy

Execute a checklist de verificação:

```bash
cd deploy
chmod +x verify-deployment.sh
./verify-deployment.sh
```

## 📞 Suporte

Para problemas durante o deploy:

1. Verifique os logs das Edge Functions no Supabase
2. Confirme se todas as migrações foram executadas
3. Teste as políticas RLS com diferentes tipos de usuário
4. Verifique se os webhooks estão funcionando

## 📝 Changelog

### Versão 1.0.0
- Sistema completo de CRM
- Agentes IA com followups
- Multi-empresa
- Políticas RLS completas
- Edge Functions implementadas

---

**✨ Deploy realizado com sucesso! Seu sistema está pronto para uso.**