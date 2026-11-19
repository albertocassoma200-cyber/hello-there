import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import "../styles.css";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Vida de Bairro — Mundo Aberto" },
      { name: "description", content: "Explora uma cidade inspirada nos bairros de Luanda, conduz carros e completa missões." },
      { property: "og:title", content: "Vida de Bairro — Mundo Aberto" },
      { property: "og:description", content: "A cidade é tua. Explora, conduz e vive as tuas próprias aventuras." },
    ],
  }),
});

type Car = { x: number; y: number; angle: number; color: string; name: string; occupied: boolean };
type Walker = { x: number; y: number; phase: number; color: string; speed: number };
type MissionPhase = "pickup" | "deliver" | "done";

const WORLD_W = 2480;
const WORLD_H = 1840;
const ROAD_X = [360, 920, 1480, 2040];
const ROAD_Y = [270, 720, 1170, 1620];
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

const houses = (() => {
  const result: Array<{ x: number; y: number; w: number; h: number; color: string; roof: string; shop?: string }> = [];
  const walls = ["#c78a62", "#d4b17c", "#a96f56", "#c6c0a0", "#b77d72", "#d1a66c", "#8f8d79", "#c9c6b6"];
  const roofs = ["#9e5944", "#7c6e5b", "#b45f49", "#887b68", "#d0b28b"];
  for (let y = 75, row = 0; y < WORLD_H - 80; y += 128, row++) {
    for (let x = 75, col = 0; x < WORLD_W - 80; x += 145, col++) {
      const road = ROAD_X.some((v) => Math.abs(x - v) < 94) || ROAD_Y.some((v) => Math.abs(y - v) < 84);
      const open = (x > 1020 && x < 1400 && y > 800 && y < 1080) || (x > 1500 && x < 1950 && y > 760 && y < 1060);
      if (road || open || (row * 7 + col * 11) % 13 === 0) continue;
      const dense = x > 1510 || y > 1250;
      result.push({
        x: x + ((row + col) % 2) * 12, y: y + ((row * 3 + col) % 2) * 9,
        w: dense ? 104 + ((row + col) % 3) * 12 : 94 + ((row * 3 + col) % 4) * 11,
        h: dense ? 80 + ((row * 5 + col) % 3) * 9 : 76 + ((row + col * 2) % 4) * 8,
        color: walls[(row * 5 + col * 3) % walls.length],
        roof: roofs[(row + col * 2) % roofs.length],
        shop: (row * 3 + col) % 19 === 0 ? ["CANTINA", "BARBEARIA", "OFICINA", "MERCEARIA"][(row + col) % 4] : undefined,
      });
    }
  }
  return result;
})();

const makeCars = (): Car[] => [
  { x: 505, y: 270, angle: 0, color: "#d84e36", name: "Toyota Corolla", occupied: false },
  { x: 1090, y: 720, angle: Math.PI / 2, color: "#e7e3d8", name: "Hyundai i10", occupied: false },
  { x: 1770, y: 1170, angle: Math.PI, color: "#357b9a", name: "Pick-up", occupied: false },
  { x: 2070, y: 1620, angle: 0, color: "#d6b33d", name: "Táxi", occupied: false },
  { x: 760, y: 1170, angle: -Math.PI / 2, color: "#5b8657", name: "Jipe", occupied: false },
];

