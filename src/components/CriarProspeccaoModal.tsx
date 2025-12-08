import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Target, Users, MapPin, ThumbsUp, Phone, Info, Trophy, Award, Gift, Star, Search, Plus, Edit2, Trash2, X, Check, UsersRound, Image, FileImage, Megaphone, Upload, QrCode, User, Building, CalendarDays, Clock, Link, Palette } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CriarProspeccaoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProspeccaoCriada: () => void;
  editingProspeccao?: any;
}

export const CriarProspeccaoModal = ({ isOpen, onOpenChange, onProspeccaoCriada, editingProspeccao }: CriarProspeccaoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dados-gerais");
  
  // Dados Gerais
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [canal, setCanal] = useState<'Whatsapp' | 'Ligação'>('Whatsapp');
  const [templateProspeccao, setTemplateProspeccao] = useState("");
  const [templateAgendado, setTemplateAgendado] = useState("");
  const [templateNaoAgendado, setTemplateNaoAgendado] = useState("");
  const [convite, setConvite] = useState("");
  const [imagemDivulgacao, setImagemDivulgacao] = useState("");
  
  // Metas
  const [metaNovos, setMetaNovos] = useState<number | "">("");
  const [metaSeminovos, setMetaSeminovos] = useState<number | "">("");
  const [metaDiretas, setMetaDiretas] = useState<number | "">("");
  const [metaCheckins, setMetaCheckins] = useState<number | "">("");
  const [metaConfirmacoes, setMetaConfirmacoes] = useState<number | "">("");
  const [metaConvites, setMetaConvites] = useState<number | "">("");
  const [tamanhoBase, setTamanhoBase] = useState<number>(0);
  
  // Metas Individuais
  const [metasIndividuais, setMetasIndividuais] = useState<Record<string, { meta_vendas: number; meta_checkins: number; meta_confirmacoes: number; meta_convites: number }>>({});
  const [usersComAcesso, setUsersComAcesso] = useState<{ id: string; nome_completo: string; tipo_acesso: string | null }[]>([]);
  const [metasIndividuaisFilter, setMetasIndividuaisFilter] = useState("");
  
  // Equipes
  interface Equipe {
    id?: string;
    nome: string;
    cor: string;
    ativo: boolean;
    membros: string[];
  }
  const coresPadrao = ['#EF4444', '#3B82F6', '#22C55E', '#EAB308', '#F97316', '#EC4899', '#8B5CF6'];
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeEditando, setEquipeEditando] = useState<number | null>(null);
  const [novaEquipeNome, setNovaEquipeNome] = useState("");
  const [novaEquipeCor, setNovaEquipeCor] = useState(coresPadrao[0]);
  const [novaEquipeMembros, setNovaEquipeMembros] = useState<string[]>([]);
  const [criarNovaEquipe, setCriarNovaEquipe] = useState(false);
  
  // Convite
  const [conviteImagem, setConviteImagem] = useState<string | null>(null);
  const [conviteImagemFile, setConviteImagemFile] = useState<File | null>(null);
  const [uploadingConvite, setUploadingConvite] = useState(false);
  
  // Marketing
  interface MarketingAsset {
    id?: string;
    tipo_formato: string;
    plataforma: string;
    largura: number;
    altura: number;
    imagem_url: string | null;
    nome_arquivo?: string;
    tamanho_arquivo?: number;
    file?: File;
  }
  const [marketingAssets, setMarketingAssets] = useState<MarketingAsset[]>([]);
  const [uploadingMarketing, setUploadingMarketing] = useState(false);
  
  // Páginas de Captura
  const [paginaInicioFrase, setPaginaInicioFrase] = useState("");
  const [paginaPalavraDestaque, setPaginaPalavraDestaque] = useState("");
  const [paginaFinalFrase, setPaginaFinalFrase] = useState("");
  const [paginaTextoApoio, setPaginaTextoApoio] = useState("");
  const [paginaPrimeiroDia, setPaginaPrimeiroDia] = useState("");
  const [paginaDiaFinal, setPaginaDiaFinal] = useState("");
  const [paginaHoraInicio, setPaginaHoraInicio] = useState("");
  const [paginaHoraTermino, setPaginaHoraTermino] = useState("");
  const [paginaLinkPolitica, setPaginaLinkPolitica] = useState("");
  const [paginaCorFundo, setPaginaCorFundo] = useState("#0d2b47");
  const [paginaCorTexto, setPaginaCorTexto] = useState("#ffffff");
  const [paginaCorDestaque, setPaginaCorDestaque] = useState("#0ab9d8");
  const [paginaImagemEvento, setPaginaImagemEvento] = useState<string | null>(null);
  const [paginaImagemEventoFile, setPaginaImagemEventoFile] = useState<File | null>(null);
  
  // Premiações - Estado com ativo/valor
  const [premiacoes, setPremiacoes] = useState<Record<string, { ativo: boolean; valor: number | "" }>>({
    equipe_campea: { ativo: false, valor: "" },
    equipe_2lugar: { ativo: false, valor: "" },
    equipe_3lugar: { ativo: false, valor: "" },
    vendedor_ouro: { ativo: false, valor: "" },
    vendedor_prata: { ativo: false, valor: "" },
    vendedor_bronze: { ativo: false, valor: "" },
    prospector_ouro: { ativo: false, valor: "" },
    prospector_prata: { ativo: false, valor: "" },
    prospector_bronze: { ativo: false, valor: "" },
    checkin_ouro: { ativo: false, valor: "" },
    checkin_prata: { ativo: false, valor: "" },
    checkin_bronze: { ativo: false, valor: "" },
    participacao_apoio: { ativo: false, valor: "" },
    indicacao_venda: { ativo: false, valor: "" },
  });
  
  // Outras Premiações (personalizadas)
  interface OutraPremiacao {
    id?: string;
    nome: string;
    valor: number | "";
    ativo: boolean;
  }
  const [outrasPremiacoes, setOutrasPremiacoes] = useState<OutraPremiacao[]>([]);
  const [novaOutraPremiacao, setNovaOutraPremiacao] = useState({ nome: "", valor: "" as number | "" });
  const [mostrarFormOutraPremiacao, setMostrarFormOutraPremiacao] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeCompany } = useCompany();

  // Preencher campos quando estiver editando
  useEffect(() => {
    if (editingProspeccao && isOpen) {
      setTitulo(editingProspeccao.titulo || "");
      setDescricao(editingProspeccao.descricao || "");
      setDataInicio(editingProspeccao.data_inicio || "");
      setDataFim(editingProspeccao.data_fim || "");
      setCanal(editingProspeccao.canal || 'Whatsapp');
      setTemplateProspeccao(editingProspeccao.template_prospeccao || "");
      setTemplateAgendado(editingProspeccao.template_agendado || "");
      setTemplateNaoAgendado(editingProspeccao.template_nao_agendado || "");
      setConvite((editingProspeccao as any).convite || "");
      setImagemDivulgacao(editingProspeccao.imagem_divulgacao_url || "");
      
      // Metas
      setMetaNovos(editingProspeccao.meta_novos ?? "");
      setMetaSeminovos(editingProspeccao.meta_seminovos ?? "");
      setMetaDiretas(editingProspeccao.meta_diretas ?? "");
      setMetaCheckins(editingProspeccao.meta_checkins ?? "");
      setMetaConfirmacoes(editingProspeccao.meta_confirmacoes ?? "");
      setMetaConvites(editingProspeccao.meta_convites ?? "");
      
      // Premiações
      setPremiacoes({
        equipe_campea: { ativo: !!editingProspeccao.premio_equipe_campea, valor: editingProspeccao.premio_equipe_campea ?? "" },
        equipe_2lugar: { ativo: !!editingProspeccao.premio_equipe_2lugar, valor: editingProspeccao.premio_equipe_2lugar ?? "" },
        equipe_3lugar: { ativo: !!editingProspeccao.premio_equipe_3lugar, valor: editingProspeccao.premio_equipe_3lugar ?? "" },
        vendedor_ouro: { ativo: !!editingProspeccao.premio_vendedor_ouro, valor: editingProspeccao.premio_vendedor_ouro ?? "" },
        vendedor_prata: { ativo: !!editingProspeccao.premio_vendedor_prata, valor: editingProspeccao.premio_vendedor_prata ?? "" },
        vendedor_bronze: { ativo: !!editingProspeccao.premio_vendedor_bronze, valor: editingProspeccao.premio_vendedor_bronze ?? "" },
        prospector_ouro: { ativo: !!editingProspeccao.premio_prospector_ouro, valor: editingProspeccao.premio_prospector_ouro ?? "" },
        prospector_prata: { ativo: !!editingProspeccao.premio_prospector_prata, valor: editingProspeccao.premio_prospector_prata ?? "" },
        prospector_bronze: { ativo: !!editingProspeccao.premio_prospector_bronze, valor: editingProspeccao.premio_prospector_bronze ?? "" },
        checkin_ouro: { ativo: !!editingProspeccao.premio_checkin_ouro, valor: editingProspeccao.premio_checkin_ouro ?? "" },
        checkin_prata: { ativo: !!editingProspeccao.premio_checkin_prata, valor: editingProspeccao.premio_checkin_prata ?? "" },
        checkin_bronze: { ativo: !!editingProspeccao.premio_checkin_bronze, valor: editingProspeccao.premio_checkin_bronze ?? "" },
        participacao_apoio: { ativo: !!editingProspeccao.premio_participacao_apoio, valor: editingProspeccao.premio_participacao_apoio ?? "" },
        indicacao_venda: { ativo: !!editingProspeccao.premio_indicacao_venda, valor: editingProspeccao.premio_indicacao_venda ?? "" },
      });
    } else if (!editingProspeccao && isOpen) {
      // Limpar campos quando criar nova prospecção
      clearForm();
    }
  }, [editingProspeccao, isOpen]);

  // Buscar tamanho da base quando editando
  useEffect(() => {
    const fetchTamanhoBase = async () => {
      if (editingProspeccao?.id && activeCompany?.id) {
        const { count } = await supabase
          .from('contatos')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', activeCompany.id);
        
        setTamanhoBase(count || 0);
      }
    };
    
    if (isOpen && editingProspeccao) {
      fetchTamanhoBase();
    }
  }, [editingProspeccao, activeCompany?.id, isOpen]);

  // Reset aba ao abrir modal
  useEffect(() => {
    if (isOpen) {
      setActiveTab("dados-gerais");
    }
  }, [isOpen]);

  const clearForm = () => {
    setTitulo("");
    setDescricao("");
    setDataInicio("");
    setDataFim("");
    setCanal('Whatsapp');
    setTemplateProspeccao("");
    setTemplateAgendado("");
    setTemplateNaoAgendado("");
    setConvite("");
    setImagemDivulgacao("");
    setMetaNovos("");
    setMetaSeminovos("");
    setMetaDiretas("");
    setMetaCheckins("");
    setMetaConfirmacoes("");
    setMetaConvites("");
    setTamanhoBase(0);
    setPremiacoes({
      equipe_campea: { ativo: false, valor: "" },
      equipe_2lugar: { ativo: false, valor: "" },
      equipe_3lugar: { ativo: false, valor: "" },
      vendedor_ouro: { ativo: false, valor: "" },
      vendedor_prata: { ativo: false, valor: "" },
      vendedor_bronze: { ativo: false, valor: "" },
      prospector_ouro: { ativo: false, valor: "" },
      prospector_prata: { ativo: false, valor: "" },
      prospector_bronze: { ativo: false, valor: "" },
      checkin_ouro: { ativo: false, valor: "" },
      checkin_prata: { ativo: false, valor: "" },
      checkin_bronze: { ativo: false, valor: "" },
      participacao_apoio: { ativo: false, valor: "" },
      indicacao_venda: { ativo: false, valor: "" },
    });
    setMetasIndividuais({});
    setMetasIndividuaisFilter("");
    setEquipes([]);
    setEquipeEditando(null);
    setNovaEquipeNome("");
    setNovaEquipeCor(coresPadrao[0]);
    setNovaEquipeMembros([]);
    setCriarNovaEquipe(false);
    setConviteImagem(null);
    setConviteImagemFile(null);
    // Páginas
    setPaginaInicioFrase("");
    setPaginaPalavraDestaque("");
    setPaginaFinalFrase("");
    setPaginaTextoApoio("");
    setPaginaPrimeiroDia("");
    setPaginaDiaFinal("");
    setPaginaHoraInicio("");
    setPaginaHoraTermino("");
    setPaginaLinkPolitica("");
    setPaginaCorFundo("#0d2b47");
    setPaginaCorTexto("#ffffff");
    setPaginaCorDestaque("#0ab9d8");
    setPaginaImagemEvento(null);
    setPaginaImagemEventoFile(null);
    // Marketing
    setMarketingAssets([]);
    // Outras Premiações
    setOutrasPremiacoes([]);
    setNovaOutraPremiacao({ nome: "", valor: "" });
    setMostrarFormOutraPremiacao(false);
  };
  
  // Buscar usuários com acesso à empresa ativa
  useEffect(() => {
    const fetchUsersComAcesso = async () => {
      if (!activeCompany?.id || !isOpen) return;
      
      // Buscar usuários que têm acesso via user_empresas
      const { data: userEmpresasData, error: userEmpresasError } = await supabase
        .from('user_empresas')
        .select('user_id')
        .eq('empresa_id', activeCompany.id);
      
      if (userEmpresasError) {
        console.error('Erro ao buscar user_empresas:', userEmpresasError);
        return;
      }
      
      const userIds = userEmpresasData?.map(ue => ue.user_id) || [];
      
      if (userIds.length === 0) {
        setUsersComAcesso([]);
        return;
      }
      
      // Buscar profiles dos usuários com status ativo
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome_completo, tipo_acesso, status')
        .in('id', userIds)
        .eq('status', 'Ativo');
      
      if (profilesError) {
        console.error('Erro ao buscar profiles:', profilesError);
        return;
      }
      
      setUsersComAcesso(profilesData || []);
    };
    
    fetchUsersComAcesso();
  }, [activeCompany?.id, isOpen]);
  
  // Buscar metas individuais quando editando
  useEffect(() => {
    const fetchMetasIndividuais = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id || !isOpen) return;
      
      const { data, error } = await supabase
        .from('prospeccao_metas_individuais')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .eq('empresa_id', activeCompany.id);
      
      if (error) {
        console.error('Erro ao buscar metas individuais:', error);
        return;
      }
      
      const metasMap: Record<string, { meta_vendas: number; meta_checkins: number; meta_confirmacoes: number; meta_convites: number }> = {};
      data?.forEach(meta => {
        metasMap[meta.user_id] = {
          meta_vendas: meta.meta_vendas || 0,
          meta_checkins: meta.meta_checkins || 0,
          meta_confirmacoes: meta.meta_confirmacoes || 0,
          meta_convites: meta.meta_convites || 0,
        };
      });
      setMetasIndividuais(metasMap);
    };
    
    // Buscar equipes quando editando
    const fetchEquipes = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id || !isOpen) return;
      
      const { data: equipesData, error: equipesError } = await supabase
        .from('prospeccao_equipes')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .eq('empresa_id', activeCompany.id);
      
      if (equipesError) {
        console.error('Erro ao buscar equipes:', equipesError);
        return;
      }
      
      if (!equipesData) return;
      
      // Buscar membros de cada equipe
      const equipesComMembros = await Promise.all(
        equipesData.map(async (equipe) => {
          const { data: membrosData } = await supabase
            .from('prospeccao_equipe_membros')
            .select('user_id')
            .eq('equipe_id', equipe.id);
          
          return {
            id: equipe.id,
            nome: equipe.nome,
            cor: equipe.cor,
            ativo: equipe.ativo,
            membros: membrosData?.map(m => m.user_id) || []
          };
        })
      );
      
      setEquipes(equipesComMembros);
    };
    
    // Buscar convite quando editando
    const fetchConvite = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id) return;
      
      const { data, error } = await supabase
        .from('prospeccao_convites')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .single();
      
      if (!error && data?.imagem_url) {
        setConviteImagem(data.imagem_url);
      }
    };
    
    // Buscar página de captura quando editando
    const fetchPagina = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id) return;
      
      const { data, error } = await supabase
        .from('prospeccao_paginas')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .single();
      
      if (!error && data) {
        setPaginaInicioFrase(data.inicio_frase || "");
        setPaginaPalavraDestaque(data.palavra_destaque || "");
        setPaginaFinalFrase(data.final_frase || "");
        setPaginaTextoApoio(data.texto_apoio || "");
        setPaginaPrimeiroDia(data.primeiro_dia_evento || "");
        setPaginaDiaFinal(data.dia_final_evento || "");
        setPaginaHoraInicio(data.hora_inicio || "");
        setPaginaHoraTermino(data.hora_termino || "");
        setPaginaLinkPolitica(data.link_politica_privacidade || "");
        setPaginaCorFundo(data.cor_fundo || "#0d2b47");
        setPaginaCorTexto(data.cor_texto || "#ffffff");
        setPaginaCorDestaque(data.cor_destaque || "#0ab9d8");
        setPaginaImagemEvento(data.imagem_evento_url || null);
      }
    };
    
    // Buscar marketing assets quando editando
    const fetchMarketingAssets = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id) return;
      
      const { data, error } = await supabase
        .from('prospeccao_marketing')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .eq('empresa_id', activeCompany.id);
      
      if (!error && data) {
        setMarketingAssets(data.map(item => ({
          id: item.id,
          tipo_formato: item.tipo_formato,
          plataforma: item.plataforma,
          largura: item.largura,
          altura: item.altura,
          imagem_url: item.imagem_url,
          nome_arquivo: item.nome_arquivo || undefined,
          tamanho_arquivo: item.tamanho_arquivo || undefined,
        })));
      }
    };
    
    // Buscar outras premiações quando editando
    const fetchOutrasPremiacoes = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id) return;
      
      const { data, error } = await supabase
        .from('prospeccao_outras_premiacoes')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .eq('empresa_id', activeCompany.id);
      
      if (!error && data) {
        setOutrasPremiacoes(data.map(item => ({
          id: item.id,
          nome: item.nome,
          valor: item.valor || 0,
          ativo: item.ativo,
        })));
      }
    };
    
    if (editingProspeccao && isOpen) {
      fetchMetasIndividuais();
      fetchEquipes();
      fetchConvite();
      fetchPagina();
      fetchMarketingAssets();
      fetchOutrasPremiacoes();
    }
  }, [editingProspeccao?.id, activeCompany?.id, isOpen]);
  
  // Handler para atualizar meta individual
  const handleMetaIndividualChange = (userId: string, field: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value);
    setMetasIndividuais(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId] || { meta_vendas: 0, meta_checkins: 0, meta_confirmacoes: 0, meta_convites: 0 },
        [field]: numValue
      }
    }));
  };
  
  // Salvar metas individuais
  const saveMetasIndividuais = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    const metasToSave = Object.entries(metasIndividuais)
      .filter(([_, meta]) => meta.meta_vendas > 0 || meta.meta_checkins > 0 || meta.meta_confirmacoes > 0 || meta.meta_convites > 0)
      .map(([userId, meta]) => ({
        prospeccao_id: prospeccaoId,
        user_id: userId,
        empresa_id: activeCompany.id,
        meta_vendas: meta.meta_vendas,
        meta_checkins: meta.meta_checkins,
        meta_confirmacoes: meta.meta_confirmacoes,
        meta_convites: meta.meta_convites,
      }));
    
    if (metasToSave.length === 0) return;
    
    // Upsert metas individuais
    const { error } = await supabase
      .from('prospeccao_metas_individuais')
      .upsert(metasToSave, { onConflict: 'prospeccao_id,user_id' });
    
    if (error) {
      console.error('Erro ao salvar metas individuais:', error);
    }
  };
  
  // Salvar equipes
  const saveEquipes = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    for (const equipe of equipes) {
      if (equipe.id) {
        // Atualizar equipe existente
        await supabase
          .from('prospeccao_equipes')
          .update({
            nome: equipe.nome,
            cor: equipe.cor,
            ativo: equipe.ativo
          })
          .eq('id', equipe.id);
        
        // Remover membros antigos e adicionar novos
        await supabase
          .from('prospeccao_equipe_membros')
          .delete()
          .eq('equipe_id', equipe.id);
        
        if (equipe.membros.length > 0) {
          await supabase
            .from('prospeccao_equipe_membros')
            .insert(equipe.membros.map(userId => ({
              equipe_id: equipe.id,
              user_id: userId
            })));
        }
      } else {
        // Criar nova equipe
        const { data: newEquipe, error: equipeError } = await supabase
          .from('prospeccao_equipes')
          .insert({
            prospeccao_id: prospeccaoId,
            empresa_id: activeCompany.id,
            nome: equipe.nome,
            cor: equipe.cor,
            ativo: equipe.ativo
          })
          .select()
          .single();
        
        if (equipeError || !newEquipe) {
          console.error('Erro ao criar equipe:', equipeError);
          continue;
        }
        
        // Adicionar membros
        if (equipe.membros.length > 0) {
          await supabase
            .from('prospeccao_equipe_membros')
            .insert(equipe.membros.map(userId => ({
              equipe_id: newEquipe.id,
              user_id: userId
            })));
        }
      }
    }
  };
  
  // Salvar convite
  const saveConvite = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    // Se não tem arquivo novo para upload, verifica se já existe imagem
    if (!conviteImagemFile && !conviteImagem) return;
    
    let imagemUrl = conviteImagem;
    
    // Se tem arquivo novo, faz upload
    if (conviteImagemFile) {
      const fileExt = conviteImagemFile.name.split('.').pop();
      const fileName = `${prospeccaoId}-${Date.now()}.${fileExt}`;
      const filePath = `${activeCompany.id}/${fileName}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('convites-prospeccao')
        .upload(filePath, conviteImagemFile, { upsert: true });
      
      if (uploadError) {
        console.error('Erro ao fazer upload do convite:', uploadError);
        return;
      }
      
      // Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from('convites-prospeccao')
        .getPublicUrl(filePath);
      
      imagemUrl = publicUrlData.publicUrl;
    }
    
    // Upsert convite
    const { error } = await supabase
      .from('prospeccao_convites')
      .upsert({
        prospeccao_id: prospeccaoId,
        empresa_id: activeCompany.id,
        imagem_url: imagemUrl
      }, { onConflict: 'prospeccao_id' });
    
    if (error) {
      console.error('Erro ao salvar convite:', error);
    }
  };
  
  // Salvar página de captura
  const savePagina = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    let imagemUrl = paginaImagemEvento;
    
    // Se tem arquivo novo, faz upload
    if (paginaImagemEventoFile) {
      const fileExt = paginaImagemEventoFile.name.split('.').pop();
      const fileName = `pagina-${prospeccaoId}-${Date.now()}.${fileExt}`;
      const filePath = `${activeCompany.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('convites-prospeccao')
        .upload(filePath, paginaImagemEventoFile, { upsert: true });
      
      if (uploadError) {
        console.error('Erro ao fazer upload da imagem da página:', uploadError);
        return;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('convites-prospeccao')
        .getPublicUrl(filePath);
      
      imagemUrl = publicUrlData.publicUrl;
    }
    
    // Upsert página
    const { error } = await supabase
      .from('prospeccao_paginas')
      .upsert({
        prospeccao_id: prospeccaoId,
        empresa_id: activeCompany.id,
        inicio_frase: paginaInicioFrase || null,
        palavra_destaque: paginaPalavraDestaque || null,
        final_frase: paginaFinalFrase || null,
        texto_apoio: paginaTextoApoio || null,
        primeiro_dia_evento: paginaPrimeiroDia || null,
        dia_final_evento: paginaDiaFinal || null,
        hora_inicio: paginaHoraInicio || null,
        hora_termino: paginaHoraTermino || null,
        link_politica_privacidade: paginaLinkPolitica || null,
        cor_fundo: paginaCorFundo,
        cor_texto: paginaCorTexto,
        cor_destaque: paginaCorDestaque,
        imagem_evento_url: imagemUrl
      }, { onConflict: 'prospeccao_id' });
    
    if (error) {
      console.error('Erro ao salvar página:', error);
    }
  };
  
  // Salvar marketing assets
  const saveMarketingAssets = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    // Deletar assets existentes para esta prospecção
    await supabase
      .from('prospeccao_marketing')
      .delete()
      .eq('prospeccao_id', prospeccaoId)
      .eq('empresa_id', activeCompany.id);
    
    // Inserir novos assets
    for (const asset of marketingAssets) {
      let imagemUrl = asset.imagem_url;
      
      // Se tem arquivo novo, faz upload
      if (asset.file) {
        const fileExt = asset.file.name.split('.').pop();
        const fileName = `marketing-${prospeccaoId}-${asset.tipo_formato}-${Date.now()}.${fileExt}`;
        const filePath = `${activeCompany.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('convites-prospeccao')
          .upload(filePath, asset.file, { upsert: true });
        
        if (uploadError) {
          console.error('Erro ao fazer upload do asset:', uploadError);
          continue;
        }
        
        const { data: publicUrlData } = supabase.storage
          .from('convites-prospeccao')
          .getPublicUrl(filePath);
        
        imagemUrl = publicUrlData.publicUrl;
      }
      
      if (imagemUrl) {
        const { error } = await supabase
          .from('prospeccao_marketing')
          .insert({
            prospeccao_id: prospeccaoId,
            empresa_id: activeCompany.id,
            tipo_formato: asset.tipo_formato,
            plataforma: asset.plataforma,
            largura: asset.largura,
            altura: asset.altura,
            imagem_url: imagemUrl,
            nome_arquivo: asset.nome_arquivo,
            tamanho_arquivo: asset.tamanho_arquivo,
          });
        
        if (error) {
          console.error('Erro ao salvar asset de marketing:', error);
        }
      }
    }
  };
  
  // Salvar outras premiações
  const saveOutrasPremiacoes = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    // Deletar premiações existentes para esta prospecção
    await supabase
      .from('prospeccao_outras_premiacoes')
      .delete()
      .eq('prospeccao_id', prospeccaoId)
      .eq('empresa_id', activeCompany.id);
    
    // Inserir novas premiações
    for (const premiacao of outrasPremiacoes) {
      const { error } = await supabase
        .from('prospeccao_outras_premiacoes')
        .insert({
          prospeccao_id: prospeccaoId,
          empresa_id: activeCompany.id,
          nome: premiacao.nome,
          valor: Number(premiacao.valor) || 0,
          ativo: premiacao.ativo,
        });
      
      if (error) {
        console.error('Erro ao salvar outra premiação:', error);
      }
    }
  };
  
  // Filtrar usuários
  const filteredUsers = usersComAcesso.filter(user => {
    const searchLower = metasIndividuaisFilter.toLowerCase();
    return user.nome_completo.toLowerCase().includes(searchLower) ||
           (user.tipo_acesso?.toLowerCase().includes(searchLower) ?? false);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titulo.trim()) {
      toast({
        title: "Erro",
        description: "O título é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const dadosProspeccao: any = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        canal: canal,
        imagem_divulgacao_url: imagemDivulgacao.trim() || null,
        meta_novos: metaNovos === "" ? null : metaNovos,
        meta_seminovos: metaSeminovos === "" ? null : metaSeminovos,
        meta_diretas: metaDiretas === "" ? null : metaDiretas,
        meta_checkins: metaCheckins === "" ? null : metaCheckins,
        meta_confirmacoes: metaConfirmacoes === "" ? null : metaConfirmacoes,
        meta_convites: metaConvites === "" ? null : metaConvites,
        // Premiações
        premio_equipe_campea: premiacoes.equipe_campea.ativo && premiacoes.equipe_campea.valor !== "" ? Number(premiacoes.equipe_campea.valor) : null,
        premio_equipe_2lugar: premiacoes.equipe_2lugar.ativo && premiacoes.equipe_2lugar.valor !== "" ? Number(premiacoes.equipe_2lugar.valor) : null,
        premio_equipe_3lugar: premiacoes.equipe_3lugar.ativo && premiacoes.equipe_3lugar.valor !== "" ? Number(premiacoes.equipe_3lugar.valor) : null,
        premio_vendedor_ouro: premiacoes.vendedor_ouro.ativo && premiacoes.vendedor_ouro.valor !== "" ? Number(premiacoes.vendedor_ouro.valor) : null,
        premio_vendedor_prata: premiacoes.vendedor_prata.ativo && premiacoes.vendedor_prata.valor !== "" ? Number(premiacoes.vendedor_prata.valor) : null,
        premio_vendedor_bronze: premiacoes.vendedor_bronze.ativo && premiacoes.vendedor_bronze.valor !== "" ? Number(premiacoes.vendedor_bronze.valor) : null,
        premio_prospector_ouro: premiacoes.prospector_ouro.ativo && premiacoes.prospector_ouro.valor !== "" ? Number(premiacoes.prospector_ouro.valor) : null,
        premio_prospector_prata: premiacoes.prospector_prata.ativo && premiacoes.prospector_prata.valor !== "" ? Number(premiacoes.prospector_prata.valor) : null,
        premio_prospector_bronze: premiacoes.prospector_bronze.ativo && premiacoes.prospector_bronze.valor !== "" ? Number(premiacoes.prospector_bronze.valor) : null,
        premio_checkin_ouro: premiacoes.checkin_ouro.ativo && premiacoes.checkin_ouro.valor !== "" ? Number(premiacoes.checkin_ouro.valor) : null,
        premio_checkin_prata: premiacoes.checkin_prata.ativo && premiacoes.checkin_prata.valor !== "" ? Number(premiacoes.checkin_prata.valor) : null,
        premio_checkin_bronze: premiacoes.checkin_bronze.ativo && premiacoes.checkin_bronze.valor !== "" ? Number(premiacoes.checkin_bronze.valor) : null,
        premio_participacao_apoio: premiacoes.participacao_apoio.ativo && premiacoes.participacao_apoio.valor !== "" ? Number(premiacoes.participacao_apoio.valor) : null,
        premio_indicacao_venda: premiacoes.indicacao_venda.ativo && premiacoes.indicacao_venda.valor !== "" ? Number(premiacoes.indicacao_venda.valor) : null,
      };

      // Adicionar campos específicos do canal
      if (canal === 'Whatsapp') {
        dadosProspeccao.template_prospeccao = templateProspeccao.trim() || null;
        dadosProspeccao.template_agendado = templateAgendado.trim() || null;
        dadosProspeccao.template_nao_agendado = templateNaoAgendado.trim() || null;
        dadosProspeccao.convite = null;
      } else {
        dadosProspeccao.template_prospeccao = null;
        dadosProspeccao.template_agendado = null;
        dadosProspeccao.template_nao_agendado = null;
        dadosProspeccao.convite = convite.trim() || null;
      }

      if (editingProspeccao) {
        // Editando prospecção existente
        const { data, error } = await supabase
          .from('prospeccoes')
          .update(dadosProspeccao)
          .eq('id', editingProspeccao.id)
          .select()
          .single();

        if (error) {
          console.error('Erro do Supabase:', error);
          throw error;
        }

        // Chamar webhook após atualização
        await callWebhook(data);
        
        // Salvar metas individuais
        await saveMetasIndividuais(data.id);
        
        // Salvar equipes
        await saveEquipes(data.id);
        
        // Salvar convite
        await saveConvite(data.id);
        
        // Salvar página de captura
        await savePagina(data.id);
        
        // Salvar marketing assets
        await saveMarketingAssets(data.id);
        
        // Salvar outras premiações
        await saveOutrasPremiacoes(data.id);

        toast({
          title: "Sucesso",
          description: "Prospecção atualizada com sucesso!"
        });
      } else {
        // Criando nova prospecção
        if (!activeCompany?.id) {
          toast({
            title: "Erro de configuração",
            description: "Nenhuma empresa ativa selecionada. Selecione uma empresa.",
            variant: "destructive"
          });
          return;
        }

        const { data, error } = await supabase
          .from('prospeccoes')
          .insert([{
            ...dadosProspeccao,
            responsavel_id: user.id,
            empresa_id: activeCompany.id,
            leads_gerados: 0
          }])
          .select()
          .single();

        if (error) {
          console.error('Erro do Supabase:', error);
          throw error;
        }

        // Chamar webhook após criação
        await callWebhook(data);
        
        // Salvar metas individuais
        await saveMetasIndividuais(data.id);
        
        // Salvar equipes
        await saveEquipes(data.id);
        
        // Salvar convite
        await saveConvite(data.id);
        
        // Salvar página de captura
        await savePagina(data.id);
        
        // Salvar marketing assets
        await saveMarketingAssets(data.id);
        
        // Salvar outras premiações
        await saveOutrasPremiacoes(data.id);

        toast({
          title: "Sucesso",
          description: "Prospecção criada com sucesso!"
        });
      }

      // Limpar form e fechar modal
      clearForm();
      onOpenChange(false);
      onProspeccaoCriada();

    } catch (error: any) {
      console.error('Erro ao processar prospecção:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar prospecção",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const callWebhook = async (prospeccaoData: any) => {
    try {
      // Buscar dados da empresa para pegar o crm_id e telefone da Pri
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('crm_id')
        .eq('id', activeCompany?.id)
        .single();

      // Buscar telefone do agente IA (Pri) da empresa
      const { data: agenteData } = await supabase
        .from('agentes_ia')
        .select('telefone')
        .eq('empresa_id', activeCompany?.id)
        .eq('nome', 'Pri')
        .single();

      // Formatar telefone: remover +55 e o 9 adicional, deixar apenas DD + número
      const formatarTelefone = (telefone: string) => {
        if (!telefone) return "";
        // Remove todos os caracteres não numéricos
        const numeros = telefone.replace(/\D/g, '');
        // Remove o código do país (55) se existir
        let telefoneFormatado = numeros.startsWith('55') ? numeros.substring(2) : numeros;
        // Se tiver 11 dígitos (DD + 9 + 8 dígitos), remove o 9
        if (telefoneFormatado.length === 11) {
          telefoneFormatado = telefoneFormatado.substring(0, 2) + telefoneFormatado.substring(3);
        }
        return telefoneFormatado;
      };

      // Formatar data para ISO 8601
      const formatarDataISO = (data: string) => {
        if (!data) return "";
        // Converte YYYY-MM-DD para ISO 8601
        return new Date(data + 'T11:00:00.000Z').toISOString();
      };

      const webhookPayload = {
        maia_id: formatarTelefone(agenteData?.telefone || ""),
        nome_evento: prospeccaoData.titulo || "",
        data_inicio: formatarDataISO(prospeccaoData.data_inicio || ""),
        data_fim: formatarDataISO(prospeccaoData.data_fim || ""),
        descricao: prospeccaoData.descricao || "",
        dealerid: empresaData?.crm_id || "",
        template_descoberta: prospeccaoData.template_prospeccao || "",
        template_conf_agendado: prospeccaoData.template_agendado || "",
        template_conf_nao_agendado: prospeccaoData.template_nao_agendado || ""
      };

      console.log('📤 Enviando webhook:', webhookPayload);

      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/pri-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        console.error('Erro na resposta do webhook:', response.status);
      } else {
        console.log('✅ Webhook enviado com sucesso');
      }
    } catch (error) {
      console.error('Erro ao enviar webhook:', error);
      // Não mostramos erro ao usuário para não interromper o fluxo
    }
  };

  const aplicarModeloDescricao = () => {
    const modeloDescricao = `🔥 Noite RAM na Saga BR-153!
Potência, exclusividade e oportunidades imperdíveis. 🚗💨

Chegou o momento que todo apaixonado por RAM esperava!
A Saga RAM BR-153 convida você para uma noite exclusiva de vendas, com atendimento VIP e condições únicas válidas apenas neste evento especial.

🌙 Evento noturno exclusivo
🛞 Chassis selecionados com preços imperdíveis
🤝 Atendimento personalizado com o gerente
🚗 Oportunidades disponíveis só no dia

🗓️ 28 de outubro, a partir das 18h
📍 Saga RAM BR-153

Viva uma experiência premium, com atendimento prioritário e condições feitas sob medida para quem valoriza potência e sofisticação.
Garanta sua presença e não perca essa oportunidade única de sair de RAM nova!

A PRI deve apenas convidar, confirmar interesse, e confirmar o endereço da loja.
Ela não deve falar sobre valores, taxas, entrada, financiamento, simulações ou detalhes técnicos de veículos.`;
    
    setDescricao(modeloDescricao);
    toast({
      title: "Modelo aplicado",
      description: "Descrição padrão foi inserida no campo"
    });
  };

  const handleCancel = () => {
    clearForm();
    onOpenChange(false);
  };

  // Calcular meta total de vendas
  const metaTotalVendas = (Number(metaNovos) || 0) + (Number(metaSeminovos) || 0) + (Number(metaDiretas) || 0);

  // Calcular metas automaticamente com base nas vendas
  // Check-in: 30% dos comparecimentos são convertidos em vendas → check-in = vendas / 0.30
  // Confirmações: 30% dos confirmados comparecem → confirmações = check-in / 0.30
  // Agendamentos: 33% dos agendados confirmam → agendamentos = confirmações / 0.33
  const calcularMetasFunil = (totalVendas: number) => {
    if (totalVendas <= 0) return { checkins: 0, confirmacoes: 0, convites: 0 };
    
    const checkins = Math.ceil(totalVendas / 0.30);
    const confirmacoes = Math.ceil(checkins / 0.30);
    const convites = Math.ceil(confirmacoes / 0.33);
    
    return { checkins, confirmacoes, convites };
  };

  // Handler para alteração de metas de vendas - recalcula as metas de funil
  const handleMetaVendaChange = (
    setter: React.Dispatch<React.SetStateAction<number | "">>,
    value: string,
    otherMetas: { novos?: number | ""; seminovos?: number | ""; diretas?: number | "" }
  ) => {
    const numValue = value === "" ? "" : Number(value);
    setter(numValue);
    
    // Calcular total considerando o novo valor
    const novoTotal = 
      (otherMetas.novos !== undefined ? (Number(otherMetas.novos) || 0) : (Number(metaNovos) || 0)) +
      (otherMetas.seminovos !== undefined ? (Number(otherMetas.seminovos) || 0) : (Number(metaSeminovos) || 0)) +
      (otherMetas.diretas !== undefined ? (Number(otherMetas.diretas) || 0) : (Number(metaDiretas) || 0));
    
    if (novoTotal > 0) {
      const calculado = calcularMetasFunil(novoTotal);
      setMetaCheckins(calculado.checkins);
      setMetaConfirmacoes(calculado.confirmacoes);
      setMetaConvites(calculado.convites);
    }
  };

  // Tooltip configs para cada meta
  const tooltipConfigs = {
    novos: {
      title: "Meta de Novos",
      description: "Quantidade de veículos novos que você espera vender durante a prospecção.",
      exemplo: "Ex: Para um evento de 2 dias, meta de 4-6 novos é comum."
    },
    seminovos: {
      title: "Meta de Seminovos",
      description: "Quantidade de veículos seminovos/usados que você espera vender durante a prospecção.",
      exemplo: "Ex: Para um evento de 2 dias, meta de 6-10 seminovos é comum."
    },
    diretas: {
      title: "Meta de Vendas Diretas",
      description: "Quantidade de vendas diretas (frotistas, PJ, vendas corporativas) esperadas.",
      exemplo: "Ex: Para eventos B2B, meta de 2-4 diretas é comum."
    },
    checkins: {
      title: "Meta de Check-ins",
      description: "Quantidade de clientes que devem comparecer ao evento. Em média, 30% dos check-ins resultam em vendas.",
      exemplo: "Ex: Para vender 10 carros, você precisa de ~34 check-ins."
    },
    confirmacoes: {
      title: "Meta de Confirmações",
      description: "Quantidade de clientes que devem confirmar presença. Em média, 30% dos confirmados comparecem.",
      exemplo: "Ex: Para ter 34 check-ins, você precisa de ~112 confirmações."
    },
    convites: {
      title: "Meta de Convites/Agendamentos",
      description: "Quantidade de clientes que devem ser convidados/agendados. Em média, 33% dos convidados confirmam.",
      exemplo: "Ex: Para ter 112 confirmações, você precisa de ~340 convites."
    }
  };

  const MetaTooltip = ({ config }: { config: typeof tooltipConfigs.novos }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px] p-3">
          <p className="font-medium text-sm mb-1">{config.title}</p>
          <p className="text-xs text-muted-foreground mb-2">{config.description}</p>
          <p className="text-xs text-primary font-medium">{config.exemplo}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // Config das premiações
  const premiacaoConfigs = {
    // Equipes
    equipe_campea: { nome: "Equipe Campeã", tooltip: "Premiação para a Equipe com mais vendas. Prêmio válido por Nº de vendas e desempate pelo VGV." },
    equipe_2lugar: { nome: "Equipe 2º Lugar", tooltip: "Premiação para a Equipe com a segunda maior quantidade de vendas." },
    equipe_3lugar: { nome: "Equipe 3º Lugar", tooltip: "Premiação para a Equipe com a terceira maior quantidade de vendas." },
    // Vendedores
    vendedor_ouro: { nome: "Vendedor Ouro", tooltip: "Premiação para o melhor vendedor do evento, considerando o número de vendas e desempate pelo VGV." },
    vendedor_prata: { nome: "Vendedor Prata", tooltip: "Premiação para o segundo melhor vendedor do evento." },
    vendedor_bronze: { nome: "Vendedor Bronze", tooltip: "Premiação para o terceiro melhor vendedor do evento." },
    // Prospectors
    prospector_ouro: { nome: "Prospector Ouro", tooltip: "Premiação destinada ao vendedor que mais prospectar clientes com presença registrada no evento." },
    prospector_prata: { nome: "Prospector Prata", tooltip: "Premiação destinada ao vendedor que possuir o segundo maior número de prospecções com presença registrada no evento." },
    prospector_bronze: { nome: "Prospector Bronze", tooltip: "Premiação destinada ao vendedor que possuir o terceiro maior número de prospecções com presença registrada no evento." },
    // Check-ins
    checkin_ouro: { nome: "Check-ins Ouro", tooltip: "Premiação destinada à pessoa que mais possuir registro de comparecimento no dia do evento (exceto vendedor)." },
    checkin_prata: { nome: "Check-ins Prata", tooltip: "Premiação destinada à pessoa que possuir o segundo maior registro de comparecimento no dia do evento (exceto vendedor)." },
    checkin_bronze: { nome: "Check-ins Bronze", tooltip: "Premiação destinada à pessoa que possuir o terceiro maior registro de comparecimento no dia do evento (exceto vendedor)." },
    // Participação
    participacao_apoio: { nome: "Participação Equipe de Apoio", tooltip: "Premiação destinada à cada membro da equipe de apoio." },
    indicacao_venda: { nome: "Indicação de Venda", tooltip: "Premiação destinada à cada indicação de venda." },
  };

  // Calcular total de premiações ativas (inclui outras premiações)
  const totalPremiacoes = Object.values(premiacoes).reduce((acc, p) => {
    if (p.ativo && p.valor !== "") {
      return acc + Number(p.valor);
    }
    return acc;
  }, 0) + outrasPremiacoes.reduce((acc, p) => {
    if (p.ativo && p.valor !== "") {
      return acc + Number(p.valor);
    }
    return acc;
  }, 0);

  const handlePremiacaoToggle = (key: string, checked: boolean) => {
    setPremiacoes(prev => ({
      ...prev,
      [key]: { ...prev[key], ativo: checked, valor: checked ? prev[key].valor : "" }
    }));
  };

  const handlePremiacaoValorChange = (key: string, valor: string) => {
    // Remove tudo que não é número
    const numericValue = valor.replace(/\D/g, '');
    const numberValue = numericValue === "" ? "" : Number(numericValue) / 100;
    
    setPremiacoes(prev => ({
      ...prev,
      [key]: { ...prev[key], valor: numberValue }
    }));
  };

  // Formatar valor como moeda brasileira
  const formatCurrency = (value: number | "") => {
    if (value === "" || value === 0) return "";
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Config das premiações inline para evitar re-render
  const renderPremiacaoField = (premioKey: string, IconComponent: React.ElementType) => {
    const config = premiacaoConfigs[premioKey as keyof typeof premiacaoConfigs];
    const premiacao = premiacoes[premioKey];
    
    return (
      <div key={premioKey} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${premiacao.ativo ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-300'}`}>
        <Switch
          checked={premiacao.ativo}
          onCheckedChange={(checked) => handlePremiacaoToggle(premioKey, checked)}
          className={premiacao.ativo ? 'data-[state=checked]:bg-green-500' : 'data-[state=unchecked]:bg-gray-400'}
        />
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <IconComponent className={`h-4 w-4 flex-shrink-0 ${premiacao.ativo ? 'text-green-600' : 'text-gray-500'}`} />
          <span className={`text-sm truncate ${premiacao.ativo ? 'font-medium text-green-700' : 'text-gray-600'}`}>{config.nome}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px] p-3">
                <p className="text-xs">{config.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="w-32 flex-shrink-0 relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            disabled={!premiacao.ativo}
            value={formatCurrency(premiacao.valor)}
            onChange={(e) => handlePremiacaoValorChange(premioKey, e.target.value)}
            className="text-right text-sm h-8 pl-7"
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
            {/* Header fixo */}
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b bg-background">
              <DialogHeader>
                <DialogTitle>
                  {editingProspeccao ? 'Editar Prospecção' : 'Nova Prospecção'}
                </DialogTitle>
              </DialogHeader>
              
              <TabsList className="grid w-full grid-cols-8 mt-4">
                <TabsTrigger value="dados-gerais" className="text-xs px-1">Dados Gerais</TabsTrigger>
                <TabsTrigger value="meta" className="text-xs px-1">Metas</TabsTrigger>
                <TabsTrigger value="metas-individuais" className="text-xs px-1">Metas Ind.</TabsTrigger>
                <TabsTrigger value="equipes" className="text-xs px-1">Equipes</TabsTrigger>
                <TabsTrigger value="premiacoes" className="text-xs px-1">Premiações</TabsTrigger>
                <TabsTrigger value="convite" className="text-xs px-1">Convite</TabsTrigger>
                <TabsTrigger value="paginas" className="text-xs px-1">Páginas</TabsTrigger>
                <TabsTrigger value="marketing" className="text-xs px-1">Marketing</TabsTrigger>
              </TabsList>
            </div>
            
            {/* Conteúdo com scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="dados-gerais" className="space-y-4 mt-0">
                <div>
                  <Label htmlFor="titulo">Título *</Label>
                  <Input
                    id="titulo"
                    placeholder="Ex: Campanha Black Friday 2024"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    className="h-auto py-1 px-2 text-xs"
                    onClick={aplicarModeloDescricao}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Aplicar modelo
                  </Button>
                </div>
                <Textarea
                  id="descricao"
                  placeholder="Descrição da campanha..."
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="data_inicio">Data de Início</Label>
                  <Input
                    id="data_inicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="data_fim">Data de Fim</Label>
                  <Input
                    id="data_fim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="canal">Canal *</Label>
                <Select value={canal} onValueChange={(value: 'Whatsapp' | 'Ligação') => setCanal(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Whatsapp">Whatsapp</SelectItem>
                    <SelectItem value="Ligação">Ligação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {canal === 'Whatsapp' && (
                <>
                  <div>
                    <Label htmlFor="template_prospeccao">Template Prospecção</Label>
                    <Textarea
                      id="template_prospeccao"
                      placeholder="Mensagem de prospecção (máx. 120 caracteres)"
                      rows={2}
                      maxLength={120}
                      value={templateProspeccao}
                      onChange={(e) => setTemplateProspeccao(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {templateProspeccao.length}/120 caracteres
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="template_agendado">Template Agendado</Label>
                    <Textarea
                      id="template_agendado"
                      placeholder="Mensagem para agendamentos (máx. 120 caracteres)"
                      rows={2}
                      maxLength={120}
                      value={templateAgendado}
                      onChange={(e) => setTemplateAgendado(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {templateAgendado.length}/120 caracteres
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="template_nao_agendado">Template Não Agendado</Label>
                    <Textarea
                      id="template_nao_agendado"
                      placeholder="Mensagem para não agendamentos (máx. 120 caracteres)"
                      rows={2}
                      maxLength={120}
                      value={templateNaoAgendado}
                      onChange={(e) => setTemplateNaoAgendado(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {templateNaoAgendado.length}/120 caracteres
                    </p>
                  </div>
                </>
              )}

              {canal === 'Ligação' && (
                <div>
                  <Label htmlFor="convite">Convite</Label>
                  <Input
                    id="convite"
                    placeholder="Nome do convite para campanhas de ligação"
                    value={convite}
                    onChange={(e) => setConvite(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="imagem_divulgacao">Imagem de Divulgação (Opcional)</Label>
                <Input
                  id="imagem_divulgacao"
                  type="url"
                  placeholder="https://exemplo.com/imagem.jpg"
                  value={imagemDivulgacao}
                  onChange={(e) => setImagemDivulgacao(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="meta" className="space-y-4 mt-0">
              {/* Meta Total de Vendas */}
              <Card className="p-4 bg-gradient-to-r from-primary/80 to-primary text-primary-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4" />
                  <span className="text-sm font-medium">Meta Total de Vendas</span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold">{metaTotalVendas}</span>
                  <p className="text-xs opacity-80 mt-1">Soma das metas de Novos, Seminovos e Diretas</p>
                </div>
              </Card>

              {/* Grid de Metas de Vendas */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs font-medium text-muted-foreground">Meta de Novos</span>
                    <MetaTooltip config={tooltipConfigs.novos} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaNovos}
                    onChange={(e) => handleMetaVendaChange(setMetaNovos, e.target.value, { 
                      novos: e.target.value === "" ? 0 : Number(e.target.value)
                    })}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Novos</p>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-medium text-muted-foreground">Meta de Seminovos</span>
                    <MetaTooltip config={tooltipConfigs.seminovos} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaSeminovos}
                    onChange={(e) => handleMetaVendaChange(setMetaSeminovos, e.target.value, { 
                      seminovos: e.target.value === "" ? 0 : Number(e.target.value)
                    })}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Seminovos</p>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-xs font-medium text-muted-foreground">Meta de Diretas</span>
                    <MetaTooltip config={tooltipConfigs.diretas} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaDiretas}
                    onChange={(e) => handleMetaVendaChange(setMetaDiretas, e.target.value, { 
                      diretas: e.target.value === "" ? 0 : Number(e.target.value)
                    })}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Diretas</p>
                </Card>
              </div>

              {/* Grid de Metas de Funil */}
              <p className="text-xs text-muted-foreground text-center">
                Calculado automaticamente com base nas metas de vendas. Você pode editar manualmente.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="h-3 w-3 text-orange-500" />
                    <span className="text-xs font-medium text-muted-foreground">Check-ins</span>
                    <MetaTooltip config={tooltipConfigs.checkins} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaCheckins}
                    onChange={(e) => setMetaCheckins(e.target.value === "" ? "" : Number(e.target.value))}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Check-ins</p>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ThumbsUp className="h-3 w-3 text-blue-500" />
                    <span className="text-xs font-medium text-muted-foreground">Confirmações</span>
                    <MetaTooltip config={tooltipConfigs.confirmacoes} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaConfirmacoes}
                    onChange={(e) => setMetaConfirmacoes(e.target.value === "" ? "" : Number(e.target.value))}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Confirmados</p>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Phone className="h-3 w-3 text-green-500" />
                    <span className="text-xs font-medium text-muted-foreground">Convites</span>
                    <MetaTooltip config={tooltipConfigs.convites} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaConvites}
                    onChange={(e) => setMetaConvites(e.target.value === "" ? "" : Number(e.target.value))}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Convites</p>
                </Card>
              </div>

              {/* Tamanho da Base */}
              <Card className="p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Tamanho da Base</span>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold text-primary">{tamanhoBase.toLocaleString('pt-BR')}</span>
                  <p className="text-xs text-muted-foreground mt-1">Contatos Distribuídos</p>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Valor calculado com base nos contatos importados
                </p>
              </Card>
            </TabsContent>

            {/* Aba Metas Individuais */}
            <TabsContent value="metas-individuais" className="space-y-4 mt-0">
              <Card className="p-4 bg-gradient-to-r from-blue-500/80 to-blue-600 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">Metas Individuais por Usuário</span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold">{usersComAcesso.length}</span>
                  <p className="text-xs opacity-80 mt-1">Usuários com acesso ativo à empresa</p>
                </div>
              </Card>
              
              {/* Filtro */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filtrar por nome ou perfil..."
                  value={metasIndividuaisFilter}
                  onChange={(e) => setMetasIndividuaisFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Lista de usuários */}
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-3 opacity-50" />
                  <p>Nenhum usuário encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((userItem) => {
                    const userMetas = metasIndividuais[userItem.id] || { meta_vendas: 0, meta_checkins: 0, meta_confirmacoes: 0, meta_convites: 0 };
                    
                    return (
                      <Card key={userItem.id} className="p-3">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                              {userItem.nome_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{userItem.nome_completo}</p>
                              <p className="text-xs text-muted-foreground">{userItem.tipo_acesso || 'Sem perfil'}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Vendas</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={userMetas.meta_vendas || ""}
                                onChange={(e) => handleMetaIndividualChange(userItem.id, 'meta_vendas', e.target.value)}
                                className="h-8 text-center text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Check-ins</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={userMetas.meta_checkins || ""}
                                onChange={(e) => handleMetaIndividualChange(userItem.id, 'meta_checkins', e.target.value)}
                                className="h-8 text-center text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Confirmações</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={userMetas.meta_confirmacoes || ""}
                                onChange={(e) => handleMetaIndividualChange(userItem.id, 'meta_confirmacoes', e.target.value)}
                                className="h-8 text-center text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Convites</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={userMetas.meta_convites || ""}
                                onChange={(e) => handleMetaIndividualChange(userItem.id, 'meta_convites', e.target.value)}
                                className="h-8 text-center text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground text-center">
                Defina metas individuais para cada usuário participante da prospecção.
              </p>
            </TabsContent>

            {/* Aba Equipes */}
            <TabsContent value="equipes" className="space-y-4 mt-0">
              <Card className="p-4 bg-gradient-to-r from-violet-500/80 to-violet-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <UsersRound className="h-4 w-4" />
                      <span className="text-sm font-medium">Gestão de Equipes</span>
                    </div>
                    <p className="text-xs opacity-80">{equipes.filter(e => e.ativo).length} equipes ativas</p>
                  </div>
                  {!criarNovaEquipe && equipeEditando === null && (
                    <Button 
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white border-0"
                      onClick={() => {
                        setCriarNovaEquipe(true);
                        setNovaEquipeNome("");
                        setNovaEquipeCor(coresPadrao[equipes.length % coresPadrao.length]);
                        setNovaEquipeMembros([]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Nova Equipe
                    </Button>
                  )}
                </div>
              </Card>
              
              {/* Formulário Nova Equipe */}
              {criarNovaEquipe && (
                <Card className="p-4 border-2 border-primary/30">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Nova Equipe</span>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm"
                        onClick={() => setCriarNovaEquipe(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nome da Equipe</Label>
                        <Input
                          placeholder="Ex: Equipe Alpha"
                          value={novaEquipeNome}
                          onChange={(e) => setNovaEquipeNome(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cor da Equipe</Label>
                        <div className="flex gap-1 mt-1">
                          {coresPadrao.map((cor) => (
                            <button
                              key={cor}
                              type="button"
                              className={`w-7 h-7 rounded-full border-2 transition-all ${novaEquipeCor === cor ? 'border-primary scale-110' : 'border-transparent hover:border-muted-foreground/30'}`}
                              style={{ backgroundColor: cor }}
                              onClick={() => setNovaEquipeCor(cor)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Integrantes</Label>
                      <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                        {usersComAcesso.map((userItem) => (
                          <label 
                            key={userItem.id}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={novaEquipeMembros.includes(userItem.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNovaEquipeMembros([...novaEquipeMembros, userItem.id]);
                                } else {
                                  setNovaEquipeMembros(novaEquipeMembros.filter(id => id !== userItem.id));
                                }
                              }}
                              className="rounded border-primary"
                            />
                            <span className="text-sm">{userItem.nome_completo}</span>
                            <span className="text-xs text-muted-foreground">({userItem.tipo_acesso})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCriarNovaEquipe(false)}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        type="button"
                        size="sm"
                        disabled={!novaEquipeNome.trim()}
                        onClick={() => {
                          setEquipes([...equipes, {
                            nome: novaEquipeNome.trim(),
                            cor: novaEquipeCor,
                            ativo: true,
                            membros: novaEquipeMembros
                          }]);
                          setCriarNovaEquipe(false);
                          setNovaEquipeNome("");
                          setNovaEquipeMembros([]);
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Adicionar Equipe
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
              
              {/* Lista de Equipes */}
              {equipes.length === 0 && !criarNovaEquipe ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UsersRound className="mx-auto h-12 w-12 mb-3 opacity-50" />
                  <p>Nenhuma equipe criada</p>
                  <p className="text-xs">Clique no botão acima para criar sua primeira equipe</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {equipes.map((equipe, index) => (
                    <Card 
                      key={index}
                      className={`p-3 border-l-4 ${!equipe.ativo ? 'opacity-60' : ''}`}
                      style={{ borderLeftColor: equipe.cor }}
                    >
                      {equipeEditando === index ? (
                        // Modo edição
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Nome da Equipe</Label>
                              <Input
                                value={equipe.nome}
                                onChange={(e) => {
                                  const updated = [...equipes];
                                  updated[index].nome = e.target.value;
                                  setEquipes(updated);
                                }}
                                className="h-9"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Cor</Label>
                              <div className="flex gap-1 mt-1">
                                {coresPadrao.map((cor) => (
                                  <button
                                    key={cor}
                                    type="button"
                                    className={`w-6 h-6 rounded-full border-2 transition-all ${equipe.cor === cor ? 'border-primary scale-110' : 'border-transparent hover:border-muted-foreground/30'}`}
                                    style={{ backgroundColor: cor }}
                                    onClick={() => {
                                      const updated = [...equipes];
                                      updated[index].cor = cor;
                                      setEquipes(updated);
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-xs">Integrantes</Label>
                            <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                              {usersComAcesso.map((userItem) => (
                                <label 
                                  key={userItem.id}
                                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={equipe.membros.includes(userItem.id)}
                                    onChange={(e) => {
                                      const updated = [...equipes];
                                      if (e.target.checked) {
                                        updated[index].membros = [...updated[index].membros, userItem.id];
                                      } else {
                                        updated[index].membros = updated[index].membros.filter(id => id !== userItem.id);
                                      }
                                      setEquipes(updated);
                                    }}
                                    className="rounded border-primary"
                                  />
                                  <span className="text-sm">{userItem.nome_completo}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex justify-end">
                            <Button 
                              type="button"
                              size="sm"
                              onClick={() => setEquipeEditando(null)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Concluir
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Modo visualização
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: equipe.cor }}
                            />
                            <div>
                              <p className="font-medium text-sm">{equipe.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {equipe.membros.length} integrante{equipe.membros.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={equipe.ativo}
                              onCheckedChange={(checked) => {
                                const updated = [...equipes];
                                updated[index].ativo = checked;
                                setEquipes(updated);
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setEquipeEditando(index)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:text-destructive"
                              onClick={() => {
                                setEquipes(equipes.filter((_, i) => i !== index));
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Aba Premiações */}
            <TabsContent value="premiacoes" className="space-y-4 mt-0">
              {/* Total em Premiações */}
              <Card className="p-4 bg-gradient-to-r from-amber-500/80 to-amber-600 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-4 w-4" />
                  <span className="text-sm font-medium">Total em Premiações</span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold">
                    {totalPremiacoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <p className="text-xs opacity-80 mt-1">Soma de todas as premiações ativas</p>
                </div>
              </Card>

              {/* Premiações para Equipes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Premiações para Equipes</span>
                </div>
                <div className="space-y-2">
                  {renderPremiacaoField("equipe_campea", Trophy)}
                  {renderPremiacaoField("equipe_2lugar", Award)}
                  {renderPremiacaoField("equipe_3lugar", Award)}
                </div>
              </div>

              {/* Premiações para Vendedores */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Premiações para Vendedores</span>
                </div>
                <div className="space-y-2">
                  {renderPremiacaoField("vendedor_ouro", Trophy)}
                  {renderPremiacaoField("vendedor_prata", Award)}
                  {renderPremiacaoField("vendedor_bronze", Award)}
                </div>
              </div>

              {/* Premiação para Vendedor Prospector */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Premiação para Vendedor Prospector</span>
                </div>
                <div className="space-y-2">
                  {renderPremiacaoField("prospector_ouro", Trophy)}
                  {renderPremiacaoField("prospector_prata", Award)}
                  {renderPremiacaoField("prospector_bronze", Award)}
                </div>
              </div>

              {/* Premiações para Equipe de Apoio */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Premiações para Equipe de Apoio</span>
                </div>
                <div className="space-y-2">
                  {renderPremiacaoField("checkin_ouro", Trophy)}
                  {renderPremiacaoField("checkin_prata", Award)}
                  {renderPremiacaoField("checkin_bronze", Award)}
                </div>
              </div>

              {/* Premiações por Participação ou Indicação */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Premiações por Participação ou Indicação</span>
                </div>
                <div className="space-y-2">
                  {renderPremiacaoField("participacao_apoio", Gift)}
                  {renderPremiacaoField("indicacao_venda", Gift)}
                </div>
              </div>

              {/* Outras Premiações (personalizadas) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Outras Premiações</span>
                  </div>
                  {!mostrarFormOutraPremiacao && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMostrarFormOutraPremiacao(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar
                    </Button>
                  )}
                </div>
                
                {/* Formulário para adicionar nova premiação */}
                {mostrarFormOutraPremiacao && (
                  <Card className="p-3 border-dashed">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Nome da Premiação</Label>
                          <Input
                            value={novaOutraPremiacao.nome}
                            onChange={(e) => setNovaOutraPremiacao(prev => ({ ...prev, nome: e.target.value }))}
                            placeholder="Ex: Bônus especial"
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Valor (R$)</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="0,00"
                              value={formatCurrency(novaOutraPremiacao.valor)}
                              onChange={(e) => {
                                const numericValue = e.target.value.replace(/\D/g, '');
                                const numberValue = numericValue === "" ? "" : Number(numericValue) / 100;
                                setNovaOutraPremiacao(prev => ({ ...prev, valor: numberValue }));
                              }}
                              className="text-right text-sm h-9 pl-7"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMostrarFormOutraPremiacao(false);
                            setNovaOutraPremiacao({ nome: "", valor: "" });
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!novaOutraPremiacao.nome.trim() || novaOutraPremiacao.valor === "" || novaOutraPremiacao.valor === 0}
                          onClick={() => {
                            setOutrasPremiacoes([...outrasPremiacoes, {
                              nome: novaOutraPremiacao.nome.trim(),
                              valor: novaOutraPremiacao.valor,
                              ativo: true
                            }]);
                            setNovaOutraPremiacao({ nome: "", valor: "" });
                            setMostrarFormOutraPremiacao(false);
                          }}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
                
                {/* Lista de outras premiações */}
                {outrasPremiacoes.length > 0 && (
                  <div className="space-y-2">
                    {outrasPremiacoes.map((premiacao, index) => (
                      <div 
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${premiacao.ativo ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-300'}`}
                      >
                        <Switch
                          checked={premiacao.ativo}
                          onCheckedChange={(checked) => {
                            const updated = [...outrasPremiacoes];
                            updated[index].ativo = checked;
                            setOutrasPremiacoes(updated);
                          }}
                          className={premiacao.ativo ? 'data-[state=checked]:bg-green-500' : 'data-[state=unchecked]:bg-gray-400'}
                        />
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <Star className={`h-4 w-4 flex-shrink-0 ${premiacao.ativo ? 'text-green-600' : 'text-gray-500'}`} />
                          <span className={`text-sm truncate ${premiacao.ativo ? 'font-medium text-green-700' : 'text-gray-600'}`}>
                            {premiacao.nome}
                          </span>
                        </div>
                        <div className="w-32 flex-shrink-0 relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0,00"
                            disabled={!premiacao.ativo}
                            value={formatCurrency(premiacao.valor)}
                            onChange={(e) => {
                              const numericValue = e.target.value.replace(/\D/g, '');
                              const numberValue = numericValue === "" ? "" : Number(numericValue) / 100;
                              const updated = [...outrasPremiacoes];
                              updated[index].valor = numberValue;
                              setOutrasPremiacoes(updated);
                            }}
                            className="text-right text-sm h-8 pl-7"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-destructive"
                          onClick={() => {
                            setOutrasPremiacoes(outrasPremiacoes.filter((_, i) => i !== index));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {outrasPremiacoes.length === 0 && !mostrarFormOutraPremiacao && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nenhuma premiação personalizada adicionada
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Aba Convite */}
            <TabsContent value="convite" className="space-y-4 mt-0">
              <Card className="p-4 bg-gradient-to-r from-purple-500/80 to-purple-600 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Image className="h-4 w-4" />
                  <span className="text-sm font-medium">Convite do Evento</span>
                </div>
                <p className="text-xs opacity-80">
                  O convite possui 4 páginas: Imagem do Evento, Informações, QR Code e Dados do Cliente
                </p>
              </Card>

              {/* Upload de Imagem */}
              <Card className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Página 1: Imagem do Evento</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Faça upload de uma imagem de 400x400 pixels para o convite
                  </p>

                  {conviteImagem ? (
                    <div className="relative">
                      <img 
                        src={conviteImagem} 
                        alt="Preview do convite" 
                        className="w-48 h-48 object-cover rounded-lg border mx-auto"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-1/2 translate-x-[100px]"
                        onClick={() => {
                          setConviteImagem(null);
                          setConviteImagemFile(null);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-48 h-48 mx-auto border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Clique para enviar</span>
                      <span className="text-xs text-muted-foreground mt-1">400x400 pixels</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setConviteImagemFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setConviteImagem(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </Card>

              {/* Preview das outras páginas */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Página 2: Informações do Evento</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Nome do Evento:</span>
                    <span className="font-medium">{titulo || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Nome da Loja:</span>
                    <span className="font-medium">{activeCompany?.nome_empresa || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Data de Início:</span>
                    <span className="font-medium">{dataInicio ? new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR') : "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Data de Fim:</span>
                    <span className="font-medium">{dataFim ? new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR') : "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Endereço:</span>
                    <span className="font-medium text-xs">Endereço da loja será exibido</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <QrCode className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Página 3: QR Code da Recepção</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <div className="w-24 h-24 bg-white border-2 rounded-lg mx-auto flex items-center justify-center">
                    <QrCode className="h-16 w-16 text-gray-800" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    QR Code será gerado automaticamente para abrir a página de recepção
                  </p>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Página 4: Informações do Cliente</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Convidado (Cliente):</span>
                    <span className="text-xs italic text-muted-foreground">Será preenchido dinamicamente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Quem Convidou:</span>
                    <span className="text-xs italic text-muted-foreground">Pessoa que enviou o convite</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UsersRound className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Equipe:</span>
                    <span className="text-xs italic text-muted-foreground">Equipe do vendedor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Vendedor Indicado:</span>
                    <span className="text-xs italic text-muted-foreground">Vendedor atribuído ao cliente</span>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Aba Páginas */}
            <TabsContent value="paginas" className="space-y-4 mt-0">
              <Card className="p-4 bg-gradient-to-r from-teal-500/80 to-teal-600 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <FileImage className="h-4 w-4" />
                  <span className="text-sm font-medium">Página de Captura de Leads</span>
                </div>
                <p className="text-xs opacity-80">
                  Configure o texto e cores da página de captura para o evento
                </p>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                {/* Coluna de Formulário */}
                <div className="space-y-4">
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Textos da Página</span>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Início da Frase (até 200 caracteres)</Label>
                      <Input
                        value={paginaInicioFrase}
                        onChange={(e) => setPaginaInicioFrase(e.target.value.slice(0, 200))}
                        placeholder="Ex: A melhor oportunidade de"
                        maxLength={200}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Palavra Destaque (até 200 caracteres)</Label>
                      <Input
                        value={paginaPalavraDestaque}
                        onChange={(e) => setPaginaPalavraDestaque(e.target.value.slice(0, 200))}
                        placeholder="Ex: Cidade e região"
                        maxLength={200}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Final da Frase (até 200 caracteres)</Label>
                      <Input
                        value={paginaFinalFrase}
                        onChange={(e) => setPaginaFinalFrase(e.target.value.slice(0, 200))}
                        placeholder="Ex: para sair de carro novo!"
                        maxLength={200}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Texto de Apoio (até 200 caracteres)</Label>
                      <Textarea
                        value={paginaTextoApoio}
                        onChange={(e) => setPaginaTextoApoio(e.target.value.slice(0, 200))}
                        placeholder="Ex: Você e sua família são nossos convidados..."
                        maxLength={200}
                        className="h-16 resize-none text-sm"
                      />
                    </div>
                  </Card>
                  
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Datas e Horários</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Primeiro Dia do Evento</Label>
                        <Input
                          type="date"
                          value={paginaPrimeiroDia}
                          onChange={(e) => setPaginaPrimeiroDia(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Dia Final do Evento</Label>
                        <Input
                          type="date"
                          value={paginaDiaFinal}
                          onChange={(e) => setPaginaDiaFinal(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Horário de Início</Label>
                        <Input
                          type="time"
                          value={paginaHoraInicio}
                          onChange={(e) => setPaginaHoraInicio(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Horário de Término</Label>
                        <Input
                          type="time"
                          value={paginaHoraTermino}
                          onChange={(e) => setPaginaHoraTermino(e.target.value)}
                        />
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Link className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Link da Política de Privacidade</span>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">URL (opcional)</Label>
                      <Input
                        value={paginaLinkPolitica}
                        onChange={(e) => setPaginaLinkPolitica(e.target.value.slice(0, 200))}
                        placeholder="https://..."
                        maxLength={200}
                      />
                    </div>
                  </Card>
                  
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Palette className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Cores</span>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Cor de Fundo</Label>
                        <input
                          type="color"
                          value={paginaCorFundo}
                          onChange={(e) => setPaginaCorFundo(e.target.value)}
                          className="w-8 h-8 rounded-full cursor-pointer border-0"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Cor do Texto</Label>
                        <input
                          type="color"
                          value={paginaCorTexto}
                          onChange={(e) => setPaginaCorTexto(e.target.value)}
                          className="w-8 h-8 rounded-full cursor-pointer border-0"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Cor Destaque</Label>
                        <input
                          type="color"
                          value={paginaCorDestaque}
                          onChange={(e) => setPaginaCorDestaque(e.target.value)}
                          className="w-8 h-8 rounded-full cursor-pointer border-0"
                        />
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Imagem do Evento</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Clique para alterar a imagem. Recomendação: 400x400 pixels
                    </p>
                    
                    {paginaImagemEvento ? (
                      <div className="relative">
                        <img 
                          src={paginaImagemEvento} 
                          alt="Imagem do evento" 
                          className="w-24 h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => document.getElementById('paginaImagemInput')?.click()}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={() => {
                            setPaginaImagemEvento(null);
                            setPaginaImagemEventoFile(null);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">Upload</span>
                      </label>
                    )}
                    <input
                      id="paginaImagemInput"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPaginaImagemEventoFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPaginaImagemEvento(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </Card>
                </div>
                
                {/* Coluna de Preview */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Preview da Página</Label>
                  <div 
                    className="rounded-lg overflow-hidden border shadow-lg"
                    style={{ backgroundColor: paginaCorFundo }}
                  >
                    <div className="p-4 min-h-[450px]">
                      {/* Header com logo e vendedor */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                          <Building className="h-4 w-4" style={{ color: paginaCorTexto }} />
                        </div>
                        <span className="text-sm font-medium" style={{ color: paginaCorTexto }}>
                          {activeCompany?.nome_empresa || "Nome da Loja"}
                        </span>
                      </div>
                      
                      {/* Título do evento */}
                      <h2 
                        className="text-lg font-bold italic mb-1" 
                        style={{ color: paginaCorDestaque }}
                      >
                        {titulo || "NOME DO EVENTO"}
                      </h2>
                      <p className="text-sm mb-3" style={{ color: paginaCorTexto }}>
                        {activeCompany?.nome_empresa || "Nome da Loja"}
                      </p>
                      
                      {/* Imagem do evento */}
                      <div className="mb-3">
                        {paginaImagemEvento ? (
                          <img 
                            src={paginaImagemEvento} 
                            alt="Evento" 
                            className="w-32 h-32 object-cover rounded-lg border-4"
                            style={{ borderColor: paginaCorFundo }}
                          />
                        ) : (
                          <div 
                            className="w-32 h-32 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${paginaCorTexto}20` }}
                          >
                            <Image className="h-8 w-8" style={{ color: paginaCorTexto }} />
                          </div>
                        )}
                      </div>
                      
                      {/* Data e hora */}
                      <div className="flex items-center gap-1 text-xs mb-4" style={{ color: paginaCorTexto }}>
                        <CalendarDays className="h-3 w-3" />
                        <span>
                          {paginaPrimeiroDia ? new Date(paginaPrimeiroDia + 'T12:00:00').toLocaleDateString('pt-BR') : "DD/MM/AAAA"}
                          {paginaHoraInicio && ` - ${paginaHoraInicio}`}
                          {paginaHoraTermino && ` às ${paginaHoraTermino}`}
                        </span>
                      </div>
                      
                      {/* Frase principal */}
                      <div className="mb-3">
                        <p className="text-lg font-bold" style={{ color: paginaCorTexto }}>
                          {paginaInicioFrase || "A melhor oportunidade de "}
                          <span style={{ color: paginaCorDestaque }}>
                            {paginaPalavraDestaque || "Cidade e região"}
                          </span>
                          {" "}{paginaFinalFrase || "para sair de carro novo!"}
                        </p>
                      </div>
                      
                      {/* Texto instrução */}
                      <p className="text-xs mb-3" style={{ color: paginaCorTexto }}>
                        Insira seus dados abaixo e <strong style={{ color: paginaCorDestaque }}>GARANTA O SEU INGRESSO!</strong>
                      </p>
                      
                      {/* Campos de formulário (preview) */}
                      <div className="space-y-2 mb-3">
                        <div className="bg-white rounded-lg px-3 py-2 text-sm text-gray-400">
                          Seu nome
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 text-sm text-gray-400">
                          Seu WhatsApp
                        </div>
                        <div className="bg-white rounded-lg px-3 py-2 text-sm text-gray-400">
                          Modelo de Interesse
                        </div>
                      </div>
                      
                      {/* Botão */}
                      <button 
                        className="w-full py-3 rounded-lg font-semibold text-sm mb-2"
                        style={{ backgroundColor: paginaCorDestaque, color: paginaCorFundo }}
                      >
                        Quero participar!
                      </button>
                      
                      {/* Links de política */}
                      <p className="text-[10px] text-center" style={{ color: paginaCorTexto }}>
                        Ao clicar em "Quero participar!" você concorda com os nossos{" "}
                        <span className="underline">Termos de Uso</span> e{" "}
                        <span className="underline">Política de Privacidade</span>
                      </p>
                    </div>
                    
                    {/* Texto de apoio na parte inferior */}
                    {paginaTextoApoio && (
                      <div className="border-t px-4 py-2" style={{ borderColor: `${paginaCorTexto}30` }}>
                        <p className="text-[10px] text-center" style={{ color: paginaCorTexto }}>
                          {paginaTextoApoio}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Aba Marketing */}
            <TabsContent value="marketing" className="space-y-4 mt-0">
              <Card className="p-4 bg-gradient-to-r from-orange-500/80 to-orange-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Megaphone className="h-4 w-4" />
                      <span className="text-sm font-medium">Conteúdo para Redes Sociais</span>
                    </div>
                    <p className="text-xs opacity-80">{marketingAssets.length} {marketingAssets.length === 1 ? 'imagem' : 'imagens'} criadas</p>
                  </div>
                </div>
              </Card>
              
              {/* Formatos disponíveis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stories (1080x1920) */}
                <Card className="p-4 border-dashed">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white">
                      <FileImage className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Stories</h4>
                      <p className="text-xs text-muted-foreground">1080 × 1920px (9:16)</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Instagram, Facebook, TikTok • Máx. 4MB
                  </p>
                  {marketingAssets.find(a => a.tipo_formato === 'stories') ? (
                    <div className="relative group">
                      <img 
                        src={marketingAssets.find(a => a.tipo_formato === 'stories')?.imagem_url || ''}
                        alt="Stories"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setMarketingAssets(prev => prev.filter(a => a.tipo_formato !== 'stories'))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Fazer upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setMarketingAssets(prev => [...prev, {
                                tipo_formato: 'stories',
                                plataforma: 'todos',
                                largura: 1080,
                                altura: 1920,
                                imagem_url: reader.result as string,
                                nome_arquivo: file.name,
                                tamanho_arquivo: file.size,
                                file
                              }]);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </Card>

                {/* Feed Quadrado (1080x1080) */}
                <Card className="p-4 border-dashed">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                      <FileImage className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Feed Quadrado</h4>
                      <p className="text-xs text-muted-foreground">1080 × 1080px (1:1)</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Instagram, Facebook • Máx. 8MB
                  </p>
                  {marketingAssets.find(a => a.tipo_formato === 'feed_quadrado') ? (
                    <div className="relative group">
                      <img 
                        src={marketingAssets.find(a => a.tipo_formato === 'feed_quadrado')?.imagem_url || ''}
                        alt="Feed Quadrado"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setMarketingAssets(prev => prev.filter(a => a.tipo_formato !== 'feed_quadrado'))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Fazer upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setMarketingAssets(prev => [...prev, {
                                tipo_formato: 'feed_quadrado',
                                plataforma: 'instagram_facebook',
                                largura: 1080,
                                altura: 1080,
                                imagem_url: reader.result as string,
                                nome_arquivo: file.name,
                                tamanho_arquivo: file.size,
                                file
                              }]);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </Card>

                {/* Feed Retrato (1080x1350) */}
                <Card className="p-4 border-dashed">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white">
                      <FileImage className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Feed Retrato</h4>
                      <p className="text-xs text-muted-foreground">1080 × 1350px (4:5)</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Instagram, Facebook • Máx. 8MB
                  </p>
                  {marketingAssets.find(a => a.tipo_formato === 'feed_retrato') ? (
                    <div className="relative group">
                      <img 
                        src={marketingAssets.find(a => a.tipo_formato === 'feed_retrato')?.imagem_url || ''}
                        alt="Feed Retrato"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setMarketingAssets(prev => prev.filter(a => a.tipo_formato !== 'feed_retrato'))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Fazer upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setMarketingAssets(prev => [...prev, {
                                tipo_formato: 'feed_retrato',
                                plataforma: 'instagram_facebook',
                                largura: 1080,
                                altura: 1350,
                                imagem_url: reader.result as string,
                                nome_arquivo: file.name,
                                tamanho_arquivo: file.size,
                                file
                              }]);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </Card>

                {/* Feed Paisagem (1200x630) */}
                <Card className="p-4 border-dashed">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 flex items-center justify-center text-white">
                      <FileImage className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Feed Paisagem</h4>
                      <p className="text-xs text-muted-foreground">1200 × 630px (1.91:1)</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Facebook, Links • Máx. 8MB
                  </p>
                  {marketingAssets.find(a => a.tipo_formato === 'feed_paisagem') ? (
                    <div className="relative group">
                      <img 
                        src={marketingAssets.find(a => a.tipo_formato === 'feed_paisagem')?.imagem_url || ''}
                        alt="Feed Paisagem"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setMarketingAssets(prev => prev.filter(a => a.tipo_formato !== 'feed_paisagem'))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Fazer upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setMarketingAssets(prev => [...prev, {
                                tipo_formato: 'feed_paisagem',
                                plataforma: 'facebook',
                                largura: 1200,
                                altura: 630,
                                imagem_url: reader.result as string,
                                nome_arquivo: file.name,
                                tamanho_arquivo: file.size,
                                file
                              }]);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </Card>

                {/* Reels/TikTok (1080x1920) */}
                <Card className="p-4 border-dashed">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center text-white">
                      <FileImage className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Reels / TikTok</h4>
                      <p className="text-xs text-muted-foreground">1080 × 1920px (9:16)</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Vídeos verticais • Thumbnail ou capa
                  </p>
                  {marketingAssets.find(a => a.tipo_formato === 'reels') ? (
                    <div className="relative group">
                      <img 
                        src={marketingAssets.find(a => a.tipo_formato === 'reels')?.imagem_url || ''}
                        alt="Reels"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setMarketingAssets(prev => prev.filter(a => a.tipo_formato !== 'reels'))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Fazer upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setMarketingAssets(prev => [...prev, {
                                tipo_formato: 'reels',
                                plataforma: 'instagram_tiktok',
                                largura: 1080,
                                altura: 1920,
                                imagem_url: reader.result as string,
                                nome_arquivo: file.name,
                                tamanho_arquivo: file.size,
                                file
                              }]);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </Card>

                {/* Capa de Vídeo (1280x720) */}
                <Card className="p-4 border-dashed">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center text-white">
                      <FileImage className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Capa de Vídeo</h4>
                      <p className="text-xs text-muted-foreground">1280 × 720px (16:9)</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    YouTube, Facebook Video • Máx. 8MB
                  </p>
                  {marketingAssets.find(a => a.tipo_formato === 'capa_video') ? (
                    <div className="relative group">
                      <img 
                        src={marketingAssets.find(a => a.tipo_formato === 'capa_video')?.imagem_url || ''}
                        alt="Capa de Vídeo"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setMarketingAssets(prev => prev.filter(a => a.tipo_formato !== 'capa_video'))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Fazer upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setMarketingAssets(prev => [...prev, {
                                tipo_formato: 'capa_video',
                                plataforma: 'youtube_facebook',
                                largura: 1280,
                                altura: 720,
                                imagem_url: reader.result as string,
                                nome_arquivo: file.name,
                                tamanho_arquivo: file.size,
                                file
                              }]);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </Card>
              </div>

              {/* Informações */}
              <Card className="p-4 bg-muted/30">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-primary mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Dica:</strong> Para melhores resultados, use imagens com as dimensões exatas recomendadas.</p>
                    <p><strong>Stories/Reels:</strong> 1080×1920px • <strong>Feed Quadrado:</strong> 1080×1080px • <strong>Feed Retrato:</strong> 1080×1350px</p>
                    <p><strong>Formatos aceitos:</strong> JPG, PNG, WebP • <strong>Tamanho máximo:</strong> 8MB por imagem</p>
                  </div>
                </div>
              </Card>
            </TabsContent>
            </div>

            {/* Footer fixo */}
            <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t bg-background">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading 
                  ? (editingProspeccao ? "Salvando..." : "Criando...") 
                  : (editingProspeccao ? "Salvar Alterações" : "Criar Prospecção")
                }
              </Button>
            </div>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
};