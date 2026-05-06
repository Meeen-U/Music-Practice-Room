import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import CalendarPage from './CalendarPage';
import confetti from 'canvas-confetti';

const BEATS_PER_MEASURE = 4;

function Metronome() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);

  // ★ TARGET TIMEを記憶しておくように変更！
  // 最初に読み込まれた時に、保存されてる時間があればそれを使う
  const [targetMinutes, setTargetMinutes] = useState(() => {
    const saved = localStorage.getItem('bassTargetMinutes');
    return saved ? parseInt(saved, 10) : 30; // なければデフォルト30分
  });

  // ★ TARGET TIMEが変更されたら、すかさず保存する！
  useEffect(() => {
    localStorage.setItem('bassTargetMinutes', targetMinutes.toString());
  }, [targetMinutes]);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const [sessionTime, setSessionTime] = useState(0); 
  const [todayTotal, setTodayTotal] = useState(0); 
  const [hasCelebrated, setHasCelebrated] = useState(false); 
  
  const startTimeRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerIDRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const beatCountRef = useRef<number>(0);
  
  const [timerEndTime, setTimerEndTime] = useState<number | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const storedData = localStorage.getItem('bassPracticeData');
    if (storedData) {
      const data = JSON.parse(storedData);
      const today = new Date().toISOString().split('T')[0];
      setTodayTotal(data[today]?.actual || 0);
    }
  }, []);

  const playDing = useCallback(() => {
    if (!audioCtxRef.current) return;
    const osc = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, audioCtxRef.current.currentTime);
    gainNode.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 2.5);
    osc.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);
    osc.start();
    osc.stop(audioCtxRef.current.currentTime + 2.5);
  }, []);

  const triggerCelebration = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#00bcd4', '#2ed573', '#ff4757'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#00bcd4', '#2ed573', '#ff4757'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    if (!audioCtxRef.current) return;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = audioCtxRef.current!.createOscillator();
      const gain = audioCtxRef.current!.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, audioCtxRef.current!.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, audioCtxRef.current!.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current!.currentTime + 1.5 + (i * 0.2));
      osc.connect(gain);
      gain.connect(audioCtxRef.current!.destination);
      osc.start();
      osc.stop(audioCtxRef.current!.currentTime + 2);
    });
  }, []);

  const savePracticeSession = useCallback((durationInSeconds: number) => {
    if (durationInSeconds < 1) return;
    const today = new Date().toISOString().split('T')[0];
    const storedData = localStorage.getItem('bassPracticeData');
    const practiceData = storedData ? JSON.parse(storedData) : {};
    
    if (!practiceData[today]) {
      practiceData[today] = { actual: 0, target: targetMinutes * 60 };
    }
    practiceData[today].actual += durationInSeconds;
    practiceData[today].target = targetMinutes * 60;
    
    localStorage.setItem('bassPracticeData', JSON.stringify(practiceData));
  }, [targetMinutes]);

  const stopMetronome = useCallback(() => {
    if (timerIDRef.current) clearInterval(timerIDRef.current);
    setIsPlaying(false);
    setCurrentBeat(0);
    beatCountRef.current = 0;
    setTimerEndTime(null);

    if (startTimeRef.current) {
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      savePracticeSession(duration);
      setSessionTime(prev => prev + duration);
      setTodayTotal(prev => prev + duration);
      startTimeRef.current = null;
    }
  }, [savePracticeSession]);

  const playClick = useCallback((beat: number) => {
    if (!audioCtxRef.current) return; 
    const osc = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);
    
    osc.frequency.value = beat === 0 ? 1500 : 1000; 
    gainNode.gain.setValueAtTime(0.5, audioCtxRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.1);
    osc.start(nextNoteTimeRef.current);
    osc.stop(nextNoteTimeRef.current + 0.1);
  }, []);

  const scheduleNextNote = useCallback(() => {
    if (!audioCtxRef.current) return;
    const interval = 60 / bpm;
    nextNoteTimeRef.current += interval;
    const currentAudioBeat = beatCountRef.current;
    playClick(currentAudioBeat);
    setCurrentBeat(currentAudioBeat);
    beatCountRef.current = (currentAudioBeat + 1) % BEATS_PER_MEASURE;
  }, [bpm, playClick]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (isPlaying) {
      const id = setInterval(() => {
        setTick(t => t + 1);
        if (timerEndTime) {
          const remain = Math.ceil((timerEndTime - Date.now()) / 1000);
          if (remain <= 0) {
            playDing();
            stopMetronome();
            setRemainingSeconds(0);
          } else {
            setRemainingSeconds(remain);
          }
        }
      }, 500); 
      return () => clearInterval(id);
    }
  }, [isPlaying, timerEndTime, stopMetronome, playDing]);

  const currentSessionDuration = isPlaying && startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
  const realTimeTodayTotal = todayTotal + currentSessionDuration;
  const targetSeconds = targetMinutes * 60;

  useEffect(() => {
    if (isPlaying && targetSeconds > 0 && realTimeTodayTotal >= targetSeconds && !hasCelebrated) {
      triggerCelebration(); 
      setHasCelebrated(true);
    }
  }, [realTimeTodayTotal, targetSeconds, hasCelebrated, isPlaying, triggerCelebration]);

  const toggleMetronome = () => {
    if (isPlaying) {
      stopMetronome();
    } else {
      if (!audioCtxRef.current) audioCtxRef.current = new window.AudioContext();

      setCurrentBeat(0); 
      beatCountRef.current = 1; 
      nextNoteTimeRef.current = audioCtxRef.current.currentTime;
      playClick(0);

      const intervalMs = (60 / bpm) * 1000;
      timerIDRef.current = window.setInterval(scheduleNextNote, intervalMs);

      if (timerSeconds > 0) {
        setTimerEndTime(Date.now() + timerSeconds * 1000);
        setRemainingSeconds(timerSeconds);
      } else {
        setTimerEndTime(null);
      }

      setIsPlaying(true);
      startTimeRef.current = Date.now();
    }
  };

  useEffect(() => {
    if (isPlaying) {
      if (timerIDRef.current) clearInterval(timerIDRef.current);
      if (audioCtxRef.current) nextNoteTimeRef.current = audioCtxRef.current.currentTime;
      const intervalMs = (60 / bpm) * 1000;
      timerIDRef.current = window.setInterval(scheduleNextNote, intervalMs);
    }
  }, [bpm, isPlaying, scheduleNextNote]);

  useEffect(() => { return () => stopMetronome(); }, [stopMetronome]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const addTimerMinutes = (min: number) => setTimerSeconds(prev => Math.min(3600, prev + min * 60));

  return (
    <div style={{ textAlign: 'center', padding: '30px 20px', minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#eee', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Sans", sans-serif', fontWeight: 300 }}>
      <h1 style={{ letterSpacing: '3px', textTransform: 'uppercase', color: '#fff', fontSize: '1.8rem', fontWeight: 500, textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>
        Metronome
      </h1>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', margin: '30px 0' }}>
        {[...Array(BEATS_PER_MEASURE)].map((_, i) => (
          <div key={i} style={{ width: '25px', height: '25px', borderRadius: '50%', backgroundColor: i === currentBeat ? (i === 0 ? '#ff4757' : '#2ed573') : '#222', transition: 'background-color 0.05s ease, transform 0.05s ease', transform: i === currentBeat ? 'scale(1.2)' : 'scale(1)', boxShadow: i === currentBeat ? `0 0 12px ${i === 0 ? '#ff4757' : '#2ed573'}` : 'inset 0 0 3px rgba(0,0,0,0.8)' }} />
        ))}
      </div>

      <div style={{ margin: '20px 0' }}>
        <span style={{ fontSize: '4.5rem', fontWeight: 200, letterSpacing: '-2px' }}>{bpm}</span>
        <span style={{ fontSize: '1.2rem', marginLeft: '8px', color: '#666', fontWeight: 400 }}>BPM</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', width: '90%', maxWidth: '400px', margin: '0 auto' }}>
        <button onClick={() => setBpm(b => Math.max(40, b - 1))} style={circleBtnStyle}>-</button>
        <input type="range" min="40" max="240" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} style={{ flex: 1, cursor: 'pointer', accentColor: '#2ed573' }} />
        <button onClick={() => setBpm(b => Math.min(240, b + 1))} style={circleBtnStyle}>+</button>
      </div>

      <div style={{ marginTop: '40px', padding: '15px 20px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '85%', maxWidth: '350px', margin: '40px auto 0' }}>
        <span style={{ fontSize: '0.8rem', color: '#00bcd4', fontWeight: 500, letterSpacing: '1px' }}>TARGET TIME</span>
        <div style={{ position: 'relative', width: '100px' }}>
          <select value={targetMinutes} onChange={(e) => setTargetMinutes(Number(e.target.value))} style={{ width: '100%', appearance: 'none', backgroundColor: 'transparent', color: '#fff', fontSize: '1.2rem', fontWeight: 400, textAlign: 'right', padding: '5px 20px 5px 5px', border: 'none', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {Array.from({ length: 13 }, (_, i) => i * 10).map(m => ( <option key={m} value={m} style={{ backgroundColor: '#222' }}>{m} min</option> ))}
          </select>
          <div style={{ position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#666', fontSize: '0.8rem' }}>▼</div>
        </div>
      </div>

      <div style={{ padding: '20px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '10px', width: '85%', maxWidth: '350px', margin: '15px auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#888', letterSpacing: '1px', fontWeight: 500 }}>TIMER</span>
          <span style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 300, fontFamily: 'monospace' }}>
            {formatTime(isPlaying ? remainingSeconds : timerSeconds)}
          </span>
        </div>
        <input type="range" min="0" max="3600" step="10" value={isPlaying ? remainingSeconds : timerSeconds} onChange={(e) => !isPlaying && setTimerSeconds(Number(e.target.value))} disabled={isPlaying} style={{ width: '100%', cursor: isPlaying ? 'not-allowed' : 'pointer', accentColor: '#ff9800' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <button onClick={() => addTimerMinutes(1)} disabled={isPlaying} style={btnStyle}>+1</button>
          <button onClick={() => addTimerMinutes(5)} disabled={isPlaying} style={btnStyle}>+5</button>
          <button onClick={() => addTimerMinutes(10)} disabled={isPlaying} style={btnStyle}>+10</button>
          <button onClick={() => setTimerSeconds(0)} disabled={isPlaying} style={{...btnStyle, backgroundColor: '#1a1a1a', color: '#666', border: '1px solid #333'}}>RST</button>
        </div>
      </div>

      <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <button onClick={toggleMetronome} style={{ padding: '18px 0', width: '85%', maxWidth: '350px', fontSize: '1.2rem', cursor: 'pointer', backgroundColor: isPlaying ? '#ff4757' : '#2ed573', border: 'none', borderRadius: '12px', color: 'white', fontWeight: 500, letterSpacing: '2px', transition: 'all 0.2s' }}>
          {isPlaying ? 'STOP' : 'START'}
        </button>
        <button onClick={() => navigate('/calendar')} style={{ padding: '12px 0', width: '85%', maxWidth: '350px', fontSize: '0.9rem', cursor: 'pointer', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '12px', color: '#888', fontWeight: 400, letterSpacing: '1px', transition: 'all 0.2s' }}>
          CALENDAR
        </button>
      </div>
    </div>
  );
}

const btnStyle = { padding: '8px 0', fontSize: '0.9rem', fontWeight: 400, backgroundColor: '#1a1a1a', color: '#ccc', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', flex: 1, transition: 'all 0.2s' };
const circleBtnStyle = { width: '35px', height: '35px', borderRadius: '50%', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Metronome />} />
        <Route path="/calendar" element={<CalendarPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;