const makeWalkers = (): Walker[] => Array.from({ length: 28 }, (_, i) => ({
  x: 120 + ((i * 271) % 2220), y: 110 + ((i * 193) % 1600), phase: i * 1.7,
  color: ["#e7ae79", "#8b563e", "#d6a16c", "#6f4539"][i % 4], speed: 8 + (i % 4) * 2,
}));

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef({
    player: { x: 455, y: 390, angle: 0, money: 0 },
    cars: makeCars(), walkers: makeWalkers(), keys: new Set<string>(), currentCar: -1,
    mission: "pickup" as MissionPhase,
    cash: [{ x: 720, y: 1170, value: 500 }, { x: 1860, y: 720, value: 750 }, { x: 2240, y: 1370, value: 500 }],
    night: false, time: 0, lastHud: 0,
    message: "Bem-vindo! Vai até ao mercado buscar a encomenda.", messageUntil: 5,
  });
  const [money, setMoney] = useState(0);
  const [mission, setMission] = useState<MissionPhase>("pickup");
  const [inCar, setInCar] = useState(false);
  const [night, setNight] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState("WASD ou setas para andar");
  const [message, setMessage] = useState("Bem-vindo! Vai até ao mercado buscar a encomenda.");
  const [full, setFull] = useState(false);

  const setKey = useCallback((key: string, pressed: boolean) => {
    if (pressed) gameRef.current.keys.add(key);
    else gameRef.current.keys.delete(key);
  }, []);

  const interact = useCallback(() => {
    const g = gameRef.current;
    if (g.currentCar >= 0) {
      const car = g.cars[g.currentCar];
      car.occupied = false;
      g.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 42;
      g.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 42;
      g.currentCar = -1;
      setInCar(false);
      g.message = "Saíste do veículo.";
      g.messageUntil = g.time + 2.8;
      return;
    }
    const nearbyCar = g.cars.findIndex((car) => distance(g.player.x, g.player.y, car.x, car.y) < 66);
    if (nearbyCar >= 0) {
      g.currentCar = nearbyCar;
      g.cars[nearbyCar].occupied = true;
      setInCar(true);
      g.message = "Entraste no " + g.cars[nearbyCar].name + ". W/S acelera · A/D vira.";
      g.messageUntil = g.time + 4;
      return;
    }
    if (g.mission === "pickup" && distance(g.player.x, g.player.y, 1255, 900) < 110) {
      g.mission = "deliver";
      setMission("deliver");
      g.message = "Encomenda recolhida! Leva-a à Dona Zefa, no Novo Horizonte.";
      g.messageUntil = g.time + 5;
    } else if (g.mission === "deliver" && distance(g.player.x, g.player.y, 2140, 1540) < 120) {
      g.mission = "done";
      setMission("done");
      g.player.money += 5000;
      setMoney(g.player.money);
      g.message = "Missão concluída! Recebeste 5.000 Kz. Boa, chefe!";
      g.messageUntil = g.time + 5;
    } else {
      g.message = "Procura um carro ou o marcador amarelo da missão.";
      g.messageUntil = g.time + 2.5;
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const element = document.getElementById("game-frame");
    try {
      if (!document.fullscreenElement && element) {
        await element.requestFullscreen();
        setFull(true);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFull(false);
      }
    } catch {
      setMessage("O modo de ecrã inteiro não está disponível neste navegador.");
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0, previous = 0, width = 0, height = 0, dpr = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(320, rect.width);
      height = Math.max(320, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    };
    const drawCar = (car: Car) => {
      ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
      ctx.fillStyle = "rgba(0,0,0,.25)"; rr(-25, -13, 55, 31, 8); ctx.fill();
      ctx.fillStyle = car.color; rr(-27, -15, 54, 30, 7); ctx.fill();
      ctx.fillStyle = "#25333b"; rr(-13, -12, 25, 24, 5); ctx.fill();
      ctx.fillStyle = "#9fc4ca"; ctx.fillRect(-9, -10, 17, 7); ctx.fillRect(-9, 3, 17, 7);
      ctx.fillStyle = "#ffe3a5"; ctx.fillRect(22, -10, 4, 6); ctx.fillRect(22, 4, 4, 6);
      ctx.fillStyle = "#22252a"; ctx.fillRect(-18, -17, 10, 4); ctx.fillRect(8, -17, 10, 4);
      ctx.fillRect(-18, 13, 10, 4); ctx.fillRect(8, 13, 10, 4);
      if (car.occupied) { ctx.strokeStyle = "#f8d34d"; ctx.lineWidth = 2; rr(-31, -19, 62, 38, 9); ctx.stroke(); }
      ctx.restore();
    };

    const drawWorld = () => {
      const g = gameRef.current;
      const subject = g.currentCar >= 0 ? g.cars[g.currentCar] : g.player;
      const cx = clamp(subject.x - width / 2, 0, WORLD_W - width);
      const cy = clamp(subject.y - height / 2, 0, WORLD_H - height);
      ctx.clearRect(0, 0, width, height);
      ctx.save(); ctx.translate(-cx, -cy);
      ctx.fillStyle = "#a89b72"; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.fillStyle = "#b7a77a"; ctx.fillRect(0, 0, 930, WORLD_H);
      ctx.fillStyle = "#988966"; ctx.fillRect(1500, 0, 980, WORLD_H);
      ctx.fillStyle = "#81926b"; ctx.fillRect(990, 820, 410, 265);
      for (let i = 0; i < 180; i++) {
        ctx.fillStyle = i % 2 ? "rgba(68,90,54,.10)" : "rgba(255,235,173,.10)";
        ctx.beginPath(); ctx.arc((i * 173) % WORLD_W, (i * 293) % WORLD_H, 4 + (i % 8), 0, Math.PI * 2); ctx.fill();
      }
      ROAD_X.forEach((x) => {
        ctx.fillStyle = "#c9bda0"; ctx.fillRect(x - 61, 0, 122, WORLD_H);
        ctx.fillStyle = "#42494a"; ctx.fillRect(x - 48, 0, 96, WORLD_H);
        ctx.fillStyle = "rgba(255,255,255,.24)"; ctx.fillRect(x - 52, 0, 3, WORLD_H); ctx.fillRect(x + 49, 0, 3, WORLD_H);
        ctx.strokeStyle = "rgba(245,225,160,.72)"; ctx.lineWidth = 2; ctx.setLineDash([22, 20]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke(); ctx.setLineDash([]);
      });
      ROAD_Y.forEach((y) => {
        ctx.fillStyle = "#c9bda0"; ctx.fillRect(0, y - 60, WORLD_W, 120);
        ctx.fillStyle = "#42494a"; ctx.fillRect(0, y - 47, WORLD_W, 94);
        ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillRect(0, y - 51, WORLD_W, 3); ctx.fillRect(0, y + 48, WORLD_W, 3);
        ctx.strokeStyle = "rgba(245,225,160,.72)"; ctx.lineWidth = 2; ctx.setLineDash([22, 20]);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke(); ctx.setLineDash([]);
      });
      ctx.strokeStyle = "#b7a886"; ctx.lineWidth = 22; ctx.beginPath();
      ctx.moveTo(1530, 470); ctx.lineTo(1680, 540); ctx.lineTo(1790, 660); ctx.lineTo(1950, 690); ctx.lineTo(2190, 840);
      ctx.moveTo(1520, 1390); ctx.lineTo(1700, 1300); ctx.lineTo(1830, 1400); ctx.lineTo(2020, 1360); ctx.lineTo(2280, 1460); ctx.stroke();

      houses.forEach((h, i) => {
        ctx.fillStyle = "rgba(28,30,25,.22)"; rr(h.x + 7, h.y + 9, h.w, h.h, 4); ctx.fill();
        ctx.fillStyle = h.color; rr(h.x, h.y, h.w, h.h, 4); ctx.fill();
        ctx.fillStyle = h.roof; ctx.fillRect(h.x + 5, h.y + 5, h.w - 10, h.h - 10);
        ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(h.x + 8, h.y + 8, h.w - 16, 5);
        ctx.fillStyle = "#675c50"; ctx.fillRect(h.x + h.w * .42, h.y + h.h - 18, 15, 13);
        if (i % 3 === 0) { ctx.fillStyle = "#d8c4a0"; ctx.fillRect(h.x + h.w * .68, h.y + 18, 16, 12); }
        if (h.shop) {
          ctx.fillStyle = "#f1d272"; rr(h.x + 8, h.y + 12, h.w - 16, 15, 3); ctx.fill();
          ctx.fillStyle = "#554632"; ctx.font = "bold 8px Arial"; ctx.textAlign = "center"; ctx.fillText(h.shop, h.x + h.w / 2, h.y + 23);
        }
      });

      // Market square and five-a-side football pitch.
      ctx.fillStyle = "#d9c99d"; rr(1010, 825, 355, 235, 16); ctx.fill();
      ctx.fillStyle = "#b58c58"; ctx.fillRect(1040, 850, 92, 70); ctx.fillStyle = "#df5a45"; ctx.fillRect(1040, 844, 92, 15);
      ctx.fillStyle = "#42584a"; ctx.fillRect(1160, 850, 92, 70); ctx.fillStyle = "#e9c54d"; ctx.fillRect(1160, 844, 92, 15);
      ctx.fillStyle = "#fff1c6"; ctx.font = "bold 13px Arial"; ctx.fillText("MERCADO DO BAIRRO", 1060, 950);
      ctx.fillStyle = "#477d52"; rr(1530, 815, 380, 220, 12); ctx.fill();
      ctx.strokeStyle = "rgba(245,255,222,.7)"; ctx.lineWidth = 3; ctx.strokeRect(1550, 835, 340, 180);
      ctx.beginPath(); ctx.moveTo(1720, 835); ctx.lineTo(1720, 1015); ctx.arc(1720, 925, 34, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.strokeRect(1550, 885, 42, 80); ctx.strokeRect(1848, 885, 42, 80);
      ctx.fillStyle = "#d8d0b2"; ctx.font = "bold 12px Arial"; ctx.fillText("CAMPO DO BAIRRO", 1630, 1060);

      for (let i = 0; i < 35; i++) {
        const x = 80 + ((i * 311) % 2290), y = 90 + ((i * 227) % 1640);
        if (houses.some((h) => x > h.x - 25 && x < h.x + h.w + 25 && y > h.y - 25 && y < h.y + h.h + 25)) continue;
        if (ROAD_X.some((r) => Math.abs(x - r) < 75) || ROAD_Y.some((r) => Math.abs(y - r) < 70)) continue;
        ctx.fillStyle = "rgba(35,52,35,.22)"; ctx.beginPath(); ctx.arc(x + 4, y + 7, 17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = i % 2 ? "#526f45" : "#66804b"; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(220,232,165,.25)"; ctx.beginPath(); ctx.arc(x - 5, y - 6, 6, 0, Math.PI * 2); ctx.fill();
      }

      ctx.font = "900 27px Arial"; ctx.fillStyle = "rgba(50,43,32,.48)";
      ctx.fillText("BAIRRO DA PEDREIRA", 80, 195); ctx.fillText("VILA DO SOL", 1050, 185); ctx.fillText("NOVO HORIZONTE", 1650, 1770);

      if (g.mission !== "done") {
        const target = g.mission === "pickup" ? { x: 1255, y: 900 } : { x: 2140, y: 1540 };
        const pulse = 1 + Math.sin(g.time * 4) * .12;
        ctx.save(); ctx.translate(target.x, target.y);
        ctx.fillStyle = "rgba(255,207,57,.22)"; ctx.beginPath(); ctx.arc(0, 0, 44 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffcf39"; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#59451a"; ctx.font = "900 17px Arial"; ctx.textAlign = "center"; ctx.fillText(g.mission === "pickup" ? "!" : "★", 0, 6);
        ctx.restore();
      }
      g.cash.forEach((coin) => {
        ctx.fillStyle = "rgba(255,215,74,.2)"; ctx.beginPath(); ctx.arc(coin.x, coin.y, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f3c83d"; ctx.beginPath(); ctx.arc(coin.x, coin.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#755619"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center"; ctx.fillText("K", coin.x, coin.y + 4);
      });
      g.walkers.forEach((walker) => {
        ctx.save(); ctx.translate(walker.x, walker.y);
        ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(2, 8, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = walker.color; ctx.beginPath(); ctx.arc(0, -5, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#29343a"; rr(-5, 0, 10, 13, 4); ctx.fill(); ctx.restore();
      });
      g.cars.forEach(drawCar);
      if (g.currentCar < 0) {
        ctx.save(); ctx.translate(g.player.x, g.player.y); ctx.rotate(g.player.angle);
        ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(2, 7, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#27353b"; rr(-9, -5, 18, 21, 6); ctx.fill();
        ctx.fillStyle = "#e3a56e"; ctx.beginPath(); ctx.arc(0, -10, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f3c14c"; ctx.fillRect(-8, -4, 16, 5); ctx.restore();
        const nearest = g.cars.find((car) => distance(g.player.x, g.player.y, car.x, car.y) < 82);
        if (nearest) { ctx.strokeStyle = "rgba(255,220,104,.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(nearest.x, nearest.y, 34, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.restore();

      if (g.night) {
        ctx.fillStyle = "rgba(15,25,50,.48)"; ctx.fillRect(0, 0, width, height);
        const glow = ctx.createRadialGradient(width / 2, height / 2, 30, width / 2, height / 2, Math.max(width, height) * .58);
        glow.addColorStop(0, "rgba(255,221,140,.10)"); glow.addColorStop(1, "rgba(4,8,22,.28)");
        ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      }

      // Minimap.
      const mw = 142, mh = 105, mx = width - mw - 18, my = 18;
      ctx.fillStyle = "rgba(14,20,22,.78)"; rr(mx - 5, my - 5, mw + 10, mh + 10, 12); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
      ctx.fillStyle = "#a89b72"; ctx.fillRect(mx, my, mw, mh); ctx.fillStyle = "#50595a";
      ROAD_X.forEach((x) => ctx.fillRect(mx + (x / WORLD_W) * mw - 3, my, 6, mh));
      ROAD_Y.forEach((y) => ctx.fillRect(mx, my + (y / WORLD_H) * mh - 3, mw, 6));
      ctx.fillStyle = "#6b8e55"; ctx.fillRect(mx + 60, my + 46, 23, 15);
      if (g.mission !== "done") {
        const t = g.mission === "pickup" ? { x: 1255, y: 900 } : { x: 2140, y: 1540 };
        ctx.fillStyle = "#ffcd43"; ctx.beginPath(); ctx.arc(mx + t.x / WORLD_W * mw, my + t.y / WORLD_H * mh, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(mx + subject.x / WORLD_W * mw, my + subject.y / WORLD_H * mh, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = "bold 8px Arial"; ctx.fillText("MAPA DA CIDADE", mx + 7, my + mh - 5);
    };

    const tick = (timestamp: number) => {
      const g = gameRef.current;
      const dt = Math.min((timestamp - (previous || timestamp)) / 1000, .04);
      previous = timestamp;
      if (!paused) {
        g.time += dt;
        const keys = g.keys;
        const forward = keys.has("w") || keys.has("arrowup");
        const backward = keys.has("s") || keys.has("arrowdown");
        const left = keys.has("a") || keys.has("arrowleft");
        const right = keys.has("d") || keys.has("arrowright");
        if (g.currentCar >= 0) {
          const car = g.cars[g.currentCar], throttle = (forward ? 1 : 0) - (backward ? .65 : 0);
          if (throttle) { car.x += Math.cos(car.angle) * throttle * 220 * dt; car.y += Math.sin(car.angle) * throttle * 220 * dt; }
          if (left) car.angle -= 2.35 * dt * (throttle >= 0 ? 1 : -1);
          if (right) car.angle += 2.35 * dt * (throttle >= 0 ? 1 : -1);
          car.x = clamp(car.x, 35, WORLD_W - 35); car.y = clamp(car.y, 35, WORLD_H - 35);
        } else {
          let dx = (right ? 1 : 0) - (left ? 1 : 0), dy = (backward ? 1 : 0) - (forward ? 1 : 0);
          if (dx || dy) {
            const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
            const speed = keys.has("shift") ? 205 : 142;
            const nx = clamp(g.player.x + dx * speed * dt, 25, WORLD_W - 25);
            const ny = clamp(g.player.y + dy * speed * dt, 25, WORLD_H - 25);
            const blocked = houses.some((h) => nx > h.x - 12 && nx < h.x + h.w + 12 && ny > h.y - 12 && ny < h.y + h.h + 12);
            if (!blocked) { g.player.x = nx; g.player.y = ny; }
            g.player.angle = Math.atan2(dy, dx);
          }
        }
        g.walkers.forEach((walker, i) => {
          walker.phase += dt * .55; walker.x += Math.cos(walker.phase + i) * walker.speed * dt;
          walker.y += Math.sin(walker.phase * .8 + i) * walker.speed * dt;
          walker.x = clamp(walker.x, 35, WORLD_W - 35); walker.y = clamp(walker.y, 35, WORLD_H - 35);
        });
        const actor = g.currentCar >= 0 ? g.cars[g.currentCar] : g.player;
        g.cash = g.cash.filter((coin) => {
          if (distance(actor.x, actor.y, coin.x, coin.y) < 34) {
            g.player.money += coin.value; setMoney(g.player.money);
            g.message = "+" + coin.value.toLocaleString("pt-PT") + " Kz encontrados!"; g.messageUntil = g.time + 2.5;
            return false;
          }
          return true;
        });
      }
      drawWorld();
      if (g.time - g.lastHud > .16) {
        g.lastHud = g.time;
        const nearCar = g.currentCar < 0 && g.cars.some((car) => distance(g.player.x, g.player.y, car.x, car.y) < 82);
        const nearMission = (g.mission === "pickup" && distance(g.player.x, g.player.y, 1255, 900) < 110) ||
          (g.mission === "deliver" && distance(g.player.x, g.player.y, 2140, 1540) < 120);
        setHint(g.currentCar >= 0 ? "E para sair do veículo" : nearCar ? "E para entrar no carro" : nearMission ? "E para interagir" : "WASD ou setas para andar · Shift para correr");
        if (g.messageUntil > g.time) setMessage(g.message);
        else if (g.mission === "pickup") setMessage("Missão: vai ao mercado buscar a encomenda.");
        else if (g.mission === "deliver") setMessage("Missão: entrega a encomenda à Dona Zefa.");
        else setMessage("Cidade livre: explora, conduz e descobre os bairros.");
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if (key === "e" && !event.repeat) interact();
      if (key === "escape") setPaused((v) => !v);
      setKey(key, true);
    };
    const keyUp = (event: KeyboardEvent) => setKey(event.key.toLowerCase(), false);
    const visibility = () => { if (document.hidden) gameRef.current.keys.clear(); };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [interact, paused, setKey]);

  useEffect(() => { gameRef.current.night = night; }, [night]);

  const touchButton = (label: string, key: string, extra = "") => (
    <button type="button" className={"touch-key " + extra} aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); setKey(key, true); }}
      onPointerUp={() => setKey(key, false)} onPointerLeave={() => setKey(key, false)}
      onPointerCancel={() => setKey(key, false)}>{label}</button>
  );

  return (
    <main className="game-page">
      <div className="game-shell">
        <header className="game-header">
          <div className="brand-line">
            <div className="brand-mark">VB</div>
            <div><h1 className="game-title">Vida de Bairro</h1><p className="game-subtitle">Mundo aberto · Luanda inspirada</p></div>
          </div>
          <div className="header-actions">
            <button className="game-btn" type="button" onClick={() => setNight((v) => !v)}>{night ? "☀ Dia" : "☾ Noite"}</button>
            <button className="game-btn" type="button" onClick={() => setPaused((v) => !v)}>{paused ? "▶ Continuar" : "Ⅱ Pausar"}</button>
            <button className="game-btn gold" type="button" onClick={toggleFullscreen}>{full ? "Sair do ecrã inteiro" : "⛶ Ecrã inteiro"}</button>
          </div>
        </header>
        <section className="game-hud" aria-label="Estado do jogo">
          <div className="hud-card"><div className="hud-label">Carteira</div><div className="hud-value">{money.toLocaleString("pt-PT")} Kz</div></div>
          <div className="hud-card"><div className="hud-label">Estado</div><div className="hud-value">{inCar ? "Ao volante" : "A pé"}</div></div>
          <div className="hud-card mission-card"><div className="hud-label">Missão principal</div>
            <div className="mission-value">{mission === "pickup" ? "① Vai ao mercado buscar a encomenda" : mission === "deliver" ? "② Entrega a encomenda à Dona Zefa" : "✓ Missão concluída · +5.000 Kz"}</div>
          </div>
        </section>
        <div className="game-frame" id="game-frame">
          <canvas ref={canvasRef} className="game-canvas" aria-label="Jogo de mundo aberto Vida de Bairro" />
          <div className="canvas-top-left"><strong>Zona de jogo · {night ? "Modo noite" : "Modo dia"}</strong><span>{hint}</span></div>
          <div className="toast-message">{message}</div>
          {paused && <div className="paused-overlay"><div className="paused-panel"><h2>JOGO PAUSADO</h2><p>Respira um pouco. A cidade espera por ti.</p>
            <button className="game-btn gold continue-btn" onClick={() => setPaused(false)}>Continuar a jogar</button></div></div>}
          <div className="touch-controls">
            <div className="touch-cluster">
              {touchButton("▲", "w", "up")}{touchButton("◀", "a", "left")}{touchButton("▼", "s", "down")}{touchButton("▶", "d", "right")}
            </div>
            <div className="touch-actions">
              <button className="touch-key" onPointerDown={(e) => { e.preventDefault(); interact(); }}>AÇÃO</button>{touchButton("CORRER", "shift")}
            </div>
          </div>
        </div>
        <footer className="game-footer">
          <div><span className="keycap">W</span><span className="keycap">A</span><span className="keycap">S</span><span className="keycap">D</span> mover · <span className="keycap">E</span> interagir · <span className="keycap">SHIFT</span> correr</div>
          <div>Protótipo jogável · Explora a cidade e descobre os bairros</div>
        </footer>
      </div>
    </main>
  );
}
