import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Image as ImageIcon, Pencil, Trash2, ArrowRight } from "lucide-react";

/* =========================================================
   型
========================================================= */
type Todo = { id: number; text: string; done: boolean };
type ExpenseItem = { id: number; amount: number; note?: string; createdAt: number };
type CleaningState = Record<string, boolean>;

type DayLog = {
  wakeTime?: string;
  sleepTime?: string;
  steps?: number;
  studyMinutes?: number;
  weight?: number;
  memo?: string;
  todos?: Todo[];
  expenses?: ExpenseItem[];
};

/* =========================================================
   定数
========================================================= */
const STEP_GOAL_DEFAULT = 10000;
const STUDY_GOAL_DEFAULT = 120;

const STORAGE_KEY = "life-log-v1";

/* =========================================================
   ユーティリティ
========================================================= */
const dayKey = (d: Date) => d.toDateString();

const loadAll = (): Record<string, DayLog> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveAll = (data: Record<string, DayLog>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/* =========================================================
   円グラフ（100%超え対応）
========================================================= */
function ProgressCircle({ value, goal, color }: { value: number; goal: number; color: string }) {
  const percent = Math.round((value / goal) * 100);
  return (
    <div className="w-24 h-24 mx-auto">
      <CircularProgressbar
        value={Math.min(percent, 100)}
        text={`${percent}%`}
        styles={buildStyles({
          pathColor: color,
          textColor: color,
          trailColor: "#eee",
          textSize: "16px",
        })}
      />
    </div>
  );
}

/* =========================================================
   メイン
========================================================= */
export default function App() {
  const [date, setDate] = useState(new Date());
  const [allLogs, setAllLogs] = useState<Record<string, DayLog>>(() => loadAll());

  const key = dayKey(date);
  const log = allLogs[key] || {};

  /* ---- 状態 ---- */
  const [wakeTime, setWakeTime] = useState(log.wakeTime || "");
  const [sleepTime, setSleepTime] = useState(log.sleepTime || "");
  const [steps, setSteps] = useState(log.steps || 0);
  const [studyMinutes, setStudyMinutes] = useState(log.studyMinutes || 0);
  const [weight, setWeight] = useState(log.weight || 0);
  const [memo, setMemo] = useState(log.memo || "");

  const [todos, setTodos] = useState<Todo[]>(log.todos || []);
  const [todoText, setTodoText] = useState("");

  const [expenses, setExpenses] = useState<ExpenseItem[]>(log.expenses || []);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");

  const [activeTab, setActiveTab] = useState<
    "time" | "steps" | "study" | "weight" | "money" | "todo"
  >("time");

  /* ---- 日付変更時 ---- */
  useEffect(() => {
    const l = allLogs[key] || {};
    setWakeTime(l.wakeTime || "");
    setSleepTime(l.sleepTime || "");
    setSteps(l.steps || 0);
    setStudyMinutes(l.studyMinutes || 0);
    setWeight(l.weight || 0);
    setMemo(l.memo || "");
    setTodos(l.todos || []);
    setExpenses(l.expenses || []);
  }, [date]);

  const saveDay = (partial: Partial<DayLog>) => {
    const next = {
      ...allLogs,
      [key]: { ...(allLogs[key] || {}), ...partial },
    };
    setAllLogs(next);
    saveAll(next);
  };

  /* =========================================================
     ToDo
  ========================================================= */
  const addTodo = () => {
    if (!todoText.trim()) return;
    const next = [...todos, { id: Date.now(), text: todoText, done: false }];
    setTodos(next);
    saveDay({ todos: next });
    setTodoText("");
  };

  const toggleTodo = (id: number) => {
    const next = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTodos(next);
    saveDay({ todos: next });
  };

  const carryOverTodos = () => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tKey = dayKey(tomorrow);

    const unfinished = todos.filter((t) => !t.done);
    if (unfinished.length === 0) return;

    const nextAll = {
      ...allLogs,
      [tKey]: {
        ...(allLogs[tKey] || {}),
        todos: [...(allLogs[tKey]?.todos || []), ...unfinished],
      },
    };
    setAllLogs(nextAll);
    saveAll(nextAll);
  };

  const allTodoDone = todos.length > 0 && todos.every((t) => t.done);

  /* =========================================================
     家計簿
  ========================================================= */
  const addExpense = () => {
    const amt = Number(expenseAmount);
    if (!amt) return;
    const next = [
      ...expenses,
      { id: Date.now(), amount: amt, note: expenseNote, createdAt: Date.now() },
    ];
    setExpenses(next);
    saveDay({ expenses: next });
    setExpenseAmount("");
    setExpenseNote("");
  };

  const dayExpenseTotal = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses]
  );

  const monthExpenseTotal = useMemo(() => {
    return Object.entries(allLogs).reduce((sum, [k, v]) => {
      const d = new Date(k);
      if (d.getMonth() !== date.getMonth() || d.getFullYear() !== date.getFullYear()) return sum;
      return sum + (v.expenses?.reduce((s, e) => s + e.amount, 0) || 0);
    }, 0);
  }, [allLogs, date]);

  /* =========================================================
     カレンダー表示
  ========================================================= */
  const renderDay = (d: Date) => {
    const l = allLogs[dayKey(d)];
    const todoDone = l?.todos && l.todos.length > 0 && l.todos.every((t) => t.done);
    const exp =
      l?.expenses?.reduce((s, e) => s + e.amount, 0) || 0;

    return (
      <div className="flex flex-col items-center text-[10px]">
        <span>{d.getDate()}</span>
        {todoDone && <span>🌟</span>}
        {exp > 0 && <span className="text-rose-600">¥{exp}</span>}
      </div>
    );
  };

  /* =========================================================
     UI
  ========================================================= */
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-center text-indigo-700">
        My Life Log ✨
      </h1>

      <Card>
        <CardContent>
          <Calendar selected={date} onSelect={setDate} renderDay={renderDay} />

          {/* メモ */}
          <div className="mt-4 text-center max-w-md mx-auto relative">
            <p className="whitespace-pre-line text-sm">{memo}</p>
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-0 -right-6"
              onClick={() => {}}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Textarea
              className="mt-2"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="今日のメモ"
            />
            <Button onClick={() => saveDay({ memo })} className="mt-2 w-full">
              保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* タブ */}
      <div className="flex flex-wrap gap-2 justify-center">
        {[
          ["time", "🕓"],
          ["steps", "🏃‍♀️"],
          ["study", "🎓"],
          ["weight", "⚖️"],
          ["money", "💰"],
          ["todo", "✅"],
        ].map(([k, label]) => (
          <Button
            key={k}
            variant={activeTab === k ? "default" : "outline"}
            onClick={() => setActiveTab(k as any)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* ---- 各タブ ---- */}
      {activeTab === "steps" && (
        <Card>
          <CardContent className="text-center space-y-3">
            <ProgressCircle value={steps} goal={STEP_GOAL_DEFAULT} color="#3b82f6" />
            <Input type="number" value={steps} onChange={(e) => setSteps(+e.target.value)} />
            <Button onClick={() => saveDay({ steps })}>保存</Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "study" && (
        <Card>
          <CardContent className="text-center space-y-3">
            <ProgressCircle value={studyMinutes} goal={STUDY_GOAL_DEFAULT} color="#a855f7" />
            <Input type="number" value={studyMinutes} onChange={(e) => setStudyMinutes(+e.target.value)} />
            <Button onClick={() => saveDay({ studyMinutes })}>保存</Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "todo" && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={todoText} onChange={(e) => setTodoText(e.target.value)} />
              <Button onClick={addTodo}>追加</Button>
            </div>
            {todos.map((t) => (
              <label key={t.id} className="flex gap-2 items-center">
                <Checkbox checked={t.done} onCheckedChange={() => toggleTodo(t.id)} />
                <span className={t.done ? "line-through text-gray-400" : ""}>{t.text}</span>
              </label>
            ))}
            <Button variant="outline" onClick={carryOverTodos} className="w-full">
              翌日に持ち越す <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "money" && (
        <Card>
          <CardContent className="space-y-3">
            <Input
              type="number"
              placeholder="金額"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
            />
            <Input
              placeholder="メモ"
              value={expenseNote}
              onChange={(e) => setExpenseNote(e.target.value)}
            />
            <Button onClick={addExpense}>追加</Button>
            <div>今日: ¥{dayExpenseTotal}</div>
            <div>今月: ¥{monthExpenseTotal}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
