import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload, UserCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Import male avatars
import male01 from "@/assets/avatars/male-01.png";
import male02 from "@/assets/avatars/male-02.png";
import male03 from "@/assets/avatars/male-03.png";
import male04 from "@/assets/avatars/male-04.png";
import male05 from "@/assets/avatars/male-05.png";
import male06 from "@/assets/avatars/male-06.png";
import male07 from "@/assets/avatars/male-07.png";
import male08 from "@/assets/avatars/male-08.png";
import male09 from "@/assets/avatars/male-09.png";
import male10 from "@/assets/avatars/male-10.png";

// Import female avatars
import female01 from "@/assets/avatars/female-01.png";
import female02 from "@/assets/avatars/female-02.png";
import female03 from "@/assets/avatars/female-03.png";
import female04 from "@/assets/avatars/female-04.png";
import female05 from "@/assets/avatars/female-05.png";
import female06 from "@/assets/avatars/female-06.png";
import female07 from "@/assets/avatars/female-07.png";
import female08 from "@/assets/avatars/female-08.png";
import female09 from "@/assets/avatars/female-09.png";
import female10 from "@/assets/avatars/female-10.png";

const maleAvatars = [male01, male02, male03, male04, male05, male06, male07, male08, male09, male10];
const femaleAvatars = [female01, female02, female03, female04, female05, female06, female07, female08, female09, female10];

interface AvatarSelectorProps {
  currentAvatar?: string | null;
  userName?: string;
  onAvatarChange: (avatarUrl: string) => void;
  disabled?: boolean;
}

export const AvatarSelector = ({ currentAvatar, userName, onAvatarChange, disabled }: AvatarSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(currentAvatar || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewUrl(result);
        setSelectedAvatar(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectAvatar = (avatar: string) => {
    setSelectedAvatar(avatar);
    setPreviewUrl(null);
  };

  const handleConfirm = () => {
    if (selectedAvatar) {
      onAvatarChange(selectedAvatar);
    }
    setOpen(false);
  };

  const initials = userName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="relative group cursor-pointer" onClick={() => !disabled && setOpen(true)}>
          <Avatar className="h-20 w-20">
            <AvatarImage src={currentAvatar || undefined} alt={userName} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          {!disabled && (
            <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-6 w-6 text-white" />
            </div>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Alterar Foto de Perfil</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="avatars" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="avatars" className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              Escolher Avatar
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Enviar Foto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="avatars" className="mt-4">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Avatares Masculinos</h4>
                <div className="grid grid-cols-5 gap-3">
                  {maleAvatars.map((avatar, index) => (
                    <div
                      key={`male-${index}`}
                      className={cn(
                        "relative cursor-pointer rounded-full overflow-hidden border-2 transition-all hover:scale-105",
                        selectedAvatar === avatar ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                      )}
                      onClick={() => handleSelectAvatar(avatar)}
                    >
                      <img src={avatar} alt={`Avatar masculino ${index + 1}`} className="w-full h-full object-cover" />
                      {selectedAvatar === avatar && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="h-6 w-6 text-primary" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Avatares Femininos</h4>
                <div className="grid grid-cols-5 gap-3">
                  {femaleAvatars.map((avatar, index) => (
                    <div
                      key={`female-${index}`}
                      className={cn(
                        "relative cursor-pointer rounded-full overflow-hidden border-2 transition-all hover:scale-105",
                        selectedAvatar === avatar ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                      )}
                      onClick={() => handleSelectAvatar(avatar)}
                    >
                      <img src={avatar} alt={`Avatar feminino ${index + 1}`} className="w-full h-full object-cover" />
                      {selectedAvatar === avatar && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="h-6 w-6 text-primary" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-32 h-32 rounded-full object-cover border-4 border-primary"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Escolher outra
                  </Button>
                </div>
              ) : (
                <div
                  className="w-32 h-32 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-2 block">Clique para enviar</span>
                  </div>
                </div>
              )}
              
              <p className="text-sm text-muted-foreground text-center">
                Formatos suportados: JPG, PNG, GIF<br />
                Tamanho máximo: 5MB
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedAvatar}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
