import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Briefing, PersonnelWithStatus, QuestionWithParsed, TestResult } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, Trash2, ArrowLeft, Copy, UserPlus, Edit2, Download, Plus, HelpCircle, BarChart3, XCircle, Printer } from "lucide-react";

const RANKS = ["Рядовий", "Молодший сержант", "Сержант", "Старший сержант", "Штаб-сержант", "Старшина", "Прапорщик", "Старший прапорщик", "Молодший лейтенант", "Лейтенант", "Старший лейтенант", "Капітан", "Майор", "Підполковник", "Полковник"];

const PRESET_PERSONNEL = [
  {name:"ЗАВГОРОДНІЙ Олексій В'ячеславович",rank:"молодший лейтенант",unit:"Взвод РХБ захисту"},
  {name:"БОНДАР Юрій Миколайович",rank:"старший сержант",unit:"Взвод РХБ захисту"},
  {name:"ШУБА Павло Васильович",rank:"старший солдат",unit:"Взвод РХБ захисту"},
  {name:"ЛИТВИНЕНКО Роман Олександрович",rank:"солдат",unit:"Взвод РХБ захисту"},
  {name:"ШЕВЧЕНКО Валерій Михайлович",rank:"молодший сержант",unit:"Взвод РХБ захисту"},
  {name:"РУЖИНСЬКИЙ Максим Юрійович",rank:"солдат",unit:"Взвод РХБ захисту"},
  {name:"ЧЕПЛАКОВ Євген Олександрович",rank:"солдат",unit:"Взвод РХБ захисту"},
  {name:"ТВЕРДОХЛІБ Анатолій Павлович",rank:"штаб-сержант",unit:"Взвод РХБ захисту"},
  {name:"ЗАБАРИЛО Ігор Дмитрович",rank:"солдат",unit:"Взвод РХБ захисту"},
  {name:"ПИЛЯЙ Ігор Васильович",rank:"солдат",unit:"Взвод РХБ захисту"},
  {name:"КРИШТАК Миколай Григорович",rank:"сержант",unit:"Взвод РХБ захисту"},
  {name:"ДЕМЧЕНКО Сергій Вікторович",rank:"солдат",unit:"Взвод РХБ захисту"},
  {name:"МАРУЩАК Віталій Миколайович",rank:"сержант",unit:"Взвод РХБ захисту"},
  {name:"ПЕТРЕНКО Едуард Романович",rank:"старший солдат",unit:"Взвод РХБ захисту"},
  {name:"ШУМІЛІН Вячеслав Вікторович",rank:"старший солдат",unit:"Взвод РХБ захисту"},
  {name:"ЖИВУН Олександр Павлович",rank:"солдат",unit:"Взвод РХБ захисту"},
  {name:"МОЛЧАН Олександр Михайлович",rank:"солдат",unit:"Взвод РХБ захисту"},
  {name:"ЦЕГЕЛЬНИЙ Михайло Михайлович",rank:"солдат",unit:"Взвод РХБ захисту"},
  {name:"ГІЛЕВИЧ Валерій Григорович",rank:"солдат",unit:"Взвод РХБ захисту"},
  {name:"УСТИЧ Ярослав Олександрович",rank:"молодший сержант",unit:"Взвод РХБ захисту"},
  {name:"БУГАЙ Сергій Володимирович",rank:"солдат",unit:"Взвод РХБ захисту"},
];

