"use client";

import { useState } from "react";
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

    const { error } = await supabase.from("feedbacks").insert({
      member_id: currentMember?.id || "unknown",
      member_name: finalMemberName,
      content: content.trim(),
    });

    if (error) {
      setErrorMsg(`전송 실패: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
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

        <form onSubmit={handleSubmit} className="p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Send size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">소중한 의견 감사합니다!</h3>
              <p className="mt-2 text-sm text-slate-500">
                보내주신 피드백은 서비스 개선에 큰 도움이 됩니다.
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
                className="min-h-[150px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                required
              />

              <div className="mt-3 flex items-center gap-2">
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

              {errorMsg && (
                <p className="mt-2 text-xs text-red-500">{errorMsg}</p>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                  disabled={submitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || submitting}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "전송 중..." : "보내기"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
