# 📋 Checklist de Deploy

## ✅ Pré-Deploy

### Configuração do Ambiente
- [ ] Conta Supabase criada
- [ ] Projeto Supabase configurado
- [ ] Node.js 18+ instalado
- [ ] Supabase CLI instalado (`npm install -g supabase`)
- [ ] Git configurado (se usar CI/CD)

### Configuração de Credenciais
- [ ] `.env` criado baseado em `.env.example`
- [ ] `DATABASE_URL` configurada corretamente
- [ ] Credenciais do Supabase coletadas:
  - [ ] Project URL
  - [ ] Anon Key
  - [ ] Service Role Key (para functions)

### Backup e Segurança
- [ ] Backup dos dados existentes (se aplicável)
- [ ] Senhas seguras definidas
- [ ] Credenciais armazenadas de forma segura

---

## 🚀 Processo de Deploy

### 1. Configuração do Banco de Dados
- [ ] Executar `chmod +x setup-database.sh`
- [ ] Executar `./setup-database.sh`
- [ ] Verificar saída sem erros
- [ ] Conferir se todas as tabelas foram criadas

### 2. Configuração das Edge Functions
- [ ] Fazer login no Supabase CLI (`supabase login`)
- [ ] Configurar PROJECT_ID (`export SUPABASE_PROJECT_ID=seu-id`)
- [ ] Executar `chmod +x edge-functions/deploy-functions.sh`
- [ ] Executar `./edge-functions/deploy-functions.sh`
- [ ] Verificar deploy das functions no painel

### 3. Configuração de Secrets
- [ ] Acessar painel Supabase > Settings > Edge Functions
- [ ] Configurar secrets necessários:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SUPABASE_DB_URL`

### 4. Configuração de Autenticação
- [ ] Acessar Authentication > Providers
- [ ] Habilitar Email provider
- [ ] Configurar Site URL em Settings
- [ ] Configurar Redirect URLs (se necessário)

### 5. Deploy da Aplicação Frontend
- [ ] **Opção A - Lovable (Recomendado):**
  - [ ] Abrir projeto no Lovable
  - [ ] Clicar em Share > Publish
  - [ ] Configurar domínio (se necessário)

- [ ] **Opção B - Deploy Manual:**
  - [ ] Executar `npm install`
  - [ ] Executar `npm run build`
  - [ ] Upload da pasta `dist/` para servidor

---

## 🔍 Verificação Pós-Deploy

### Verificação Automática
- [ ] Executar `chmod +x verify-deployment.sh`
- [ ] Executar `./verify-deployment.sh`
- [ ] Taxa de sucesso >= 90%

### Testes Manuais

#### Autenticação
- [ ] Registrar novo usuário
- [ ] Login com usuário criado
- [ ] Logout funciona corretamente
- [ ] Reset de senha (se configurado)

#### Funcionalidades Principais
- [ ] Criar/editar empresa
- [ ] Associar usuário à empresa
- [ ] Criar agente IA
- [ ] Configurar followup
- [ ] Importar base de contatos
- [ ] Criar prospecção
- [ ] Testar webhook (se configurado)

#### Segurança
- [ ] RLS funcionando (usuário só vê dados da própria empresa)
- [ ] Permissões por tipo de usuário funcionando
- [ ] Não é possível acessar dados de outras empresas

#### Performance
- [ ] Páginas carregam em < 3 segundos
- [ ] Consultas do banco eficientes
- [ ] Sem erros no console do navegador

---

## 📱 Configuração de Produção

### SSL e Domínio
- [ ] Certificado SSL configurado
- [ ] Domínio customizado (se aplicável)
- [ ] Redirect HTTP → HTTPS

### Monitoramento
- [ ] Logs das Edge Functions funcionando
- [ ] Analytics configurado (se aplicável)
- [ ] Alertas de erro configurados (se aplicável)

### Backup e Recuperação
- [ ] Backup automático do Supabase configurado
- [ ] Documentação de processo de recuperação
- [ ] Teste de restore (se possível)

---

## 👥 Configuração de Usuários

### Primeiro Usuário Administrador
- [ ] Criar conta via interface
- [ ] Atualizar tipo_acesso para 'Administrador' no banco
- [ ] Testar acesso administrativo
- [ ] Criar empresa inicial

### Configuração de Equipe
- [ ] Criar usuários da equipe
- [ ] Definir tipos de acesso apropriados
- [ ] Associar usuários às empresas corretas
- [ ] Testar permissões

---

## 📋 Documentação

### Para Usuários
- [ ] Manual de uso básico criado
- [ ] Treinamento da equipe agendado
- [ ] Contatos de suporte definidos

### Para Desenvolvedores
- [ ] Documentação técnica atualizada
- [ ] Processo de deploy documentado
- [ ] Credenciais compartilhadas com segurança
- [ ] Processo de rollback definido

---

## 🚨 Troubleshooting

### Problemas Comuns

**Erro de conexão com banco:**
- Verificar DATABASE_URL
- Verificar se IP está liberado no Supabase
- Testar conexão com `psql`

**Edge Functions não funcionam:**
- Verificar se secrets estão configurados
- Verificar logs no painel Supabase
- Testar functions individualmente

**RLS bloqueando acesso:**
- Verificar se usuário tem perfil criado
- Verificar associação usuário-empresa
- Verificar políticas RLS

**Webhooks não disparam:**
- Verificar URL do webhook
- Verificar logs da function trigger-webhook
- Testar webhook manualmente

---

## ✅ Deploy Concluído

- [ ] Todos os itens do checklist verificados
- [ ] Verificação automática passou (>90%)
- [ ] Testes manuais realizados
- [ ] Usuários podem acessar o sistema
- [ ] Documentação entregue
- [ ] Equipe treinada

**Data do Deploy:** _______________
**Versão:** 1.0.0
**Responsável:** _______________

---

## 📞 Suporte Pós-Deploy

**Contatos:**
- Desenvolvedor: [seu-email]
- Suporte Técnico: [email-suporte]
- Documentação: [link-docs]

**Links Úteis:**
- Painel Supabase: https://supabase.com/dashboard
- Aplicação: [sua-url]
- Repositório: [github-url]