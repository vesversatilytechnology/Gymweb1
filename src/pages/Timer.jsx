import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/** BIP usando WebAudio (não precisa de arquivo .mp3) */
function playBeep({ freq = 880, durationMs = 180, volume = 0.2 } = {}) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, durationMs);
  } catch (_) {
    // se der erro, silenciosamente ignora
  }
}

export default function Timer() {
  const navigate = useNavigate();

  const [modo, setModo] = useState("stopwatch"); // 'stopwatch' | 'countdown'
  const [running, setRunning] = useState(false);

  // STOPWATCH (segundos totais)
  const [elapsed, setElapsed] = useState(0);

  // COUNTDOWN (definição do usuário em mm:ss)
  const [minutos, setMinutos] = useState(1);
  const [segundos, setSegundos] = useState(0);
  const [restantes, setRestantes] = useState(60); // em segundos

  const intervalRef = useRef(null);

  // Sincroniza "restantes" quando usuário muda minutos/segundos
  useEffect(() => {
    if (modo === "countdown" && !running) {
      const total =
        Math.max(0, parseInt(minutos || 0, 10)) * 60 +
        Math.max(0, parseInt(segundos || 0, 10));
      setRestantes(total);
    }
  }, [minutos, segundos, modo, running]);

  // Tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      if (modo === "stopwatch") {
        setElapsed((e) => e + 1);
      } else {
        setRestantes((r) => {
          if (r <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            // 3 bips curtinhos
            playBeep();
            setTimeout(() => playBeep({ freq: 980 }), 220);
            setTimeout(() => playBeep({ freq: 1040 }), 440);
            return 0;
          }
          // beep de marcação a cada 10s (opcional)
          if ((r - 1) % 10 === 0) playBeep({ freq: 700, durationMs: 120, volume: 0.12 });
          return r - 1;
        });
      }
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [running, modo]);

  const iniciar = () => setRunning(true);
  const pausar = () => {
    setRunning(false);
    clearInterval(intervalRef.current);
  };
  const resetar = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    if (modo === "stopwatch") {
      setElapsed(0);
    } else {
      const total =
        Math.max(0, parseInt(minutos || 0, 10)) * 60 +
        Math.max(0, parseInt(segundos || 0, 10));
      setRestantes(total);
    }
  };

  const format = (s) => {
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const mostrar = modo === "stopwatch" ? format(elapsed) : format(restantes);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        {/* topo */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded"
          >
            ← Voltar para treinos
          </button>
          <h1 className="text-2xl font-bold">Cronômetro</h1>
          <div />
        </div>

        {/* seleção de modo */}
        <div className="bg-gray-800 p-4 rounded mb-4">
          <label className="block mb-2 font-semibold">Modo</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={modo === "stopwatch"}
                onChange={() => {
                  setModo("stopwatch");
                  resetar();
                }}
              />
              <span>Cronômetro (conta pra cima)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={modo === "countdown"}
                onChange={() => {
                  setModo("countdown");
                  resetar();
                }}
              />
              <span>Temporizador (define tempo)</span>
            </label>
          </div>
        </div>

        {/* configuração de temporizador */}
        {modo === "countdown" && (
          <div className="bg-gray-800 p-4 rounded mb-4">
            <label className="block mb-2 font-semibold">Defina o tempo</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                className="w-24 text-black rounded p-2"
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
              />
              <span>min</span>
              <input
                type="number"
                min={0}
                max={59}
                className="w-24 text-black rounded p-2"
                value={segundos}
                onChange={(e) => setSegundos(e.target.value)}
              />
              <span>seg</span>
            </div>
          </div>
        )}

        {/* display */}
        <div className="bg-gray-800 p-6 rounded text-center mb-4">
          <div className="text-6xl font-mono">{mostrar}</div>
        </div>

        {/* controles */}
        <div className="flex items-center justify-center gap-3">
          {!running ? (
            <button
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
              onClick={iniciar}
            >
              Iniciar
            </button>
          ) : (
            <button
              className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded"
              onClick={pausar}
            >
              Pausar
            </button>
          )}
          <button
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
            onClick={resetar}
          >
            Resetar
          </button>
        </div>
      </div>
    </div>
  );
}