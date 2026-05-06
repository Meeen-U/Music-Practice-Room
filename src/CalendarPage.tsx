import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';

type DailyRecord = {
  actual: number;
  target: number;
};

function CalendarPage() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [practiceData, setPracticeData] = useState<Record<string, DailyRecord>>({});

  useEffect(() => {
    const storedData = localStorage.getItem('bassPracticeData');
    if (storedData) {
      setPracticeData(JSON.parse(storedData));
    }
  }, []);

  const startDate = startOfMonth(currentMonth);
  const endDate = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m 0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getStatusColor = (record?: DailyRecord) => {
    if (!record || record.actual === 0) return '#1a1a1a'; // 練習していない（ダークグレー）
    if (record.actual < record.target) return '#00bcd4'; // 目標未満（ネオンブルー）
    return '#1e88e5'; // 目標達成！（ディープブルー）
  };

  return (
    <div style={{ padding: '30px 20px', minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#eee', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Sans", sans-serif', fontWeight: 300 }}>
      
      <button 
        onClick={() => navigate('/')}
        style={{ padding: '10px 20px', marginBottom: '20px', cursor: 'pointer', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#ccc', transition: 'all 0.2s', fontSize: '0.9rem', letterSpacing: '1px' }}>
        ← BACK TO ROOM
      </button>

      <h2 style={{ textAlign: 'center', marginBottom: '30px', fontSize: '1.5rem', fontWeight: 400, letterSpacing: '2px' }}>
        📅 PRACTICE LOG <span style={{ color: '#888', fontSize: '1.2rem' }}>({format(currentMonth, 'yyyy.MM')})</span>
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', maxWidth: '800px', margin: '0 auto' }}>
        {daysInMonth.map((day) => {
          const dateString = format(day, 'yyyy-MM-dd');
          const record = practiceData[dateString];
          
          return (
            <div 
              key={dateString}
              style={{
                backgroundColor: getStatusColor(record),
                aspectRatio: '1 / 1.2', // 情報を入れやすくするために少し縦長に変更！
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: record?.actual ? '#fff' : '#555',
                fontWeight: isToday(day) ? 500 : 300,
                border: isToday(day) ? '1px solid #fff' : '1px solid #222',
                position: 'relative',
                boxShadow: record?.actual ? '0 4px 10px rgba(0,0,0,0.3)' : 'none'
              }}
            >
              <span style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{format(day, 'd')}</span>
              
              {/* ★ 実績と目標の表示エリア */}
              {record && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  {record.actual > 0 && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                      {formatDuration(record.actual)}
                    </span>
                  )}
                  {/* 目標タイムを小さくバッジっぽく表示🎯 */}
                  <span style={{ 
                    fontSize: '0.7rem', 
                    color: record.actual >= record.target ? '#fff' : 'rgba(255,255,255,0.6)', 
                    backgroundColor: 'rgba(0,0,0,0.2)', 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    marginTop: '2px' 
                  }}>
                    🎯 {Math.floor(record.target / 60)}m
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '40px', fontSize: '0.85rem', color: '#888' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '3px' }}></div>未実施</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#00bcd4', borderRadius: '3px' }}></div>目標未満</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#1e88e5', borderRadius: '3px' }}></div>目標達成！</div>
      </div>

    </div>
  );
}

export default CalendarPage;