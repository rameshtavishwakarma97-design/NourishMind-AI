import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot
} from "recharts";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { X, Loader2, Bell } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { useHydration } from "@/hooks/useHydration";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useMoodLog } from "@/hooks/useMoodLog";
import { useGutSymptomLog } from "@/hooks/useGutSymptomLog";
import { useReminders, RepeatType } from "@/hooks/useReminders";
import { useFoodLog } from "@/hooks/useFoodLog";

const mealTypeIcons: Record<string, string> = {
  breakfast: "🌅", lunch: "☀️", dinner: "🌙", snacks: "🌤", other: "🍽️",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { todayLog, wellnessScore, loading: dashLoading, calorieTarget: profileCalorieTarget } = useDashboard();
  const { totalMl, glassesCount, target: waterTargetMl, progressPercent: waterPctRaw, addWater, loading: hydLoading } = useHydration();
  const { profile } = useUserProfile();
  const isFemale = profile?.biological_sex === "female" || profile?.biological_sex === "Female";
  const [showCycleBanner, setShowCycleBanner] = useState(true);
  const [showWaterPopover, setShowWaterPopover] = useState(false);
  const { todayMood: selectedMood, feedback: moodFeedback, logMood } = useMoodLog();
  const { todayScore: gutScore, lastLogged: gutLastLogged, feedback: gutFeedback, logGutScore } = useGutSymptomLog();
  const { addReminder } = useReminders();

  // Get today's meals for dynamic contributions and blood sugar simulation
  const todayStr = new Date().toISOString().split('T')[0];
  const { meals: todayMeals } = useFoodLog(todayStr);

  const mealContributions = useMemo(() => {
    if (todayMeals.length === 0) return [];
    return todayMeals.map(m => ({
      icon: mealTypeIcons[m.meal_type] || "🍽️",
      label: m.meal_type.charAt(0).toUpperCase() + m.meal_type.slice(1),
      kcal: Math.round(m.total_calories || 0),
    }));
  }, [todayMeals]);

  // Generate blood sugar simulation from actual meal times
  const bloodSugarData = useMemo(() => {
    const hours = ['6AM', '7AM', '8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM', '8PM', '9PM', '10PM'];
    const baseline = 20;
    const mealHours = todayMeals.map(m => {
      const d = new Date(m.logged_at);
      return { hour: d.getHours(), kcal: m.total_calories || 0 };
    });
    return hours.map(label => {
      const hourNum = parseInt(label) + (label.includes('PM') && !label.startsWith('12') ? 12 : 0);
      const adjustedHour = label === '12PM' ? 12 : hourNum;
      let level = baseline;
      for (const meal of mealHours) {
        const diff = adjustedHour - meal.hour;
        if (diff >= 0 && diff <= 3) {
          const spike = Math.min((meal.kcal / 15), 70);
          const decay = diff === 0 ? 0.7 : diff === 1 ? 1.0 : diff === 2 ? 0.6 : 0.2;
          level += spike * decay;
        }
      }
      return { time: label, level: Math.round(level) };
    });
  }, [todayMeals]);

  // Reminder modal state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState("");
  const [reminderTime, setReminderTime] = useState("08:00");
  const [reminderRepeat, setReminderRepeat] = useState<RepeatType>("once");
  const [reminderSaving, setReminderSaving] = useState(false);

  const handleOpenReminder = () => {
    // Pre-fill with tomorrow's priorities
    setReminderText("Add eggs for B12 · Morning sunlight · Sleep by 11PM");
    setReminderTime("08:00");
    setReminderRepeat("once");
    setShowReminderModal(true);
  };

  const handleSaveReminder = async () => {
    if (!reminderText.trim()) return;
    setReminderSaving(true);
    const result = await addReminder(reminderText.trim(), reminderTime, reminderRepeat);
    setReminderSaving(false);
    if (result) {
      setShowReminderModal(false);
      const displayTime = new Date(`2000-01-01T${reminderTime}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      toast({ title: `Reminder set for ${displayTime} tomorrow ✅` });
    } else {
      toast({ title: "Failed to save reminder", variant: "destructive" });
    }
  };

  // Use real data if available, fallback to 0
  const totalCalories = todayLog?.total_calories ?? 0;
  const calorieTarget = profileCalorieTarget;
  const proteinG = todayLog?.total_protein_g ?? 0;
  const carbsG = todayLog?.total_carbs_g ?? 0;
  const fatG = todayLog?.total_fat_g ?? 0;
  const wellnessOverall = wellnessScore?.overall ?? 78;
  const userName = profile?.full_name?.split(' ')[0] ?? 'Rameshta';

  const waterLiters = +(totalMl / 1000).toFixed(2);
  const waterTarget = +(waterTargetMl / 1000).toFixed(1);
  const waterPct = waterPctRaw;
  const waterGlasses = glassesCount;

  const logWater = async (ml: number) => {
    await addWater(ml);
    setShowWaterPopover(false);
    toast({ title: `💧 ${ml}ml logged · ${((totalMl + ml) / 1000).toFixed(1)}L today` });
  };

  const macroData = [
    { name: "Protein", value: proteinG, color: "hsl(147, 35%, 49%)" },
    { name: "Carbs", value: carbsG, color: "hsl(36, 78%, 56%)" },
    { name: "Fat", value: fatG, color: "hsl(214, 56%, 57%)" },
  ];

  // Micronutrient RDAs (general adult male/female average for visualization)
  const rda = {
    iron: 18,        // mg
    calcium: 1000,   // mg
    magnesium: 400,  // mg
    potassium: 3400, // mg
    sodium: 2300,    // mg (upper limit typically, but using as target here for simplicity)
    vitaminD: 15,    // mcg
    zinc: 11,        // mg
    folate: 400,     // mcg
    vitaminB12: 2.4, // mcg
  };

  const calcPct = (val?: number, target: number = 1) => Math.min(100, Math.round(((val || 0) / target) * 100));
  const getDStatus = (pct: number) => pct >= 80 ? "✅" : pct >= 50 ? "🟡" : "🔴";

  const microNutrients = [
    { name: "Iron", pct: calcPct(todayMeals.reduce((acc, m) => acc + (m.meal_ingredients?.reduce((s, i) => s + (i.iron_mg || 0), 0) || 0), 0), rda.iron), get status() { return getDStatus(this.pct); } },
    { name: "Calcium", pct: calcPct(todayMeals.reduce((acc, m) => acc + (m.meal_ingredients?.reduce((s, i) => s + (i.calcium_mg || 0), 0) || 0), 0), rda.calcium), get status() { return getDStatus(this.pct); } },
    { name: "Magnesium", pct: calcPct(todayMeals.reduce((acc, m) => acc + (m.meal_ingredients?.reduce((s, i) => s + (i.magnesium_mg || 0), 0) || 0), 0), rda.magnesium), get status() { return getDStatus(this.pct); } },
    { name: "Potassium", pct: calcPct(todayMeals.reduce((acc, m) => acc + (m.meal_ingredients?.reduce((s, i) => s + (i.potassium_mg || 0), 0) || 0), 0), rda.potassium), get status() { return getDStatus(this.pct); } },
    { name: "Sodium", pct: calcPct(todayMeals.reduce((acc, m) => acc + (m.meal_ingredients?.reduce((s, i) => s + (i.sodium_mg || 0), 0) || 0), 0), rda.sodium), get status() { return getDStatus(this.pct); } },
    { name: "B12", pct: calcPct(todayMeals.reduce((acc, m) => acc + (m.meal_ingredients?.reduce((s, i) => s + (i.vitamin_b12_mcg || 0), 0) || 0), 0), rda.vitaminB12), get status() { return getDStatus(this.pct); } },
    { name: "Vitamin D", pct: calcPct(todayMeals.reduce((acc, m) => acc + (m.meal_ingredients?.reduce((s, i) => s + (i.vitamin_d_mcg || 0), 0) || 0), 0), rda.vitaminD), get status() { return getDStatus(this.pct); } },
    { name: "Zinc", pct: calcPct(todayMeals.reduce((acc, m) => acc + (m.meal_ingredients?.reduce((s, i) => s + (i.zinc_mg || 0), 0) || 0), 0), rda.zinc), get status() { return getDStatus(this.pct); } },
    { name: "Folate", pct: calcPct(todayMeals.reduce((acc, m) => acc + (m.meal_ingredients?.reduce((s, i) => s + (i.folate_mcg || 0), 0) || 0), 0), rda.folate), get status() { return getDStatus(this.pct); } },
    { name: "Water", pct: waterPct, status: waterPct >= 80 ? "✅" : waterPct >= 50 ? "🟡" : "🔴" },
  ];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    if (h >= 17 && h < 21) return "Good evening";
    return "Good night";
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      {/* Hero Card */}
      <motion.div
        className="rounded-2xl p-5 md:p-8 flex flex-col md:flex-row items-center md:justify-between gap-4"
        style={{ background: "linear-gradient(135deg, #1A3C2E, #2D6B4F)" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="space-y-2 text-center md:text-left w-full md:w-auto">
          <h1 className="font-serif text-[22px] md:text-2xl lg:text-3xl font-bold text-white">{getGreeting()}, {userName} ✨</h1>
          <p className="text-white/80 font-sans text-sm">You've eaten {totalCalories.toLocaleString()} of {calorieTarget.toLocaleString()} kcal today</p>
        </div>
        {/* Wellness ring — below greeting on mobile, beside on desktop */}
        <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="6"
              strokeDasharray={`${(wellnessOverall / 100) * 263.9} 263.9`} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xl md:text-2xl font-mono font-bold text-white">{wellnessOverall}</span>
        </div>
        {/* Progress bar — full width below ring on mobile */}
        <div className="w-full md:hidden">
          <div className="w-full h-2 bg-white/20 rounded-pill">
            <div className="h-full bg-white rounded-pill" style={{ width: `${wellnessOverall}%` }} />
          </div>
        </div>
        <div className="hidden md:block w-64 h-2 bg-white/20 rounded-pill">
          <div className="h-full bg-white rounded-pill" style={{ width: `${wellnessOverall}%` }} />
        </div>
      </motion.div>

      {/* IBS-Cycle Overlap Banner — only for female users */}
      <AnimatePresence>
        {isFemale && showCycleBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl px-6 py-4 flex items-center gap-4"
            style={{ background: "#F3E5F5" }}
          >
            <span className="text-xl">🌸</span>
            <p className="flex-1 text-sm font-sans text-foreground">
              You're in your <span className="font-semibold">Luteal Phase (Day 22)</span> — IBS symptoms are typically 2.4× higher this week. FODMAP recommendations tightened.
            </p>
            <button className="text-xs text-secondary font-sans font-medium hover:underline shrink-0">Learn more</button>
            <button onClick={() => setShowCycleBanner(false)} className="text-muted-foreground hover:text-foreground p-1 shrink-0"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Row 1 — single col mobile, 2-col tablet, 3-col desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {/* Calorie Ring + Meal Pills */}
        <div className="bg-card rounded-2xl md:rounded-2xl border border-border p-4 md:p-6 flex flex-col items-center">
          <h3 className="font-serif text-sm font-semibold text-foreground mb-4">Calories</h3>
          <div className="relative w-[140px] h-[140px] md:w-[160px] md:h-[160px]">
            <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
              <circle cx="80" cy="80" r="68" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
              <circle cx="80" cy="80" r="68" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8"
                strokeDasharray={`${(Math.min(totalCalories / calorieTarget, 1)) * 427.3} 427.3`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-mono font-bold text-foreground">{totalCalories.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground font-sans">kcal</span>
            </div>
          </div>
          <div className="flex gap-4 mt-4 text-xs font-mono text-muted-foreground">
            <span>P {proteinG}g</span><span>C {carbsG}g</span><span>F {fatG}g</span>
          </div>
          {/* Meal contribution pills */}
          <div className="flex gap-2 mt-3 flex-wrap justify-center">
            {mealContributions.map((m) => (
              <button
                key={m.label}
                onClick={() => navigate("/app/chat")}
                className="bg-muted rounded-pill px-3 py-1 text-[10px] font-sans text-foreground hover:bg-accent transition-colors"
              >
                {m.icon} {m.label} {m.kcal} kcal
              </button>
            ))}
          </div>
        </div>

        {/* Macro Donut */}
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
          <h3 className="font-serif text-sm font-semibold text-foreground mb-4">Macro Split</h3>
          <div className="h-[140px] md:h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={macroData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {macroData.map((m, i) => <Cell key={i} fill={m.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {macroData.map((m) => (
              <div key={m.name} className="flex items-center gap-1.5 text-xs font-sans">
                <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                <span className="text-muted-foreground">{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Meal Timing + Fasting Window */}
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6 md:col-span-2 lg:col-span-1 overflow-x-auto">
          <h3 className="font-serif text-sm font-semibold text-foreground mb-4">Meal Timing</h3>
          {/* 24h timeline */}
          <div className="relative h-8 mb-3">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-muted rounded-pill" />
            {/* Fasting zone: 9PM (87.5%) to 8:42AM (~36%) wraps around — show as green overlay */}
            <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded-l-pill" style={{ left: "0%", width: "36%", background: "rgba(61,153,112,0.25)" }} />
            <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded-r-pill" style={{ left: "87.5%", width: "12.5%", background: "rgba(61,153,112,0.25)" }} />
            {/* Time markers */}
            <div className="absolute bottom-0 left-0 text-[8px] text-muted-foreground font-sans">12AM</div>
            <div className="absolute bottom-0 left-1/4 text-[8px] text-muted-foreground font-sans">6AM</div>
            <div className="absolute bottom-0 left-1/2 text-[8px] text-muted-foreground font-sans">12PM</div>
            <div className="absolute bottom-0 left-3/4 text-[8px] text-muted-foreground font-sans">6PM</div>
            <div className="absolute bottom-0 right-0 text-[8px] text-muted-foreground font-sans">12AM</div>
          </div>
          {/* Fasting label */}
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-success/20 text-success rounded-pill px-2.5 py-0.5 text-[10px] font-semibold font-sans">11.7 hr fast ✅</span>
            <span className="text-[10px] text-muted-foreground font-sans">Goal: 12 hours · 18 mins short</span>
          </div>
          {/* Meal dots */}
          <div className="relative h-[80px] flex items-end">
            <div className="absolute bottom-8 left-0 right-0 h-px bg-border" />
            {[
              { time: "8:42 AM", label: "Breakfast", left: "20%", kcal: 697 },
              { time: "1:15 PM", label: "Lunch", left: "50%", kcal: 480 },
              { time: "4:30 PM", label: "Snack", left: "72%", kcal: 243 },
            ].map((meal) => (
              <div key={meal.time} className="absolute bottom-4 flex flex-col items-center" style={{ left: meal.left }}>
                <span className="text-[8px] text-muted-foreground font-sans mb-0.5">{meal.label}</span>
                <span className="text-[8px] font-mono text-muted-foreground mb-0.5">{meal.kcal} kcal</span>
                <div className="w-3 h-3 rounded-full bg-secondary" />
                <span className="text-[8px] text-muted-foreground font-sans mt-0.5">{meal.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Micros + Blood Sugar — stack on mobile, 2-col tablet+desktop */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-6">
        {/* Micronutrient Tracker */}
        <div className="md:col-span-3 bg-card rounded-2xl border border-border p-4 md:p-6">
          <h3 className="font-serif text-sm font-semibold text-foreground mb-4">Micronutrients Today</h3>
          <div className="space-y-2.5">
            {microNutrients.map((m) => (
              <div key={m.name} className="flex items-center gap-3">
                <span className="w-20 text-xs font-sans text-foreground">{m.name}</span>
                <div className="flex-1 h-2 bg-muted rounded-pill overflow-hidden">
                  <div className="h-full rounded-pill transition-all" style={{
                    width: `${m.pct}%`,
                    background: m.pct >= 80 ? "hsl(var(--success))" : m.pct >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))",
                  }} />
                </div>
                <span className="text-xs font-mono w-10 text-right text-muted-foreground">{m.pct}%</span>
                <span className="text-xs">{m.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Blood Sugar with Peak Labels */}
        <div className="md:col-span-2 bg-card rounded-2xl border border-border p-4 md:p-6">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-serif text-sm font-semibold text-foreground">Blood Sugar Simulation</h3>
            <span className="text-[9px] text-muted-foreground font-sans italic">Simulated — not medical advice</span>
          </div>
          <div className="h-[220px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bloodSugarData}>
                <defs>
                  <linearGradient id="bsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(147, 35%, 49%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(147, 35%, 49%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={30} />
                <Tooltip />
                <Area type="monotone" dataKey="level" stroke="hsl(147, 35%, 49%)" fill="url(#bsGrad)" strokeWidth={2} />
                {/* Peak labels */}
                <ReferenceDot x="9AM" y={72} r={0}>
                  <label value="Breakfast 9:15AM" position="top" fontSize={8} fill="hsl(var(--muted-foreground))" />
                </ReferenceDot>
                <ReferenceDot x="2PM" y={80} r={0}>
                  <label value="Lunch 2:00PM" position="top" fontSize={8} fill="hsl(var(--muted-foreground))" />
                </ReferenceDot>
                <ReferenceDot x="5PM" y={70} r={0}>
                  <label value="Snack 5:15PM" position="top" fontSize={8} fill="hsl(var(--muted-foreground))" />
                </ReferenceDot>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hydration Module */}
      <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
        <h3 className="font-serif text-sm font-semibold text-foreground mb-4">Hydration Today 💧</h3>
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="h-3 bg-muted rounded-pill overflow-hidden">
            <motion.div
              className="h-full rounded-pill"
              style={{ background: "#4A90D9" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(waterPct, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono font-semibold text-foreground">{waterLiters.toFixed(1)}L / {waterTarget}L ({waterPct}%)</span>
            <span className="text-xs text-muted-foreground font-sans">Last logged: 2:30 PM</span>
          </div>
          {/* Water glasses */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`text-lg ${i < waterGlasses ? "" : "opacity-30 grayscale"}`}>💧</span>
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-sans">+{Math.max(0, 5 - waterGlasses)} glass{5 - waterGlasses !== 1 ? "es" : ""} to hit your goal</span>
          </div>
          {/* Log water button */}
          <Popover open={showWaterPopover} onOpenChange={setShowWaterPopover}>
            <PopoverTrigger asChild>
              <Button size="sm" className="rounded-pill text-xs bg-[#4A90D9] hover:bg-[#4A90D9]/90 text-white">+ Log Water</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="start">
              <p className="text-sm font-sans font-semibold text-foreground mb-3">How much did you drink?</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "1 glass", ml: 250 },
                  { label: "Half bottle", ml: 500 },
                  { label: "Full bottle", ml: 1000 },
                  { label: "Custom", ml: 330 },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => logWater(opt.ml)}
                    className="bg-muted rounded-xl px-3 py-2 text-xs font-sans text-foreground hover:bg-accent transition-colors"
                  >
                    {opt.label} {opt.ml}ml
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Condition Modules: FODMAP + Mood-Nutrition — stack on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        {/* FODMAP Tracker */}
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6" style={{ borderLeft: "3px solid #4CAF7C" }}>
          <div className="mb-4">
            <h3 className="font-serif text-sm font-semibold text-foreground">FODMAP Tracker 🫀</h3>
            <p className="text-[10px] text-muted-foreground font-sans">Active because you have IBS</p>
          </div>
          {/* Status badge */}
          <div className="mb-4">
            <span className="inline-block rounded-pill px-4 py-1.5 text-sm font-sans font-semibold" style={{ background: "#FFF3E0", color: "#E8A838" }}>
              ⚠️ Moderate FODMAP Day
            </span>
          </div>
          {/* Flagged ingredients \u2014 always vertical on mobile (already vertical) */}
          <div className="space-y-3 mb-5">
            <div className="flex items-start gap-2 text-xs font-sans">
              <span>🔴</span>
              <div><span className="font-medium text-foreground">Onion (in bhindi sabzi)</span> — <span className="text-destructive">HIGH FODMAP</span><br /><span className="text-muted-foreground">Consider reducing portion</span></div>
            </div>
            <div className="flex items-start gap-2 text-xs font-sans">
              <span>🟡</span>
              <div><span className="font-medium text-foreground">Milk 250ml (Amul Gold)</span> — <span className="text-warning">MODERATE</span><br /><span className="text-muted-foreground">Lactose may cause symptoms</span></div>
            </div>
            <div className="flex items-start gap-2 text-xs font-sans">
              <span>🟢</span>
              <div><span className="font-medium text-foreground">Oats 80g</span> — <span className="text-success">LOW FODMAP</span><br /><span className="text-muted-foreground">Safe</span></div>
            </div>
          </div>
          {/* Gut symptom log */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-sans font-medium text-foreground mb-2">How's your gut feeling today?</p>
            <div className="flex gap-2 mb-2">
              {["😣", "😟", "😐", "🙂", "😄"].map((emoji, i) => (
                <button
                  key={i}
                  onClick={async () => {
                    const ok = await logGutScore(i + 1);
                    if (ok) toast({ title: "Gut score logged — we'll track symptom patterns 📊" });
                    else toast({ title: "Failed to log — try again", variant: "destructive" });
                  }}
                  className={`text-2xl transition-all rounded-full p-1 ${gutScore === i + 1 ? "scale-125 ring-2 ring-success bg-success/10" : gutScore !== null && gutScore !== i + 1 ? "opacity-50" : "hover:scale-110"
                    }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {gutFeedback && (
              <p className="text-xs text-foreground font-sans mb-1 bg-success/10 rounded-lg px-3 py-2">{gutFeedback}</p>
            )}
            <p className="text-[10px] text-muted-foreground font-sans">Last logged: {gutLastLogged ?? "Never"}{gutScore ? ` · Score: ${gutScore}/5` : ""}</p>
            {isFemale && <p className="text-[10px] text-muted-foreground font-sans mt-1 italic">Your IBS symptoms tend to be higher this week (luteal phase). Extra caution with high-FODMAP foods.</p>}
          </div>
        </div>

        {/* Mood-Nutrition Correlation */}
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6" style={{ borderLeft: "3px solid #4A90D9" }}>
          <div className="mb-4">
            <h3 className="font-serif text-sm font-semibold text-foreground">Mood & Nutrition Link 🧠</h3>
            <p className="text-[10px] text-muted-foreground font-sans">Active because you have Anxiety</p>
          </div>
          {/* Stat row */}
          {/* Stat row — stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4">
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground font-sans mb-1">Today's Mood</p>
              <p className="text-lg">{selectedMood ? ["😣", "😟", "😐", "😊", "😄"][selectedMood - 1] : "😊"} <span className="text-sm font-mono font-semibold">{selectedMood || 4}/5</span></p>
            </div>
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground font-sans mb-1">7-day avg mood</p>
              <p className="text-sm font-mono font-semibold text-foreground">3.4 / 5</p>
            </div>
          </div>
          {/* Insight */}
          <div className="rounded-xl p-4 mb-4" style={{ background: "#EBF4FF" }}>
            <p className="text-xs font-sans text-foreground">
              📊 <span className="font-semibold">Pattern detected:</span> On days your magnesium is below 60% RDA, your mood averages 2.1 vs 3.8 on adequate days.<br />
              Today: Magnesium at 48% ⚠️
            </p>
          </div>
          {/* Mg fix */}
          <div className="bg-muted rounded-xl p-3 mb-4">
            <p className="text-xs font-sans text-muted-foreground">
              <span className="font-medium text-foreground">Add to tomorrow:</span> Dark chocolate (15g), Pumpkin seeds (20g), or Spinach to boost magnesium by ~80mg
            </p>
          </div>
          {/* Log mood button */}
          <div>
            <p className="text-xs font-sans font-medium text-foreground mb-2">Log today's mood</p>
            <div className="flex gap-2">
              {["😣", "😟", "😐", "😊", "😄"].map((emoji, i) => (
                <button
                  key={i}
                  onClick={async () => {
                    const ok = await logMood(i + 1);
                    if (ok) toast({ title: "Mood logged — we'll track patterns over time 📊" });
                    else toast({ title: "Failed to log — try again", variant: "destructive" });
                  }}
                  className={`text-2xl transition-all rounded-full p-1 ${selectedMood === i + 1 ? "scale-130 ring-2 ring-[#4A90D9] bg-[#4A90D9]/10" : selectedMood !== null && selectedMood !== i + 1 ? "opacity-50" : "hover:scale-110"
                    }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {moodFeedback && (
              <p className="text-xs text-foreground font-sans mt-2 bg-[#EBF4FF] rounded-lg px-3 py-2">{moodFeedback}</p>
            )}
          </div>
        </div>
      </div>

      {/* End of Day Recap — stack on mobile */}
      <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
        <h3 className="font-serif text-base font-semibold text-foreground mb-4 md:mb-6">End of Day Recap</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
          <div className="rounded-xl p-4 space-y-3" style={{ borderLeft: "3px solid #3D9970", background: "#E8F5E9" }}>
            <h4 className="font-sans text-sm font-semibold text-secondary">What you did well ✅</h4>
            <ul className="space-y-2 text-sm font-sans text-foreground">
              <li>• Hit protein goal</li><li>• 2.1L water</li><li>• 14hr fast</li>
            </ul>
          </div>
          <div className="rounded-xl p-4 space-y-3" style={{ borderLeft: "3px solid #E8A838", background: "#FFF8E1" }}>
            <h4 className="font-sans text-sm font-semibold text-warning">What to improve 📈</h4>
            <ul className="space-y-2 text-sm font-sans text-foreground">
              <li>• Low Vitamin D</li><li>• Magnesium gap</li><li>• Late dinner</li>
            </ul>
          </div>
          <div className="rounded-xl p-4 space-y-3" style={{ borderLeft: "3px solid hsl(153, 38%, 17%)", background: "#F1F8F5" }}>
            <h4 className="font-sans text-sm font-semibold text-primary">Tomorrow's priority 🎯</h4>
            <ul className="space-y-2 text-sm font-sans text-foreground">
              <li>• Add eggs for B12</li><li>• Morning sunlight</li><li>• Sleep by 11PM</li>
            </ul>
            <Button size="sm" onClick={handleOpenReminder} className="rounded-pill text-xs w-full mt-2 bg-primary text-primary-foreground">
              <Bell className="h-3 w-3 mr-1" /> Set Reminder →
            </Button>
          </div>
        </div>
      </div>

      {/* Reminder Modal */}
      <Dialog open={showReminderModal} onOpenChange={setShowReminderModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Set Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-sans font-medium text-muted-foreground">What to remember</label>
              <textarea
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-sans font-medium text-muted-foreground">Time</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-sans font-medium text-muted-foreground">Repeat</label>
              <div className="flex gap-2">
                {([
                  { value: "once" as RepeatType, label: "Just tomorrow" },
                  { value: "daily" as RepeatType, label: "Every day" },
                  { value: "weekdays" as RepeatType, label: "Weekdays only" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setReminderRepeat(opt.value)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-sans transition-colors ${reminderRepeat === opt.value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReminderModal(false)} className="rounded-pill text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleSaveReminder}
              disabled={reminderSaving || !reminderText.trim()}
              className="rounded-pill text-xs bg-primary text-primary-foreground"
            >
              {reminderSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bell className="h-3 w-3 mr-1" />}
              Save Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
