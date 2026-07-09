import { useState, useEffect } from "react";
import { useLanguage } from "../../context/LanguageContext";
import * as sessionNoteService from "../../services/sessionNoteService";
import type { SessionNoteInput } from "../../services/sessionNoteService";

type FieldKey = "chiefComplaint" | "diagnosis" | "prescription" | "followUp" | "generalNotes";

const EMPTY_FORM: Record<FieldKey, string> = {
  chiefComplaint: "",
  diagnosis: "",
  prescription: "",
  followUp: "",
  generalNotes: "",
};

const FIELD_LABELS: { key: FieldKey; label: string; rows: number }[] = [
  { key: "chiefComplaint", label: "Chief Complaint", rows: 2 },
  { key: "diagnosis", label: "Diagnosis", rows: 2 },
  { key: "prescription", label: "Prescription", rows: 3 },
  { key: "followUp", label: "Follow-up", rows: 2 },
  { key: "generalNotes", label: "General Notes", rows: 3 },
];

export function SessionNoteModal({
  orgId, branchId, sessionId, appointmentId, patientName, onClose,
}: {
  orgId: string;
  branchId: string;
  sessionId: string;
  appointmentId: string;
  patientName: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<FieldKey, string>>(EMPTY_FORM);
  const [isSharedWithPatient, setIsSharedWithPatient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    sessionNoteService.getNote(orgId, branchId, sessionId, appointmentId)
      .then((note) => {
        if (!alive) return;
        if (note) {
          setForm({
            chiefComplaint: note.chiefComplaint,
            diagnosis: note.diagnosis,
            prescription: note.prescription,
            followUp: note.followUp,
            generalNotes: note.generalNotes,
          });
          setIsSharedWithPatient(note.isSharedWithPatient);
        }
      })
      .catch(() => { if (alive) setLoadError(t("Failed to load existing notes.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orgId, branchId, sessionId, appointmentId, t]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const data: SessionNoteInput = { ...form, isSharedWithPatient };
      await sessionNoteService.upsertNote(orgId, branchId, sessionId, appointmentId, data);
      setSaved(true);
    } catch {
      setSaveError(t("Failed to save notes. Please try again."));
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-navy px-6 py-4">
          <p className="font-heading text-base font-bold text-white">{t("Session Notes")}</p>
          <p className="mt-0.5 text-xs text-white/50">{patientName || t("Patient")}</p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded bg-offwhite" />)}
            </div>
          ) : loadError ? (
            <p className="text-sm text-danger">{loadError}</p>
          ) : (
            <>
              {FIELD_LABELS.map(({ key, label, rows }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy-mid">
                    {t(label)}
                  </label>
                  <textarea
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    rows={rows}
                    className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={isSharedWithPatient}
                  onChange={(e) => setIsSharedWithPatient(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {t("Share with Patient")}
              </label>
              <p className="text-xs text-navy-mid">
                {t("When shared, the patient can see these notes. Hidden by default.")}
              </p>
            </>
          )}
        </div>

        <div className="border-t border-border px-6 py-4">
          {saveError && <p className="mb-2 text-xs text-danger">{saveError}</p>}
          {saved && !saveError && <p className="mb-2 text-xs text-success">{t("Saved ✓")}</p>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-border py-2.5 text-sm font-medium text-navy-mid transition hover:border-navy"
            >
              {t("Close")}
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={loading || saving}
              className="flex-1 rounded-md bg-gold py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
            >
              {saving ? t("Saving…") : t("Save Notes")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
