"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { MessageSquare, Check, Clock } from "lucide-react";

interface Feedback {
  id: string;
  created_at: string;
  member_id: string;
  member_name: string;
  content: string;
  status: "open" | "closed";
}

export default function FeedbackView() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedbacks = async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setFeedbacks(data as Feedback[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const newStatus = currentStatus === "open" ? "closed" : "open";
    
    // Optimistic update
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
    
    await supabase.from("feedbacks").update({ status: newStatus }).eq("id", id);
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-400">불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={22} className="text-indigo-600" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">사용자 피드백</h1>
            <p className="text-sm text-slate-500">앱 내 사용자들의 의견 및 오류 제보 내역입니다.</p>
          </div>
        </div>
        <button
          onClick={fetchFeedbacks}
          className="text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          새로고침
        </button>
      </div>

      <div className="space-y-4">
        {feedbacks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-400">
            접수된 피드백이 없습니다.
          </div>
        ) : (
          feedbacks.map((fb) => (
            <div key={fb.id} className={`rounded-2xl border bg-white p-5 shadow-sm transition-all ${fb.status === 'closed' ? 'border-slate-200 opacity-60' : 'border-indigo-100'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{fb.member_name}</h3>
                  <p className="text-xs text-slate-400">{new Date(fb.created_at).toLocaleString('ko-KR')}</p>
                </div>
                <button
                  onClick={() => toggleStatus(fb.id, fb.status)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    fb.status === 'open' 
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  }`}
                >
                  {fb.status === 'open' ? (
                    <><Clock size={14} /> 미해결</>
                  ) : (
                    <><Check size={14} /> 해결됨</>
                  )}
                </button>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                {fb.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