export default function BriefingPage() {
  const { id } = useParams<{ id: string }>();
  const briefingId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Personnel state
  const [showAdd, setShowAdd] = useState(false);
  const [editPerson, setEditPerson] = useState<PersonnelWithStatus | null>(null);
  const [pName, setPName] = useState("");
  const [pRank, setPRank] = useState("Рядовий");
  const [pUnit, setPUnit] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Question state
  const [showAddQ, setShowAddQ] = useState(false);
  const [editQ, setEditQ] = useState<QuestionWithParsed | null>(null);
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState<"single"|"multiple">("single");
  const [qOptions, setQOptions] = useState([{id:"a",text:""},{id:"b",text:""},{id:"c",text:""},{id:"d",text:""}]);
  const [qCorrect, setQCorrect] = useState<string[]>([]);

  const { data: briefing } = useQuery<Briefing>({
    queryKey: ["/api/briefings", briefingId],
    queryFn: () => apiRequest("GET", `/api/briefings/${briefingId}`).then(r => r.json()),
  });

  const { data: personnel = [], isLoading: loadingP } = useQuery<PersonnelWithStatus[]>({
    queryKey: ["/api/briefings", briefingId, "personnel", "tokens"],
    queryFn: () => apiRequest("GET", `/api/briefings/${briefingId}/personnel/tokens`).then(r => r.json()),
    refetchInterval: 15000,
  });

  const { data: questionsRaw = [] } = useQuery<QuestionWithParsed[]>({
    queryKey: ["/api/briefings", briefingId, "questions", "admin"],
    queryFn: () => apiRequest("GET", `/api/briefings/${briefingId}/questions/admin`).then(r => r.json()),
  });

  const { data: results = [] } = useQuery<(TestResult & {personnelName:string;personnelRank:string})[]>({
    queryKey: ["/api/briefings", briefingId, "results"],
    queryFn: () => apiRequest("GET", `/api/briefings/${briefingId}/results`).then(r => r.json()),
    refetchInterval: 15000,
  });

  // Personnel mutations
  const addPersonMutation = useMutation({
    mutationFn: (d: any) => apiRequest("POST", `/api/briefings/${briefingId}/personnel`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/briefings", briefingId, "personnel", "tokens"] }); queryClient.invalidateQueries({ queryKey: ["/api/briefings"] }); setShowAdd(false); toast({ title: "Додано" }); },
  });

  const editPersonMutation = useMutation({
    mutationFn: ({ id, d }: any) => apiRequest("PATCH", `/api/personnel/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/briefings", briefingId, "personnel", "tokens"] }); setEditPerson(null); toast({ title: "Оновлено" }); },
  });

  const deletePersonMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/personnel/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/briefings", briefingId, "personnel", "tokens"] }); queryClient.invalidateQueries({ queryKey: ["/api/briefings"] }); },
  });

  const bulkImportMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/briefings/${briefingId}/personnel/bulk`, PRESET_PERSONNEL),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/briefings", briefingId, "personnel", "tokens"] }); queryClient.invalidateQueries({ queryKey: ["/api/briefings"] }); toast({ title: "Імпортовано", description: `${PRESET_PERSONNEL.length} осіб додано` }); },
  });

  // Question mutations
  const addQMutation = useMutation({
    mutationFn: (d: any) => apiRequest("POST", `/api/briefings/${briefingId}/questions`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/briefings", briefingId, "questions", "admin"] }); setShowAddQ(false); resetQForm(); toast({ title: "Питання додано" }); },
  });

  const editQMutation = useMutation({
    mutationFn: ({ id, d }: any) => apiRequest("PATCH", `/api/questions/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/briefings", briefingId, "questions", "admin"] }); setEditQ(null); resetQForm(); toast({ title: "Оновлено" }); },
  });

  const deleteQMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/questions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/briefings", briefingId, "questions", "admin"] }),
  });

  const resetQForm = () => { setQText(""); setQType("single"); setQOptions([{id:"a",text:""},{id:"b",text:""},{id:"c",text:""},{id:"d",text:""}]); setQCorrect([]); };

  const openEditQ = (q: QuestionWithParsed) => {
    setEditQ(q); setQText(q.text); setQType(q.type as "single"|"multiple");
    setQOptions(q.parsedOptions.length ? q.parsedOptions : [{id:"a",text:""},{id:"b",text:""},{id:"c",text:""},{id:"d",text:""}]);
    setQCorrect(q.parsedCorrect);
  };

  const saveQuestion = () => {
    const filledOptions = qOptions.filter(o => o.text.trim());
    if (!qText.trim() || filledOptions.length < 2) { toast({ title: "Заповніть питання і мінімум 2 варіанти", variant: "destructive" }); return; }
    if (qCorrect.length === 0) { toast({ title: "Оберіть правильну відповідь", variant: "destructive" }); return; }
    const payload = { text: qText, type: qType, options: JSON.stringify(filledOptions), correctOptions: JSON.stringify(qCorrect) };
    if (editQ) { editQMutation.mutate({ id: editQ.id, d: payload }); }
    else { addQMutation.mutate(payload); }
  };

  const toggleCorrect = (optId: string) => {
    if (qType === "single") { setQCorrect([optId]); }
    else { setQCorrect(prev => prev.includes(optId) ? prev.filter(x => x !== optId) : [...prev, optId]); }
  };

  const copyLink = (p: PersonnelWithStatus) => {
    const token = (p as any).accessToken || "";
    const link = `${window.location.origin}${window.location.pathname}#/read/${briefingId}/${p.id}/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Посилання скопійовано", description: `Відправте ${p.name} у Signal` });
  };

  const printReport = () => {
    const passed = personnel.filter(p => p.testPassed);
    const failed = personnel.filter(p => p.acknowledged && !p.testPassed);
    const pending = personnel.filter(p => !p.acknowledged);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Звіт: ${briefing?.title}</title>
      <style>body{font-family:Arial,sans-serif;margin:40px;font-size:13px}
      h1{font-size:18px;margin-bottom:4px}
      .meta{color:#666;font-size:12px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}
      th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}
      th{background:#f0f0f0;font-weight:600}
      .pass{color:#16a34a;font-weight:600}.fail{color:#dc2626;font-weight:600}.pend{color:#d97706}
      .footer{margin-top:40px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between}
      .sig{width:200px;border-bottom:1px solid #000;margin-top:32px;margin-bottom:4px}
      </style></head><body>
      <h1>${briefing?.title}</h1>
      <div class="meta">Дата: ${new Date().toLocaleDateString("uk-UA",{day:"numeric",month:"long",year:"numeric"})} · Прохідний бал: ${briefing?.passingScore}% · Всього: ${personnel.length} осіб</div>
      <table><thead><tr><th>№</th><th>Звання, ПІБ</th><th>Підрозділ</th><th>Балів</th><th>Статус</th><th>Дата</th></tr></thead><tbody>
      ${personnel.map((p,i)=>`<tr>
        <td>${i+1}</td>
        <td>${p.rank} ${p.name}</td>
        <td>${p.unit||"—"}</td>
        <td>${p.testScore !== undefined ? p.testScore+"%" : "—"}</td>
        <td class="${p.testPassed?"pass":p.acknowledged?"fail":"pend"}">${p.testPassed?"✓ Пройшов":p.acknowledged?"✗ Не пройшов":"Очікується"}</td>
        <td>${p.acknowledgedAt?new Date(p.acknowledgedAt).toLocaleDateString("uk-UA"):"—"}</td>
      </tr>`).join("")}
      </tbody></table>
      <div class="footer">
        <div><div>Командир підрозділу:</div><div class="sig"></div><div style="font-size:11px">підпис / дата</div></div>
        <div style="text-align:right"><div>Пройшли: <b class="pass">${passed.length}</b></div><div>Не пройшли: <b class="fail">${failed.length}</b></div><div>Очікується: <b class="pend">${pending.length}</b></div></div>
      </div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const done = personnel.filter(p => p.testPassed).length;
  const attempted = personnel.filter(p => p.acknowledged).length;
  const total = personnel.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Назад
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate">{briefing?.title}</h1>
            <p className="text-xs text-muted-foreground">{questionsRaw.length} питань · прохідний бал {briefing?.passingScore}%</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={printReport}>
            <Printer className="w-3.5 h-3.5" /> Друк
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Пройшли тест</span>
              <span className="text-sm font-mono text-muted-foreground">{done} / {total}</span>
            </div>
            <Progress value={pct} className="h-2" />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="text-green-600 dark:text-green-400 font-medium">✓ Пройшли: {done}</span>
              <span className="text-red-500 font-medium">✗ Не пройшли: {attempted - done}</span>
              <span className="text-orange-500">⏳ Очікується: {total - attempted}</span>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="personnel">
          <TabsList className="mb-4">
            <TabsTrigger value="personnel" className="gap-1.5"><UserPlus className="w-3.5 h-3.5" />Особовий склад ({total})</TabsTrigger>
            <TabsTrigger value="questions" className="gap-1.5"><HelpCircle className="w-3.5 h-3.5" />Питання ({questionsRaw.length})</TabsTrigger>
            <TabsTrigger value="results" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Результати ({results.length})</TabsTrigger>
          </TabsList>

          {/* PERSONNEL TAB */}
          <TabsContent value="personnel">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Список особового складу</CardTitle>
                <div className="flex gap-2">
                  {total === 0 && (
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => bulkImportMutation.mutate()} disabled={bulkImportMutation.isPending}>
                      <Download className="w-3.5 h-3.5" /> Завантажити зі списку (21)
                    </Button>
                  )}
                  <Button size="sm" className="gap-1" onClick={() => { setShowAdd(true); setPName(""); setPRank("Рядовий"); setPUnit(""); }}>
                    <UserPlus className="w-3.5 h-3.5" /> Додати
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {loadingP ? [1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />) :
                personnel.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Додайте особовий склад</div>
                ) : personnel.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${p.testPassed ? "bg-green-500" : p.acknowledged ? "bg-red-400" : "bg-orange-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.rank} {p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.testPassed ? <span className="text-green-600 dark:text-green-400">✓ Пройшов — {p.testScore}%{p.testAttempts && p.testAttempts > 1 ? ` (спроб: ${p.testAttempts})` : ""}</span>
                        : p.acknowledged ? <span className="text-red-500">✗ Не пройшов — {p.testScore}%{p.testAttempts && p.testAttempts > 1 ? ` (спроб: ${p.testAttempts})` : ""}</span>
                        : <span className="text-orange-500">⏳ Очікується</span>}
                      </p>
                    </div>
                    {p.unit && <span className="text-xs text-muted-foreground hidden sm:block shrink-0">{p.unit}</span>}
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyLink(p)} title="Скопіювати посилання">
                        {copiedId === p.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditPerson(p); setPName(p.name); setPRank(p.rank||"Рядовий"); setPUnit(p.unit||""); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deletePersonMutation.mutate(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* QUESTIONS TAB */}
          <TabsContent value="questions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Питання тесту</CardTitle>
                <Button size="sm" className="gap-1" onClick={() => { setShowAddQ(true); resetQForm(); }}>
                  <Plus className="w-3.5 h-3.5" /> Додати питання
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {questionsRaw.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Додайте питання для тесту
                  </div>
                ) : questionsRaw.map((q, idx) => (
                  <div key={q.id} className="border border-border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{idx+1}. {q.text}</p>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs">{q.type === "single" ? "1 відповідь" : "кілька"}</Badge>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditQ(q)}><Edit2 className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteQMutation.mutate(q.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {q.parsedOptions.map(opt => (
                        <div key={opt.id} className={`text-xs px-2 py-1 rounded ${q.parsedCorrect.includes(opt.id) ? "bg-green-500/15 text-green-700 dark:text-green-400 font-medium" : "bg-muted text-muted-foreground"}`}>
                          {q.parsedCorrect.includes(opt.id) ? "✓ " : ""}{opt.text}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RESULTS TAB */}
          <TabsContent value="results">
            <Card>
              <CardHeader><CardTitle className="text-base">Результати тестування</CardTitle></CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Ще немає результатів</div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Best result per person */}
                    {(() => {
                      const byPerson = new Map<number, typeof results[0]>();
                      results.forEach(r => {
                        const existing = byPerson.get(r.personnelId);
                        if (!existing || r.score > existing.score) byPerson.set(r.personnelId, r);
                      });
                      return [...byPerson.values()].sort((a,b) => b.score - a.score).map(r => (
                        <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${r.passed ? "bg-green-500" : "bg-red-400"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.personnelRank} {r.personnelName}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(r.completedAt).toLocaleString("uk-UA",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                              {" · "}{r.correctCount}/{r.totalCount} правильних · спроба {r.attemptNumber}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-lg font-bold ${r.passed ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{r.score}%</p>
                            <p className={`text-xs ${r.passed ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{r.passed ? "Пройшов" : "Не пройшов"}</p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Person Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Додати до списку</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><label className="text-sm font-medium">ПІБ *</label><Input value={pName} onChange={e=>setPName(e.target.value)} placeholder="Іваненко Іван Іванович" /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Звання</label>
              <Select value={pRank} onValueChange={setPRank}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RANKS.map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Підрозділ</label><Input value={pUnit} onChange={e=>setPUnit(e.target.value)} placeholder="1-й взвод..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowAdd(false)}>Скасувати</Button>
            <Button onClick={()=>{ if(!pName.trim()){toast({title:"Введіть ПІБ",variant:"destructive"});return;} addPersonMutation.mutate({name:pName,rank:pRank,unit:pUnit}); }} disabled={addPersonMutation.isPending}>Додати</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Person Dialog */}
      <Dialog open={!!editPerson} onOpenChange={v=>{if(!v)setEditPerson(null);}}>
        <DialogContent>
          <DialogHeader><DialogTitle>Редагувати</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><label className="text-sm font-medium">ПІБ</label><Input value={pName} onChange={e=>setPName(e.target.value)} /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Звання</label>
              <Select value={pRank} onValueChange={setPRank}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RANKS.map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Підрозділ</label><Input value={pUnit} onChange={e=>setPUnit(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setEditPerson(null)}>Скасувати</Button>
            <Button onClick={()=>editPersonMutation.mutate({id:editPerson!.id,d:{name:pName,rank:pRank,unit:pUnit}})} disabled={editPersonMutation.isPending}>Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Question Dialog */}
      <Dialog open={showAddQ || !!editQ} onOpenChange={v=>{if(!v){setShowAddQ(false);setEditQ(null);resetQForm();}}}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editQ ? "Редагувати питання" : "Нове питання"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Текст питання</label>
              <Textarea value={qText} onChange={e=>setQText(e.target.value)} placeholder="Введіть питання..." rows={3} className="resize-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Тип відповіді</label>
              <Select value={qType} onValueChange={v=>{ setQType(v as any); setQCorrect([]); }}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Одна правильна відповідь</SelectItem>
                  <SelectItem value="multiple">Кілька правильних відповідей</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Варіанти відповідей <span className="text-muted-foreground font-normal">(натисніть щоб позначити правильну)</span></label>
              {qOptions.map((opt, i) => (
                <div key={opt.id} className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={()=>toggleCorrect(opt.id)}
                    className={`w-6 h-6 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${qCorrect.includes(opt.id) ? "bg-green-500 border-green-500 text-white" : "border-border"}`}
                  >
                    {qCorrect.includes(opt.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                  <Input value={opt.text} onChange={e=>{ const n=[...qOptions]; n[i]={...n[i],text:e.target.value}; setQOptions(n); }} placeholder={`Варіант ${opt.id.toUpperCase()}`} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>{setShowAddQ(false);setEditQ(null);resetQForm();}}>Скасувати</Button>
            <Button onClick={saveQuestion} disabled={addQMutation.isPending||editQMutation.isPending}>
              {editQ ? "Зберегти" : "Додати питання"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
