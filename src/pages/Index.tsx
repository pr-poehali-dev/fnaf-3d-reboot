import { useState, useEffect, useRef, useCallback } from "react";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type GamePhase = "menu" | "playing" | "dead" | "win";
type Direction = "left" | "right" | "forward" | "back";
type AnimId = "bonnie" | "chica" | "freddy" | "foxy";

interface Vec2 { x: number; y: number; }

interface Animatronic {
  id: AnimId;
  name: string;
  emoji: string;
  color: string;
  // grid position (0..MAP_W-1, 0..MAP_H-1)
  x: number;
  y: number;
  moveTimer: number;
  moveInterval: number; // ticks between moves
  active: boolean;
}

// ─── MAP ─────────────────────────────────────────────────────────────────────
// 0 = wall, 1 = floor, 2 = player start, 9 = door (left=col0 right=colMAX)
const MAP_W = 9;
const MAP_H = 9;
const RAW_MAP = [
  [0,0,0,0,1,0,0,0,0],
  [0,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,0,1,0],
  [0,1,0,0,1,0,0,1,0],
  [1,1,1,1,2,1,1,1,1],
  [0,1,0,0,1,0,0,1,0],
  [0,1,0,0,1,0,0,1,0],
  [0,1,1,1,1,1,1,1,0],
  [0,0,0,0,1,0,0,0,0],
];

// Player starts at the '2' cell
const PLAYER_START: Vec2 = { x: 4, y: 4 };

// ─── RAYCASTER ────────────────────────────────────────────────────────────────
const FOV = Math.PI / 3; // 60°
const HALF_FOV = FOV / 2;
const RAY_COUNT = 120;
const MAX_DEPTH = 12;

function isWall(map: number[][], x: number, y: number): boolean {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || xi >= MAP_W || yi < 0 || yi >= MAP_H) return true;
  return map[yi][xi] === 0;
}

interface RayHit {
  dist: number;
  wallX: number; // fractional hit pos (for texturing)
  side: 0 | 1;  // 0=NS, 1=EW
}

function castRay(map: number[][], px: number, py: number, angle: number): RayHit {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // DDA algorithm
  let mapX = Math.floor(px);
  let mapY = Math.floor(py);

  const deltaDistX = Math.abs(1 / dx);
  const deltaDistY = Math.abs(1 / dy);

  let stepX: number, stepY: number;
  let sideDistX: number, sideDistY: number;

  if (dx < 0) { stepX = -1; sideDistX = (px - mapX) * deltaDistX; }
  else        { stepX =  1; sideDistX = (mapX + 1 - px) * deltaDistX; }
  if (dy < 0) { stepY = -1; sideDistY = (py - mapY) * deltaDistY; }
  else        { stepY =  1; sideDistY = (mapY + 1 - py) * deltaDistY; }

  let side: 0 | 1 = 0;
  let hit = false;
  let depth = 0;

  while (!hit && depth < MAX_DEPTH * 10) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }
    if (isWall(map, mapX, mapY)) hit = true;
    depth++;
  }

  let dist: number;
  if (side === 0) dist = sideDistX - deltaDistX;
  else            dist = sideDistY - deltaDistY;

  // Wall X for texture
  let wallX: number;
  if (side === 0) wallX = py + dist * dy;
  else            wallX = px + dist * dx;
  wallX -= Math.floor(wallX);

  return { dist: Math.max(0.1, dist), wallX, side };
}

// ─── CANVAS RENDERER ─────────────────────────────────────────────────────────
interface RenderState {
  px: number; py: number; angle: number;
  map: number[][];
  animatronics: Animatronic[];
  flashlightOn: boolean;
  flickerAlpha: number;
  doorLeft: boolean;
  doorRight: boolean;
  hour: number;
}

