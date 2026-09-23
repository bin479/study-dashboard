import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

// Using default Node.js runtime for stability on Netlify

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey) {
      return new Response('Missing Supabase Config', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // If today is Saturday or Sunday, show next week's schedule
    const now = new Date();
    // In Korea time (simple approximation by adding 9 hours if server is UTC)
    // Edge runtime dates are usually UTC. 
    now.setHours(now.getHours() + 9);
    
    if (now.getDay() === 0 || now.getDay() === 6) {
      now.setDate(now.getDate() + (now.getDay() === 0 ? 1 : 2));
    }

    const w1 = getMonday(now);
    const w2 = new Date(w1);
    w2.setDate(w2.getDate() + 7);

    const week1Dates: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(w1);
      d.setDate(d.getDate() + i);
      week1Dates.push(formatDate(d));
    }
    const week2Dates: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(w2);
      d.setDate(d.getDate() + i);
      week2Dates.push(formatDate(d));
    }

    const allDates = [...week1Dates, ...week2Dates];
    const grouped: Record<string, any[]> = {};
    allDates.forEach(d => (grouped[d] = []));

    const startStr = week1Dates[0];
    const endStr = week2Dates[4];

    const { data: lectures, error } = await supabase
      .from('lectures')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })
      .order('order', { ascending: true });

    if (error) {
      console.error(error);
      return new Response('Database error', { status: 500 });
    }

    if (lectures) {
      lectures.forEach((l) => {
        if (grouped[l.date]) {
          grouped[l.date].push(l);
        }
      });
    }

    // Fetch Korean Font (Noto Sans KR) dynamically
    let fontBuffer: ArrayBuffer | null = null;
    try {
      const fontRes = await fetch('https://fonts.gstatic.com/s/notosanskr/v36/PbykFmXiEBPT4ITbgNA5Cgms2_wmR2A.woff');
      fontBuffer = await fontRes.arrayBuffer();
    } catch (err) {
      console.error('Failed to load font:', err);
    }

    const renderDay = (date: string, dayLectures: any[]) => {
      const d = new Date(date);
      const dayName = DAY_NAMES[d.getDay()];

      return (
        <div
          key={date}
          style={{
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '16px',
            borderLeft: '6px solid #6366f1',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '70px',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: '2px solid rgba(255,255,255,0.1)',
              marginRight: '16px',
              paddingRight: '16px',
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 'bold' }}>{dayName}</span>
            <span style={{ fontSize: 16, color: '#94a3b8', marginTop: 6 }}>
              {date.substring(5).replace('-', '/')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
            {dayLectures.length === 0 ? (
              <div style={{ display: 'flex', fontSize: 20, color: '#64748b', alignItems: 'center', height: '100%' }}>
                일정 없음
              </div>
            ) : (
              dayLectures.map((l, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '10px' }}>
                    <span style={{ fontSize: 22, fontWeight: 'bold', color: '#e2e8f0' }}>
                      {l.subject}
                    </span>
                    {l.professor && (
                      <span style={{ fontSize: 18, color: '#94a3b8', marginBottom: '2px' }}>
                        {l.professor}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'row', marginTop: '4px', fontSize: 18, color: '#cbd5e1', gap: '10px' }}>
                    <span style={{ color: '#818cf8' }}>{l.period}</span>
                    {l.topic && <span>• {l.topic}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    };

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: '#0f172a',
            color: 'white',
            fontFamily: '"Noto Sans KR", sans-serif',
          }}
        >
          {/* Top empty space for iOS Clock (approx 500px) */}
          <div style={{ display: 'flex', height: '500px', width: '100%' }}></div>

          {/* Main Content Area */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '40px',
              height: '1420px',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 40,
                fontWeight: 'bold',
                color: '#818cf8',
                marginBottom: 30,
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>주간 시간표 (2주)</span>
              <span style={{ fontSize: 28, color: '#94a3b8', fontWeight: 'normal' }}>
                {startStr.substring(5).replace('-', '/')} ~ {endStr.substring(5).replace('-', '/')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '20px' }}>
                {week1Dates.map(date => renderDay(date, grouped[date]))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '20px' }}>
                {week2Dates.map(date => renderDay(date, grouped[date]))}
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
        fonts: fontBuffer ? [
          {
            name: 'Noto Sans KR',
            data: fontBuffer,
            weight: 400,
            style: 'normal',
          },
        ] : undefined,
      }
    );
  } catch (e: any) {
    console.error(e);
    return new Response('Error generating image', { status: 500 });
  }
}
