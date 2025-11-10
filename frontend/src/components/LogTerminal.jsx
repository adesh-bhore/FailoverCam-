import React, { useEffect, useState, useRef } from "react";
import { Terminal } from "lucide-react";
import LetterGlitch from "./LetterGlitch";

export default function LogTerminal() {
  const [displayedLogs, setDisplayedLogs] = useState([]);
  const [queue, setQueue] = useState([]);
  const lastTimestamp = useRef(parseFloat(localStorage.getItem("lastLogTime") || "0"));
  const seenMessages = useRef(new Set());
  const containerRef = useRef(null);
  const isTyping = useRef(false);
  const audioContextRef = useRef(null);

  // Initialize Web Audio API for typing sound
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Play typing sound effect
  const playTypingSound = () => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Mechanical keyboard-like sound
    oscillator.frequency.value = 800 + Math.random() * 200;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.02, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  };

  // 🟢 Fetch new logs every 2 seconds
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/logs/since/${lastTimestamp.current.toFixed(6)}`
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.length > 0) {
          const fresh = data.filter(
            (log) => !seenMessages.current.has(log.timestamp + log.message)
          );

          if (fresh.length > 0) {
            fresh.forEach((l) =>
              seenMessages.current.add(l.timestamp + l.message)
            );

            const lastLog = fresh[fresh.length - 1];
            if (lastLog?.timestamp) {
              lastTimestamp.current =
                new Date(lastLog.timestamp).getTime() / 1000;
              localStorage.setItem(
                "lastLogTime",
                lastTimestamp.current.toString()
              );
            }

            setQueue((prev) => [...prev, ...fresh]);
          }
        }
      } catch (err) {
        console.error("Fetch logs failed:", err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  // 🧠 Process queue one log at a time with typing animation
  useEffect(() => {
    const processQueue = async () => {
      if (isTyping.current || queue.length === 0) return;

      isTyping.current = true;
      const nextLog = queue[0];

      await typeLog(nextLog);

      setQueue((q) => q.slice(1));
      isTyping.current = false;
    };

    processQueue();
  }, [queue, displayedLogs]);

  async function typeLog(log) {
    return new Promise((resolve) => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      const logText = `[${timestamp}] ${log.tag}: ${log.message}`;
      const prompt = 'user@ai-system:~/logs$-> ';
      const fullText = prompt + logText;
      let index = 0;
      let current = "";

      // Color based on tag
      const getColor = () => {
        if (log.tag.includes("FAIL") || log.tag.includes("ERROR")) return "#ff6b9d";
        if (log.tag.includes("OK") || log.tag.includes("SUCCESS")) return "#a6e3a1";
        if (log.tag.includes("SWITCH") || log.tag.includes("DETECTION")) return "#fab387";
        if (log.tag.includes("START") || log.tag.includes("INIT")) return "#89b4fa";
        return "#cdd6f4";
      };

      const color = getColor();
      const logIndex = displayedLogs.length;
      setDisplayedLogs((prev) => [...prev, ""]);

      const interval = setInterval(() => {
        current += fullText[index];
        index++;

        // Play typing sound with some randomness
        if (Math.random() > 0.3) {
          playTypingSound();
        }

        setDisplayedLogs((prev) => {
          const newLogs = [...prev];
          const promptLength = prompt.length;
          const promptPart = current.substring(0, promptLength);
          const logPart = current.substring(promptLength);
          
          newLogs[logIndex] = (
            <span style={{ display: 'inline', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <span style={{ 
                color: '#89b4fa',
                fontWeight: 500,
                userSelect: 'none'
              }}>
                {promptPart}
              </span>
              <span style={{ color }}>
                {logPart}
              </span>
              {index < fullText.length && (
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '16px',
                  backgroundColor: color,
                  marginLeft: '2px',
                  animation: 'blink 0.8s infinite',
                  verticalAlign: 'middle'
                }} />
              )}
            </span>
          );
          return newLogs;
        });

        if (index >= fullText.length) {
          clearInterval(interval);
          scrollToBottom();
          resolve();
        }
      }, 18);
    });
  }

  function scrollToBottom() {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1e2e 0%, #181825 100%)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(205,214,244,0.1)',
      fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
      fontSize: '13px',
      maxWidth: '100%',
      border: '1px solid rgba(205,214,244,0.1)'
    }}>
      {/* macOS-style title bar */}
      <div style={{
        background: 'linear-gradient(to bottom, #2a2a3a 0%, #24243a 100%)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid rgba(0,0,0,0.3)',
        userSelect: 'none'
      }}>
        {/* Traffic light buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#ff5f57',
            border: '0.5px solid rgba(0,0,0,0.1)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.2)'
          }} />
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#febc2e',
            border: '0.5px solid rgba(0,0,0,0.1)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.2)'
          }} />
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#28c840',
            border: '0.5px solid rgba(0,0,0,0.1)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.2)'
          }} />
        </div>

        {/* Terminal title */}
        <div style={{
          flex: 1,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#cdd6f4',
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '0.3px'
        }}>
          <Terminal size={14} />
          <span>AI System Logs — zsh</span>
        </div>
      </div>

      {/* Terminal content */}
      <div
        ref={containerRef}
        style={{
          backgroundColor: '#1e1e2e',
          color: '#cdd6f4',
          padding: '16px',
          height: '450px',
          overflowY: 'auto',
          lineHeight: '1.6',
          letterSpacing: '0.3px'
        }}
      >
        {/* Welcome message */}
        {displayedLogs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '0' }}>
            <div style={{ color: '#6c7086', fontStyle: 'italic', marginBottom: '20px', flexShrink: 0 }}>
              <div>Last login: {new Date().toLocaleString()}</div>
              <div style={{ marginTop: '8px' }}>
                Waiting for system logs...
              </div>
            </div>
            <div style={{
              flex: 1,
              minHeight: 10,
              marginTop: '8px'
            }}>
              {/* Terminal prompt with glitch effect integrated */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'flex-start',
                fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#cdd6f4',
                width: '100%'
              }}>
                <span style={{
                  color: '#89b4fa',
                  fontWeight: 500,
                  marginRight: '9px',
                  marginTop: '-7px',
                  flexShrink: 0,
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  display: 'inline-block'
                }}>
                  user@ai-system:~/logs$-&gt;
                </span>
                <div style={{
                  flex: 1,
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: '30.8px',
                  display: 'inline-block',
                  verticalAlign: 'top'
                }}>
                  <LetterGlitch
                    glitchSpeed={50}
                    centerVignette={false}
                    outerVignette={false}
                    smooth={true}
                    glitchColors={['#6c7086', '#a6e3a1', '#89b4fa', '#fab387', '#f38ba8', '#cdd6f4', '#89dceb']}
                    style={{
                      backgroundColor: 'transparent'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {displayedLogs.map((line, i) => (
          <div key={i} style={{ 
            marginBottom: '6px',
            wordBreak: 'break-word',
            lineHeight: '1.6'
          }}>
            {line}
          </div>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        /* Custom scrollbar */
        div[style*="overflowY: auto"]::-webkit-scrollbar {
          width: 10px;
        }

        div[style*="overflowY: auto"]::-webkit-scrollbar-track {
          background: rgba(30,30,46,0.5);
        }

        div[style*="overflowY: auto"]::-webkit-scrollbar-thumb {
          background: rgba(137,180,250,0.3);
          border-radius: 5px;
        }

        div[style*="overflowY: auto"]::-webkit-scrollbar-thumb:hover {
          background: rgba(137,180,250,0.5);
        }
      `}</style>
    </div>
  );
}