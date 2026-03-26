import { useState, useEffect, useRef, useCallback } from "react";

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Room = "cam1A" | "cam1B" | "cam1C" | "cam2A" | "cam2B" | "cam3" | "cam4A" | "cam4B";
type AnimatronicId = "bonnie" | "chica" | "freddy" | "foxy";
type GamePhase = "menu" | "playing" | "dead" | "win";
type View = "office" | "cameras";

interface Animatronic {
  id: AnimatronicId;
  name: string;
  room: Room | "left_door" | "right_door" | "gone";
  path: (Room | "left_door" | "right_door")[];
  moveTimer: number;
  moveInterval: number;
  emoji: string;
  color: string;
}

interface GameState {
  phase: GamePhase;
  view: View;
  activeCamera: Room;
  hour: number;
  battery: number;
  leftDoorClosed: boolean;
  rightDoorClosed: boolean;
  leftLightOn: boolean;
  rightLightOn: boolean;
  animatronics: Animatronic[];
  night: number;
  screamSource: AnimatronicId | null;
  showStatic: boolean;
  cameraUp: boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ROOMS: Record<Room, { name: string; neighbors: Room[] }> = {
  cam1A: { name: "Сцена", neighbors: ["cam1B", "cam1C"] },
  cam1B: { name: "Гримёрка", neighbors: ["cam1A", "cam3", "cam2A"] },
  cam1C: { name: "Пиццерия", neighbors: ["cam1A", "cam2B"] },
  cam2A: { name: "Зап. коридор", neighbors: ["cam1B", "cam3"] },
  cam2B: { name: "Вост. коридор", neighbors: ["cam1C", "cam4A"] },
  cam3:  { name: "Туалеты",       neighbors: ["cam1B", "cam2A"] },
  cam4A: { name: "Кухня",         neighbors: ["cam2B", "cam4B"] },
  cam4B: { name: "Бэкстейдж",     neighbors: ["cam4A"] },
};

const INITIAL_ANIMATRONICS: Animatronic[] = [
  {
    id: "bonnie", name: "Бонни", room: "cam1A",
    path: ["cam1A","cam1B","cam2A","cam3","cam2A"],
    moveTimer: 0, moveInterval: 12,
    emoji: "🐰", color: "#7C3AED",
  },
  {
    id: "chica", name: "Чика", room: "cam1A",
    path: ["cam1A","cam1C","cam2B","cam4A","cam4B"],
    moveTimer: 0, moveInterval: 15,
    emoji: "🐦", color: "#D97706",
  },
  {
    id: "freddy", name: "Фредди", room: "cam1A",
    path: ["cam1A","cam1B","cam1C","cam2B","cam4A"],
    moveTimer: 0, moveInterval: 20,
    emoji: "🐻", color: "#92400E",
  },
  {
    id: "foxy", name: "Фокси", room: "cam2A",
    path: ["cam2A","cam1B","cam2A"],
    moveTimer: 0, moveInterval: 10,
    emoji: "🦊", color: "#DC2626",
  },
];

const BATTERY_DRAIN_BASE = 0.012;
const DOOR_DRAIN = 0.018;
const LIGHT_DRAIN = 0.008;
const CAMERA_DRAIN = 0.006;
const HOUR_DURATION = 45000; // ms per in-game hour

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function getRoomAnimatronics(anims: Animatronic[], room: Room | string) {
  return anims.filter(a => a.room === room);
}

// ─── STATIC OVERLAY ───────────────────────────────────────────────────────────
function StaticOverlay({ intensity = 1 }: { intensity?: number }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E")`,
        opacity: intensity * 0.4,
        mixBlendMode: "screen",
      }}
    />
  );
}

// ─── SCREAM SCREEN ────────────────────────────────────────────────────────────
function ScreamScreen({ anim, onDone }: { anim: Animatronic; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center animate-scream"
      style={{ background: "#000" }}
    >
      <div className="text-center">
        <div
          className="text-[160px] leading-none animate-scream-emoji"
          style={{ filter: `drop-shadow(0 0 40px ${anim.color})` }}
        >
          {anim.emoji}
        </div>
        <div
          className="text-4xl font-black mt-4 tracking-widest uppercase"
          style={{ color: anim.color, textShadow: `0 0 30px ${anim.color}` }}
        >
          {anim.name.toUpperCase()}
        </div>
        <div className="text-red-500 text-xl mt-2 font-bold animate-pulse">ВЫ МЕРТВЫ</div>
      </div>
      <div className="absolute inset-0 bg-red-900/20 animate-pulse" />
    </div>
  );
}

