/// <reference path="../../css-modules.d.ts" />
import type { CSSProperties } from "react";

import styles from "./ExperimentalDisclaimer.module.css";

const box: CSSProperties = {
  margin: 0,
  padding: "1rem 1.25rem",
  borderRadius: 8,
  border: "1px solid color-mix(in srgb, #fe01ac 22%, transparent)",
  borderLeft: "4px solid #fe01ac",
  background: "color-mix(in srgb, #fe01ac 6%, transparent)",
  fontSize: "0.9375rem",
  lineHeight: 1.6,
  color: "var(--vocs-color_text, #4c4c4c)",
};

export function ExperimentalDisclaimer() {
  return (
    <div className={styles.disclaimerSlot}>
      <aside
        style={box}
        role="note"
        aria-label="Experimental software notice"
      >
        The ZCAM SDK is an early-stage reference implementation intended to
        demonstrate cryptographic camera attestation. It is not production-ready
        and should not be used to handle sensitive user data or ship in
        production-scale applications.
      </aside>
    </div>
  );
}
