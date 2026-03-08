"use client";
import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const API = "http://127.0.0.1:8000";

const fmt = (n: any) => typeof n === "number" ? n.toFixed(2) : n;
const fmtEur = (n: any) => `€${Number(n).toLocaleString("en", { minimumFractionDigits: 2 })}`;
const SIGNAL_COLOR = { BUY: "#00ff9d", SELL: "#ff4d6d", HOLD: "#ffd166" };
const SIGNAL_BG    = { BUY: "rgba(0,255,157,0.12)", SELL: "rgba(255,77,109,0.12)", HOLD: "rgba(255,209,102,0.12)" };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(10,14,26,0.95)", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#a8c8e8" }}>
      <p style={{ color: "#4a9eff", marginBottom: 4, fontSize: 11 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0" }}>{p.name}: <span style={{ color: "#fff", fontWeight: 600 }}>€{fmt(p.value)}</span></p>
      ))}
    </div>
  );
};

const StatCard = ({ label, value, sub, accent }) => (
  <div style={{ background: "linear-gradient(135deg, rgba(10,20,40,0.9) 0%, rgba(15,30,60,0.9) 100%)", border: `1px solid ${accent}33`, borderRadius: 12, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
    <p style={{ color: "#5a7a9a", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{label}</p>
    <p style={{ color: accent, fontSize: 26, fontWeight: 700, fontFamily: "'Space Mono', monospace", marginBottom: 4 }}>{value}</p>
    {sub && <p style={{ color: "#4a6a8a", fontSize: 12 }}>{sub}</p>}
  </div>
);

const SignalBadge = ({ signal }) => (
  <span style={{ background: SIGNAL_BG[signal] || "rgba(255,255,255,0.05)", color: SIGNAL_COLOR[signal] || "#fff", border: `1px solid ${SIGNAL_COLOR[signal] || "#fff"}44`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>{signal}</span>
);

export default function GridMind() {
  const [tab, setTab]               = useState("forecast");
  const [stats, setStats]           = useState(null);
  const [forecast, setForecast]     = useState(null);
  const [signals, setSignals]       = useState(null);
  const [optResult, setOptResult]   = useState(null);
  const [optLoading, setOptLoading] = useState(false);
  const [totalMwh, setTotalMwh]     = useState(100);
  const [maxPerHour, setMaxPerHour] = useState(10);
  const [chat, setChat]             = useState([
    { role: "assistant", content: "Hello! I'm GridMind AI. Ask me anything about European energy markets, price forecasts, or trading strategies." }
  ]);
  const [chatInput, setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/stats`).then(r => r.json()).then(setStats).catch(() => {});
    fetch(`${API}/forecast`).then(r => r.json()).then(setForecast).catch(() => {});
    fetch(`${API}/signals`).then(r => r.json()).then(setSignals).catch(() => {});
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const forecastData = forecast ? forecast.labels.slice(-48).map((t, i) => ({
    time: new Date(t).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit" }),
    Actual: forecast.actual[forecast.actual.length - 48 + i],
    Predicted: forecast.predicted[forecast.predicted.length - 48 + i],
  })) : [];

  const signalData = signals ? signals.labels.slice(-48).map((t, i) => ({
    time: new Date(t).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit" }),
    price: signals.actual[signals.actual.length - 48 + i],
    signal: signals.signals[signals.signals.length - 48 + i],
  })) : [];

  const optData = optResult ? optResult.schedule.filter(s => s.buy_mwh > 0.01).slice(0, 30).map(s => ({
    time: new Date(s.datetime).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit" }),
    price: s.price, buy: s.buy_mwh,
  })) : [];

  const runOptimize = async () => {
    setOptLoading(true);
    try {
      const res = await fetch(`${API}/optimize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ total_mwh: totalMwh, max_per_hour: maxPerHour }) });
      setOptResult(await res.json());
    } catch (e) {}
    setOptLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChat(prev => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: chat.slice(1).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
        })
      });

      setChat(prev => [...prev, { role: "assistant", content: "" }]);
      setChatLoading(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                setChat(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: updated[updated.length - 1].content + parsed.token };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      setChat(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
      setChatLoading(false);
    }
  };

  const TABS = ["forecast", "signals", "optimize", "chat"];
  const TAB_LABELS = { forecast: "📈 Forecast", signals: "⚡ Signals", optimize: "⚙️ Optimize", chat: "🤖 AI Chat" };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #050a14; color: #c8e0f8; font-family: 'Syne', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a1428; }
        ::-webkit-scrollbar-thumb { background: #1a3a6a; border-radius: 2px; }
        input[type=range] { accent-color: #4a9eff; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .tab-btn { transition: all 0.2s; }
        .tab-btn:hover { background: rgba(74,158,255,0.1) !important; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 20% 0%, #0a1e3d 0%, #050a14 60%)" }}>

        <header style={{ borderBottom: "1px solid #0e2444", background: "rgba(5,10,20,0.8)", backdropFilter: "blur(20px)", padding: "0 32px", position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #4a9eff, #0066cc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
            <div>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>Grid</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#4a9eff", letterSpacing: -0.5 }}>Mind</span>
              <span style={{ fontSize: 11, color: "#3a6a9a", marginLeft: 10, letterSpacing: 2, textTransform: "uppercase" }}>Energy Intelligence</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff9d", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, color: "#3a8a5a", letterSpacing: 1 }}>LIVE</span>
            <span style={{ fontSize: 12, color: "#2a4a6a", marginLeft: 8 }}>European Power Market</span>
          </div>
        </header>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32, animation: "fadeIn 0.5s ease" }}>
              <StatCard label="Avg Market Price" value={fmtEur(stats.avg_price)} sub="€/MWh historical avg" accent="#4a9eff" />
              <StatCard label="Model Accuracy" value={`${(stats.model_r2 * 100).toFixed(1)}%`} sub={`R² score · MAE €${stats.model_mae}`} accent="#00ff9d" />
              <StatCard label="Price Range" value={`€${stats.min_price}–${stats.max_price}`} sub="Min–Max per MWh" accent="#ffd166" />
              <StatCard label="Data Points" value={stats.total_hours.toLocaleString()} sub="Hours of market data" accent="#ff4d6d" />
            </div>
          )}

          <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(10,20,40,0.6)", padding: 4, borderRadius: 12, width: "fit-content" }}>
            {TABS.map(t => (
              <button key={t} className="tab-btn" onClick={() => setTab(t)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'Syne', sans-serif", fontWeight: 600, background: tab === t ? "linear-gradient(135deg, #1a3a6a, #0a2a4a)" : "transparent", color: tab === t ? "#4a9eff" : "#3a5a7a", borderBottom: tab === t ? "2px solid #4a9eff" : "2px solid transparent" }}>{TAB_LABELS[t]}</button>
            ))}
          </div>

          {tab === "forecast" && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#fff" }}>Price Forecast</h2>
              <p style={{ color: "#3a6a9a", fontSize: 13, marginBottom: 24 }}>XGBoost model · R² = 0.9619 · MAE = €1.68/MWh · Last 48 hours shown</p>
              <div style={{ background: "rgba(10,18,35,0.8)", border: "1px solid #0e2444", borderRadius: 16, padding: "24px 16px" }}>
                <ResponsiveContainer width="100%" height={360}>
                  <AreaChart data={forecastData}>
                    <defs>
                      <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4a9eff" stopOpacity={0.3} /><stop offset="95%" stopColor="#4a9eff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00ff9d" stopOpacity={0.2} /><stop offset="95%" stopColor="#00ff9d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0e2444" />
                    <XAxis dataKey="time" tick={{ fill: "#3a6a9a", fontSize: 10 }} tickLine={false} interval={7} />
                    <YAxis tick={{ fill: "#3a6a9a", fontSize: 11 }} tickLine={false} tickFormatter={v => `€${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: "#5a8aaa", fontSize: 12 }} />
                    <Area type="monotone" dataKey="Actual" stroke="#4a9eff" fill="url(#actualGrad)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Predicted" stroke="#00ff9d" fill="url(#predGrad)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {tab === "signals" && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#fff" }}>Trading Signals</h2>
              <p style={{ color: "#3a6a9a", fontSize: 13, marginBottom: 24 }}>Buy / Sell / Hold recommendations based on predicted price movements</p>
              {signals && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
                  {["BUY", "SELL", "HOLD"].map(s => (
                    <div key={s} style={{ background: SIGNAL_BG[s], border: `1px solid ${SIGNAL_COLOR[s]}33`, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                      <SignalBadge signal={s} />
                      <p style={{ color: SIGNAL_COLOR[s], fontSize: 28, fontWeight: 700, fontFamily: "'Space Mono', monospace", marginTop: 8 }}>{signals.summary[s].toLocaleString()}</p>
                      <p style={{ color: "#3a5a7a", fontSize: 11, marginTop: 4 }}>total signals</p>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background: "rgba(10,18,35,0.8)", border: "1px solid #0e2444", borderRadius: 16, padding: "24px 16px" }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={signalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0e2444" />
                    <XAxis dataKey="time" tick={{ fill: "#3a6a9a", fontSize: 10 }} tickLine={false} interval={7} />
                    <YAxis tick={{ fill: "#3a6a9a", fontSize: 11 }} tickFormatter={v => `€${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="price" stroke="#4a9eff" strokeWidth={2} dot={(props) => {
                      const { cx, cy, payload } = props;
                      return <circle key={cx} cx={cx} cy={cy} r={3} fill={SIGNAL_COLOR[payload.signal] || "#4a9eff"} stroke="none" />;
                    }} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12 }}>
                  {["BUY", "SELL", "HOLD"].map(s => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: SIGNAL_COLOR[s] }} />
                      <span style={{ color: "#3a6a9a", fontSize: 11 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "optimize" && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#fff" }}>Portfolio Optimizer</h2>
              <p style={{ color: "#3a6a9a", fontSize: 13, marginBottom: 24 }}>Linear programming engine finds the cheapest hours to buy your energy</p>
              <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
                <div style={{ background: "rgba(10,18,35,0.8)", border: "1px solid #0e2444", borderRadius: 16, padding: 24 }}>
                  <h3 style={{ color: "#4a9eff", fontSize: 14, fontWeight: 600, marginBottom: 20, letterSpacing: 1 }}>PARAMETERS</h3>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <label style={{ color: "#5a8aaa", fontSize: 12 }}>Total Energy Needed</label>
                      <span style={{ color: "#4a9eff", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{totalMwh} MWh</span>
                    </div>
                    <input type="range" min={10} max={500} value={totalMwh} onChange={e => setTotalMwh(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <label style={{ color: "#5a8aaa", fontSize: 12 }}>Max Per Hour</label>
                      <span style={{ color: "#4a9eff", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{maxPerHour} MWh</span>
                    </div>
                    <input type="range" min={1} max={50} value={maxPerHour} onChange={e => setMaxPerHour(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                  <button onClick={runOptimize} disabled={optLoading} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: optLoading ? "#1a3a5a" : "linear-gradient(135deg, #1a5aaa, #0a3a7a)", color: optLoading ? "#3a6a9a" : "#4a9eff", fontSize: 13, fontWeight: 700, cursor: optLoading ? "not-allowed" : "pointer", fontFamily: "'Syne', sans-serif", letterSpacing: 1 }}>
                    {optLoading ? "OPTIMIZING..." : "⚙️ RUN OPTIMIZER"}
                  </button>
                  {optResult && (
                    <div style={{ marginTop: 20, padding: 16, background: "rgba(0,255,157,0.05)", border: "1px solid #00ff9d22", borderRadius: 10 }}>
                      <p style={{ color: "#3a8a5a", fontSize: 11, marginBottom: 8, letterSpacing: 1 }}>RESULTS</p>
                      {[
                        { label: "Optimal Cost", value: fmtEur(optResult.total_cost), color: "#00ff9d" },
                        { label: "Naive Cost", value: fmtEur(optResult.naive_cost), color: "#ff4d6d" },
                        { label: "Savings", value: `${fmtEur(optResult.savings)} (${optResult.savings_pct}%)`, color: "#ffd166" },
                        { label: "Avg Paid", value: `€${optResult.avg_price_paid}/MWh`, color: "#4a9eff" },
                      ].map(r => (
                        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ color: "#5a8aaa", fontSize: 12 }}>{r.label}</span>
                          <span style={{ color: r.color, fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ background: "rgba(10,18,35,0.8)", border: "1px solid #0e2444", borderRadius: 16, padding: "24px 16px" }}>
                  {optResult ? (
                    <>
                      <p style={{ color: "#3a6a9a", fontSize: 12, marginBottom: 16 }}>Top buying hours (by predicted price)</p>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={optData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#0e2444" />
                          <XAxis dataKey="time" tick={{ fill: "#3a6a9a", fontSize: 9 }} tickLine={false} interval={4} />
                          <YAxis yAxisId="left" tick={{ fill: "#3a6a9a", fontSize: 11 }} tickFormatter={v => `€${v}`} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fill: "#3a6a9a", fontSize: 11 }} tickFormatter={v => `${v}MW`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar yAxisId="right" dataKey="buy" fill="#4a9eff" fillOpacity={0.7} radius={[4, 4, 0, 0]} name="Buy (MWh)" />
                          <Line yAxisId="left" type="monotone" dataKey="price" stroke="#ffd166" strokeWidth={2} dot={false} name="Price" />
                        </BarChart>
                      </ResponsiveContainer>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 40 }}>⚙️</div>
                      <p style={{ color: "#2a4a6a", fontSize: 13 }}>Set parameters and run the optimizer</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "chat" && (
            <div style={{ animation: "fadeIn 0.4s ease" }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#fff" }}>GridMind AI</h2>
              <p style={{ color: "#3a6a9a", fontSize: 13, marginBottom: 24 }}>Ask anything about energy markets, forecasts, or trading strategy</p>
              <div style={{ background: "rgba(10,18,35,0.8)", border: "1px solid #0e2444", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ height: 420, overflowY: "auto", padding: 20 }}>
                  {chat.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                      <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: 12, background: m.role === "user" ? "linear-gradient(135deg, #1a4a8a, #0a2a5a)" : "rgba(15,25,45,0.95)", border: m.role === "user" ? "1px solid #2a6aaa" : "1px solid #1a3a5a", color: "#c8e0f8", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {m.content}
                        {/* Blinking cursor on last streaming message */}
                        {m.role === "assistant" && i === chat.length - 1 && m.content !== "" && (
                          <span style={{ display: "inline-block", width: 2, height: 14, background: "#4a9eff", marginLeft: 2, animation: "blink 1s infinite", verticalAlign: "middle" }} />
                        )}
                        {/* Dots while waiting for first token */}
                        {m.role === "assistant" && m.content === "" && (
                          <span style={{ color: "#3a6a9a", letterSpacing: 2 }}>●●●</span>
                        )}
                        {m.role === "assistant" && m.content !== "" && (
                          <div style={{ marginTop: 6, fontSize: 10, color: "#3a6a9a" }}>GridMind AI</div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ borderTop: "1px solid #0e2444", padding: 16, display: "flex", gap: 10 }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendChat()}
                    placeholder="Ask about energy prices, trading signals, market trends..."
                    style={{ flex: 1, background: "rgba(15,25,45,0.8)", border: "1px solid #1a3a5a", borderRadius: 10, padding: "10px 16px", color: "#c8e0f8", fontSize: 13, outline: "none", fontFamily: "'Syne', sans-serif" }}
                  />
                  <button onClick={sendChat} disabled={chatLoading} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: chatLoading ? "#1a3a5a" : "linear-gradient(135deg, #1a5aaa, #0a3a7a)", color: chatLoading ? "#3a6a9a" : "#4a9eff", fontSize: 13, fontWeight: 700, cursor: chatLoading ? "not-allowed" : "pointer", fontFamily: "'Syne', sans-serif" }}>Send</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {["Why do electricity prices spike in winter?", "What does an 18.9% saving mean in real terms?", "Explain the Buy/Sell signals", "What is day-ahead pricing?"].map(q => (
                  <button key={q} onClick={() => setChatInput(q)} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #1a3a5a", background: "rgba(15,25,45,0.6)", color: "#3a6a9a", fontSize: 11, cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>{q}</button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}