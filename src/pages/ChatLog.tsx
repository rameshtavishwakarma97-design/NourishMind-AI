import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ingredients = [
  { name: "Rolled Oats", qty: "80g", kcal: 297, p: 10, c: 54, f: 5, source: "✅ IFCT" },
  { name: "Almonds (7 pcs)", qty: "21g", kcal: 122, p: 4, c: 5, f: 10, source: "✅ IFCT" },
  { name: "Myprotein Whey", qty: "1 scoop (30g)", kcal: 103, p: 21, c: 2, f: 2, source: "✅ Brand DB" },
  { name: "Amul Gold Milk", qty: "250ml", kcal: 163, p: 8, c: 12, f: 9, source: "✅ Brand DB" },
  { name: "Cocoa Powder", qty: "1 tsp (3g)", kcal: 8, p: 1, c: 1, f: 0, source: "✅ IFCT" },
  { name: "Sugar Free sachet", qty: "1 sachet", kcal: 4, p: 0, c: 1, f: 0, source: "⚠️ Estimated" },
];
const totals = { kcal: 697, p: 44, c: 75, f: 26 };

const micros = [
  { name: "Fe 2.1mg", color: "🟡" },
  { name: "Ca 384mg", color: "🟢" },
  { name: "Mg 87mg", color: "🟡" },
  { name: "B12 1.2mcg", color: "🟡" },
  { name: "D 48IU", color: "🔴" },
];

const rightMicros = [
  ["Fe🟡", "Ca🟢", "Mg🟡", "K🟢", "Na🟢"],
  ["B12🟡", "D🔴", "Zn🟡", "Folate🟡", "Water🔴"],
];

type Message = { type: "ai" | "user" | "mealcard" | "typing"; text?: string };

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

