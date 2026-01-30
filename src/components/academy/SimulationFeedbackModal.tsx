import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Star } from "lucide-react";

interface SimulationFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
}

export function SimulationFeedbackModal({
  isOpen,
  onClose,
  onSubmit,
}: SimulationFeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(true);
  const [progress, setProgress] = useState(0);

  // Reset and start processing when modal opens
  useEffect(() => {
    if (isOpen) {
      setRating(0);
      setComment("");
      setProgress(0);
      setIsProcessing(true);
      
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setIsProcessing(false);
            return 100;
          }
          return p + 10;
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (rating === 0) {
      return; // Don't allow submit without rating
    }
    onSubmit(rating, comment);
    setRating(0);
    setComment("");
    setProgress(0);
    setIsProcessing(true);
  };

  const canSubmit = rating > 0 && !isProcessing;

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={() => {
        // Prevent closing if rating is not provided
        // Modal can only be closed by submitting
      }}
    >
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Sua simulação terminou!</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <p className="text-muted-foreground">
            Agora é com a gente! Seu feedback está sendo gerado e em alguns instantes estará disponível no seu histórico.
          </p>

          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Processando feedback...
              </p>
            </div>
          )}

          <div className="space-y-3">
            <p className="font-medium text-foreground">
              Enquanto isso, avalie como estamos indo...
              <span className="text-destructive"> *</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Avalie a qualidade e realismo da simulação com uma nota entre 1 e 5.
              Isso nos ajudará a melhorar a sua experiência.
            </p>

            {/* Star Rating */}
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating === 0 && (
              <p className="text-xs text-destructive text-center">
                * Avaliação obrigatória
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Comentário (opcional)
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Se tiver algum comentário ou sugestão sobre essa chamada ou sobre a plataforma, compartilhe com a gente (máximo 300 caracteres)"
              maxLength={300}
              rows={4}
            />
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full bg-primary hover:bg-primary/90"
            disabled={!canSubmit}
          >
            {rating === 0 ? "Selecione uma avaliação" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