// ─── CAMERA VIEW ─────────────────────────────────────────────────────────────
function CameraView({
  activeCamera, animatronics, onSelectCamera, showStatic,
}: {
  activeCamera: Room;
  animatronics: Animatronic[];
  onSelectCamera: (r: Room) => void;
  showStatic: boolean;
}) {
  const room = ROOMS[activeCamera];
  const present = getRoomAnimatronics(animatronics, activeCamera);

  return (
    <div className="absolute inset-0 bg-black flex flex-col">
      {/* Camera feed */}
      <div className="flex-1 relative overflow-hidden" style={{ background: "radial-gradient(ellipse at center, #0a1a0a 0%, #000 100%)" }}>
        <StaticOverlay intensity={showStatic ? 1 : 0.3} />

        {/* CRT scanlines */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
          }}
        />

        {/* Room name */}
        <div className="absolute top-3 left-4 z-20">
          <span className="text-green-400 font-mono text-xs tracking-widest uppercase">
            CAM {activeCamera.toUpperCase()} — {room.name}
          </span>
        </div>

        {/* REC indicator */}
        <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 font-mono text-xs">REC</span>
        </div>

        {/* Room visual */}
        <div className="absolute inset-0 flex items-center justify-center">
          <RoomScene room={activeCamera} animatronics={present} />
        </div>

        {/* Timestamp */}
        <div className="absolute bottom-3 right-4 z-20 text-green-400/50 font-mono text-xs">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Camera selector */}
      <div className="bg-gray-950 border-t border-green-900/30 p-2">
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(ROOMS) as Room[]).map(r => {
            const hasAnim = getRoomAnimatronics(animatronics, r).length > 0;
            return (
              <button
                key={r}
                onClick={() => onSelectCamera(r)}
                className={`relative px-2 py-1.5 rounded text-xs font-mono transition-all border ${
                  activeCamera === r
                    ? "bg-green-900/40 border-green-500 text-green-300"
                    : "bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500"
                }`}
              >
                {r.toUpperCase()}
                {hasAnim && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── ROOM SCENE ──────────────────────────────────────────────────────────────
function RoomScene({ room, animatronics }: { room: Room; animatronics: Animatronic[] }) {
  const roomVisuals: Record<Room, { bg: string; elements: string }> = {
    cam1A: {
      bg: "from-gray-900 via-gray-800 to-gray-900",
      elements: "🎭 Главная сцена",
    },
    cam1B: {
      bg: "from-purple-950 via-gray-900 to-gray-950",
      elements: "🎪 Гримёрка",
    },
    cam1C: {
      bg: "from-gray-900 via-yellow-950 to-gray-900",
      elements: "🍕 Пиццерия",
    },
    cam2A: {
      bg: "from-gray-950 via-gray-900 to-gray-950",
      elements: "🚪 Западный коридор",
    },
    cam2B: {
      bg: "from-gray-950 via-gray-900 to-gray-950",
      elements: "🚪 Восточный коридор",
    },
    cam3: {
      bg: "from-gray-950 via-slate-900 to-gray-950",
      elements: "🚻 Туалеты",
    },
    cam4A: {
      bg: "from-gray-950 via-red-950 to-gray-950",
      elements: "🍳 Кухня",
    },
    cam4B: {
      bg: "from-black via-gray-950 to-black",
      elements: "📦 Бэкстейдж",
    },
  };

  const visual = roomVisuals[room];

  return (
    <div className={`w-full h-full bg-gradient-to-b ${visual.bg} flex flex-col items-center justify-center relative`}>
      {/* Perspective corridor lines */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <svg width="100%" height="100%" viewBox="0 0 400 300">
          <line x1="200" y1="150" x2="0" y2="0" stroke="#1a4a1a" strokeWidth="1" />
          <line x1="200" y1="150" x2="400" y2="0" stroke="#1a4a1a" strokeWidth="1" />
          <line x1="200" y1="150" x2="0" y2="300" stroke="#1a4a1a" strokeWidth="1" />
          <line x1="200" y1="150" x2="400" y2="300" stroke="#1a4a1a" strokeWidth="1" />
          <rect x="120" y="80" width="160" height="140" fill="none" stroke="#1a4a1a" strokeWidth="1" />
          <rect x="60" y="40" width="280" height="220" fill="none" stroke="#1a4a1a" strokeWidth="0.5" />
        </svg>
      </div>

      <div className="text-green-900/40 text-sm font-mono z-10 mb-6">{visual.elements}</div>

      {/* Animatronics in room */}
      {animatronics.length > 0 ? (
        <div className="flex gap-4 z-10">
          {animatronics.map(a => (
            <div key={a.id} className="text-center animate-pulse">
              <div
                className="text-6xl"
                style={{ filter: `drop-shadow(0 0 20px ${a.color}) drop-shadow(0 0 40px ${a.color})` }}
              >
                {a.emoji}
              </div>
              <div className="text-xs font-mono mt-1" style={{ color: a.color }}>{a.name}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-green-900/20 font-mono text-xs z-10">[ ПУСТО ]</div>
      )}
    </div>
  );
}

// ─── OFFICE VIEW ─────────────────────────────────────────────────────────────
function OfficeView({
  leftDoorClosed, rightDoorClosed,
  leftLightOn, rightLightOn,
  onLeftDoor, onRightDoor,
  onLeftLight, onRightLight,
  animatronics,
  battery,
}: {
  leftDoorClosed: boolean; rightDoorClosed: boolean;
  leftLightOn: boolean; rightLightOn: boolean;
  onLeftDoor: () => void; onRightDoor: () => void;
  onLeftLight: () => void; onRightLight: () => void;
  animatronics: Animatronic[];
  battery: number;
}) {
  const leftEnemy = animatronics.find(a => a.room === "left_door");
  const rightEnemy = animatronics.find(a => a.room === "right_door");

  return (
    <div className="absolute inset-0 flex" style={{ background: "#050a05" }}>

      {/* LEFT PANEL */}
      <div className="w-28 flex flex-col items-center justify-center gap-3 border-r border-green-900/20 bg-black/40 px-2 py-4">
        {/* Light preview */}
        <div
          className="w-20 h-28 rounded-lg border border-green-900/30 relative overflow-hidden transition-all duration-200"
          style={{ background: leftLightOn ? (leftEnemy ? "#3a0000" : "#0a1a00") : "#000" }}
        >
          {leftLightOn && leftEnemy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl" style={{ filter: `drop-shadow(0 0 10px ${leftEnemy.color})` }}>
                {leftEnemy.emoji}
              </div>
            </div>
          )}
          {leftLightOn && !leftEnemy && (
            <div className="absolute inset-0 flex items-center justify-center text-green-900/30 text-xs font-mono">пусто</div>
          )}
          {!leftLightOn && leftDoorClosed && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-xs">🚪</div>
          )}
        </div>

        <button
          onClick={onLeftLight}
          className={`w-full py-1.5 rounded text-xs font-bold font-mono border transition-all ${
            leftLightOn
              ? "bg-yellow-400/20 border-yellow-400 text-yellow-400"
              : "bg-gray-900 border-gray-700 text-gray-600 hover:border-gray-500"
          }`}
        >
          СВЕТ
        </button>

        <button
          onClick={onLeftDoor}
          className={`w-full py-2 rounded text-xs font-black font-mono border transition-all ${
            leftDoorClosed
              ? "bg-red-900/40 border-red-500 text-red-400"
              : "bg-gray-900 border-gray-700 text-gray-600 hover:border-gray-500"
          }`}
        >
          {leftDoorClosed ? "ОТКР" : "ЗАКР"}
        </button>

        <div className="text-gray-700 font-mono text-xs mt-1">◄ ЛЕВО</div>
      </div>

      {/* MAIN OFFICE */}
      <div className="flex-1 relative overflow-hidden">
        <StaticOverlay intensity={0.15} />

        {/* Office room */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* Desk */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1/3"
              style={{ background: "linear-gradient(to top, #0a0a0a, #111)" }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800" />
              {/* Monitor */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-20 bg-gray-900 border border-gray-700 rounded flex items-center justify-center">
                <div className="text-green-400/30 text-xs font-mono text-center">
                  <div>КАМЕРЫ</div>
                  <div className="text-lg">📷</div>
                </div>
              </div>
              {/* Fan */}
              <div className="absolute top-6 right-24 text-2xl animate-spin" style={{ animationDuration: "2s" }}>🌀</div>
              {/* Freddy mask */}
              <div className="absolute top-4 left-16 text-2xl opacity-60">🎭</div>
            </div>

            {/* Back wall */}
            <div
              className="absolute top-0 left-0 right-0"
              style={{
                height: "67%",
                background: "linear-gradient(to bottom, #0d1a0d, #0a140a)",
              }}
            >
              {/* Posters */}
              <div className="absolute top-8 left-1/4 text-xs text-green-900/20 font-mono rotate-1">📋 POSTER</div>
              <div className="absolute top-12 right-1/4 text-xs text-green-900/20 font-mono -rotate-1">🎪 FNAF</div>

              {/* Ceiling light */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full opacity-20"
                style={{ background: "radial-gradient(ellipse, #1a4a1a, transparent)" }}
              />
            </div>

            {/* Left door frame */}
            <div className="absolute left-0 top-0 bottom-1/3 w-16 bg-gray-950 border-r border-gray-800 flex items-center justify-center">
              {leftDoorClosed ? (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                  <span className="text-gray-600 text-xs font-mono rotate-90">ЗАКРЫТО</span>
                </div>
              ) : (
                <div className="w-full h-full" style={{ background: leftLightOn && leftEnemy ? "#1a0000" : "transparent" }}>
                  {leftLightOn && leftEnemy && (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-5xl" style={{ filter: `drop-shadow(0 0 15px ${leftEnemy.color})` }}>
                        {leftEnemy.emoji}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right door frame */}
            <div className="absolute right-0 top-0 bottom-1/3 w-16 bg-gray-950 border-l border-gray-800 flex items-center justify-center">
              {rightDoorClosed ? (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                  <span className="text-gray-600 text-xs font-mono rotate-90">ЗАКРЫТО</span>
                </div>
              ) : (
                <div className="w-full h-full" style={{ background: rightLightOn && rightEnemy ? "#1a0000" : "transparent" }}>
                  {rightLightOn && rightEnemy && (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-5xl" style={{ filter: `drop-shadow(0 0 15px ${rightEnemy.color})` }}>
                        {rightEnemy.emoji}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Battery warning */}
        {battery < 20 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-red-500 font-mono text-xs animate-pulse font-bold tracking-widest">
            ⚠ НИЗКИЙ ЗАРЯД ⚠
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div className="w-28 flex flex-col items-center justify-center gap-3 border-l border-green-900/20 bg-black/40 px-2 py-4">
        <div
          className="w-20 h-28 rounded-lg border border-green-900/30 relative overflow-hidden transition-all duration-200"
          style={{ background: rightLightOn ? (rightEnemy ? "#3a0000" : "#0a1a00") : "#000" }}
        >
          {rightLightOn && rightEnemy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl" style={{ filter: `drop-shadow(0 0 10px ${rightEnemy.color})` }}>
                {rightEnemy.emoji}
              </div>
            </div>
          )}
          {rightLightOn && !rightEnemy && (
            <div className="absolute inset-0 flex items-center justify-center text-green-900/30 text-xs font-mono">пусто</div>
          )}
        </div>

        <button
          onClick={onRightLight}
          className={`w-full py-1.5 rounded text-xs font-bold font-mono border transition-all ${
            rightLightOn
              ? "bg-yellow-400/20 border-yellow-400 text-yellow-400"
              : "bg-gray-900 border-gray-700 text-gray-600 hover:border-gray-500"
          }`}
        >
          СВЕТ
        </button>

        <button
          onClick={onRightDoor}
          className={`w-full py-2 rounded text-xs font-black font-mono border transition-all ${
            rightDoorClosed
              ? "bg-red-900/40 border-red-500 text-red-400"
              : "bg-gray-900 border-gray-700 text-gray-600 hover:border-gray-500"
          }`}
        >
          {rightDoorClosed ? "ОТКР" : "ЗАКР"}
        </button>

        <div className="text-gray-700 font-mono text-xs mt-1">ПРАВО ►</div>
      </div>
    </div>
  );
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function HUD({
  hour, battery, night, view, onToggleCamera,
}: {
  hour: number; battery: number; night: number;
  view: View; onToggleCamera: () => void;
}) {
  const batteryColor = battery > 50 ? "#22c55e" : battery > 20 ? "#f59e0b" : "#ef4444";

  return (
    <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2 bg-black/80 border-b border-green-900/30">
      <div className="font-mono text-xs text-green-400">
        <span className="text-green-600">НОЧЬ</span> {night} &nbsp;
        <span className="text-green-600">ЧАС</span>{" "}
        {hour === 0 ? "12:00 AM" : hour < 6 ? `${hour}:00 AM` : "6:00 AM"}
      </div>

      <button
        onClick={onToggleCamera}
        className={`px-4 py-1 rounded font-mono text-xs font-bold border transition-all ${
          view === "cameras"
            ? "bg-green-900/40 border-green-500 text-green-300"
            : "bg-gray-900 border-gray-600 text-gray-400 hover:border-gray-400"
        }`}
      >
        {view === "cameras" ? "▼ ОПУСТИТЬ" : "▲ КАМЕРЫ"}
      </button>

      <div className="flex items-center gap-2 font-mono text-xs">
        <span style={{ color: batteryColor }}>⚡</span>
        <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${battery}%`, background: batteryColor }}
          />
        </div>
        <span style={{ color: batteryColor }}>{Math.floor(battery)}%</span>
      </div>
    </div>
  );
}

// ─── MENU ────────────────────────────────────────────────────────────────────
function MenuScreen({ onStart, night }: { onStart: () => void; night: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-40">
      <div className="text-center">
        <div className="text-6xl mb-4">🐻</div>
        <h1 className="text-4xl font-black text-green-400 font-mono tracking-widest mb-2">
          FREDDY&apos;S
        </h1>
        <p className="text-green-700 font-mono text-sm mb-1">ПЯТЬ НОЧЕЙ У ФРЕДДИ</p>
        <p className="text-gray-600 font-mono text-xs mb-10">Веб-версия</p>

        <div className="text-green-800 font-mono text-xs mb-6">
          НОЧЬ {night} из 5
        </div>

        <button
          onClick={onStart}
          className="px-10 py-3 bg-green-900/30 border-2 border-green-500 text-green-300 font-mono font-black text-sm rounded hover:bg-green-900/50 transition-all hover:scale-105 tracking-widest"
        >
          ► НАЧАТЬ НОЧЬ {night}
        </button>

        <div className="mt-10 text-gray-700 font-mono text-xs max-w-xs text-center leading-relaxed">
          Следи за аниматрониками через камеры.<br />
          Закрывай двери если они рядом.<br />
          Продержись до 6:00 утра.
        </div>

        <div className="mt-6 flex gap-6 justify-center">
          {INITIAL_ANIMATRONICS.map(a => (
            <div key={a.id} className="text-center">
              <div className="text-2xl">{a.emoji}</div>
              <div className="text-xs font-mono mt-1" style={{ color: a.color }}>{a.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── WIN / LOSE SCREENS ───────────────────────────────────────────────────────
function DeadScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-40">
      <div className="text-6xl mb-4 animate-bounce">💀</div>
      <h2 className="text-3xl font-black text-red-500 font-mono tracking-widest mb-2">GAME OVER</h2>
      <p className="text-red-800 font-mono text-sm mb-8">Аниматроник добрался до тебя...</p>
      <button
        onClick={onRestart}
        className="px-8 py-3 bg-red-900/30 border-2 border-red-600 text-red-400 font-mono font-black text-sm rounded hover:bg-red-900/50 transition-all"
      >
        ↺ ПОПРОБОВАТЬ СНОВА
      </button>
    </div>
  );
}

function WinScreen({ night, onNext }: { night: number; onNext: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-40">
      <div className="text-6xl mb-4">⭐</div>
      <h2 className="text-3xl font-black text-green-400 font-mono tracking-widest mb-2">
        {night >= 5 ? "ВЫ ПОБЕДИЛИ!" : `НОЧЬ ${night} ПРОЙДЕНА`}
      </h2>
      <p className="text-green-700 font-mono text-sm mb-8">
        {night >= 5 ? "Все 5 ночей позади. Вы выжили!" : "Продержитесь ещё одну ночь..."}
      </p>
      <button
        onClick={onNext}
        className="px-8 py-3 bg-green-900/30 border-2 border-green-500 text-green-300 font-mono font-black text-sm rounded hover:bg-green-900/50 transition-all"
      >
        {night >= 5 ? "↺ СНАЧАЛА" : `► НОЧЬ ${night + 1}`}
      </button>
    </div>
  );
}

// ─── MAIN GAME ────────────────────────────────────────────────────────────────
export default function Index() {
  const [night, setNight] = useState(1);
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [view, setView] = useState<View>("office");
  const [activeCamera, setActiveCamera] = useState<Room>("cam1A");
  const [hour, setHour] = useState(0);
  const [battery, setBattery] = useState(100);
  const [leftDoorClosed, setLeftDoorClosed] = useState(false);
  const [rightDoorClosed, setRightDoorClosed] = useState(false);
  const [leftLightOn, setLeftLightOn] = useState(false);
  const [rightLightOn, setRightLightOn] = useState(false);
  const [animatronics, setAnimatronics] = useState<Animatronic[]>(INITIAL_ANIMATRONICS);
  const [screamAnim, setScreamAnim] = useState<Animatronic | null>(null);
  const [showStatic, setShowStatic] = useState(false);

  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hourTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batteryRef = useRef(100);
  const phaseRef = useRef<GamePhase>("menu");

  phaseRef.current = phase;

  const triggerDeath = useCallback((anim: Animatronic) => {
    setPhase("dead");
    setScreamAnim(anim);
    setShowStatic(true);
    setTimeout(() => setShowStatic(false), 500);
  }, []);

  const startGame = useCallback((n: number) => {
    const difficulty = n;
    const anims = INITIAL_ANIMATRONICS.map(a => ({
      ...a,
      room: a.id === "foxy" ? "cam2A" as Room : "cam1A" as Room,
      moveTimer: 0,
      moveInterval: Math.max(5, a.moveInterval - (difficulty - 1) * 2),
    }));
    setAnimatronics(anims);
    setBattery(100);
    batteryRef.current = 100;
    setHour(0);
    setView("office");
    setLeftDoorClosed(false);
    setRightDoorClosed(false);
    setLeftLightOn(false);
    setRightLightOn(false);
    setScreamAnim(null);
    setPhase("playing");
  }, []);

  // ── GAME LOOP ──
  useEffect(() => {
    if (phase !== "playing") {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (hourTimerRef.current) clearInterval(hourTimerRef.current);
      return;
    }

    // Hour timer
    hourTimerRef.current = setInterval(() => {
      setHour(h => {
        if (h >= 5) {
          setPhase("win");
          return h;
        }
        return h + 1;
      });
    }, HOUR_DURATION);

    // Main tick: 1s
    gameLoopRef.current = setInterval(() => {
      if (phaseRef.current !== "playing") return;

      // Battery drain
      setLeftLightOn(ll => {
        setRightLightOn(rl => {
          setView(v => {
            setLeftDoorClosed(ld => {
              setRightDoorClosed(rd => {
                let drain = BATTERY_DRAIN_BASE;
                if (ld) drain += DOOR_DRAIN;
                if (rd) drain += DOOR_DRAIN;
                if (ll) drain += LIGHT_DRAIN;
                if (rl) drain += LIGHT_DRAIN;
                if (v === "cameras") drain += CAMERA_DRAIN;

                const newBat = clamp(batteryRef.current - drain, 0, 100);
                batteryRef.current = newBat;
                setBattery(newBat);

                if (newBat <= 0) {
                  setPhase("dead");
                  const dummyAnim = INITIAL_ANIMATRONICS[0];
                  setScreamAnim(dummyAnim);
                }
                return rd;
              });
              return ld;
            });
            return v;
          });
          return rl;
        });
        return ll;
      });

      // Move animatronics
      setAnimatronics(prev => {
        const next = prev.map(a => {
          if (a.room === "gone") return a;

          const newTimer = a.moveTimer + 1;
          if (newTimer < a.moveInterval) return { ...a, moveTimer: newTimer };

          // Time to move
          const currentRoom = a.room;

          // At left_door or right_door — try to get in
          if (currentRoom === "left_door") {
            // Check if door closed
            setLeftDoorClosed(ld => {
              if (!ld) {
                // Attack!
                setTimeout(() => {
                  if (phaseRef.current === "playing") {
                    triggerDeath(a);
                  }
                }, 100);
              }
              return ld;
            });
            return { ...a, moveTimer: 0, room: "gone" as const };
          }

          if (currentRoom === "right_door") {
            setRightDoorClosed(rd => {
              if (!rd) {
                setTimeout(() => {
                  if (phaseRef.current === "playing") {
                    triggerDeath(a);
                  }
                }, 100);
              }
              return rd;
            });
            return { ...a, moveTimer: 0, room: "gone" as const };
          }

          // Normal movement
          const roomData = ROOMS[currentRoom as Room];
          if (!roomData) return { ...a, moveTimer: 0 };

          const neighbors = roomData.neighbors;
          const nextRoomOptions: (Room | "left_door" | "right_door")[] = [...neighbors];

          // Bonnie goes left, others go right, foxy varies
          if (a.id === "bonnie" && (currentRoom === "cam2A" || currentRoom === "cam3")) {
            nextRoomOptions.push("left_door");
          }
          if ((a.id === "chica" || a.id === "freddy") && (currentRoom === "cam4A" || currentRoom === "cam4B")) {
            nextRoomOptions.push("right_door");
          }
          if (a.id === "foxy" && currentRoom === "cam1B") {
            nextRoomOptions.push("left_door");
          }

          const nextRoom = nextRoomOptions[Math.floor(Math.random() * nextRoomOptions.length)];

          // Static flash on move
          setShowStatic(true);
          setTimeout(() => setShowStatic(false), 150);

          return { ...a, moveTimer: 0, room: nextRoom };
        });
        return next;
      });
    }, 1000);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (hourTimerRef.current) clearInterval(hourTimerRef.current);
    };
  }, [phase, triggerDeath]);

  const handleScreamDone = () => {
    setScreamAnim(null);
  };

  return (
    <div
      className="w-screen h-screen relative overflow-hidden bg-black select-none"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* MENU */}
      {phase === "menu" && <MenuScreen onStart={() => startGame(night)} night={night} />}

      {/* DEAD */}
      {phase === "dead" && !screamAnim && <DeadScreen onRestart={() => { setNight(1); setPhase("menu"); }} />}

      {/* WIN */}
      {phase === "win" && (
        <WinScreen
          night={night}
          onNext={() => {
            const nextNight = night >= 5 ? 1 : night + 1;
            setNight(nextNight);
            setPhase("menu");
          }}
        />
      )}

      {/* PLAYING */}
      {(phase === "playing" || phase === "dead") && (
        <>
          <HUD
            hour={hour}
            battery={battery}
            night={night}
            view={view}
            onToggleCamera={() => setView(v => v === "cameras" ? "office" : "cameras")}
          />

          <div className="absolute inset-0 pt-10">
            {view === "office" ? (
              <OfficeView
                leftDoorClosed={leftDoorClosed}
                rightDoorClosed={rightDoorClosed}
                leftLightOn={leftLightOn}
                rightLightOn={rightLightOn}
                onLeftDoor={() => setLeftDoorClosed(v => !v)}
                onRightDoor={() => setRightDoorClosed(v => !v)}
                onLeftLight={() => setLeftLightOn(v => !v)}
                onRightLight={() => setRightLightOn(v => !v)}
                animatronics={animatronics}
                battery={battery}
              />
            ) : (
              <CameraView
                activeCamera={activeCamera}
                animatronics={animatronics}
                onSelectCamera={setActiveCamera}
                showStatic={showStatic}
              />
            )}
          </div>

          {/* Global static flash */}
          {showStatic && (
            <div className="absolute inset-0 z-20 pointer-events-none bg-white/5 animate-pulse" />
          )}

          {/* Scream */}
          {screamAnim && (
            <ScreamScreen anim={screamAnim} onDone={handleScreamDone} />
          )}
        </>
      )}

      <style>{`
        @keyframes scream {
          0% { opacity: 0; transform: scale(0.8); }
          10% { opacity: 1; transform: scale(1.1); }
          20% { transform: scale(0.95); }
          30% { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes screamEmoji {
          0% { transform: scale(0) rotate(-20deg); }
          30% { transform: scale(1.3) rotate(5deg); }
          50% { transform: scale(0.9) rotate(-3deg); }
          70% { transform: scale(1.1) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .animate-scream { animation: scream 0.3s ease-out forwards; }
        .animate-scream-emoji { animation: screamEmoji 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
}