const ChatLog = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    { type: "ai", text: `${getGreeting()}, Rameshta! I'm ready to help you track today. What did you eat for breakfast? Just describe it naturally` },
    { type: "user", text: "I had overnight oats for breakfast — 7 almonds, 1 scoop Myprotein whey, 250ml Amul Gold milk, 1 tsp cocoa powder, sugar free" },
    { type: "mealcard" },
    { type: "ai", text: "Logged! Your breakfast was high in protein (44g — great start!). Vitamin D is low though — try to get some morning sunlight or add an egg tomorrow. You're at 697 of 1,800 kcal for the day." },
  ]);
  const [input, setInput] = useState("");
  const [savedMeals] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages((m) => [...m, { type: "user", text: userMsg }, { type: "typing" }]);
    setTimeout(() => {
      setMessages((m) => m.filter((msg) => msg.type !== "typing").concat({ type: "mealcard" }));
    }, 1800);
  };

  return (
    <div className="flex h-screen">
      {/* Chat Panel — 65% */}
      <div className="w-[65%] flex flex-col border-r border-border">
        {/* Top bar */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card">
          <div>
            <h2 className="font-serif text-lg font-bold text-foreground">NourishMind</h2>
            <p className="text-xs text-muted-foreground font-sans">Your AI Health Coach</p>
          </div>
          <div className="bg-muted rounded-pill px-3 py-1">
            <span className="text-xs font-mono font-semibold text-foreground">697 / 1,800 kcal</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* Date divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-sans">Today, Saturday Feb 21</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {msg.type === "ai" && (
                  <div className="flex justify-start">
                    <div className="bg-surface-elevated rounded-[20px] rounded-bl-sm px-5 py-3 max-w-[80%]">
                      <p className="text-sm font-sans text-foreground">{msg.text}</p>
                    </div>
                  </div>
                )}
                {msg.type === "user" && (
                  <div className="flex justify-end">
                    <div className="bg-primary rounded-[20px] rounded-br-sm px-5 py-3 max-w-[80%]">
                      <p className="text-sm font-sans text-primary-foreground">{msg.text}</p>
                    </div>
                  </div>
                )}
                {msg.type === "typing" && (
                  <div className="flex justify-start">
                    <div className="bg-surface-elevated rounded-[20px] rounded-bl-sm px-5 py-3">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((d) => (
                          <motion.div
                            key={d}
                            className="w-2 h-2 rounded-full bg-muted-foreground/50"
                            animate={{ y: [0, -6, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity, delay: d * 0.15 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {msg.type === "mealcard" && <MealLogCard onSave={() => toast({ title: "Overnight Oats saved! ✅" })} />}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Quick-log chips */}
        <div className="px-6 py-2 space-y-2">
          <div className="flex gap-2 overflow-x-auto">
            {savedMeals.length > 0 ? (
              savedMeals.map((chip) => (
                <button
                  key={chip}
                  className="shrink-0 bg-muted rounded-pill px-4 py-1.5 text-xs font-sans font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {chip}
                </button>
              ))
            ) : null}
            <button className="shrink-0 bg-muted rounded-pill px-4 py-1.5 text-xs font-sans font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
              + New
            </button>
          </div>
          {savedMeals.length === 0 && (
            <p className="text-xs text-muted-foreground font-sans text-center">
              Log a meal 3x to save it as a quick-log chip
            </p>
          )}
        </div>

        {/* Input bar */}
        <div className="p-4 border-t border-border bg-card flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Tell me what you ate, or ask me anything..."
            className="flex-1 resize-none bg-background rounded-xl border border-border px-4 py-3 text-sm font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-32"
            rows={1}
          />
          <button className="text-muted-foreground hover:text-foreground p-2">
            <Camera className="h-5 w-5" />
          </button>
          <Button
            onClick={handleSend}
            className="rounded-full w-11 h-11 p-0 bg-primary hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Right Panel — 35% */}
      <div className="w-[35%] overflow-y-auto p-6 space-y-6 bg-background">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-foreground">Today's Nutrition</h3>
          <span className="text-xs text-muted-foreground font-sans">Feb 21</span>
        </div>

        {/* Calorie Ring */}
        <div className="flex justify-center">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 160 160" className="w-40 h-40 -rotate-90">
              <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
              <circle
                cx="80" cy="80" r="70" fill="none"
                stroke="hsl(var(--secondary))"
                strokeWidth="8"
                strokeDasharray={`${(697 / 1800) * 439.8} 439.8`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-mono font-bold text-foreground">697</span>
              <span className="text-xs text-muted-foreground font-sans">of 1,800 kcal</span>
            </div>
          </div>
        </div>

        {/* Macro Progress Bars */}
        <div className="space-y-3">
          {[
            { label: "Protein", val: 44, max: 150, color: "var(--macro-protein)" },
            { label: "Carbs", val: 75, max: 250, color: "var(--macro-carbs)" },
            { label: "Fat", val: 26, max: 65, color: "var(--macro-fat)" },
            { label: "Fiber", val: 3, max: 30, color: "var(--macro-fiber)" },
          ].map((m) => (
            <div key={m.label} className="space-y-1">
              <div className="flex justify-between text-xs font-sans">
                <span className="text-foreground font-medium">{m.label}</span>
                <span className="font-mono text-muted-foreground">{m.val}g / {m.max}g</span>
              </div>
              <div className="h-2 bg-muted rounded-pill overflow-hidden">
                <div
                  className="h-full rounded-pill transition-all"
                  style={{ width: `${(m.val / m.max) * 100}%`, background: `hsl(${m.color})` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Micro Grid */}
        <div>
          <h4 className="text-sm font-semibold font-sans text-foreground mb-2">Micronutrients</h4>
          <div className="space-y-1">
            {rightMicros.map((row, i) => (
              <div key={i} className="flex gap-2">
                {row.map((m) => (
                  <span key={m} className="bg-muted rounded-lg px-2 py-1 text-xs font-mono text-foreground">{m}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Meal Timing */}
        <div>
          <h4 className="text-sm font-semibold font-sans text-foreground mb-2">Meal Timing</h4>
          <div className="bg-muted rounded-xl p-4 relative h-16">
            <div className="absolute bottom-4 left-0 right-0 h-px bg-border" />
            <div className="absolute bottom-0 flex items-end" style={{ left: "20%" }}>
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-muted-foreground font-sans mb-1 whitespace-nowrap">Breakfast</span>
                <span className="text-[9px] text-muted-foreground font-sans mb-1">697 kcal</span>
                <div className="w-3 h-3 rounded-full bg-secondary" />
                <span className="text-[9px] text-muted-foreground font-sans mt-1">8:42 AM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MealLogCard = ({ onSave }: { onSave: () => void }) => (
  <div className="bg-card rounded-3xl border shadow-sm overflow-hidden" style={{ borderColor: "#E8E4DC" }}>
    {/* Header */}
    <div className="px-6 py-3 flex items-center gap-3 border-b" style={{ borderColor: "#E8E4DC" }}>
      <span className="bg-warning/20 text-warning rounded-pill px-3 py-1 text-xs font-semibold font-sans">🌅 Breakfast</span>
      <span className="text-xs text-muted-foreground font-sans">8:42 AM</span>
      <span className="ml-auto text-xs font-sans text-success font-medium">✅ 94% Confident</span>
    </div>
    {/* Table */}
    <div className="px-6 py-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground font-sans border-b" style={{ borderColor: "#E8E4DC" }}>
            <th className="text-left py-2 font-medium">Ingredient</th>
            <th className="text-left py-2 font-medium pl-2">Quantity</th>
            <th className="text-right py-2 font-medium">Calories</th>
            <th className="text-right py-2 font-medium">Protein</th>
            <th className="text-right py-2 font-medium">Carbs</th>
            <th className="text-right py-2 font-medium">Fat</th>
            <th className="text-right py-2 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ing) => (
            <tr key={ing.name} className="border-b border-border/30">
              <td className="py-2 font-sans text-foreground">{ing.name}</td>
              <td className="py-2 font-sans text-muted-foreground pl-2">{ing.qty}</td>
              <td className="text-right font-mono text-foreground">{ing.kcal} kcal</td>
              <td className="text-right font-mono text-foreground">{ing.p}g</td>
              <td className="text-right font-mono text-foreground">{ing.c}g</td>
              <td className="text-right font-mono text-foreground">{ing.f}g</td>
              <td className="text-right font-sans text-muted-foreground text-[10px]">{ing.source}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold" style={{ backgroundColor: "#F4F2EE" }}>
            <td className="py-2.5 font-sans text-foreground">TOTAL</td>
            <td className="py-2.5">—</td>
            <td className="text-right font-mono text-foreground">{totals.kcal} kcal</td>
            <td className="text-right font-mono text-foreground">{totals.p}g</td>
            <td className="text-right font-mono text-foreground">{totals.c}g</td>
            <td className="text-right font-mono text-foreground">{totals.f}g</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
    {/* Micro badges */}
    <div className="px-6 py-3 flex gap-2 flex-wrap">
      {micros.map((m) => (
        <span key={m.name} className="bg-muted rounded-pill px-3 py-1 text-[10px] font-mono text-foreground">
          {m.name} {m.color}
        </span>
      ))}
    </div>
    {/* Actions */}
    <div className="px-6 py-3 border-t flex gap-3" style={{ borderColor: "#E8E4DC" }}>
      <Button variant="ghost" size="sm" className="text-xs rounded-pill" onClick={onSave}>💾 Save as Recipe</Button>
      <Button variant="ghost" size="sm" className="text-xs rounded-pill">✏️ Edit</Button>
    </div>
  </div>
);

export default ChatLog;