function renderFrame(ctx: CanvasRenderingContext2D, W: number, H: number, s: RenderState) {
  const { px, py, angle, map, flashlightOn, flickerAlpha, doorLeft, doorRight } = s;

  // Clear
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // Ceiling gradient (dark reddish)
  const ceil = ctx.createLinearGradient(0, 0, 0, H / 2);
  ceil.addColorStop(0, "#0a0005");
  ceil.addColorStop(1, "#150010");
  ctx.fillStyle = ceil;
  ctx.fillRect(0, 0, W, H / 2);

  // Floor gradient
  const floor = ctx.createLinearGradient(0, H / 2, 0, H);
  floor.addColorStop(0, "#0d0008");
  floor.addColorStop(1, "#050003");
  ctx.fillStyle = floor;
  ctx.fillRect(0, H / 2, W, H / 2);

  // ── Raycasting ──
  const sliceW = W / RAY_COUNT;
  const zBuffer: number[] = new Array(RAY_COUNT);

  for (let i = 0; i < RAY_COUNT; i++) {
    const rayAngle = angle - HALF_FOV + (i / RAY_COUNT) * FOV;
    const hit = castRay(map, px, py, rayAngle);
    zBuffer[i] = hit.dist;

    // Fix fisheye
    const corrDist = hit.dist * Math.cos(rayAngle - angle);
    const wallH = Math.min(H, H / corrDist);
    const wallTop = (H - wallH) / 2;

    // Wall brightness (side shading + distance)
    const sideDim = hit.side === 1 ? 0.7 : 1.0;
    const distDim = Math.max(0, 1 - corrDist / MAX_DEPTH);
    const bright = sideDim * distDim;

    // Flashlight cone
    const rayFrac = (i / RAY_COUNT - 0.5) * 2; // -1..1
    const coneLight = flashlightOn
      ? Math.max(0, 1 - Math.abs(rayFrac) * 2.5) * 0.8
      : 0;
    const ambientLight = 0.04;
    const totalLight = Math.min(1, (ambientLight + coneLight) * bright);

    // Wall color: purple/crimson tones with texture
    const texStripe = Math.floor(hit.wallX * 8) % 2 === 0 ? 1.0 : 0.85;
    const r = Math.floor(80 * totalLight * texStripe);
    const g = Math.floor(5 * totalLight * texStripe);
    const b = Math.floor(90 * totalLight * texStripe);

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(Math.floor(i * sliceW), Math.floor(wallTop), Math.ceil(sliceW) + 1, Math.ceil(wallH));

    // Baseboard
    if (corrDist < MAX_DEPTH * 0.5) {
      ctx.fillStyle = `rgba(30,0,35,${totalLight * 0.6})`;
      ctx.fillRect(Math.floor(i * sliceW), Math.floor(wallTop + wallH - 4), Math.ceil(sliceW) + 1, 4);
    }
  }

  // ── Flashlight cone overlay ──
  if (flashlightOn) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
    grad.addColorStop(0,   "rgba(255,230,180,0.18)");
    grad.addColorStop(0.4, "rgba(255,180,100,0.06)");
    grad.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Sprite rendering (animatronics) ──
  const sprites: { anim: Animatronic; dist: number }[] = [];
  for (const anim of s.animatronics) {
    if (!anim.active) continue;
    const dx = anim.x + 0.5 - px;
    const dy = anim.y + 0.5 - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.5 || dist > MAX_DEPTH) continue;
    sprites.push({ anim, dist });
  }
  sprites.sort((a, b) => b.dist - a.dist);

  for (const { anim, dist } of sprites) {
    const dx = anim.x + 0.5 - px;
    const dy = anim.y + 0.5 - py;

    // Transform to camera space
    const invDet = 1.0 / (Math.cos(angle) * Math.sin(angle + Math.PI / 2) - Math.sin(angle) * Math.cos(angle + Math.PI / 2));
    const transformX = invDet * (Math.cos(angle + Math.PI / 2) * dx - Math.cos(angle) * dy);
    const transformY = invDet * (Math.sin(angle) * dx - Math.sin(angle + Math.PI / 2) * dy) ;

    // Hmm simplify: just use angle to sprite
    const spriteAngle = Math.atan2(dy, dx);
    let angleDiff = spriteAngle - angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    if (Math.abs(angleDiff) > HALF_FOV * 1.5) continue;

    const screenX = W / 2 + (angleDiff / HALF_FOV) * (W / 2);
    const spriteH = Math.min(H * 1.2, H / dist * 1.0);
    const spriteTop = H / 2 - spriteH * 0.6;
    const spriteW = spriteH * 0.7;

    // Check occlusion via zBuffer
    const stripStart = Math.floor(screenX - spriteW / 2);
    const stripEnd   = Math.floor(screenX + spriteW / 2);
    let visible = false;
    for (let s = Math.max(0, stripStart); s < Math.min(W, stripEnd); s++) {
      const zIdx = Math.floor((s / W) * RAY_COUNT);
      if (zBuffer[zIdx] > dist) { visible = true; break; }
    }
    if (!visible) continue;

    // Sprite brightness from flashlight
    const spriteFrac = (screenX / W - 0.5) * 2;
    const spriteLight = flashlightOn
      ? Math.max(0.05, 1 - Math.abs(spriteFrac) * 2.0) * Math.max(0, 1 - dist / 6)
      : Math.max(0, 0.03 * (1 - dist / MAX_DEPTH));

    // Draw sprite as emoji scaled
    ctx.save();
    ctx.globalAlpha = Math.min(1, spriteLight * 3 + 0.1);
    const fontSize = Math.max(12, spriteH * 0.55);
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Glow effect when close
    if (dist < 2.5) {
      ctx.shadowColor = anim.color;
      ctx.shadowBlur = 30 * (1 - dist / 2.5);
    }

    ctx.fillText(anim.emoji, screenX, H / 2 - spriteH * 0.05);
    ctx.restore();
  }

  // ── Door overlays ──
  if (doorLeft) {
    const dg = ctx.createLinearGradient(0, 0, W * 0.18, 0);
    dg.addColorStop(0, "rgba(10,0,15,0.95)");
    dg.addColorStop(1, "rgba(10,0,15,0)");
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, W * 0.18, H);
    ctx.fillStyle = "rgba(80,0,100,0.3)";
    ctx.fillRect(0, H * 0.1, 12, H * 0.8);
  }
  if (doorRight) {
    const dg = ctx.createLinearGradient(W, 0, W * 0.82, 0);
    dg.addColorStop(0, "rgba(10,0,15,0.95)");
    dg.addColorStop(1, "rgba(10,0,15,0)");
    ctx.fillStyle = dg;
    ctx.fillRect(W * 0.82, 0, W * 0.18, H);
    ctx.fillStyle = "rgba(80,0,100,0.3)";
    ctx.fillRect(W - 12, H * 0.1, 12, H * 0.8);
  }

  // ── Vignette ──
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // ── Flicker noise ──
  if (flickerAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flickerAlpha * 0.08})`;
    ctx.fillRect(0, 0, W, H);
    // Scanlines
    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = `rgba(0,0,0,${flickerAlpha * 0.3})`;
      ctx.fillRect(0, y, W, 2);
    }
  }

  // ── Hour display (subtle) ──
  ctx.fillStyle = "rgba(150,0,180,0.25)";
  ctx.font = "11px 'Courier New'";
  ctx.textAlign = "right";
  ctx.fillText(`${s.hour === 0 ? "12" : s.hour}:00 AM`, W - 10, H - 10);
}

// ─── ANIMATRONIC DEFINITIONS ─────────────────────────────────────────────────
function makeAnimatronics(night: number): Animatronic[] {
  const speed = Math.max(4, 9 - night);
  return [
    { id: "bonnie",  name: "Бонни",  emoji: "🐰", color: "#7C3AED", x: 0, y: 4, moveTimer: 0, moveInterval: speed,     active: true },
    { id: "chica",   name: "Чика",   emoji: "🐦", color: "#D97706", x: 8, y: 4, moveTimer: 0, moveInterval: speed + 1, active: true },
    { id: "freddy",  name: "Фредди", emoji: "🐻", color: "#92400E", x: 4, y: 0, moveTimer: 0, moveInterval: speed + 2, active: night >= 2 },
    { id: "foxy",    name: "Фокси",  emoji: "🦊", color: "#DC2626", x: 4, y: 8, moveTimer: 0, moveInterval: speed - 1, active: night >= 3 },
  ];
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef({
    px: PLAYER_START.x + 0.5,
    py: PLAYER_START.y + 0.5,
    angle: 0,
    map: RAW_MAP.map(r => [...r]),
    animatronics: makeAnimatronics(1),
    flashlightOn: false,
    flickerAlpha: 0,
    doorLeft: false,
    doorRight: false,
    battery: 100,
    hour: 0,
    night: 1,
    phase: "menu" as GamePhase,
    keys: {} as Record<string, boolean>,
    moveTimer: 0,
    animTick: 0,
    hourTick: 0,
    scream: null as Animatronic | null,
    screamTimer: 0,
    mouseDX: 0,
  });
  const rafRef    = useRef<number>(0);

  // React UI state (mirrors stateRef for rendering React UI)
  const [phase,       setPhase]       = useState<GamePhase>("menu");
  const [battery,     setBattery]     = useState(100);
  const [hour,        setHour]        = useState(0);
  const [night,       setNight]       = useState(1);
  const [doorLeft,    setDoorLeft]    = useState(false);
  const [doorRight,   setDoorRight]   = useState(false);
  const [flashOn,     setFlashOn]     = useState(false);
  const [scream,      setScream]      = useState<Animatronic | null>(null);
  const [winNight,    setWinNight]    = useState(1);

  const s = stateRef.current;

  // ── Input ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => { s.keys[e.code] = true; };
    const up   = (e: KeyboardEvent) => { s.keys[e.code] = false; };
    const move = (e: MouseEvent)    => { if (s.phase === "playing") s.mouseDX += e.movementX; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup",   up);
      window.removeEventListener("mousemove", move);
    };
  }, [s]);

  // ── Canvas pointer lock ──
  const requestLock = useCallback(() => {
    canvasRef.current?.requestPointerLock();
  }, []);

  // ── Start night ──
  const startNight = useCallback((n: number) => {
    s.px = PLAYER_START.x + 0.5;
    s.py = PLAYER_START.y + 0.5;
    s.angle = 0;
    s.map = RAW_MAP.map(r => [...r]);
    s.animatronics = makeAnimatronics(n);
    s.battery = 100;
    s.hour = 0;
    s.night = n;
    s.phase = "playing";
    s.doorLeft = false;
    s.doorRight = false;
    s.flashlightOn = false;
    s.flickerAlpha = 0;
    s.scream = null;
    s.screamTimer = 0;
    s.moveTimer = 0;
    s.animTick = 0;
    s.hourTick = 0;
    setBattery(100);
    setHour(0);
    setNight(n);
    setDoorLeft(false);
    setDoorRight(false);
    setFlashOn(false);
    setScream(null);
    setPhase("playing");
  }, [s]);

  // ── Toggle doors ──
  const toggleLeft  = useCallback(() => {
    s.doorLeft = !s.doorLeft;
    setDoorLeft(v => !v);
  }, [s]);

  const toggleRight = useCallback(() => {
    s.doorRight = !s.doorRight;
    setDoorRight(v => !v);
  }, [s]);

  const toggleFlash = useCallback(() => {
    s.flashlightOn = !s.flashlightOn;
    setFlashOn(v => !v);
  }, [s]);

  // ── Death ──
  const triggerDeath = useCallback((anim: Animatronic) => {
    s.phase = "dead";
    s.scream = anim;
    s.screamTimer = 150;
    setPhase("dead");
    setScream(anim);
  }, [s]);

  // ── Main loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let lastTime = 0;
    let tick = 0;

    function loop(ts: number) {
      rafRef.current = requestAnimationFrame(loop);
      const dt = ts - lastTime;
      if (dt < 16) return; // cap ~60fps
      lastTime = ts;
      tick++;

      const s = stateRef.current;
      const W = canvas!.width;
      const H = canvas!.height;

      if (s.phase === "menu" || s.phase === "win") {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        return;
      }

      if (s.phase === "dead") {
        // Scream flash
        if (s.screamTimer > 0) {
          s.screamTimer -= dt / 16;
          const t = s.screamTimer / 150;
          ctx.fillStyle = `rgb(${Math.floor(180 * t)},0,0)`;
          ctx.fillRect(0, 0, W, H);
          s.flickerAlpha = t;
        }
        return;
      }

      // ── Playing ──

      // Mouse look
      const MOUSE_SENS = 0.002;
      s.angle += s.mouseDX * MOUSE_SENS;
      s.mouseDX = 0;

      // Keyboard turn
      const TURN_SPEED = 0.035;
      if (s.keys["ArrowLeft"]  || s.keys["KeyA"]) s.angle -= TURN_SPEED;
      if (s.keys["ArrowRight"] || s.keys["KeyD"]) s.angle += TURN_SPEED;

      // Movement
      const MOVE_SPEED = 0.05;
      let nx = s.px;
      let ny = s.py;
      if (s.keys["ArrowUp"] || s.keys["KeyW"]) {
        nx += Math.cos(s.angle) * MOVE_SPEED;
        ny += Math.sin(s.angle) * MOVE_SPEED;
      }
      if (s.keys["ArrowDown"] || s.keys["KeyS"]) {
        nx -= Math.cos(s.angle) * MOVE_SPEED;
        ny -= Math.sin(s.angle) * MOVE_SPEED;
      }
      // Collision
      if (!isWall(s.map, nx, s.py)) s.px = nx;
      if (!isWall(s.map, s.px, ny)) s.py = ny;

      // Flashlight key
      if (s.keys["KeyF"] && !s._fPrev) {
        s.flashlightOn = !s.flashlightOn;
        setFlashOn(s.flashlightOn);
      }
      (s as Record<string, unknown>)._fPrev = s.keys["KeyF"];

      // Battery drain
      s.battery -= 0.008;
      if (s.flashlightOn) s.battery -= 0.012;
      if (s.doorLeft)  s.battery -= 0.010;
      if (s.doorRight) s.battery -= 0.010;
      s.battery = Math.max(0, s.battery);
      if (tick % 10 === 0) setBattery(Math.floor(s.battery));

      if (s.battery <= 0) {
        s.flashlightOn = false;
        setFlashOn(false);
      }

      // Hour tick (every ~600 frames ≈ 10s real)
      s.hourTick++;
      if (s.hourTick >= 600) {
        s.hourTick = 0;
        s.hour++;
        setHour(s.hour);
        if (s.hour >= 6) {
          s.phase = "win";
          setWinNight(s.night);
          setPhase("win");
          return;
        }
      }

      // Flicker
      s.flickerAlpha = Math.max(0, s.flickerAlpha - 0.05);
      if (Math.random() < 0.003) s.flickerAlpha = Math.random() * 0.6;

      // ── Animatronic AI ──
      s.animTick++;
      if (s.animTick >= 60) {
        s.animTick = 0;
        for (const anim of s.animatronics) {
          if (!anim.active) continue;
          anim.moveTimer++;
          if (anim.moveTimer < anim.moveInterval) continue;
          anim.moveTimer = 0;

          const dxTotal = (PLAYER_START.x + 0.5) - (anim.x + 0.5); // aim toward office
          const dyTotal = (PLAYER_START.y + 0.5) - (anim.y + 0.5);

          // Choose direction toward player with some randomness
          const dirs: Direction[] = ["forward", "back", "left", "right"];
          const weights = dirs.map(d => {
            let wx = anim.x, wy = anim.y;
            if (d === "forward") wy--;
            if (d === "back")    wy++;
            if (d === "left")    wx--;
            if (d === "right")   wx++;
            if (isWall(s.map, wx + 0.5, wy + 0.5)) return -999;
            const ddx = (PLAYER_START.x + 0.5) - (wx + 0.5);
            const ddy = (PLAYER_START.y + 0.5) - (wy + 0.5);
            return -(ddx * ddx + ddy * ddy) + (Math.random() - 0.5) * 4;
          });

          let best = -1;
          let bestW = -Infinity;
          for (let i = 0; i < dirs.length; i++) {
            if (weights[i] > bestW) { bestW = weights[i]; best = i; }
          }

          if (best >= 0) {
            const d = dirs[best];
            if (d === "forward") anim.y--;
            if (d === "back")    anim.y++;
            if (d === "left")    anim.x--;
            if (d === "right")   anim.x++;
          }

          // Clamp to map
          anim.x = Math.max(0, Math.min(MAP_W - 1, anim.x));
          anim.y = Math.max(0, Math.min(MAP_H - 1, anim.y));

          // Check if reached player
          const distToPlayer = Math.hypot(anim.x + 0.5 - s.px, anim.y + 0.5 - s.py);
          if (distToPlayer < 1.2) {
            // Check door block
            const isLeft  = anim.x === 0 && s.doorLeft;
            const isRight = anim.x === MAP_W - 1 && s.doorRight;
            if (!isLeft && !isRight) {
              s.flickerAlpha = 1;
              setTimeout(() => triggerDeath(anim), 300);
              return;
            }
          }
        }
      }

      // ── Render ──
      renderFrame(ctx, W, H, {
        px: s.px, py: s.py, angle: s.angle,
        map: s.map,
        animatronics: s.animatronics,
        flashlightOn: s.flashlightOn,
        flickerAlpha: s.flickerAlpha,
        doorLeft: s.doorLeft,
        doorRight: s.doorRight,
        hour: s.hour,
      });
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [triggerDeath]);

  // ── Scream auto-clear ──
  useEffect(() => {
    if (!scream) return;
    const t = setTimeout(() => {
      setScream(null);
    }, 2500);
    return () => clearTimeout(t);
  }, [scream]);

  const batteryColor = battery > 50 ? "#22c55e" : battery > 20 ? "#f59e0b" : "#ef4444";
  const hourLabel = hour === 0 ? "12:00 AM" : `${hour}:00 AM`;

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative select-none"
      style={{ fontFamily: "'Courier New', monospace" }}>

      {/* CANVAS */}
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        onClick={requestLock}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: "pixelated", cursor: "crosshair" }}
      />

      {/* ── MENU ── */}
      {phase === "menu" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black">
          <div className="text-center max-w-md px-6">
            <div className="text-7xl mb-4 animate-bounce">🐻</div>
            <h1 className="text-3xl font-black text-purple-400 tracking-widest mb-1">FREDDY&apos;S</h1>
            <p className="text-purple-700 text-sm mb-1 tracking-widest">ПЯТЬ НОЧЕЙ</p>
            <p className="text-gray-600 text-xs mb-8">Псевдо-3D хоррор</p>

            <button
              onClick={() => startNight(night)}
              className="px-10 py-3 border-2 border-purple-600 text-purple-300 font-black text-sm rounded hover:bg-purple-900/30 transition-all hover:scale-105 tracking-widest mb-6"
            >
              ► НОЧЬ {night}
            </button>

            <div className="text-gray-700 text-xs leading-6 space-y-1 mt-4">
              <div><span className="text-purple-600">WASD / ↑↓←→</span> — движение и поворот</div>
              <div><span className="text-purple-600">МЫШЬ</span> — осмотреться (кликни для захвата)</div>
              <div><span className="text-purple-600">F</span> — фонарик</div>
              <div><span className="text-purple-600">Q / E</span> — левая / правая дверь</div>
              <div className="pt-2 text-gray-800">Продержись до 6:00 утра. Не трать батарею зря.</div>
            </div>

            <div className="flex gap-6 justify-center mt-8">
              {makeAnimatronics(night).filter(a => a.active).map(a => (
                <div key={a.id} className="text-center">
                  <div className="text-2xl">{a.emoji}</div>
                  <div className="text-xs mt-1" style={{ color: a.color }}>{a.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── HUD ── */}
      {phase === "playing" && (
        <>
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2 bg-black/70">
            <div className="text-xs text-purple-500">
              НОЧЬ <span className="text-purple-300 font-bold">{night}</span>
              &nbsp;&nbsp;
              <span className="text-purple-700">{hourLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: batteryColor }}>⚡</span>
              <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${battery}%`, background: batteryColor }} />
              </div>
              <span style={{ color: batteryColor }}>{battery}%</span>
            </div>
          </div>

          {/* Crosshair */}
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
            <div className="w-4 h-px bg-white/20" />
            <div className="absolute w-px h-4 bg-white/20" />
          </div>

          {/* Left door button */}
          <div className="absolute left-3 bottom-16 z-30 flex flex-col gap-2">
            <button
              onClick={toggleLeft}
              className={`px-3 py-2 text-xs font-black border rounded transition-all ${
                doorLeft
                  ? "bg-red-900/50 border-red-500 text-red-400"
                  : "bg-black/60 border-gray-700 text-gray-500 hover:border-purple-700"
              }`}
            >
              ◄ ДВЕРЬ<br />[Q]
            </button>
          </div>

          {/* Right door button */}
          <div className="absolute right-3 bottom-16 z-30 flex flex-col gap-2">
            <button
              onClick={toggleRight}
              className={`px-3 py-2 text-xs font-black border rounded transition-all ${
                doorRight
                  ? "bg-red-900/50 border-red-500 text-red-400"
                  : "bg-black/60 border-gray-700 text-gray-500 hover:border-purple-700"
              }`}
            >
              ДВЕРЬ ►<br />[E]
            </button>
          </div>

          {/* Flashlight button */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <button
              onClick={toggleFlash}
              className={`px-6 py-2 text-xs font-black border rounded-full transition-all ${
                flashOn
                  ? "bg-yellow-900/40 border-yellow-500 text-yellow-300"
                  : "bg-black/60 border-gray-700 text-gray-600 hover:border-yellow-800"
              }`}
            >
              🔦 ФОНАРИК [F]
            </button>
          </div>

          {/* Controls hint */}
          <div className="absolute bottom-4 right-4 z-30 text-gray-800 text-xs text-right leading-5">
            WASD / ↑↓←→ движение<br/>
            Мышь — обзор
          </div>

          {/* Low battery warning */}
          {battery < 15 && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 text-red-500 text-xs font-black animate-pulse tracking-widest">
              ⚠ БАТАРЕЯ РАЗРЯЖАЕТСЯ ⚠
            </div>
          )}

          {/* Key handlers via invisible overlay */}
          <KeyHandler
            onQ={toggleLeft}
            onE={toggleRight}
            onF={toggleFlash}
          />
        </>
      )}

      {/* ── SCREAM ── */}
      {scream && phase === "dead" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black animate-scream-bg">
          <div
            className="text-[140px] leading-none animate-scream-pop"
            style={{ filter: `drop-shadow(0 0 60px ${scream.color}) drop-shadow(0 0 100px ${scream.color})` }}
          >
            {scream.emoji}
          </div>
          <div className="text-3xl font-black mt-4 tracking-widest" style={{ color: scream.color }}>
            {scream.name.toUpperCase()}
          </div>
          <div className="text-red-500 text-lg font-bold mt-2 animate-pulse">ВЫ МЕРТВЫ</div>
        </div>
      )}

      {/* ── DEAD (after scream) ── */}
      {phase === "dead" && !scream && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black">
          <div className="text-5xl mb-4">💀</div>
          <h2 className="text-2xl font-black text-red-600 tracking-widest mb-2">GAME OVER</h2>
          <p className="text-red-900 text-sm mb-8 font-mono">Тебя нашли в темноте...</p>
          <button
            onClick={() => { setPhase("menu"); s.phase = "menu"; }}
            className="px-8 py-3 border-2 border-red-700 text-red-500 font-black text-sm rounded hover:bg-red-900/20 transition-all"
          >
            ↺ СНОВА
          </button>
        </div>
      )}

      {/* ── WIN ── */}
      {phase === "win" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black">
          <div className="text-5xl mb-4">⭐</div>
          <h2 className="text-2xl font-black text-purple-400 tracking-widest mb-2">
            {winNight >= 5 ? "ВЫ ВЫЖИЛИ!" : `НОЧЬ ${winNight} ПРОЙДЕНА`}
          </h2>
          <p className="text-purple-800 text-sm mb-8">
            {winNight >= 5 ? "Все 5 ночей позади." : "Ещё одна ночь впереди..."}
          </p>
          <button
            onClick={() => {
              const next = winNight >= 5 ? 1 : winNight + 1;
              setNight(next);
              s.night = next;
              setPhase("menu");
              s.phase = "menu";
            }}
            className="px-8 py-3 border-2 border-purple-600 text-purple-400 font-black text-sm rounded hover:bg-purple-900/20 transition-all"
          >
            {winNight >= 5 ? "↺ СНАЧАЛА" : `► НОЧЬ ${winNight + 1}`}
          </button>
        </div>
      )}

      <style>{`
        @keyframes screamBg {
          0%   { background: #000; }
          10%  { background: #1a0000; }
          30%  { background: #0a0000; }
          100% { background: #000; }
        }
        @keyframes screamPop {
          0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
          40%  { transform: scale(1.4) rotate(8deg);  opacity: 1; }
          60%  { transform: scale(0.9) rotate(-4deg); }
          80%  { transform: scale(1.1) rotate(2deg); }
          100% { transform: scale(1)   rotate(0deg); }
        }
        .animate-scream-bg  { animation: screamBg  2.5s ease forwards; }
        .animate-scream-pop { animation: screamPop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
      `}</style>
    </div>
  );
}

// ── Key handler component ──────────────────────────────────────────────────────
function KeyHandler({ onQ, onE, onF }: { onQ: () => void; onE: () => void; onF: () => void }) {
  const prevQ = useRef(false);
  const prevE = useRef(false);
  const prevF = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "KeyQ" && !prevQ.current) { onQ(); }
      if (e.code === "KeyE" && !prevE.current) { onE(); }
      if (e.code === "KeyF" && !prevF.current) { onF(); }
      prevQ.current = e.code === "KeyQ";
      prevE.current = e.code === "KeyE";
      prevF.current = e.code === "KeyF";
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyQ") prevQ.current = false;
      if (e.code === "KeyE") prevE.current = false;
      if (e.code === "KeyF") prevF.current = false;
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup",   up);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup",   up);
    };
  }, [onQ, onE, onF]);

  return null;
}