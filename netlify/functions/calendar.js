const { createClient } = require("@supabase/supabase-js");

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function generateIcs(lectures) {
  const now = new Date();
  const dtstamp =
    now.getUTCFullYear() +
    pad2(now.getUTCMonth() + 1) +
    pad2(now.getUTCDate()) +
    "T" +
    pad2(now.getUTCHours()) +
    pad2(now.getUTCMinutes()) +
    pad2(now.getUTCSeconds()) +
    "Z";

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Study Dashboard//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:시간표",
    "X-WR-TIMEZONE:Asia/Seoul"
  ];

  for (const l of lectures) {
    if (!l.startTime || !l.endTime) continue;
    if (l.status === "shifted") continue;

    const dateStr = l.date.replace(/-/g, ""); // YYYYMMDD
    const startStr = l.startTime.replace(/:/g, "") + "00";
    const endStr = l.endTime.replace(/:/g, "") + "00";

    const dtstart = dateStr + "T" + startStr;
    const dtend = dateStr + "T" + endStr;

    const summary = `[${l.subject}] ${l.topic || ""}${l.professor ? ` (${l.professor})` : ""}`;
    let description = `${l.period}`;
    if (l.note) description += `\\n${l.note.replace(/\n/g, "\\n")}`;

    ics.push(
      "BEGIN:VEVENT",
      `UID:${l.id}@study-dashboard`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Seoul:${dtstart}`,
      `DTEND;TZID=Asia/Seoul:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      "END:VEVENT"
    );
  }

  ics.push("END:VCALENDAR");
  return ics.join("\r\n");
}

exports.handler = async (event) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    return {
      statusCode: 500,
      body: "Supabase credentials missing"
    };
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: lectures, error } = await supabase
      .from("lectures")
      .select("*")
      .order("date", { ascending: true })
      .order("order", { ascending: true });

    if (error) {
      throw error;
    }

    const icsContent = generateIcs(lectures || []);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"schedule.ics\"",
        "Cache-Control": "public, max-age=3600"
      },
      body: icsContent
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: err.message
    };
  }
};
