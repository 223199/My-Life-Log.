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
import { Image as ImageIcon, Pencil, Trash2 } from "lucide-react";

/** =========================================================
 *  型
 *  ======================================================= */
type Todo = { id: number; text: string; done: boolean };
type ExpenseItem = { id: number; amount: number; note?: string; createdAt: number };
type CleaningState = Record<string, boolean>;

type DayLog = {
  wakeTime?: string;      // "HH:MM"
  sleepTime?: string;     // "HH:MM"
  steps?: number;         // number
  studyMinutes?: number;  // number
  weight?: number;        // number
  memo?: string;          // string
  todos?: Todo[];         // list
  expenses?: ExpenseItem[]; // list
  cleaning?: CleaningState;  // map
};

type MonthGoals = {
  stepsGoal: number; // 歩数
  studyGoal: number; // 分
};

/** =========================================================
 *  定数
 *  ======================================================= */
const STORAGE_LOGS = "my-life-log:logs:v2";
const STORAGE_MONTH_GOALS = "my-life-log:month-goals:v1";

const DEFAULT_GOALS: MonthGoals = {
  stepsGoal: 10000,
  studyGoal: 120,
};

// 掃除エリア（ベランダ上・玄関下）
const AREA_LIST = [
  "veranda",
  "room",
  "closet",
  "toilet",
  "bath",
  "washbasin",
  "kitchen",
  "entrance",
] as const;

const AREAS: Record<
  (typeof AREA_LIST)[number],
  { x: number; y: number; w: number; h: number; label: string }
> = {
  veranda: { x: 20, y: 10, w: 260, h: 40, label: "ベランダ" },
  room: { x: 20, y: 60, w: 260, h: 130, label: "洋室" },
  closet: { x: 210, y: 150, w: 60, h: 40, label: "クローゼット" }, // 洋室右下
  // 上から：トイレ→浴室→洗面（合計縦=キッチン縦）
  kitchen: { x: 20, y: 200, w: 150, h: 75, label: "キッチン" },
  toilet: { x: 190, y: 200, w: 90, h: 25, label: "トイレ" },
  bath: { x: 190, y: 225, w: 90, h: 25, label: "浴室" },
  washbasin: { x: 190, y: 250, w: 90, h: 25, label: "洗面" },
  entrance: { x: 80, y: 280, w: 140, h: 40, label: "玄関" },
};

// 写真は IndexedDB に日付ごと保存
const DB_NAME = "lifeLogPhotos";
const STORE_NAME = "photos";

/** =========================================================
 *  ユーティリティ
 *  ======================================================= */
const dayKey = (d: Date) => d.toDateString();
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function safeParse<T>(s: string | null, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB error"));
  });
}

async function savePhotoToDB(key: string, dataUrl: string) {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("tx error"));
    });
  } catch (e) {
    console.warn("savePhotoToDB failed", e);
  }
}

async function getPhotoFromDB(key: string): Promise<string> {
  try {
    const db = await openDB();
    return await new Promise<string>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as string) || "");
      req.onerror = () => reject(req.error || new Error("get error"));
    });
  } catch (e) {
    console.warn("getPhotoFromDB failed", e);
    return "";
  }
}

async function deletePhotoFromDB(key: string) {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("delete error"));
    });
  } catch (e) {
    console.warn("deletePhotoFromDB failed", e);
  }
}

/** =========================================================
 *  小UI
 *  ======================================================= */
function SectionCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`shadow-md bg-white/85 ${className}`}>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

