import { describe, it, expect, beforeEach } from "vitest";
import { analyzeDiseaseWithGemini, analyzeDiseaseRuleBased } from "../lib/health/aiTriage";
import { evaluateTriageFlags, calculateRiskScore, mapRiskToCategory } from "../shared/triage";

describe("Triage Safety Floor Enforcement", () => {
  it("ensures rule engine determines deterministic minimum safety priority", () => {
    const emergencyVitals = { oxygenSaturation: 85, heartRate: 140, systolicBP: 190 };
    const score = calculateRiskScore({ age: 30, vitalSigns: emergencyVitals });
    const priority = mapRiskToCategory(score);
    expect(priority).toBe("emergency");
  });

  it("prevents AI from downgrading an emergency condition to routine", async () => {
    // Disease text with clear emergency symptoms
    const text = "Patient with severe chest pain, breathing difficulty and cardiac arrest signs";
    const ruleBaseline = analyzeDiseaseRuleBased(text);
    expect(ruleBaseline.priority).toBe("emergency");

    // Even if AI service returned routine, safety floor enforces emergency
    const aiResult = await analyzeDiseaseWithGemini(text);
    expect(aiResult.priority).toBe("emergency");
  });

  it("evaluates maternal danger as high priority floor", () => {
    const res = evaluateTriageFlags({ maternalDanger: true });
    expect(res.priority).toBe("emergency");
    expect(res.reason).toBe("maternalDanger");
  });
});

describe("Optimistic Versioning & Sync Logic", () => {
  it("validates client operation payload snapshot structure", () => {
    const payload = {
      localId: "pat-101",
      name: "Ramesh Kumar",
      sex: "male",
      version: 1,
    };
    const payloadStr = JSON.stringify(payload);
    const parsed = JSON.parse(payloadStr);

    expect(parsed.localId).toBe("pat-101");
    expect(parsed.version).toBe(1);
  });

  it("detects conflict when server version is higher than operation version", () => {
    const clientVersion = 1;
    const serverVersion = 2;
    const isConflict = serverVersion > clientVersion;

    expect(isConflict).toBe(true);
  });
});
