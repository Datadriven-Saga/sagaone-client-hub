import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export function TemplatesTab() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Templates da Paty</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Os templates da Paty são gerenciados na tela principal de Templates, filtrando pelo agente Paty.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/prospeccao/templates"><ExternalLink className="h-4 w-4 mr-1" /> Abrir Templates</Link>
        </Button>
      </CardContent>
    </Card>
  );
}