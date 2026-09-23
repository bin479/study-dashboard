import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

// 교시 정의: 1교시~8교시 (각 1시간씩)
const PERIODS = [
  { label: '1', time: '09:00', hour: 9 },
  { label: '2', time: '10:00', hour: 10 },
  { label: '3', time: '11:00', hour: 11 },
  { label: '4', time: '12:00', hour: 12 },
  { label: 'LUNCH', time: '13:00', hour: 13 },
  { label: '5', time: '14:00', hour: 14 },
  { label: '6', time: '15:00', hour: 15 },
  { label: '7', time: '16:00', hour: 16 },
  { label: '8', time: '17:00', hour: 17 },
];

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'];

// 교시 row 높이 (px)
const ROW_H = 100;
const LUNCH_H = 55;
const HEADER_H = 75;
const TIME_COL_W = 72;
const IMG_W = 1080;
const IMG_H = 2340; // iPhone XR: 828×1792 → scaled to 1080×2340

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getTopOffset(startHour: number): number {
  // 9시 기준 오프셋 계산
  const h = startHour;
  if (h < 9) return 0;
  if (h < 13) {
    return (h - 9) * ROW_H;
  }
  // 13:00 점심
  if (h === 13) return 4 * ROW_H;
  // 14:00~
  return 4 * ROW_H + LUNCH_H + (h - 14) * ROW_H;
}

function getHeight(durationHours: number, startHour: number): number {
  // 점심 시간(13시)이 포함되면 LUNCH_H 추가
  const endHour = startHour + durationHours;
  const crossesLunch = startHour < 13 && endHour > 13;
  return durationHours * ROW_H + (crossesLunch ? LUNCH_H : 0);
}

