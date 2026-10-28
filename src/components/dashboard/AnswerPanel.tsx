import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/useAppStore";
import { Sparkles, Copy, Check, RefreshCw, Send, ShieldAlert, BookOpen, X, HelpCircle } from "lucide-react";

export const AnswerPanel: React.FC = () => {
  const {
    latestSuggestion,
    selectedVariantStyle,
    setSelectedVariantStyle,
    setLatestSuggestion,
    knowledgeDocs,
    setActiveTab,
  } = useAppStore();

  const [copiedStyle, setCopiedStyle] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeDocs = knowledgeDocs.filter((d) => d.is_active);

  const activeVariant = latestSuggestion?.variants.find(
    (v) => v.style.toLowerCase() === selectedVariantStyle.toLowerCase()
  ) || latestSuggestion?.variants[0];

  const handleCopy = (text: string, styleKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStyle(styleKey);
    setTimeout(() => setCopiedStyle(null), 2000);
  };

  const handleManualRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim()) return;

    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const suggestion = await invoke("generate_answer_manual", { context: manualQuery });
      setLatestSuggestion(suggestion as any);
      setManualQuery("");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Lỗi tạo câu trả lời: ${err?.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadSample = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const sampleQuestion = "Can you describe a challenging project you worked on and how you resolved the issues?";
      const suggestion = await invoke("generate_answer_manual", { context: sampleQuestion });
      setLatestSuggestion(suggestion as any);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Lỗi: ${err?.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-400" />
            AI Smart Answer Assistant
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Detects interview & meeting questions and generates contextual suggestions in 3 styles.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 font-medium">
          <ShieldAlert className="w-3.5 h-3.5" />
          Anti-Fabrication Guard Active
        </div>
      </div>

      {/* Knowledge Base Reference Status Banner */}
      <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span className="text-xs text-slate-300">
            {activeDocs.length > 0 ? (
              <>
                Đang đối chiếu với <strong className="text-white font-semibold">{activeDocs.length} tài liệu tri thức</strong> (CV, dự án cá nhân) để đề xuất câu trả lời chuẩn xác.
              </>
            ) : (
              <>
                Chưa kích hoạt tài liệu cá nhân. Hãy nạp CV hoặc tài liệu dự án để AI gợi ý câu trả lời chính xác theo hồ sơ của bạn.
              </>
            )}
          </span>
        </div>
        <button
          onClick={() => setActiveTab("knowledge")}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 flex-shrink-0 underline self-start sm:self-auto"
        >
          <span>Quản lý tài liệu</span>
          <span>➔</span>
        </button>
      </div>

      {/* Error Feedback Banner */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Manual Suggestion Trigger Bar */}
      <form onSubmit={handleManualRequest} className="glass-panel p-3 rounded-2xl flex items-center gap-3">
        <input
          type="text"
          value={manualQuery}
          onChange={(e) => setManualQuery(e.target.value)}
          placeholder="Didn't catch the question? Type or paste it here to get instant answer suggestions..."
          className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={isGenerating || !manualQuery.trim()}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all"
        >
          {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Suggest Answer
        </button>
      </form>

      {/* Main Answer View */}
      {latestSuggestion ? (
        <div className="space-y-6">
          {/* Question Banner */}
          <div className="glass-panel rounded-2xl p-5 border-l-4 border-l-indigo-500 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Target Question • {latestSuggestion.question.question_type}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono">
                  {latestSuggestion.is_manual ? "Manual Trigger" : "Auto Detected"}
                </span>
                <button
                  onClick={() => setLatestSuggestion(null)}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Đóng / Xóa gợi ý này"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-base font-semibold text-white">
              "{latestSuggestion.question.question_text}"
            </p>
          </div>

          {/* Style Selector Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            {latestSuggestion.variants.map((variant) => (
              <button
                key={variant.style}
                onClick={() => setSelectedVariantStyle(variant.style)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  selectedVariantStyle.toLowerCase() === variant.style.toLowerCase()
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {variant.style}
              </button>
            ))}
          </div>

          {/* Active Style Response Card */}
          {activeVariant && (
            <div className="glass-panel rounded-2xl p-6 space-y-4 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  {activeVariant.style} Response (English)
                </span>
                <button
                  onClick={() => handleCopy(activeVariant.text_en, activeVariant.style)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 transition-all"
                >
                  {copiedStyle === activeVariant.style ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedStyle === activeVariant.style ? "Copied to Clipboard!" : "Copy English"}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <p className="text-base text-slate-100 leading-relaxed font-normal">
                  {activeVariant.text_en}
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  Vietnamese Reference Translation
                </span>
                <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/60">
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {activeVariant.text_vi}
                  </p>
                </div>
              </div>

              {/* Anti-fabrication reminder */}
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/50 flex items-center gap-2.5 text-xs text-slate-400">
                <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  Replace any bracketed placeholders like <code className="text-indigo-300 bg-indigo-950/80 px-1 py-0.5 rounded font-mono text-[11px]">[your metric/technology]</code> with your actual experience. The AI never invents personal background.
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm py-16 space-y-4">
          <Sparkles className="w-12 h-12 opacity-30 text-amber-400" />
          <div className="text-center">
            <p className="text-base font-medium text-slate-300">Chưa phát hiện câu hỏi nào trong luồng âm thanh</p>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Khi ai đó đặt câu hỏi trong buổi họp hoặc phỏng vấn, các gợi ý câu trả lời thông minh sẽ lập tức xuất hiện ở đây.
            </p>
          </div>
          <button
            onClick={handleLoadSample}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-all flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <span>Nạp Câu Hỏi Thử Nghiệm (Sample Question)</span>
          </button>
        </div>
      )}
    </div>
  );
};
