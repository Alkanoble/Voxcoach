import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BAR_HEIGHTS = [14,20,30,42,52,62,74,84,76,92,98,86,100,92,80,94,86,72,90,80,66,78,60,48,38,28,20,14];

export default function Home() {
  const { user } = useAuth();
  const barsRef = useRef([]);

  useEffect(() => {
    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      const dur = 0.55 + Math.random() * 0.75;
      bar.style.animationDuration = `${dur}s`;
      bar.style.animationDelay = `${i * 0.045}s`;
    });
  }, []);

  return (
    <div style={{ background: '#f5ead6', minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=DM+Sans:wght@300;400;500&display=swap');

        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.3); }
        }

        .vc-hero {
          width: 100%;
          flex: 1;
          padding: 0 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 80px;
        }

        .vc-btn-primary {
          background:#1a1208;
          color:#f5ead6;
          padding:15px 40px;
          border-radius:4px;
          text-decoration:none;
          transition: background 0.2s;
        }
        
        .vc-btn-primary:hover {
          background:#2a1e10;
        }

        .vc-bar {
          width:8px;
          border-radius:3px 3px 0 0;
          animation: wave ease-in-out infinite;
          transform-origin:bottom;
        }

        @media (max-width: 900px) {
          .vc-hero {
            flex-direction: column;
            justify-content: center;
            padding: 40px 24px;
            text-align: center;
          }
          .vc-hero-content {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
        }
      `}</style>

      {/* HERO */}
      <section className="vc-hero">

        {/* LEFT */}
        <div className="vc-hero-content" style={{ flex:1 }}>
          <p style={{ color:'#b8832a', fontSize:12, fontWeight: 700, letterSpacing: '1px' }}>AI-POWERED SPEECH ANALYSIS</p>

          <h1 style={{ fontSize:64, fontFamily:"'Playfair Display'", lineHeight: 1.1, marginTop: '16px', marginBottom: '24px', color: '#1a1208' }}>
            Your Personal <br />
            <span style={{ color:'#b8832a', fontStyle: 'italic' }}>AI Speech Coach.</span>
          </h1>

          <p style={{ maxWidth:500, color:'#5a4a30', fontSize: '18px', lineHeight: 1.6, marginBottom: '40px' }}>
            Master your delivery, reduce filler words, and speak confidently.
          </p>

          <div style={{ display:'flex', gap:16 }}>
            {user ? (
               <Link to="/dashboard" className="vc-btn-primary">Go to Dashboard</Link>
            ) : (
               <Link to="/login" className="vc-btn-primary">Let's Start</Link>
            )}
          </div>
        </div>

        {/* RIGHT WAVE */}
        <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:180 }}>
          {BAR_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className="vc-bar"
              ref={el => (barsRef.current[i] = el)}
              style={{ height: h * 1.5, background:'#b8832a' }}
            />
          ))}
        </div>

      </section>
    </div>
  );
}