// 강의 색상 (subjectType 기반)
function getCardColor(lecture: any): { bg: string; border: string; text: string } {
  const type = lecture.entryType;
  const sub = lecture.subjectType;
  if (type === 'exam') return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };
  if (sub === 'minor') return { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' };
  return { bg: '#f0fdf4', border: '#22c55e', text: '#166534' };
}

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    console.log('Supabase config loaded:', !!supabaseUrl && !!serviceKey);

    if (!supabaseUrl || !serviceKey) {
      return new Response('Missing Supabase Config', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 한국 시간(UTC+9) 기준 현재 날짜
    const nowUtc = new Date();
    const now = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);

    // 주말이면 다음 주로 이동
    if (now.getUTCDay() === 0 || now.getUTCDay() === 6) {
      now.setUTCDate(now.getUTCDate() + (now.getUTCDay() === 0 ? 1 : 2));
    }

    const w1 = getMonday(new Date(now));
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

    console.log('Fetched lectures count:', lectures ? lectures.length : 0);

    if (error) {
      console.error(error);
      return new Response('Database error', { status: 500 });
    }

    if (lectures) {
      lectures.forEach((l) => {
        if (grouped[l.date] !== undefined) {
          grouped[l.date].push(l);
        }
      });
    }

    // Font loading disabled for Netlify (system font fallback)
let fontBuffer: ArrayBuffer | null = null;

    // 시간표 그리드 전체 높이 계산
    const GRID_H = 4 * ROW_H + LUNCH_H + 4 * ROW_H; // 교시1~4 + 점심 + 교시5~8
    const GRID_TOP_PADDING = 12;
    const CONTENT_W = IMG_W - TIME_COL_W - 8; // 날짜 열 5개 공간
    const COL_W = Math.floor(CONTENT_W / 5);

    // 주별 격자 렌더링 함수
    const renderWeekGrid = (weekDates: string[], weekLabel: string) => {
      const SECTION_H = HEADER_H + GRID_TOP_PADDING + GRID_H + 20;

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
          }}
        >
          {/* 주 헤더 바 */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#1e293b',
              borderRadius: '10px 10px 0 0',
              marginBottom: 0,
              padding: '6px 12px',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 'bold', color: '#818cf8' }}>{weekLabel}</span>
            <span style={{ fontSize: 24, color: '#64748b', marginLeft: 16 }}>
              {weekDates[0].substring(5).replace('-', '/')} ~ {weekDates[4].substring(5).replace('-', '/')}
            </span>
          </div>

          {/* 요일 헤더 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              backgroundColor: '#0f172a',
              borderBottom: '1px solid #334155',
            }}
          >
            {/* 시간 열 */}
            <div
              style={{
                display: 'flex',
                width: TIME_COL_W,
                height: HEADER_H,
                alignItems: 'center',
                justifyContent: 'center',
                borderRight: '1px solid #334155',
              }}
            >
              <span style={{ fontSize: 22, color: '#475569' }}>교시</span>
            </div>
            {/* 요일 */}
            {weekDates.map((date, i) => {
              const mmdd = date.substring(5).replace('-', '/');
              return (
                <div
                  key={date}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    height: HEADER_H,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRight: i < 4 ? '1px solid #334155' : 'none',
                    backgroundColor: '#0f172a',
                  }}
                >
                  <span style={{ fontSize: 30, fontWeight: 'bold', color: '#e2e8f0' }}>
                    {WEEKDAY_LABELS[i]}
                  </span>
                  <span style={{ fontSize: 22, color: '#64748b', marginTop: 2 }}>{mmdd}</span>
                </div>
              );
            })}
          </div>

          {/* 그리드 바디 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              position: 'relative',
              backgroundColor: '#0f172a',
              borderRadius: '0 0 10px 10px',
              overflow: 'hidden',
            }}
          >
            {/* 교시 시간 열 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: TIME_COL_W,
                borderRight: '1px solid #334155',
                flexShrink: 0,
              }}
            >
              {PERIODS.map((p) => {
                const h = p.label === 'LUNCH' ? LUNCH_H : ROW_H;
                return (
                  <div
                    key={p.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      height: h,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: '1px solid #1e293b',
                      backgroundColor: p.label === 'LUNCH' ? '#0a0f1e' : 'transparent',
                    }}
                  >
                    {p.label === 'LUNCH' ? (
                      <span style={{ fontSize: 12, color: '#475569' }}>점심</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 16, color: '#475569' }}>{p.label}</span>
                        <span style={{ fontSize: 14, color: '#334155', marginTop: 2 }}>{p.time}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 요일별 강의 컬럼 */}
            {weekDates.map((date, colIdx) => {
              const dayLectures = grouped[date] || [];
              return (
                <div
                  key={date}
                  style={{
                    display: 'flex',
                    flex: 1,
                    position: 'relative',
                    borderRight: colIdx < 4 ? '1px solid #1e293b' : 'none',
                    height: GRID_H,
                  }}
                >
                  {/* 배경 가로선 */}
                  {PERIODS.map((p) => {
                    const top = getTopOffset(p.hour);
                    const h = p.label === 'LUNCH' ? LUNCH_H : ROW_H;
                    return (
                      <div
                        key={p.label}
                        style={{
                          display: 'flex',
                          position: 'absolute',
                          top,
                          left: 0,
                          right: 0,
                          height: h,
                          borderBottom: '1px solid #1e293b',
                          backgroundColor: p.label === 'LUNCH' ? '#070b14' : 'transparent',
                        }}
                      />
                    );
                  })}

                  {/* 강의 블록 */}
                  {dayLectures.map((l, idx) => {
                    const startHour = l.startTime
                      ? parseInt(l.startTime.split(':')[0])
                      : 9 + (l.order - 1);
                    const duration = l.durationHours || 1;
                    const top = getTopOffset(startHour);
                    const height = getHeight(duration, startHour) - 4;
                    const colors = getCardColor(l);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          position: 'absolute',
                          top: top + 2,
                          left: 3,
                          right: 3,
                          height,
                          backgroundColor: colors.bg,
                          borderRadius: 8,
                          borderLeft: `5px solid ${colors.border}`,
                          flexDirection: 'column',
                          padding: '6px 8px',
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          style={{
                            fontSize: height < 70 ? 18 : 24,
                            fontWeight: 'bold',
                            color: colors.text,
                            lineHeight: 1.2,
                          }}
                        >
                          {l.subject}
                        </span>
                        {l.topic && height >= 60 && (
                          <span style={{ fontSize: 18, color: '#374151', marginTop: 3, lineHeight: 1.2 }}>
                            {l.topic}
                          </span>
                        )}
                        {l.professor && height >= 80 && (
                          <span style={{ fontSize: 17, color: '#6b7280', marginTop: 3 }}>
                            {l.professor}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* 점심 라벨 (월요일 열에만) */}
                  {colIdx === 0 && (
                    <div
                      style={{
                        display: 'flex',
                        position: 'absolute',
                        top: getTopOffset(13),
                        left: 0,
                        right: 0,
                        height: LUNCH_H,
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 0,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    // 점심 라벨 세로 위치: 4교시 끝
    const w1Label = `1주차`;
    const w2Label = `2주차`;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: '#0d1117',
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
            padding: '40px 30px 30px 30px',
            gap: 24,
          }}
        >
          {/* 제목 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 44, fontWeight: 'bold', color: '#818cf8' }}>
              📅 주간 시간표
            </span>
            <span style={{ fontSize: 28, color: '#64748b' }}>
              {startStr.substring(5).replace('-', '/')} ~ {endStr.substring(5).replace('-', '/')}
            </span>
          </div>

          {/* 1주차 */}
          {renderWeekGrid(week1Dates, w1Label)}

          {/* 구분선 */}
          <div style={{ display: 'flex', height: 2, backgroundColor: '#1e293b', margin: '4px 0' }} />

          {/* 2주차 */}
          {renderWeekGrid(week2Dates, w2Label)}
        </div>
      ),
      {
        width: IMG_W,
        height: IMG_H,
        fonts: fontBuffer
          ? [
              {
                name: 'Noto Sans KR',
                data: fontBuffer,
                weight: 400,
                style: 'normal',
              },
            ]
          : undefined,
      }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(`Error generating image: ${e.message}`, { status: 500 });
  }
}
