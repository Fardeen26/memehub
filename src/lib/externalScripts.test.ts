import { describe, expect, it } from "vitest";
import {
  ADSENSE_SCRIPT_URL,
  externalScriptDescriptors,
} from "./externalScripts";

describe("external script descriptors", () => {
  it("declares the AdSense script exactly once with one loading strategy", () => {
    const adsenseScripts = externalScriptDescriptors.filter(
      ({ src }) => src === ADSENSE_SCRIPT_URL,
    );

    expect(adsenseScripts).toHaveLength(1);
    expect(adsenseScripts[0]).toMatchObject({
      async: true,
      crossOrigin: "anonymous",
      strategy: "afterInteractive",
    });
  });

  it("does not declare the same external script URL more than once", () => {
    const sources = externalScriptDescriptors.map(({ src }) => src);

    expect(new Set(sources).size).toBe(sources.length);
  });

  it("does not load a redundant custom analytics tracker", () => {
    expect(externalScriptDescriptors).toHaveLength(1);
    expect(externalScriptDescriptors[0]?.src).toBe(ADSENSE_SCRIPT_URL);
    expect(
      externalScriptDescriptors.some(({ src }) =>
        src.includes("analytics-code.vercel.app"),
      ),
    ).toBe(false);
  });
});
