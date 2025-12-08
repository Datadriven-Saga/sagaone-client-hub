import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Battery, Gauge, Zap, Car, Fuel, Settings2 } from "lucide-react";

interface CarModel {
  id: string;
  name: string;
  category: string;
  price: string;
  image: string;
  specs: {
    autonomy: string;
    power: string;
    acceleration: string;
    topSpeed: string;
    battery: string;
    charging: string;
  };
  features: string[];
  description: string;
}

const bydCars: CarModel[] = [
  {
    id: "dolphin",
    name: "BYD Dolphin",
    category: "Hatchback Elétrico",
    price: "A partir de R$ 149.800",
    image: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&auto=format&fit=crop&q=60",
    specs: {
      autonomy: "340 km",
      power: "150 cv",
      acceleration: "7,0s (0-100 km/h)",
      topSpeed: "160 km/h",
      battery: "44,9 kWh",
      charging: "30 min (30-80%)",
    },
    features: ["Teto solar panorâmico", "Central multimídia 12,8\"", "Carregador wireless", "Câmera 360°", "Piloto automático adaptativo"],
    description: "O BYD Dolphin é o hatchback elétrico perfeito para a cidade, combinando design moderno, tecnologia avançada e eficiência energética em um pacote compacto e acessível.",
  },
  {
    id: "seal",
    name: "BYD Seal",
    category: "Sedã Elétrico",
    price: "A partir de R$ 269.800",
    image: "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&auto=format&fit=crop&q=60",
    specs: {
      autonomy: "550 km",
      power: "313 cv",
      acceleration: "5,9s (0-100 km/h)",
      topSpeed: "180 km/h",
      battery: "82,5 kWh",
      charging: "30 min (30-80%)",
    },
    features: ["Tecnologia Cell-to-Body", "Suspensão a ar", "Sistema de som Dynaudio", "Bancos ventilados", "Head-up display"],
    description: "O BYD Seal representa o ápice da engenharia elétrica, oferecendo desempenho esportivo, autonomia impressionante e luxo refinado em um sedã elegante.",
  },
  {
    id: "song-plus",
    name: "BYD Song Plus",
    category: "SUV Híbrido Plug-in",
    price: "A partir de R$ 229.800",
    image: "https://images.unsplash.com/photo-1606611013016-969c19ba7ee7?w=800&auto=format&fit=crop&q=60",
    specs: {
      autonomy: "1.200 km (total)",
      power: "326 cv (combinado)",
      acceleration: "5,9s (0-100 km/h)",
      topSpeed: "190 km/h",
      battery: "18,3 kWh",
      charging: "2h (carga completa)",
    },
    features: ["Modo 100% elétrico", "AWD inteligente", "Porta-malas 574L", "DiPilot", "NFC digital key"],
    description: "O BYD Song Plus combina a versatilidade de um SUV com a eficiência híbrida plug-in, oferecendo liberdade para viagens longas sem ansiedade de autonomia.",
  },
  {
    id: "tan",
    name: "BYD Tan",
    category: "SUV Elétrico Premium",
    price: "A partir de R$ 459.800",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&auto=format&fit=crop&q=60",
    specs: {
      autonomy: "520 km",
      power: "517 cv",
      acceleration: "4,6s (0-100 km/h)",
      topSpeed: "200 km/h",
      battery: "108,8 kWh",
      charging: "35 min (30-80%)",
    },
    features: ["7 lugares", "Tração AWD", "Suspensão adaptativa", "Interior em couro Nappa", "Sistema de som premium 12 alto-falantes"],
    description: "O BYD Tan é o SUV elétrico de luxo que combina espaço para toda a família com desempenho impressionante e tecnologia de ponta.",
  },
  {
    id: "yuan-plus",
    name: "BYD Yuan Plus",
    category: "SUV Compacto Elétrico",
    price: "A partir de R$ 185.800",
    image: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&auto=format&fit=crop&q=60",
    specs: {
      autonomy: "410 km",
      power: "204 cv",
      acceleration: "7,3s (0-100 km/h)",
      topSpeed: "160 km/h",
      battery: "60,4 kWh",
      charging: "30 min (30-80%)",
    },
    features: ["Design Ocean-X", "Bateria Blade", "V2L (Vehicle to Load)", "Painel rotativo 12,8\"", "Modo esportivo"],
    description: "O BYD Yuan Plus oferece a combinação perfeita de praticidade urbana e capacidade para aventuras, com autonomia ideal para o dia a dia.",
  },
  {
    id: "han",
    name: "BYD Han",
    category: "Sedã Executivo Elétrico",
    price: "A partir de R$ 399.800",
    image: "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&auto=format&fit=crop&q=60",
    specs: {
      autonomy: "605 km",
      power: "523 cv",
      acceleration: "3,9s (0-100 km/h)",
      topSpeed: "230 km/h",
      battery: "85,4 kWh",
      charging: "25 min (30-80%)",
    },
    features: ["Design Dynasty", "Monocoque Blade", "Condução autônoma L2+", "Interior artesanal", "Sistema de áudio Dirac"],
    description: "O BYD Han é a expressão máxima do luxo elétrico, combinando performance de superesportivo com refinamento de limousine.",
  },
];

const SpecItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
    <div className="p-2 bg-primary/10 rounded-lg">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  </div>
);

const CarCard = ({ car }: { car: CarModel }) => (
  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
    <div className="relative h-48 overflow-hidden">
      <img
        src={car.image}
        alt={car.name}
        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
      />
      <Badge className="absolute top-3 right-3 bg-primary">{car.category}</Badge>
    </div>
    <CardHeader className="pb-2">
      <div className="flex justify-between items-start">
        <div>
          <CardTitle className="text-xl">{car.name}</CardTitle>
          <p className="text-primary font-semibold mt-1">{car.price}</p>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground line-clamp-2">{car.description}</p>
      
      <div className="grid grid-cols-2 gap-2">
        <SpecItem icon={Gauge} label="Autonomia" value={car.specs.autonomy} />
        <SpecItem icon={Zap} label="Potência" value={car.specs.power} />
        <SpecItem icon={Car} label="0-100 km/h" value={car.specs.acceleration} />
        <SpecItem icon={Battery} label="Bateria" value={car.specs.battery} />
      </div>

      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground mb-2">Principais recursos:</p>
        <div className="flex flex-wrap gap-1">
          {car.features.slice(0, 3).map((feature, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {feature}
            </Badge>
          ))}
          {car.features.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{car.features.length - 3}
            </Badge>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

const Carros = () => {
  const categories = [...new Set(bydCars.map(car => car.category))];

  return (
    <DashboardLayout title="Carros BYD">
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Car className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{bydCars.length}</p>
                  <p className="text-sm text-muted-foreground">Modelos Disponíveis</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Battery className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{bydCars.filter(c => c.category.includes('Elétrico')).length}</p>
                  <p className="text-sm text-muted-foreground">100% Elétricos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Fuel className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{bydCars.filter(c => c.category.includes('Híbrido')).length}</p>
                  <p className="text-sm text-muted-foreground">Híbridos Plug-in</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Settings2 className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">Blade</p>
                  <p className="text-sm text-muted-foreground">Tecnologia de Bateria</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cars Grid */}
        <Tabs defaultValue="todos" className="w-full">
          <TabsList>
            <TabsTrigger value="todos">Todos os Modelos</TabsTrigger>
            <TabsTrigger value="eletricos">Elétricos</TabsTrigger>
            <TabsTrigger value="hibridos">Híbridos</TabsTrigger>
            <TabsTrigger value="suv">SUVs</TabsTrigger>
            <TabsTrigger value="sedan">Sedãs</TabsTrigger>
          </TabsList>

          <TabsContent value="todos" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bydCars.map(car => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="eletricos" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bydCars.filter(car => car.category.includes('Elétrico')).map(car => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="hibridos" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bydCars.filter(car => car.category.includes('Híbrido')).map(car => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="suv" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bydCars.filter(car => car.category.includes('SUV')).map(car => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sedan" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bydCars.filter(car => car.category.includes('Sedã')).map(car => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Carros;
