import{u as s,j as e}from"./index-DYU0ST6z.js";const a={title:"Security",description:"undefined"};function n(t){const i={a:"a",code:"code",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",ol:"ol",p:"p",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...s(),...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"security",children:["Security",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#security",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(i.h2,{id:"security-claims",children:["Security Claims",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#security-claims",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"A verifiably authentic photo from ZCAM provides the following guarantees:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Device Authenticity"}),": The photo was signed on a genuine Apple device with a Secure Enclave"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"App Binding"}),": The signing key is bound to a specific application via Apple App Attest"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Content Integrity"}),": The photo has not been modified since the signature was created"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Proof Validity"}),": The above properties are verified in a zero-knowledge proof that chains to Apple's root certificate"]}),`
`]}),`
`,e.jsxs(i.h2,{id:"trust-assumptions",children:["Trust Assumptions",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#trust-assumptions",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The security of ZCAM relies on the following assumptions:"}),`
`,e.jsxs(i.table,{children:[e.jsx(i.thead,{children:e.jsxs(i.tr,{children:[e.jsx(i.th,{children:"Assumption"}),e.jsx(i.th,{children:"Rationale"})]})}),e.jsxs(i.tbody,{children:[e.jsxs(i.tr,{children:[e.jsx(i.td,{children:"Secure Enclave keys cannot be exfiltrated"}),e.jsx(i.td,{children:"Hardware security guarantee from Apple"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:"Apple App Attest is honest"}),e.jsx(i.td,{children:"Apple signs attestations only for legitimate device/app pairs"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:"SP1 proof system is sound"}),e.jsx(i.td,{children:"Groth16 proofs cannot be forged without the witness"})]})]})]}),`
`,e.jsxs(i.h2,{id:"sdk-trust-model",children:["SDK Trust Model",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#sdk-trust-model",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The ZCAM SDK provides cryptographic guarantees that a photo was signed by a genuine Apple device using App Attest."}),`
`,e.jsxs(i.h3,{id:"what-the-sdk-guarantees",children:["What the SDK Guarantees",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#what-the-sdk-guarantees",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.p,{children:["The SDK's public API ",e.jsx(i.strong,{children:"only allows signing photos captured by the device camera"}),":"]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["The ",e.jsx(i.code,{children:"ZCamera.takePhoto()"})," method captures directly from the native camera and signs immediately"]}),`
`,e.jsx(i.li,{children:"There is no public API to sign an arbitrary file or image"}),`
`,e.jsx(i.li,{children:"Photos are signed using Secure Enclave keys bound to the app via Apple App Attest"}),`
`,e.jsx(i.li,{children:"The signature chains to Apple's root certificate, verifiable in a ZK proof"}),`
`]}),`
`,e.jsxs(i.p,{children:["This means an honest integrator ",e.jsx(i.strong,{children:"cannot accidentally sign AI-generated or manipulated images"})," through normal SDK usage."]}),`
`,e.jsxs(i.h3,{id:"what-it-takes-to-circumvent",children:["What It Takes to Circumvent",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#what-it-takes-to-circumvent",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.p,{children:["Signing arbitrary images (e.g., AI-generated content) requires ",e.jsx(i.strong,{children:"deliberate malicious action"}),":"]}),`
`,e.jsxs(i.table,{children:[e.jsx(i.thead,{children:e.jsxs(i.tr,{children:[e.jsx(i.th,{children:"Attack Path"}),e.jsx(i.th,{children:"What's Required"})]})}),e.jsxs(i.tbody,{children:[e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Dependency bypass"})}),e.jsx(i.td,{children:"Importing the SDK's underlying packages and replicating the signing logic outside the SDK"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"SDK modification"})}),e.jsx(i.td,{children:"Forking the SDK source code to expose internal signing functions"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Device compromise"})}),e.jsx(i.td,{children:"Jailbreaking the device to hook into the camera pipeline"})]})]})]}),`
`,e.jsx(i.p,{children:"None of these are possible through normal SDK integration. An attacker must consciously work to circumvent the SDK's design."}),`
`,e.jsxs(i.h3,{id:"defense-in-depth-appid-verification",children:["Defense in Depth: AppID Verification",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#defense-in-depth-appid-verification",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.p,{children:["Even if an attacker builds a malicious app using one of the above methods, ",e.jsx(i.strong,{children:"AppID verification provides a second layer of defense"}),":"]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Every signed photo includes the App Attest ",e.jsx(i.code,{children:"appId"})," that created it"]}),`
`,e.jsxs(i.li,{children:["Verifiers check this ",e.jsx(i.code,{children:"appId"})," against a ",e.jsx(i.strong,{children:"trusted allowlist"})]}),`
`,e.jsxs(i.li,{children:["Malicious apps will have a different ",e.jsx(i.code,{children:"appId"})," that verifiers can identify and reject"]}),`
`]}),`
`,e.jsxs(i.p,{children:['This shifts the trust question from "was this signed by ',e.jsx(i.em,{children:"a"}),' device?" to "was this signed by ',e.jsx(i.em,{children:"a trusted app"}),'?"']}),`
`,e.jsxs(i.h3,{id:"jailbroken-device-detection",children:["Jailbroken Device Detection",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#jailbroken-device-detection",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"A jailbroken device poses the highest risk, as it can bypass software-level protections by hooking into the camera pipeline or modifying the SDK at runtime."}),`
`,e.jsx(i.p,{children:"To mitigate this:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Apple App Attest"})," itself provides some jailbreak resistance—attestation may fail or return different risk metrics on compromised devices"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Jailbreak detection"})," is being integrated into the SDK to identify compromised devices at capture time"]}),`
`,e.jsx(i.li,{children:"Photos captured on detected jailbroken devices can be flagged or rejected by verifiers"}),`
`]}),`
`,e.jsx(i.p,{children:"This is an active area of development to strengthen the SDK's guarantees on potentially compromised devices."}),`
`,e.jsxs(i.h3,{id:"integrator-responsibilities",children:["Integrator Responsibilities",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#integrator-responsibilities",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"For the SDK's guarantees to hold, integrating applications must:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Use the SDK as documented, without modifying the capture-to-sign flow"}),`
`,e.jsx(i.li,{children:"Ensure their app is not compromised or tampered with"}),`
`,e.jsx(i.li,{children:"Run on non-jailbroken devices"}),`
`,e.jsx(i.li,{children:"Undergo vetting before being added to the trusted AppID allowlist"}),`
`]}),`
`,e.jsxs(i.p,{children:["This creates a clear security contract: ",e.jsx(i.strong,{children:"ZCAM guarantees the SDK's integrity; integrators guarantee their app environment."})]}),`
`,e.jsxs(i.h2,{id:"physical-replay-attacks",children:["Physical Replay Attacks",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#physical-replay-attacks",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The SDK guarantees a photo was captured by the device camera. However, someone may photograph a screen displaying an AI-generated image. In this case, the camera genuinely captured something, however the resulting photo is inauthentic."}),`
`,e.jsxs(i.p,{children:["These ",e.jsx(i.strong,{children:"physical replay attacks"})," include photographing a screen, printed image, or projection. The resulting photo is cryptographically valid but visually misleading."]}),`
`,e.jsxs(i.h3,{id:"our-solution-contextual-metadata",children:["Our Solution: Contextual Metadata",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#our-solution-contextual-metadata",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"ZCAM embeds rich contextual metadata at capture time, giving verifiers the signals needed to detect physical replay attacks. A photo of a screen or printout will have measurably different characteristics than a photo of a real scene:"}),`
`,e.jsxs(i.table,{children:[e.jsx(i.thead,{children:e.jsxs(i.tr,{children:[e.jsx(i.th,{children:"Field"}),e.jsx(i.th,{children:"What It Measures"}),e.jsx(i.th,{children:"Fraud Indicator"})]})}),e.jsxs(i.tbody,{children:[e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"GPS / Location"})}),e.jsx(i.td,{children:"Location"}),e.jsx(i.td,{children:"Location inconsistent with claimed scene"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Timestamp"})}),e.jsx(i.td,{children:"Time"}),e.jsx(i.td,{children:"Time inconsistent with lighting conditions"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Subject Distance"})}),e.jsx(i.td,{children:"Distance to focused subject"}),e.jsx(i.td,{children:"Focus distance inconsistent with the subject of picture"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Depth Map"})}),e.jsx(i.td,{children:"Per-pixel depth from dual cameras/LiDAR"}),e.jsx(i.td,{children:"Flat depth when the subject has more depth variance"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"White Balance"})}),e.jsx(i.td,{children:"Color temperature"}),e.jsx(i.td,{children:"Screen color temperature differs from natural light"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Ambient Light"})}),e.jsx(i.td,{children:"Environmental light level"}),e.jsx(i.td,{children:"Unusually uniform lighting could indicate screen glow"})]})]})]})]})}function d(t={}){const{wrapper:i}={...s(),...t.components};return i?e.jsx(i,{...t,children:e.jsx(n,{...t})}):n(t)}export{d as default,a as frontmatter};