// 100%超えはテキスト表示しつつ、円は100%で止める（崩れない）
function ProgressCircle({
  value,
  goal,
  color,
}: {
  value: number;
  goal: number;
  color: string;
}) {
  const percent = goal > 0 ? Math.round((value / goal) * 100) : 0;
  return (
    <div className="w-24 h-24 mx-auto">
      <CircularProgressbar
        value={Math.min(Math.max(percent, 0), 100)}
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

function MapSVG({
  cleaningState,
  onToggle,
}: {
  cleaningState: CleaningState;
  onToggle: (area: string) => void;
}) {
  return (
    <svg width="300" height="340" viewBox="0 0 300 340" className="mx-auto border rounded bg-white">
      <rect x={0} y={0} width={300} height={340} fill="#fff" stroke="none" />

      {Object.entries(AREAS).map(([k, a]) => {
        const key = k as keyof typeof AREAS;
        const marked = !!cleaningState?.[key];
        return (
          <g key={key}>
            <rect
              x={a.x}
              y={a.y}
              width={a.w}
              height={a.h}
              fill="#fff"
              stroke="#111"
              strokeWidth={1}
              onClick={() => onToggle(key)}
              style={{ cursor: "pointer" }}
            />
            <text
              x={a.x + a.w / 2}
              y={a.y + a.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
            >
              {a.label}
            </text>

            {marked && (
              <circle
                cx={a.x + a.w / 2}
                cy={a.y + a.h / 2}
                r={12}
                fill="#16a34a"
                opacity={0.85}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** =========================================================
 *  メイン
 *  ======================================================= */
export default function App() {
  const [date, setDate] = useState<Date>(() => new Date());

  // 日別ログ（全部入り）
  const [logs, setLogs] = useState<Record<string, DayLog>>(() =>
    safeParse<Record<string, DayLog>>(localStorage.getItem(STORAGE_LOGS), {})
  );

  // 月次目標
  const [monthGoalsAll, setMonthGoalsAll] = useState<Record<string, MonthGoals>>(() =>
    safeParse<Record<string, MonthGoals>>(localStorage.getItem(STORAGE_MONTH_GOALS), {})
  );

  const mk = monthKey(date);
  const monthGoals = monthGoalsAll[mk] || null;

  // 月目標入力
  const [showGoalSetup, setShowGoalSetup] = useState(false);
  const [goalStepsInput, setGoalStepsInput] = useState(String(DEFAULT_GOALS.stepsGoal));
  const [goalStudyInput, setGoalStudyInput] = useState(String(DEFAULT_GOALS.studyGoal));

  // 写真＆メモ（写真はIndexedDB、メモはlogs）
  const [photo, setPhoto] = useState("");
  const [isEditingPhoto, setIsEditingPhoto] = useState(true);

  const [memo, setMemo] = useState("");
  const [isEditingMemo, setIsEditingMemo] = useState(true);

  // 日付のキー
  const dk = dayKey(date);
  const dayLog = logs[dk] || {};

  // 各入力
  const [wakeTime, setWakeTime] = useState("");
  const [sleepTime, setSleepTime] = useState("");
  const [steps, setSteps] = useState<string>("");
  const [studyMinutes, setStudyMinutes] = useState<string>("");
  const [weight, setWeight] = useState<string>("");

  // ToDo
  const [todoText, setTodoText] = useState("");
  const [currentTodos, setCurrentTodos] = useState<Todo[]>([]);

  // 家計簿（明細）
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseNote, setEditExpenseNote] = useState("");

  // 掃除
  const [cleaningState, setCleaningState] = useState<CleaningState>({});

  // タブ
  const [activeTab, setActiveTab] = useState<
    "time" | "steps" | "study" | "weight" | "cleaning" | "money" | "todo"
  >("time");

  /** ---- logs保存 ---- */
  const saveLogs = useCallback((next: Record<string, DayLog>) => {
    setLogs(next);
    try {
      localStorage.setItem(STORAGE_LOGS, JSON.stringify(next));
    } catch (e) {
      console.warn("save logs failed", e);
      alert("保存に失敗しました（ストレージ容量がいっぱいかもしれません）。");
    }
  }, []);

  const updateDay = useCallback(
    (partial: Partial<DayLog>) => {
      const prev = logs[dk] || {};
      const nextDay = { ...prev, ...partial };
      const next = { ...logs, [dk]: nextDay };
      saveLogs(next);
    },
    [dk, logs, saveLogs]
  );

  /** ---- 月目標：未設定なら促す ---- */
  useEffect(() => {
    const g = monthGoalsAll[mk];
    if (!g) {
      setGoalStepsInput(String(DEFAULT_GOALS.stepsGoal));
      setGoalStudyInput(String(DEFAULT_GOALS.studyGoal));
      setShowGoalSetup(true);
    } else {
      setShowGoalSetup(false);
      setGoalStepsInput(String(g.stepsGoal));
      setGoalStudyInput(String(g.studyGoal));
    }
  }, [mk, monthGoalsAll]);

  const saveMonthGoals = useCallback(() => {
    const stepsGoal = Math.max(1, Math.floor(Number(goalStepsInput) || DEFAULT_GOALS.stepsGoal));
    const studyGoal = Math.max(1, Math.floor(Number(goalStudyInput) || DEFAULT_GOALS.studyGoal));

    const nextAll = { ...monthGoalsAll, [mk]: { stepsGoal, studyGoal } };
    setMonthGoalsAll(nextAll);
    localStorage.setItem(STORAGE_MONTH_GOALS, JSON.stringify(nextAll));
    setShowGoalSetup(false);
  }, [goalStepsInput, goalStudyInput, mk, monthGoalsAll]);

  /** ---- 日付変更時：その日の値をフォームへ反映 ---- */
  useEffect(() => {
    const d = logs[dk] || {};
    setWakeTime(d.wakeTime || "");
    setSleepTime(d.sleepTime || "");
    setSteps(d.steps != null ? String(d.steps) : "");
    setStudyMinutes(d.studyMinutes != null ? String(d.studyMinutes) : "");
    setWeight(d.weight != null ? String(d.weight) : "");

    setMemo(d.memo || "");
    setIsEditingMemo(!d.memo);

    const todos = Array.isArray(d.todos) ? d.todos : [];
    setCurrentTodos(todos);

    const ex = Array.isArray(d.expenses) ? d.expenses : [];
    setExpenseItems(ex);
    setExpenseAmount("");
    setExpenseNote("");
    setEditingExpenseId(null);
    setEditExpenseAmount("");
    setEditExpenseNote("");

    setCleaningState(d.cleaning || {});

    // 写真
    (async () => {
      const p = await getPhotoFromDB(dk);
      setPhoto(p || "");
      setIsEditingPhoto(!p);
    })();
  }, [dk, logs]);

  /** ---- 写真 ---- */
  const handlePhotoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = (event.target?.result as string) || "";
        if (!dataUrl) return;
        setPhoto(dataUrl);
        await savePhotoToDB(dk, dataUrl);
        setIsEditingPhoto(false);
      };
      reader.readAsDataURL(file);
    },
    [dk]
  );

  const handlePhotoDelete = useCallback(async () => {
    await deletePhotoFromDB(dk);
    setPhoto("");
    setIsEditingPhoto(true);
  }, [dk]);

  /** ---- メモ ---- */
  const saveMemo = useCallback(() => {
    updateDay({ memo });
    setIsEditingMemo(false);
  }, [memo, updateDay]);

  /** ---- 時間/歩数/勉強/体重 保存 ---- */
  const saveTime = useCallback(() => {
    updateDay({ wakeTime, sleepTime });
  }, [wakeTime, sleepTime, updateDay]);

  const saveSteps = useCallback(() => {
    const n = Number(steps);
    updateDay({ steps: Number.isFinite(n) ? n : 0 });
  }, [steps, updateDay]);

  const saveStudy = useCallback(() => {
    const n = Number(studyMinutes);
    updateDay({ studyMinutes: Number.isFinite(n) ? n : 0 });
  }, [studyMinutes, updateDay]);

  const saveWeight = useCallback(() => {
    const n = Number(weight);
    updateDay({ weight: Number.isFinite(n) ? n : 0 });
  }, [weight, updateDay]);

  /** ---- ToDo ---- */
  const addTodo = useCallback(() => {
    if (!todoText.trim()) return;
    const next = [...currentTodos, { id: Date.now(), text: todoText.trim(), done: false }];
    setCurrentTodos(next);
    updateDay({ todos: next });
    setTodoText("");
  }, [todoText, currentTodos, updateDay]);

  const toggleTodo = useCallback(
    (id: number) => {
      const next = currentTodos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      setCurrentTodos(next);
      updateDay({ todos: next });
    },
    [currentTodos, updateDay]
  );

  const deleteTodo = useCallback(
    (id: number) => {
      const next = currentTodos.filter((t) => t.id !== id);
      setCurrentTodos(next);
      updateDay({ todos: next });
    },
    [currentTodos, updateDay]
  );

  // 未完了を翌日に持ち越し（今日からは未完了を消す）
  const carryOverTodosToTomorrow = useCallback(() => {
    const pending = currentTodos.filter((t) => !t.done);
    if (pending.length === 0) return;

    const tomorrow = new Date(date);
    tomorrow.setDate(date.getDate() + 1);
    const tKey = dayKey(tomorrow);

    const tomorrowLog = logs[tKey] || {};
    const existingTomorrow = Array.isArray(tomorrowLog.todos) ? tomorrowLog.todos : [];

    // id衝突回避で作り直す
    const carried = pending.map((t, idx) => ({ ...t, id: Date.now() + idx }));

    const nextTomorrowTodos = [...existingTomorrow, ...carried];
    const nextTodayTodos = currentTodos.filter((t) => t.done);

    const nextAll = {
      ...logs,
      [dk]: { ...(logs[dk] || {}), todos: nextTodayTodos },
      [tKey]: { ...tomorrowLog, todos: nextTomorrowTodos },
    };

    saveLogs(nextAll);
    setCurrentTodos(nextTodayTodos);
  }, [currentTodos, date, dk, logs, saveLogs]);

  /** ---- 掃除 ---- */
  const toggleArea = useCallback(
    (area: string) => {
      const next = { ...(cleaningState || {}) };
      next[area] = !next[area];
      setCleaningState(next);
      updateDay({ cleaning: next });
    },
    [cleaningState, updateDay]
  );

  const resetCleaning = useCallback(() => {
    setCleaningState({});
    updateDay({ cleaning: {} });
  }, [updateDay]);

  /** ---- 家計簿（明細） ---- */
  const expenseTotal = useMemo(
    () => expenseItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0),
    [expenseItems]
  );

  const monthlyExpenseTotal = useMemo(() => {
    const y = date.getFullYear();
    const m = date.getMonth();
    return Object.entries(logs).reduce((sum, [k, v]) => {
      const d = new Date(k);
      if (d.getFullYear() !== y || d.getMonth() !== m) return sum;
      const items = Array.isArray(v.expenses) ? v.expenses : [];
      const daySum = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
      return sum + daySum;
    }, 0);
  }, [logs, date]);

  const addExpenseItem = useCallback(() => {
    const amt = Math.floor(Number(expenseAmount));
    if (!Number.isFinite(amt) || amt <= 0) return;

    const item: ExpenseItem = {
      id: Date.now(),
      amount: amt,
      note: expenseNote.trim() ? expenseNote.trim() : undefined,
      createdAt: Date.now(),
    };

    const next = [...expenseItems, item];
    setExpenseItems(next);
    updateDay({ expenses: next });

    setExpenseAmount("");
    setExpenseNote("");
  }, [expenseAmount, expenseNote, expenseItems, updateDay]);

  const startEditExpense = useCallback((it: ExpenseItem) => {
    setEditingExpenseId(it.id);
    setEditExpenseAmount(String(it.amount));
    setEditExpenseNote(it.note || "");
  }, []);

  const cancelEditExpense = useCallback(() => {
    setEditingExpenseId(null);
    setEditExpenseAmount("");
    setEditExpenseNote("");
  }, []);

  const saveEditExpense = useCallback(() => {
    if (editingExpenseId == null) return;
    const amt = Math.floor(Number(editExpenseAmount));
    if (!Number.isFinite(amt) || amt <= 0) return;

    const next = expenseItems.map((it) =>
      it.id === editingExpenseId
        ? { ...it, amount: amt, note: editExpenseNote.trim() ? editExpenseNote.trim() : undefined }
        : it
    );

    setExpenseItems(next);
    updateDay({ expenses: next });
    cancelEditExpense();
  }, [editingExpenseId, editExpenseAmount, editExpenseNote, expenseItems, updateDay, cancelEditExpense]);

  const deleteExpenseItem = useCallback(
    (id: number) => {
      const next = expenseItems.filter((it) => it.id !== id);
      setExpenseItems(next);
      updateDay({ expenses: next });
    },
    [expenseItems, updateDay]
  );

  /** ---- グラフ用（歩数だけ） ---- */
  const chartData = useMemo(
    () =>
      Object.entries(logs)
        .map(([k, v]) => ({
          name: k.slice(4, 10),
          steps: Number(v.steps) || 0,
        }))
        .slice(-60),
    [logs]
  );

  /** ---- 目標（今月） ---- */
  const stepsGoal = monthGoals?.stepsGoal ?? DEFAULT_GOALS.stepsGoal;
  const studyGoal = monthGoals?.studyGoal ?? DEFAULT_GOALS.studyGoal;

  /** ---- カレンダー表示（起床時間・掃除・家計簿・🌟） ---- */
  const renderDay = useCallback(
    (d: Date) => {
      const k = dayKey(d);
      const l = logs[k] || {};
      const wakeLabel = l.wakeTime ? String(l.wakeTime).slice(0, 5) : "";

      const items = Array.isArray(l.expenses) ? l.expenses : [];
      const dayExpenseTotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

      const cleaning = l.cleaning || {};
      const hasCleaning = Object.keys(cleaning).length > 0;
      const allAreasDone = (AREA_LIST as readonly string[]).every((a) => cleaning[a]);

      const dayTodos = Array.isArray(l.todos) ? l.todos : [];
      const todoAllDone = dayTodos.length > 0 && dayTodos.every((t) => t.done);

      return (
        <div className="flex flex-col items-center text-[10px] leading-tight">
          <span className="text-xs">{d.getDate()}</span>
          {wakeLabel && <span className="text-blue-600">{wakeLabel}</span>}
          {dayExpenseTotal > 0 && <span className="text-rose-600">¥{dayExpenseTotal.toLocaleString()}</span>}
          {hasCleaning && (
            <span className={allAreasDone ? "text-green-600" : "text-yellow-600"}>
              {allAreasDone ? "○" : "△"}
            </span>
          )}
          {todoAllDone && <span className="text-amber-500">🌟</span>}
        </div>
      );
    },
    [logs]
  );

  /** ---- memo中央＆鉛筆はみ出し対策 ---- */
  const memoView = (
    <div className="relative mt-3 max-w-md mx-auto text-center px-8">
      <p className="text-gray-800 text-sm whitespace-pre-line text-center">{memo}</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEditingMemo(true)}
        className="absolute top-0 right-2"
        aria-label="メモを編集"
        title="編集"
      >
        <Pencil className="w-4 h-4 text-indigo-600" />
      </Button>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 bg-gradient-to-br from-blue-50 to-pink-50 min-h-screen">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 text-indigo-700">My Life Log ✨</h1>

      {/* 月目標設定（未設定なら自動表示） */}
      {showGoalSetup && (
        <SectionCard className="border border-indigo-200">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-indigo-700">今月の目標を設定</h2>
            <p className="text-xs text-gray-600">毎月1回、目標を設定できます（後から編集もOK）</p>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">歩数（目標）</label>
              <Input type="number" value={goalStepsInput} onChange={(e) => setGoalStepsInput(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">勉強時間（分・目標）</label>
              <Input type="number" value={goalStudyInput} onChange={(e) => setGoalStudyInput(e.target.value)} />
            </div>
          </div>

          <Button onClick={saveMonthGoals} className="mt-3 w-full">
            保存してはじめる
          </Button>
        </SectionCard>
      )}

      {/* カレンダー + 写真 + メモ */}
      <SectionCard className="border border-indigo-200">
        <Calendar
          selected={date}
          onSelect={(d) => {
            if (d) setDate(d);
          }}
          renderDay={renderDay}
        />

        <div className="mt-4 text-center">
          {/* 写真 */}
          {photo ? (
            <div className="relative inline-block">
              <img src={photo} alt="日付の写真" className="mx-auto w-48 h-48 object-cover rounded-lg border shadow" />
              <div className="absolute top-1 right-1 flex gap-1">
                <Button variant="ghost" size="sm" className="bg-white/70" onClick={() => setIsEditingPhoto(true)}>
                  <Pencil className="w-4 h-4 text-indigo-600" />
                </Button>
                <Button variant="ghost" size="sm" className="bg-white/70" onClick={handlePhotoDelete}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          ) : (
            isEditingPhoto && (
              <label className="cursor-pointer bg-indigo-600 text-white px-3 py-2 rounded-md inline-flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> 写真を追加
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            )
          )}

          {isEditingPhoto && photo && (
            <div className="mt-2">
              <input type="file" accept="image/*" onChange={handlePhotoUpload} />
              <div className="text-xs text-gray-500 mt-1">（鉛筆を押して差し替えできます）</div>
            </div>
          )}

          {/* メモ：写真のすぐ下 */}
          {!isEditingMemo && memo && memoView}

          {isEditingMemo && (
            <div className="mt-3 max-w-md mx-auto">
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="今日のコメントを書く..." />
              <div className="flex gap-2 mt-2">
                <Button onClick={saveMemo} className="flex-1">
                  保存
                </Button>
                {memo && (
                  <Button variant="outline" onClick={() => setIsEditingMemo(false)} className="flex-1">
                    閉じる
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* タブ */}
      <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-2">
        <Button variant={activeTab === "time" ? "default" : "outline"} onClick={() => setActiveTab("time")}>
          🕓 時間
        </Button>
        <Button variant={activeTab === "steps" ? "default" : "outline"} onClick={() => setActiveTab("steps")}>
          🏃‍♀️ 歩数
        </Button>
        <Button variant={activeTab === "study" ? "default" : "outline"} onClick={() => setActiveTab("study")}>
          🎓 勉強
        </Button>
        <Button variant={activeTab === "weight" ? "default" : "outline"} onClick={() => setActiveTab("weight")}>
          ⚖️ 体重
        </Button>
        <Button variant={activeTab === "cleaning" ? "default" : "outline"} onClick={() => setActiveTab("cleaning")}>
          🧹 掃除
        </Button>
        <Button variant={activeTab === "money" ? "default" : "outline"} onClick={() => setActiveTab("money")}>
          💰 家計簿
        </Button>
        <Button variant={activeTab === "todo" ? "default" : "outline"} onClick={() => setActiveTab("todo")}>
          ✅ ToDo
        </Button>
      </div>

      {/* 時間（起床/就寝） */}
      {activeTab === "time" && (
        <SectionCard className="border border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-700">起床・就寝時間</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGoalSetup(true)}
              title="今月の目標を編集"
            >
              目標を編集
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-sm mb-1">起きた時間</label>
              <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">寝た時間</label>
              <Input type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} />
            </div>
          </div>

          <Button onClick={saveTime} className="mt-3 w-full">
            保存
          </Button>
        </SectionCard>
      )}

      {/* 歩数 */}
      {activeTab === "steps" && (
        <SectionCard className="border border-blue-200 text-center space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-blue-600">歩数の記録</h2>
            <Button variant="outline" size="sm" onClick={() => setShowGoalSetup(true)}>
              目標を編集
            </Button>
          </div>

          <ProgressCircle value={Number(steps) || 0} goal={stepsGoal} color="#3b82f6" />
          <p className="text-sm">今月の目標: {stepsGoal.toLocaleString()}歩</p>

          <Input type="number" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="今日の歩数を入力" />

          <Button onClick={saveSteps} className="w-full">
            保存
          </Button>

          <div className="overflow-x-auto mt-4">
            <LineChart width={600} height={280} data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="steps" stroke="#3b82f6" name="歩数" />
            </LineChart>
          </div>
        </SectionCard>
      )}

      {/* 勉強 */}
      {activeTab === "study" && (
        <SectionCard className="border border-purple-200 text-center space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-purple-600">勉強時間</h2>
            <Button variant="outline" size="sm" onClick={() => setShowGoalSetup(true)}>
              目標を編集
            </Button>
          </div>

          <ProgressCircle value={Number(studyMinutes) || 0} goal={studyGoal} color="#a855f7" />
          <p className="text-sm">今月の目標: {studyGoal}分</p>

          <Input
            type="number"
            value={studyMinutes}
            onChange={(e) => setStudyMinutes(e.target.value)}
            placeholder="今日の勉強時間（分）"
          />

          <Button onClick={saveStudy} className="w-full">
            保存
          </Button>
        </SectionCard>
      )}

      {/* 体重 */}
      {activeTab === "weight" && (
        <SectionCard className="border border-amber-200 text-center space-y-3">
          <h2 className="text-lg font-semibold text-amber-600">体重の記録</h2>
          <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="今日の体重（kg）" />
          <Button onClick={saveWeight} className="w-full">
            保存
          </Button>
        </SectionCard>
      )}

      {/* 掃除 */}
      {activeTab === "cleaning" && (
        <SectionCard className="border border-green-200 text-center space-y-3">
          <h2 className="text-lg font-semibold text-green-600">掃除マップ</h2>
          <p className="text-xs text-gray-600">部屋をクリックすると、その場所に掃除済みマーク（○）がつきます。</p>

          <MapSVG cleaningState={cleaningState} onToggle={toggleArea} />

          <div className="flex justify-center gap-2 mt-2">
            <Button variant="outline" onClick={resetCleaning}>
              リセット
            </Button>
          </div>
        </SectionCard>
      )}

      {/* 家計簿 */}
      {activeTab === "money" && (
        <SectionCard className="border border-rose-200 space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-rose-600">家計簿（支出）</h2>
            <p className="text-xs text-gray-600 mt-1">買い物ごとに追加 → 日合計と月合計を自動計算</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block text-sm mb-1">金額（円）</label>
              <Input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="例：1200" />
            </div>
            <div>
              <label className="block text-sm mb-1">メモ（任意）</label>
              <Input value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder="例：コンビニ / 日用品" />
            </div>
          </div>

          <Button onClick={addExpenseItem} className="w-full">
            追加
          </Button>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-rose-50 rounded-lg p-3">
            <div className="text-sm text-gray-700">今日の合計</div>
            <div className="text-xl font-bold text-rose-700">{expenseTotal.toLocaleString()} 円</div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-700">{date.getFullYear()}年{date.getMonth() + 1}月の合計</div>
            <div className="text-xl font-bold text-gray-800">{monthlyExpenseTotal.toLocaleString()} 円</div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">今日の明細</h3>

            {expenseItems.length === 0 ? (
              <p className="text-sm text-gray-500">まだ記録がありません。</p>
            ) : (
              <ul className="space-y-2">
                {expenseItems
                  .slice()
                  .sort((a, b) => a.createdAt - b.createdAt)
                  .map((it) => {
                    const isEditing = editingExpenseId === it.id;

                    return (
                      <li key={it.id} className="bg-white border rounded-md px-3 py-2">
                        {!isEditing ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-gray-800">{it.amount.toLocaleString()} 円</div>
                              {it.note && <div className="text-xs text-gray-500 truncate">{it.note}</div>}
                            </div>

                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => startEditExpense(it)} title="編集">
                                <Pencil className="w-4 h-4 text-indigo-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteExpenseItem(it.id)} title="削除">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs mb-1">金額（円）</label>
                                <Input type="number" value={editExpenseAmount} onChange={(e) => setEditExpenseAmount(e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-xs mb-1">メモ（任意）</label>
                                <Input value={editExpenseNote} onChange={(e) => setEditExpenseNote(e.target.value)} />
                              </div>
                            </div>

                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" onClick={cancelEditExpense}>
                                キャンセル
                              </Button>
                              <Button onClick={saveEditExpense}>保存</Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </SectionCard>
      )}

      {/* ToDo（目標なし、🌟、持ち越し） */}
      {activeTab === "todo" && (
        <SectionCard className="border border-emerald-200 text-center space-y-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold text-emerald-600">ToDo リスト</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={carryOverTodosToTomorrow}
              disabled={currentTodos.length === 0 || currentTodos.every((t) => t.done)}
              title="未完了タスクを翌日に移動します"
            >
              ⏭ 持ち越す
            </Button>
          </div>

          <p className="text-sm text-gray-700">
            完了: {currentTodos.filter((t) => t.done).length}件 / 全部: {currentTodos.length}件
          </p>

          <div className="flex gap-2">
            <Input value={todoText} onChange={(e) => setTodoText(e.target.value)} placeholder="タスクを入力..." />
            <Button onClick={addTodo}>追加</Button>
          </div>

          <ul className="space-y-1 mt-2 text-left max-w-md mx-auto">
            {currentTodos.map((todo) => (
              <li key={todo.id} className="flex items-center justify-between text-sm bg-emerald-50 px-2 py-1 rounded-md shadow-sm">
                <div className="flex items-center gap-2">
                  <Checkbox checked={todo.done} onCheckedChange={() => toggleTodo(todo.id)} />
                  <span className={todo.done ? "line-through text-gray-400" : "text-gray-700"}>{todo.text}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteTodo(todo.id)} title="削除">
                  ❌
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
