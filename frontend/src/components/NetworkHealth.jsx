import React, { useEffect, useState } from "react";
import { Activity, Wifi, Zap, TrendingUp, Clock, Radio } from "lucide-react";

export default function NetworkHealth() {
  const [h, setH] = useState(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let timer = null;
    const fetchHealth = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/health");
        if (!res.ok) return;
        const data = await res.json();
        setH(data);
        setPulse(true);
        setTimeout(() => setPulse(false), 300);
      } catch {}
    };
    fetchHealth();
    timer = setInterval(fetchHealth, 2000);
    return () => clearInterval(timer);
  }, []);

  const getStatusConfig = (s) => {
    switch(s) {
      case "GOOD":
        return { color: "#00ff88", bg: "rgba(0,255,136,0.12)", glow: "rgba(0,255,136,0.3)" };
      case "FAIR":
        return { color: "#ffd166", bg: "rgba(255,209,102,0.12)", glow: "rgba(255,209,102,0.3)" };
      case "POOR":
        return { color: "#ff0066", bg: "rgba(255,0,102,0.12)", glow: "rgba(255,0,102,0.3)" };
      default:
        return { color: "#00ffff", bg: "rgba(0,255,255,0.12)", glow: "rgba(0,255,255,0.3)" };
    }
  };

  const statusConfig = getStatusConfig(h?.status);

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.85) 100%)",
      border: "1px solid rgba(100,255,218,0.2)",
      borderRadius: 20,
      padding: "24px",
      color: "#e2e8f0",
      backdropFilter: "blur(16px)",
      minWidth: 340,
      maxWidth: 400,
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${statusConfig.glow} inset`,
      position: "relative",
      overflow: "hidden",
      transition: "all 0.3s ease"
    }}>
      {/* Animated background gradient */}
      <div style={{
        position: "absolute",
        top: -100,
        right: -100,
        width: 200,
        height: 200,
        background: `radial-gradient(circle, ${statusConfig.glow} 0%, transparent 70%)`,
        opacity: 0.15,
        animation: "pulse 3s ease-in-out infinite"
      }} />

      {/* Header with status badge */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: statusConfig.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${statusConfig.color}`,
            boxShadow: `0 0 20px ${statusConfig.glow}`
          }}>
            <Activity size={22} color={statusConfig.color} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.5px",
              color: "#f1f5f9"
            }}>
              Network Health
            </div>
            <div style={{
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 500,
              marginTop: 2
            }}>
              Real-time monitoring
            </div>
          </div>
        </div>

        <div style={{
          padding: "8px 16px",
          borderRadius: 999,
          background: statusConfig.bg,
          border: `1.5px solid ${statusConfig.color}`,
          color: statusConfig.color,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.5px",
          fontFamily: "'JetBrains Mono', monospace",
          boxShadow: `0 0 15px ${statusConfig.glow}`,
          transform: pulse ? "scale(1.05)" : "scale(1)",
          transition: "transform 0.3s ease"
        }}>
          {h?.status || "INIT"}
        </div>
      </div>

      {/* Feed URL */}
      <div style={{
        background: "rgba(15,23,42,0.6)",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 16,
        border: "1px solid rgba(100,255,218,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 10
      }}>
        <Radio size={16} color="#64ffda" />
        <div style={{
          fontSize: 12,
          color: "#64ffda",
          fontFamily: "'JetBrains Mono', monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1
        }}>
          {h?.feed_url || "No active feed"}
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        marginBottom: 16
      }}>
        {/* Latency */}
        <MetricCard
          icon={<Zap size={16} />}
          label="Latency"
          value={h?.latency_ms ?? "—"}
          unit="ms"
          color="#00ff88"
        />

        {/* Jitter */}
        <MetricCard
          icon={<TrendingUp size={16} />}
          label="Jitter"
          value={h?.jitter_ms ?? "—"}
          unit="ms"
          color="#ffd166"
        />

        {/* Packet Loss */}
        <MetricCard
          icon={<Wifi size={16} />}
          label="Packet Loss"
          value={h?.packet_loss_pct ?? "—"}
          unit="%"
          color="#ff0066"
        />

        {/* FPS */}
        <MetricCard
          icon={<Activity size={16} />}
          label="FPS"
          value={h?.fps ?? "0.0"}
          unit=""
          color="#00ffff"
        />
      </div>

      {/* Signal Bars */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        height: 50,
        marginBottom: 12,
        padding: "12px 16px",
        background: "rgba(15,23,42,0.4)",
        borderRadius: 12,
        border: "1px solid rgba(100,255,218,0.1)"
      }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const isActive = 
            (h?.status === "GOOD" && i < 5) ||
            (h?.status === "FAIR" && i < 3) ||
            (h?.status === "POOR" && i < 2);

          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${20 + i * 10}%`,
                background: isActive
                  ? `linear-gradient(to top, ${statusConfig.color}, ${statusConfig.color}88)`
                  : "rgba(71,85,105,0.3)",
                borderRadius: 4,
                transition: "all 0.4s ease",
                boxShadow: isActive ? `0 0 10px ${statusConfig.glow}` : "none",
                animation: isActive ? `barPulse 2s ease-in-out ${i * 0.1}s infinite` : "none"
              }}
            />
          );
        })}
      </div>

      {/* Last Updated */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: 0.6,
        fontSize: 11,
        color: "#94a3b8",
        fontFamily: "'JetBrains Mono', monospace"
      }}>
        <Clock size={12} />
        <span>Updated: {h?.last_updated || "—"}</span>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500;700&display=swap');
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.1); opacity: 0.25; }
        }

        @keyframes barPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

function MetricCard({ icon, label, value, unit, color }) {
  return (
    <div style={{
      background: "rgba(15,23,42,0.6)",
      borderRadius: 12,
      padding: "12px",
      border: `1px solid ${color}22`,
      transition: "all 0.3s ease",
      cursor: "default",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Glow effect on hover */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: 0.5
      }} />

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
        color: color,
        opacity: 0.9
      }}>
        {icon}
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          fontFamily: "'Space Grotesk', sans-serif"
        }}>
          {label}
        </span>
      </div>

      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color: "#f1f5f9",
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "-0.5px"
      }}>
        {value}
        <span style={{
          fontSize: 14,
          marginLeft: 4,
          color: color,
          fontWeight: 600
        }}>
          {unit}
        </span>
      </div>
    </div>
  );
}