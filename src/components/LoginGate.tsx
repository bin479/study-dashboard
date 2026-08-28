"use client";

import { useState } from "react";
import { Stethoscope, ArrowLeft, Lock } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { claimMember, isMemberClaimed, verifyMemberPin } from "@/lib/auth";

type Step = "search" | "setPin" | "enterPin";

export default function LoginGate() {
  const members = useDashboardStore((s) => s.members);
  const setCurrentMemberId = useDashboardStore((s) => s.setCurrentMemberId);

  const [query, setQuery] = useState("");
  const [step, setStep] = useState<Step>("search");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = members.filter(
    (m) => m.name.includes(query) || (m.studentId?.includes(query) ?? false)
  );

  const selected = members.find((m) => m.id === selectedId);

  const pickMember = async (memberId: string) => {
    setSelectedId(memberId);
    setError("");
    setPin("");
    setPinConfirm("");
    setBusy(true);
    const claimed = await isMemberClaimed(memberId);
    setBusy(false);
    setStep(claimed ? "enterPin" : "setPin");
  };

  const handleSetPin = async () => {
    if (!selectedId) return;
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
    const ok = await claimMember(selectedId, pin);
    setBusy(false);
    if (ok) {
      setCurrentMemberId(selectedId);
    } else {
      setError("이미 등록된 이름입니다 — PIN 입력으로 로그인해주세요.");
      setStep("enterPin");
    }
  };

  const handleVerifyPin = async () => {
    if (!selectedId) return;
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN은 숫자 4자리입니다.");
      return;
    }
    setBusy(true);
    setError("");
    const ok = pin === "0000" ? true : await verifyMemberPin(selectedId, pin);
    setBusy(false);
    if (ok) {
      setCurrentMemberId(selectedId);
    } else {
      setError("PIN이 맞지 않습니다. (분실시 0000으로 로그인 가능합니다)");
      setPin("");
    }
  };

  const goBack = () => {
    setStep("search");
    setSelectedId(null);
    setPin("");
    setPinConfirm("");
    setError("");
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 items-center justify-center rounded-xl overflow-hidden mb-2">
            <img src="/chosun_logo.png" alt="조선대학교 의과대학 로고" className="h-full w-auto object-contain" />
          </div>
          <p className="text-base font-semibold text-slate-900">조선대학교 의과대학 학습 대시보드</p>
          <p className="text-sm text-slate-500">본인 이름을 선택하고 PIN으로 로그인하세요.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {step === "search" && (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 또는 학번으로 검색"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-100">
                {visible.slice(0, 30).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => pickMember(m.id)}
                    className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">{m.name}</span>
                    <span className="text-xs text-slate-400">{m.studentId}</span>
                  </button>
                ))}
                {visible.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>
                )}
              </div>
            </>
          )}

          {(step === "setPin" || step === "enterPin") && selected && (
            <>
              <button onClick={goBack} className="mb-3 flex items-center gap-1 text-xs text-slate-400">
                <ArrowLeft size={13} /> 다른 이름 선택
              </button>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
                  {selected.name.slice(0, 1)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{selected.name}</p>
                  <p className="text-xs text-slate-400">
                    {step === "setPin" ? "처음 로그인 — PIN을 설정하세요" : "PIN을 입력하세요"}
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Lock size={12} /> PIN (숫자 4자리)
              </label>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && (step === "setPin" ? handleSetPin() : handleVerifyPin())}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-lg tracking-[0.5em]"
              />

              {step === "setPin" && (
                <>
                  <label className="mt-2 block text-xs font-medium text-slate-500">PIN 확인</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-lg tracking-[0.5em]"
                  />
                </>
              )}

              {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}

              <button
                onClick={step === "setPin" ? handleSetPin : handleVerifyPin}
                disabled={busy}
                className="mt-3 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? "확인 중…" : step === "setPin" ? "PIN 설정하고 시작하기" : "로그인"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
