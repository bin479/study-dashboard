import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

// We use the edge runtime for next/og
export const runtime = 'edge';

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

    const monday = getMonday(now);
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);

    const startStr = formatDate(monday);
    const endStr = formatDate(friday);

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

    // Group lectures by date
    const grouped: Record<string, any[]> = {};
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      grouped[formatDate(d)] = [];
    }

    if (lectures) {
      lectures.forEach((l) => {
        if (grouped[l.date]) {
          grouped[l.date].push(l);
        }
      });
    }

    const dates = Object.keys(grouped).sort();

    // Fetch Korean Font (Noto Sans KR) dynamically
    let fontBuffer: ArrayBuffer | null = null;
    try {
      const fontRes = await fetch('https://fonts.gstatic.com/s/notosanskr/v36/PbykFmXiEBPT4ITbgNA5Cgms2_wmR2A.woff');
      fontBuffer = await fontRes.arrayBuffer();
    } catch (err) {
      console.error('Failed to load font:', err);
    }

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
              padding: '60px 40px',
              height: '1420px',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 48,
                fontWeight: 'bold',
                color: '#818cf8',
                marginBottom: 40,
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>주간 시간표</span>
              <span style={{ fontSize: 32, color: '#94a3b8', fontWeight: 'normal' }}>
                {startStr.substring(5).replace('-', '/')} ~ {endStr.substring(5).replace('-', '/')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {dates.map((date) => {
                const dayLectures = grouped[date];
                const d = new Date(date);
                const dayName = DAY_NAMES[d.getDay()];

                return (
                  <div
                    key={date}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '24px',
                      padding: '30px',
                      borderLeft: '8px solid #6366f1',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '120px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRight: '2px solid rgba(255,255,255,0.1)',
                        marginRight: '30px',
                        paddingRight: '30px',
                      }}
                    >
                      <span style={{ fontSize: 42, fontWeight: 'bold' }}>{dayName}</span>
                      <span style={{ fontSize: 24, color: '#94a3b8', marginTop: 10 }}>
                        {date.substring(5).replace('-', '/')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '20px' }}>
                      {dayLectures.length === 0 ? (
                        <div style={{ display: 'flex', fontSize: 32, color: '#64748b', alignItems: 'center', height: '100%' }}>
                          일정 없음
                        </div>
                      ) : (
                        dayLectures.map((l, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '15px' }}>
                              <span style={{ fontSize: 36, fontWeight: 'bold', color: '#e2e8f0' }}>
                                {l.subject}
                              </span>
                              {l.professor && (
                                <span style={{ fontSize: 28, color: '#94a3b8', marginBottom: '3px' }}>
                                  {l.professor}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'row', marginTop: '8px', fontSize: 28, color: '#cbd5e1', gap: '15px' }}>
                              <span style={{ color: '#818cf8' }}>{l.period}</span>
                              {l.topic && <span>• {l.topic}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
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
