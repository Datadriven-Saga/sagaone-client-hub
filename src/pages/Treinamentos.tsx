import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PlayCircle, Clock, CheckCircle, BookOpen, Users, Award } from "lucide-react";

const Treinamentos = () => {
  const courses = [
    {
      id: 1,
      title: "Fundamentos do CRM Saga One",
      description: "Aprenda os conceitos básicos e navegação no sistema Saga One",
      duration: "2h 30min",
      progress: 100,
      status: "Concluído",
      lessons: 8,
      instructor: "Equipe Saga One"
    },
    {
      id: 2, 
      title: "Gestão de Prospecção Avançada",
      description: "Técnicas avançadas para criação e gestão de campanhas de prospecção",
      duration: "3h 15min", 
      progress: 65,
      status: "Em andamento",
      lessons: 12,
      instructor: "Maria Santos"
    },
    {
      id: 3,
      title: "Automação de Leads",
      description: "Como configurar e utilizar automações para otimizar o atendimento",
      duration: "1h 45min",
      progress: 0,
      status: "Não iniciado", 
      lessons: 6,
      instructor: "Carlos Lima"
    },
    {
      id: 4,
      title: "Relatórios e Analytics",
      description: "Análise de dados e criação de relatórios para tomada de decisão",
      duration: "2h 10min",
      progress: 0,
      status: "Não iniciado",
      lessons: 9,
      instructor: "Ana Costa"
    }
  ];

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      "Concluído": "default",
      "Em andamento": "secondary",
      "Não iniciado": "outline"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <DashboardLayout title="Treinamentos">
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Cursos Disponíveis
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {courses.length}
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Cursos Concluídos
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {courses.filter(c => c.status === 'Concluído').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Horas de Estudo
                </p>
                <p className="text-2xl font-bold text-foreground">
                  2h 30min
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </Card>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{course.title}</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      {course.description}
                    </p>
                  </div>
                  {getStatusBadge(course.status)}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {course.duration}
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {course.lessons} aulas
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {course.instructor}
                  </div>
                </div>

                {course.progress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progresso</span>
                      <span>{course.progress}%</span>
                    </div>
                    <Progress value={course.progress} className="h-2" />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {course.status === 'Não iniciado' ? (
                    <Button className="flex items-center gap-2">
                      <PlayCircle className="h-4 w-4" />
                      Iniciar Curso
                    </Button>
                  ) : course.status === 'Em andamento' ? (
                    <Button className="flex items-center gap-2">
                      <PlayCircle className="h-4 w-4" />
                      Continuar
                    </Button>
                  ) : (
                    <Button variant="outline" className="flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Ver Certificado
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    Detalhes
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Learning Path */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Trilha de Aprendizado Recomendada
          </h3>
          <p className="text-muted-foreground mb-6">
            Siga esta sequência para obter o máximo aproveitamento do sistema Saga One.
          </p>
          
          <div className="space-y-4">
            {courses.map((course, index) => (
              <div key={course.id} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{course.title}</p>
                  <p className="text-sm text-muted-foreground">{course.duration}</p>
                </div>
                {getStatusBadge(course.status)}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Treinamentos;