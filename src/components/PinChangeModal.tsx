import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Lock, X } from "lucide-react";
import { resetMemberPin, claimMember } from "@/lib/auth";

export default function PinChangeModal({ memberId, onClose }: { memberId: string, onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN은 숫자 4자리로 입력해주세요.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PIN이 서로 다릅니다. 다시 입력해주세요.");
      return;
    }
    setBusy(true);
    setError("");
    
    // 강제 초기화 후 새로 등록
    const resetOk = await resetMemberPin(memberId);
    if (!resetOk) {
      setError("비밀번호 초기화에 실패했습니다.");
      setBusy(false);
      return;
    }

    const claimOk = await claimMember(memberId, pin);
    setBusy(false);
    
    if (claimOk) {
      setSuccess(true);
      setTimeout(onClose, 1500);
    } else {
      setError("비밀번호 변경에 실패했습니다.");
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Lock size={18} className="text-indigo-600" />
            비밀번호 변경
          </h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <p className="text-lg font-semibold text-emerald-600">변경 완료!</p>
            <p className="mt-1 text-sm text-slate-500">잠시 후 창이 닫힙니다.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">새 비밀번호 (숫자 4자리)</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg tracking-[0.5em] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="••••"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">새 비밀번호 확인</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg tracking-[0.5em] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="••••"
              />
            </div>
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            
            <button
              type="submit"
              disabled={busy || pin.length < 4 || pinConfirm.length < 4}
              className="mt-2 w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              {busy ? "변경 중..." : "변경하기"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
