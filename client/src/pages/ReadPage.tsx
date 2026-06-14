import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Briefing, QuestionWithParsed } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, BookOpen, AlertCircle, Loader2, ChevronRight, ChevronLeft, ClipboardList } from "lucide-react";

type PersonnelPublic = { id: number; name: string; rank: string; unit: string; acknowledged: boolean; testPassed?: boolean; testScore?: number; testAttempts?: number };

type Phase = "briefing" | "test" | "result";

export default function ReadPage() {
  const { briefingId, personnelId, token } = useParams<{ briefingId: string; personnelId: string; token: string }>();
  const bId = parseInt(briefingId);
  const pId = parseInt(personnelId);

  const [phase, setPhase] = useState<Phase>("briefing");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [submitResult, setSubmitResult] = useState<{ score: number; correct: number; total: number; passed: boolean; passingScore: number } | null>(null);

  const { data: briefing, isLoading: loadingB } = useQuery<Briefing>({
    queryKey: ["/api/briefings", bId],
    queryFn: () => apiRequest("GET", `/api/briefings/${bId}`).then(r => r.json()),
  });

  const { data: personnelList, isLoading: loadingP } = useQuery<PersonnelPublic[]>({
    queryKey: ["/api/briefings", bId, "personnel"],
    queryFn: () => apiRequest("GET", `/api/briefings/${bId}/personnel`).then(r => r.json()),
  });

  const { data: questionsRaw = [], isLoading: loadingQ } = useQuery<QuestionWithParsed[]>({
    queryKey: ["/api/briefings", bId, "questions"],
    queryFn: () => apiRequest("GET", `/api/briefings/${bId}/questions`).then(r => r.json()),
    enabled: phase === "test" || phase === "briefing",
  });

  const person = personnelList?.find(p => p.id === pId);

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/briefings/${bId}/submit`, {
      personnelId: pId,
      accessToken: token,
      answers: Object.entries(answers).map(([qId, opts]) => ({ questionId: parseInt(qId), selectedOptions: opts })),
    }),
    onSuccess: async (res) => {
      const data = await res.json();
      setSubmitResult(data);
      setPhase("result");
    },
  });

  const toggleAnswer = (questionId: number, optionId: string, type: string) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      if (type === "single") return { ...prev, [questionId]: [optionId] };
      const has = current.includes(optionId);
      return { ...prev, [questionId]: has ? current.filter(x => x !== optionId) : [...current, optionId] };
    });
  };

  const isLoading = loadingB || loadingP || loadingQ;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!briefing || !person) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h1 className="text-lg font-bold">Посилання недійсне</h1>
        <p className="text-muted-foreground text-sm text-center">Зверніться до командира для отримання правильного посилання</p>
      </div>
    );
  }

  // ── PHASE: BRIEFING ──
  if (phase === "briefing") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Інструктаж</p>
              <p className="text-sm font-semibold truncate">{person.rank} {person.name}</p>
            </div>
            <div className="shrink-0 text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
              {questionsRaw.length} питань
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold">{briefing.title}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(briefing.createdAt).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })}
              {" · "}Прохідний бал: {briefing.passingScore}%
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {briefing.content}
          </div>

          {person.testPassed ? (
            <div className="border border-green-500/30 bg-green-500/10 rounded-xl p-5 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">Тест вже пройдено</p>
                <p className="text-sm text-muted-foreground">Ваш результат: {person.testScore}%</p>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-xl p-5 space-y-4 bg-card">
              <div className="flex items-start gap-3">
                <ClipboardList className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Після читання пройдіть тест</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {questionsRaw.length} питань · прохідний бал {briefing.passingScore}%
                    {person.testAttempts && person.testAttempts > 0 ? ` · Спроб: ${person.testAttempts}` : ""}
                  </p>
                </div>
              </div>
              {person.acknowledged && !person.testPassed && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  Попередній результат: {person.testScore}% — нижче прохідного балу. Перечитайте і спробуйте ще раз.
                </div>
              )}
              <Button className="w-full gap-2" size="lg" onClick={() => setPhase("test")} disabled={questionsRaw.length === 0}>
                {questionsRaw.length === 0 ? "Питання ще не додані" : "Перейти до тесту"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ── PHASE: TEST ──
  if (phase === "test") {
    const q = questionsRaw[currentQ];
    const selectedForQ = answers[q?.id] || [];
    const answered = Object.keys(answers).length;
    const progressPct = Math.round((answered / questionsRaw.length) * 100);

    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Питання {currentQ + 1} з {questionsRaw.length}</p>
              <p className="text-xs text-muted-foreground">{answered} відповідей дано</p>
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          {q ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {q.type === "multiple" ? "Оберіть всі правильні відповіді" : "Оберіть одну правильну відповідь"}
                </p>
                <h2 className="text-base font-semibold leading-snug">{q.text}</h2>
              </div>

              <div className="space-y-2.5">
                {q.parsedOptions?.map((opt) => {
                  const selected = selectedForQ.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      data-testid={`option-${opt.id}`}
                      onClick={() => toggleAnswer(q.id, opt.id, q.type)}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all text-sm ${
                        selected
                          ? "border-primary bg-primary/10 text-foreground font-medium"
                          : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <span className={`inline-block w-5 h-5 rounded-${q.type === "single" ? "full" : "md"} border-2 mr-3 align-middle transition-colors ${selected ? "bg-primary border-primary" : "border-muted-foreground/40"}`} />
                      {opt.text}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setCurrentQ(c => Math.max(0, c - 1))} disabled={currentQ === 0} className="gap-1">
                  <ChevronLeft className="w-4 h-4" /> Назад
                </Button>
                {currentQ < questionsRaw.length - 1 ? (
                  <Button onClick={() => setCurrentQ(c => c + 1)} className="gap-1">
                    Далі <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending || answered < questionsRaw.length}
                    className="gap-1 bg-green-600 hover:bg-green-700"
                  >
                    {submitMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Надсилання...</> : <>Завершити тест <CheckCircle2 className="w-4 h-4" /></>}
                  </Button>
                )}
              </div>
              {currentQ === questionsRaw.length - 1 && answered < questionsRaw.length && (
                <p className="text-xs text-center text-orange-500">Дайте відповідь на всі питання щоб завершити</p>
              )}
            </div>
          ) : null}
        </main>
      </div>
    );
  }

  // ── PHASE: RESULT ──
  if (phase === "result" && submitResult) {
    const { score, correct, total, passed, passingScore } = submitResult;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center ${passed ? "bg-green-500/15" : "bg-red-500/15"}`}>
            {passed
              ? <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
              : <AlertCircle className="w-12 h-12 text-red-500" />
            }
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{score}%</h1>
            <p className={`text-lg font-semibold ${passed ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {passed ? "Тест пройдено!" : "Тест не пройдено"}
            </p>
            <p className="text-sm text-muted-foreground">
              {correct} правильних з {total} питань
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-2 text-sm text-left">
            <div className="flex justify-between"><span className="text-muted-foreground">Ваш результат:</span><span className="font-semibold">{score}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Прохідний бал:</span><span className="font-semibold">{passingScore}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ім'я:</span><span className="font-medium text-right">{person.rank} {person.name}</span></div>
          </div>

          {!passed && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Перечитайте інструктаж і спробуйте ще раз</p>
              <Button className="w-full" variant="outline" onClick={() => {
                setPhase("briefing");
                setAnswers({});
                setCurrentQ(0);
                setSubmitResult(null);
              }}>
                Повернутись до інструктажу
              </Button>
            </div>
          )}

          {passed && (
            <p className="text-sm text-muted-foreground">Ваш результат зафіксовано. Дякуємо.</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
