import type { Priority, PriorityReason } from "./types";
import type { DoctorSpecialization, UserProfile, DoctorProfile } from "./userAuth";

export type TriageAnalysisResult = {
  priority: Priority;
  priorityReason: PriorityReason;
  recommendedSpecialization: DoctorSpecialization;
  clinicalSummary: string;
  matchedDoctor: {
    id: string;
    name: string;
    specialization: string;
  } | null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Keyword & Clinical Rule Engine for Offline Triage & Specialty Assignment
// ──────────────────────────────────────────────────────────────────────────────

export function analyzeDiseaseRuleBased(diseaseText: string): {
  priority: Priority;
  priorityReason: PriorityReason;
  recommendedSpecialization: DoctorSpecialization;
  clinicalSummary: string;
} {
  const d = (diseaseText || "").toLowerCase().trim();

  // Emergency conditions
  if (
    d.includes("chest pain") ||
    d.includes("heart") ||
    d.includes("breathing") ||
    d.includes("unconscious") ||
    d.includes("severe bleeding") ||
    d.includes("seizure") ||
    d.includes("stroke") ||
    d.includes("cardiac") ||
    d.includes("trauma")
  ) {
    return {
      priority: "emergency",
      priorityReason: "vitalConcern",
      recommendedSpecialization: "Emergency & Trauma Care",
      clinicalSummary: "Critical symptoms requiring immediate emergency care & trauma stabilization.",
    };
  }

  // Maternal & Gynecological
  if (
    d.includes("pregnant") ||
    d.includes("pregnancy") ||
    d.includes("maternal") ||
    d.includes("labor") ||
    d.includes("vaginal") ||
    d.includes("delivery") ||
    d.includes("trimest")
  ) {
    return {
      priority: d.includes("pain") || d.includes("bleed") ? "emergency" : "urgent",
      priorityReason: "maternalDanger",
      recommendedSpecialization: "Obstetrics & Gynecology",
      clinicalSummary: "Maternal healthcare evaluation needed by OB/GYN specialist.",
    };
  }

  // Pediatrics / Child
  if (
    d.includes("child") ||
    d.includes("infant") ||
    d.includes("baby") ||
    d.includes("pediatric") ||
    d.includes("toddler") ||
    d.includes("newborn")
  ) {
    return {
      priority: "urgent",
      priorityReason: "childDanger",
      recommendedSpecialization: "Pediatrics / Child Health",
      clinicalSummary: "Pediatric care required for young patient.",
    };
  }

  // Surgery / Fracture / Burns
  if (
    d.includes("fracture") ||
    d.includes("wound") ||
    d.includes("burn") ||
    d.includes("cut") ||
    d.includes("accident") ||
    d.includes("injury") ||
    d.includes("swallowing")
  ) {
    return {
      priority: "urgent",
      priorityReason: "clinicianUrgent",
      recommendedSpecialization: "General Surgery",
      clinicalSummary: "Surgical/wound evaluation required.",
    };
  }

  // Dental
  if (d.includes("tooth") || d.includes("teeth") || d.includes("dental") || d.includes("gum")) {
    return {
      priority: "routine",
      priorityReason: "routineCare",
      recommendedSpecialization: "Dental & Oral Health",
      clinicalSummary: "Oral & dental checkup recommended.",
    };
  }

  // Chronic conditions
  if (
    d.includes("diabetes") ||
    d.includes("bp") ||
    d.includes("hypertension") ||
    d.includes("blood pressure") ||
    d.includes("chronic") ||
    d.includes("asthma")
  ) {
    return {
      priority: "priority",
      priorityReason: "chronicReview",
      recommendedSpecialization: "General Medicine (MBBS)",
      clinicalSummary: "Chronic illness review and management.",
    };
  }

  // Fever / Infection / General OPD
  if (
    d.includes("fever") ||
    d.includes("cough") ||
    d.includes("cold") ||
    d.includes("infection") ||
    d.includes("vomit") ||
    d.includes("diarrhea") ||
    d.includes("diarrhoea") ||
    d.includes("headache") ||
    d.includes("pain")
  ) {
    return {
      priority: "urgent",
      priorityReason: "vitalConcern",
      recommendedSpecialization: "Community Medicine / MO",
      clinicalSummary: "Acute OPD consultation needed.",
    };
  }

  return {
    priority: "routine",
    priorityReason: "routineCare",
    recommendedSpecialization: "General Medicine (MBBS)",
    clinicalSummary: "General health checkup.",
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Optional Gemini API Triage Analysis (with immediate fallback)
// ──────────────────────────────────────────────────────────────────────────────

export async function analyzeDiseaseWithGemini(diseaseText: string): Promise<{
  priority: Priority;
  priorityReason: PriorityReason;
  recommendedSpecialization: DoctorSpecialization;
  clinicalSummary: string;
}> {
  const geminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  const ruleBaseline = analyzeDiseaseRuleBased(diseaseText);

  if (!geminiKey || !diseaseText.trim()) {
    return ruleBaseline;
  }

  const priorityRanks: Record<Priority, number> = {
    emergency: 0,
    urgent: 1,
    priority: 2,
    routine: 3,
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze the following patient disease description for rural hospital triage and doctor assignment.
Disease/Symptoms: "${diseaseText}"

Return ONLY a JSON object with this exact structure:
{
  "priority": "emergency" | "urgent" | "priority" | "routine",
  "priorityReason": "maternalDanger" | "childDanger" | "vitalConcern" | "clinicianUrgent" | "chronicReview" | "routineCare",
  "recommendedSpecialization": "General Medicine (MBBS)" | "Pediatrics / Child Health" | "Obstetrics & Gynecology" | "Emergency & Trauma Care" | "Community Medicine / MO" | "General Surgery" | "Dental & Oral Health",
  "clinicalSummary": "Short 1-sentence analysis"
}`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const cleanedJson = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanedJson);
      if (parsed.priority && parsed.recommendedSpecialization) {
        let finalPriority: Priority = parsed.priority;
        // Deterministic Safety Floor: AI cannot downgrade a higher risk category calculated by rules
        if (priorityRanks[finalPriority] > priorityRanks[ruleBaseline.priority]) {
          finalPriority = ruleBaseline.priority;
        }

        return {
          priority: finalPriority,
          priorityReason: parsed.priorityReason || ruleBaseline.priorityReason,
          recommendedSpecialization: parsed.recommendedSpecialization,
          clinicalSummary: parsed.clinicalSummary || "AI-assessed triage.",
        };
      }
    }
  } catch (err) {
    console.warn("Gemini API call skipped or failed, using rule engine:", err);
  }

  return ruleBaseline;
}


// ──────────────────────────────────────────────────────────────────────────────
// Doctor Matching Engine: Finds Best Suited or Free Doctor in Hospital
// ──────────────────────────────────────────────────────────────────────────────

export function matchBestDoctor(
  facilityId: string,
  recommendedSpecialty: DoctorSpecialization,
  registeredUsers: UserProfile[],
  currentQueue: Array<{ doctorName?: string; doctorId?: string; status: string }> = []
): { id: string; name: string; specialization: string } | null {
  // Find all doctors registered for this facility
  const facilityDoctors = registeredUsers.filter(
    (u) =>
      (u.role === "doctor" || u.role === "chief_doctor") &&
      (!facilityId || u.facilityId === facilityId)
  ) as DoctorProfile[];

  if (facilityDoctors.length === 0) {
    // If no specific doctor found for this facility in state, return default general duty doctor
    return {
      id: "doc-duty-01",
      name: "Dr. Duty Doctor",
      specialization: recommendedSpecialty || "General Medicine (MBBS)",
    };
  }

  // Count active queue items per doctor
  const doctorLoad = new Map<string, number>();
  facilityDoctors.forEach((doc) => doctorLoad.set(doc.id, 0));

  currentQueue.forEach((q) => {
    if (q.status !== "completed" && q.doctorId && doctorLoad.has(q.doctorId)) {
      doctorLoad.set(q.doctorId, (doctorLoad.get(q.doctorId) || 0) + 1);
    }
  });

  // 1. Try to find doctor matching recommended specialization
  const specialtyMatches = facilityDoctors.filter((doc) =>
    doc.specialization.toLowerCase().includes(recommendedSpecialty.toLowerCase())
  );

  if (specialtyMatches.length > 0) {
    // Pick matched specialty doctor with the lowest active patient queue (freest)
    specialtyMatches.sort(
      (a, b) => (doctorLoad.get(a.id) || 0) - (doctorLoad.get(b.id) || 0)
    );
    const chosen = specialtyMatches[0];
    return {
      id: chosen.id,
      name: chosen.name,
      specialization: chosen.specialization,
    };
  }

  // 2. Otherwise pick any available doctor in the facility with the shortest queue (freest doc)
  facilityDoctors.sort(
    (a, b) => (doctorLoad.get(a.id) || 0) - (doctorLoad.get(b.id) || 0)
  );
  const freestDoctor = facilityDoctors[0];

  return {
    id: freestDoctor.id,
    name: freestDoctor.name,
    specialization: freestDoctor.specialization,
  };
}
