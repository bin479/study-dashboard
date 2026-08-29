"use client";

import { useState, useEffect } from "react";
import { MessageSquarePlus, X, Send } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabaseClient";

interface Props {
  onClose: () => void;
}

export default function FeedbackModal({ onClose }: Props) {
  const currentMemberId = useDashboardStore((s) => s.currentMemberId);
  const members = useDashboardStore((s) => s.members);
  const currentMember = members.find((m) => m.id === currentMemberId);

  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const [myFeedbacks, setMyFeedbacks] = useState<any[]>([]);

  useEffect(() => {
    const fetchMyFeedbacks = async () => {
      if (!currentMember) return;
      const supabase = getSupabase();
      if (!supabase) return;
      const { data } = await supabase
        .from("feedbacks")
        .select("*")
        .eq("member_id", currentMember.id)
        .order("created_at", { ascending: false });
      if (data) setMyFeedbacks(data);
    };
    fetchMyFeedbacks();
  }, [currentMember]);

  const handleDelete = async (id: string) => {
    if (!confirm("이 피드백 전송을 취소하시겠습니까?")) return;
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from("feedbacks").delete().eq("id", id);
    setMyFeedbacks((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setErrorMsg("");

    const supabase = getSupabase();
    if (!supabase) {
      setErrorMsg("서버 연결에 실패했습니다.");
      setSubmitting(false);
      return;
    }

    const finalMemberName = isAnonymous 
      ? `${currentMember?.name || "알 수 없음"} (익명 요청)` 
      : (currentMember?.name || "알 수 없음");

    const { data, error } = await supabase.from("feedbacks").insert({
      member_id: currentMember?.id || "unknown",
      member_name: finalMemberName,
      content: content.trim(),
    }).select().single();

    if (error) {
      setErrorMsg(`전송 실패: ${error.message}`);
      setSubmitting(false);
      return;
    }

    if (data) {
      setMyFeedbacks([data, ...myFeedbacks]);
    }
    
    setContent("");
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      // We don't auto close here so they can see their sent feedback if they want
      // onClose();
    }, 2000);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2 text-indigo-600">
            <MessageSquarePlus size={20} />
            <h2 className="text-lg font-bold text-slate-900">개발자에게 의견 보내기</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <form onSubmit={handleSubmit}>
            {success ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Send size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">소중한 의견 감사합니다!</h3>
                <p className="mt-2 text-sm text-slate-500">
                  성공적으로 전송되었습니다.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-slate-600">
                  앱 사용 중 겪은 불편한 점, 오류, 혹은 추가되었으면 하는 기능을 편하게 적어주세요.
                </p>

                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="예: 시간표에서 OOO 기능이 추가되었으면 좋겠어요. 모바일에서 화면이 깨져 보입니다."
                  className="min-h-[120px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                  required
                />

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="anonymous-checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <label htmlFor="anonymous-checkbox" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                      익명으로 보내기
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!content.trim() || submitting}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? "전송 중..." : "보내기"}
                  </button>
                </div>
                
                {errorMsg && (
                  <p className="mt-2 text-xs text-red-500">{errorMsg}</p>
                )}
              </>
            )}
          </form>

          {myFeedbacks.length > 0 && (
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="mb-4 text-sm font-bold text-slate-900">내가 보낸 의견 내역</h3>
              <div className="space-y-3">
                {myFeedbacks.map((fb) => (
                  <div key={fb.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex flex-col gap-2">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{fb.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400">
                        {new Date(fb.created_at).toLocaleString('ko-KR')}
                        {fb.status === "closed" ? " (해결됨)" : " (대기중)"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(fb.id)}
                        className="text-[11px] font-medium text-red-500 hover:text-red-700 hover:underline"
                      >
                        전송 취소(삭제)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
