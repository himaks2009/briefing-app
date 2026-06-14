import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { BriefingWithStats } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, BookOpen, Users, Trash2, Eye, CheckCircle2, ClipboardList, GraduationCap } from "lucide-react";

type Tab = "briefing" | "lesson";

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("briefing");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [passingScore, setPassingScore] = useState("70");

  const { data: briefings = [], isLoading: loadingB } = useQuery<BriefingWithStats[]>({
    queryKey: ["/api/briefings", "briefing"],
    queryFn: () => apiRequest("GET", "/api/briefings?type=briefing").then(r => r.json()),
  });

  const { data: lessons = [], isLoading: loadingL } = useQuery<BriefingWithStats[]>({
    queryKey: ["/api/briefings", "lesson"],
    queryFn: () => apiRequest("GET", "/api/briefings?type=lesson").then(r => r.json()),
  });

  const isLoading = activeTab === "briefing" ? loadingB : loadingL;
  const items = activeTab === "briefing" ? briefings : lessons;

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; passingScore: number; itemType: string }) =>
      apiRequest("POST", "/api/briefings", data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefings", activeTab] });
      setShowCreate(false);
      setTitle(""); setContent(""); setPassingScore("70");
      toast({ title: activeTab === "briefing" ? "Інструктаж створено" : "Заняття створено" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/briefings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefings", activeTab] });
      toast({ title: "Видалено" });
    },
  });

  const handleCreate = () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Заповніть всі поля", variant: "destructive" });
      return;
    }
    createMutation.mutate({ title, content, passingScore: parseInt(passingScore) || 70, itemType: activeTab });
  };

  const labelSingle = activeTab === "briefing" ? "Інструктаж" : "Заняття";
  const labelPlural = activeTab === "briefing" ? "інструктажів" : "занять";
  const labelCreate = activeTab === "briefing" ? "Новий інструктаж" : "Нове заняття";
  const labelEmpty = activeTab === "briefing" ? "Немає інструктажів" : "Немає занять";
  const labelEmptySub = activeTab === "briefing"
    ? "Створіть перший інструктаж для особового складу"
    : "Створіть перше заняття для особового складу";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Система інструктажів</h1>
              <p className="text-xs text-muted-foreground">Адміністративна панель</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            {labelCreate}
          </Button>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-0">
          <button
            onClick={() => setActiveTab("briefing")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "briefing"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Інструктажі
          </button>
          <button
            onClick={() => setActiveTab("lesson")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "lesson"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Заняття
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1,2,3].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-40 mt-4" /></Card>)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            {activeTab === "briefing"
              ? <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              : <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            }
            <p className="text-muted-foreground text-lg">{labelEmpty}</p>
            <p className="text-muted-foreground text-sm mt-1">{labelEmptySub}</p>
            <Button onClick={() => setShowCreate(true)} className="mt-6 gap-2">
              <Plus className="w-4 h-4" /> {labelCreate}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((b) => {
              const pct = b.totalPersonnel > 0 ? Math.round((b.passedCount / b.totalPersonnel) * 100) : 0;
              return (
                <Card key={b.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight">{b.title}</CardTitle>
                      {b.passedCount > 0 && b.passedCount >= b.totalPersonnel && b.totalPersonnel > 0 ? (
                        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Всі пройшли
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">В процесі</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })}
                      {" · "}{b.questionCount} питань · прохідний бал {b.passingScore}%
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">{b.content}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{b.passedCount} / {b.totalPersonnel} пройшли тест</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline" size="sm" className="flex-1 gap-1"
                        onClick={() => navigate(`/briefing/${b.id}`)}
                      >
                        <Eye className="w-3.5 h-3.5" /> Управління
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(b.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeTab === "briefing" ? "Новий інструктаж" : "Нове заняття"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Назва</label>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder={activeTab === "briefing" ? "Інструктаж з безпеки №12" : "Тактична підготовка №5"} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {activeTab === "briefing" ? "Текст інструктажу" : "Матеріал заняття"}
              </label>
              <Textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="Введіть текст..." rows={7} className="resize-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Прохідний бал (%)</label>
              <Input type="number" min="1" max="100" value={passingScore}
                onChange={e => setPassingScore(e.target.value)} className="w-32" />
              <p className="text-xs text-muted-foreground">Мінімальний % правильних відповідей для зарахування</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Скасувати</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Створення..." : "Створити"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
