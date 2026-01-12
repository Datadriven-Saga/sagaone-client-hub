import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Check, CheckCheck, Image as ImageIcon, Video, Music } from "lucide-react";

interface CardButton {
  id: string;
  nome: string;
  buttonId: string;
}

interface CardData {
  imagemUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  textoCabecalho?: string;
  rodape?: string;
  botoes?: CardButton[];
}

interface TemplatePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  nome: string;
  formato: string;
  conteudo: string;
  cardData?: CardData;
}

export function TemplatePreview({ 
  isOpen, 
  onClose, 
  nome, 
  formato, 
  conteudo, 
  cardData 
}: TemplatePreviewProps) {
  // Função para renderizar o conteúdo baseado no formato
  const renderTemplateContent = () => {
    switch (formato) {
      case "texto":
        return (
          <div className="whitespace-pre-wrap text-sm">
            {conteudo || "Texto da mensagem..."}
          </div>
        );

      case "botao":
        return (
          <div className="space-y-2">
            <div className="whitespace-pre-wrap text-sm">
              {conteudo || "Texto da mensagem..."}
            </div>
            {cardData?.botoes && cardData.botoes.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-[#25D366]/20">
                {cardData.botoes.map((btn, index) => (
                  <button
                    key={btn.id || index}
                    className="w-full py-2 text-center text-[#00A884] text-sm font-medium border border-[#25D366]/30 rounded-lg bg-transparent hover:bg-[#25D366]/5 transition-colors"
                  >
                    {btn.nome || `Botão ${index + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case "imagem":
        return (
          <div className="space-y-2">
            {cardData?.imagemUrl ? (
              <div className="rounded-lg overflow-hidden">
                <img 
                  src={cardData.imagemUrl} 
                  alt="Preview" 
                  className="w-full h-40 object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-40 bg-muted/50 rounded-lg flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
              </div>
            )}
            {conteudo && (
              <div className="whitespace-pre-wrap text-sm">
                {conteudo}
              </div>
            )}
          </div>
        );

      case "audio":
        return (
          <div className="space-y-2">
            {cardData?.audioUrl ? (
              <div className="bg-[#25D366]/10 rounded-lg p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center">
                  <Music className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="h-1 bg-[#25D366]/30 rounded-full">
                    <div className="w-1/3 h-full bg-[#25D366] rounded-full"></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">0:00 / 0:30</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-20 bg-muted/50 rounded-lg flex items-center justify-center">
                <Music className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
            {conteudo && (
              <div className="whitespace-pre-wrap text-sm">
                {conteudo}
              </div>
            )}
          </div>
        );

      case "video":
        return (
          <div className="space-y-2">
            {cardData?.videoUrl ? (
              <div className="rounded-lg overflow-hidden">
                <video 
                  src={cardData.videoUrl} 
                  className="w-full h-40 object-cover"
                  controls
                />
              </div>
            ) : (
              <div className="w-full h-40 bg-muted/50 rounded-lg flex items-center justify-center">
                <Video className="h-12 w-12 text-muted-foreground/40" />
              </div>
            )}
            {conteudo && (
              <div className="whitespace-pre-wrap text-sm">
                {conteudo}
              </div>
            )}
          </div>
        );

      case "card":
        return (
          <div className="space-y-2">
            {/* Imagem do Card */}
            {cardData?.imagemUrl ? (
              <div className="rounded-lg overflow-hidden -mx-3 -mt-3">
                <img 
                  src={cardData.imagemUrl} 
                  alt="Preview" 
                  className="w-full h-32 object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-32 bg-muted/50 rounded-lg -mx-3 -mt-3 flex items-center justify-center" style={{ width: 'calc(100% + 24px)' }}>
                <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
            
            {/* Cabeçalho */}
            {cardData?.textoCabecalho && (
              <p className="font-semibold text-sm pt-2">
                {cardData.textoCabecalho}
              </p>
            )}
            
            {/* Corpo do texto */}
            {conteudo && (
              <div className="whitespace-pre-wrap text-sm">
                {conteudo}
              </div>
            )}
            
            {/* Rodapé */}
            {cardData?.rodape && (
              <p className="text-xs text-muted-foreground pt-1">
                {cardData.rodape}
              </p>
            )}
            
            {/* Botões */}
            {cardData?.botoes && cardData.botoes.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-[#25D366]/20">
                {cardData.botoes.map((btn, index) => (
                  <button
                    key={btn.id || index}
                    className="w-full py-2 text-center text-[#00A884] text-sm font-medium border border-[#25D366]/30 rounded-lg bg-transparent hover:bg-[#25D366]/5 transition-colors"
                  >
                    {btn.nome || `Botão ${index + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground text-center py-4">
            Preview não disponível para este formato
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Preview: {nome || "Template"}</DialogTitle>
        </DialogHeader>
        
        {/* WhatsApp Chat Interface */}
        <div className="bg-[#E5DDD5] dark:bg-[#0B141A] min-h-[350px] p-4">
          {/* Chat Background Pattern */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Message Bubble */}
          <div className="relative flex justify-end mb-2">
            <div className="max-w-[85%] bg-[#DCF8C6] dark:bg-[#005C4B] rounded-lg p-3 shadow-sm">
              {/* Tail */}
              <div className="absolute -right-2 top-0 w-4 h-4 overflow-hidden">
                <div className="w-4 h-4 bg-[#DCF8C6] dark:bg-[#005C4B] transform rotate-45 translate-x-2 -translate-y-2"></div>
              </div>
              
              {/* Content */}
              <div className="text-[#111B21] dark:text-white">
                {renderTemplateContent()}
              </div>
              
              {/* Timestamp and Status */}
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <CheckCheck className="h-3.5 w-3.5 text-[#53BDEB]" />
              </div>
            </div>
          </div>
        </div>
        
      </DialogContent>
    </Dialog>
  );
}
