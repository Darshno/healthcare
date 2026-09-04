import { describe, expect, it } from "vitest";
import { translate, priorityLabel, priorityReasonLabel, syncLabel, referralLabel } from "../lib/health/i18n";
import type { AppLanguage } from "../lib/health/types";

describe("i18n multilingual support", () => {
  const languages: AppLanguage[] = ["en", "hi", "ta", "mr"];

  it("translates core operational terms across English, Hindi, Tamil, and Marathi", () => {
    for (const lang of languages) {
      expect(translate(lang, "operations")).toBeTruthy();
      expect(translate(lang, "queue")).toBeTruthy();
      expect(translate(lang, "patients")).toBeTruthy();
      expect(translate(lang, "medicines")).toBeTruthy();
      expect(translate(lang, "referrals")).toBeTruthy();
      expect(translate(lang, "registerPatient")).toBeTruthy();
      expect(translate(lang, "emergency")).toBeTruthy();
      expect(translate(lang, "urgent")).toBeTruthy();
      expect(translate(lang, "routine")).toBeTruthy();
      expect(translate(lang, "syncNow")).toBeTruthy();
    }
  });

  it("provides correct localized labels for triage priorities", () => {
    expect(priorityLabel("ta", "emergency")).toBe("அவசரம்");
    expect(priorityLabel("mr", "emergency")).toBe("तात्काळ / आणीबाणी");
    expect(priorityLabel("hi", "emergency")).toBe("आपातकाल");
    expect(priorityLabel("en", "emergency")).toBe("Emergency");
  });

  it("provides correct localized labels for referral statuses", () => {
    expect(referralLabel("ta", "inTransit")).toBe("பயணத்தில் உள்ளது");
    expect(referralLabel("mr", "inTransit")).toBe("मार्गावर");
    expect(referralLabel("hi", "inTransit")).toBe("रास्ते में");
    expect(referralLabel("en", "inTransit")).toBe("In transit");
  });
});
