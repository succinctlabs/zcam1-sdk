import{f as s,j as e}from"./index-DS39NnaK.js";const d={title:"Security",description:"undefined"};function n(i){const t={a:"a",aside:"aside",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",ol:"ol",p:"p",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...s(),...i.components};return e.jsxs(e.Fragment,{children:[e.jsx(t.header,{children:e.jsxs(t.h1,{id:"security",children:["Security",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#security",children:e.jsx(t.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(t.h2,{id:"security-claims",children:["Security Claims",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#security-claims",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"A verifiably authentic photo from ZCAM provides the following guarantees:"}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Device Authenticity"}),": The photo was signed on a genuine Apple device with a Secure Enclave"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"App Binding"}),": The signing key is bound to a specific application via Apple App Attest"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Content Integrity"}),": The photo has not been modified since the signature was created"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Proof Validity"}),": The above properties are verified in a zero-knowledge proof that chains to Apple's root certificate"]}),`
`]}),`
`,e.jsxs(t.h2,{id:"trust-assumptions",children:["Trust Assumptions",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#trust-assumptions",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"The security of ZCAM relies on the following assumptions:"}),`
`,e.jsxs(t.table,{children:[e.jsx(t.thead,{children:e.jsxs(t.tr,{children:[e.jsx(t.th,{children:"Assumption"}),e.jsx(t.th,{children:"Rationale"})]})}),e.jsxs(t.tbody,{children:[e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Secure Enclave keys cannot be exfiltrated"}),e.jsx(t.td,{children:"Hardware security guarantee from Apple"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"Apple App Attest is honest"}),e.jsx(t.td,{children:"Apple signs attestations only for legitimate device/app pairs"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"SP1 proof system is sound"}),e.jsx(t.td,{children:"Groth16 proofs cannot be forged without the witness"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"SDK code integrity"}),e.jsx(t.td,{children:"The SDK code on-device has not been tampered with"})]})]})]}),`
`,e.jsxs(t.h2,{id:"critical-assumption-capture-to-sign-integrity",children:["Critical Assumption: Capture-to-Sign Integrity",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#critical-assumption-capture-to-sign-integrity",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.aside,{"data-callout":"warning",children:e.jsx(t.p,{children:`The SDK signs the photo immediately after capture, but there is no cryptographic binding
between the camera hardware and the signing operation. We assume no malicious code can
execute between the moment the photo is captured and when it is signed.`})}),`
`,e.jsx(t.p,{children:"This assumption holds if:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"The SDK code has not been tampered with"}),`
`,e.jsx(t.li,{children:"The host application does not inject code into the capture flow"}),`
`,e.jsx(t.li,{children:"The device is not compromised"}),`
`]}),`
`,e.jsxs(t.p,{children:["This is an ",e.jsx(t.strong,{children:"operational security"})," assumption, not a cryptographic guarantee."]}),`
`,e.jsxs(t.h2,{id:"open-issues",children:["Open Issues",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#open-issues",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.h3,{id:"app-trust-model",children:["App Trust Model",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#app-trust-model",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.p,{children:["Currently, the SP1 program verifies that a photo was signed by ",e.jsx(t.em,{children:"an"}),` Apple Attested key,
but does not restrict `,e.jsx(t.em,{children:"which"})," apps are trusted. A malicious app could:"]}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsx(t.li,{children:"Integrate the SDK"}),`
`,e.jsx(t.li,{children:"Feed AI-generated images to the signing flow"}),`
`,e.jsx(t.li,{children:"Generate valid proofs for inauthentic photos"}),`
`]}),`
`,e.jsx(t.strong,{children:"Mitigations under consideration:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"Maintain a allowlist of trusted App IDs verified in the proof"}),`
`,e.jsx(t.li,{children:"Output the App ID as a public value, allowing verifiers to check trust"}),`
`,e.jsx(t.li,{children:"Require app attestation/audit before allowlist inclusion"}),`
`]}),`
`,e.jsxs(t.h3,{id:"third-party-sdk-integration",children:["Third-Party SDK Integration",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#third-party-sdk-integration",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:`As the SDK scales to third-party apps, we need mechanisms to ensure integrators
use the SDK as intended. Options include:`}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"Code signing / integrity checks on the SDK binary"}),`
`,e.jsx(t.li,{children:"Runtime attestation of the SDK version"}),`
`,e.jsx(t.li,{children:"Legal/contractual requirements for integrators"}),`
`]}),`
`,e.jsxs(t.h3,{id:"sdk-code-integrity",children:["SDK Code Integrity",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#sdk-code-integrity",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"We need to guarantee the SDK code cannot be tampered with:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Build pipeline"}),": CI/CD must produce reproducible, auditable builds"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"On-device"}),": The SDK binary should be verified before execution"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Updates"}),": SDK updates must be authenticated"]}),`
`]}),`
`,e.jsx(t.p,{children:"This is not yet fully implemented."}),`
`,e.jsxs(t.h2,{id:"inauthentic-photos",children:["Inauthentic Photos",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#inauthentic-photos",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"Even with cryptographic guarantees that a photo was captured by a genuine device running the SDK, attackers may attempt physical attacks:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Screen capture"}),": Photographing a screen displaying an AI-generated or manipulated image"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Printed photo capture"}),": Photographing a printed image"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Projector capture"}),": Photographing a projected image"]}),`
`]}),`
`,e.jsx(t.p,{children:'These attacks bypass software-level protections because the camera genuinely captures "something" — just not an authentic scene.'}),`
`,e.jsx(t.p,{children:`Note that the taken photo is still "valid" in that it was taken using the camera app, properly signed etc. But the photo is still "inauthentic" in terms of what it is trying to portray.
This is a different, much harder problem to solve. In fact, a cryptographic solution is likely impossible. Instead, our strategy is to provide as much contextual data in the metadata for a user to be able to make an informed decision on the authenticity of the photo.`}),`
`,e.jsxs(t.h3,{id:"detection-signals",children:["Detection Signals",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#detection-signals",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"The following metadata fields can help detect physical replay attacks:"}),`
`,e.jsxs(t.table,{children:[e.jsx(t.thead,{children:e.jsxs(t.tr,{children:[e.jsx(t.th,{children:"Field"}),e.jsx(t.th,{children:"What It Measures"}),e.jsx(t.th,{children:"Fraud Indicator"})]})}),e.jsxs(t.tbody,{children:[e.jsxs(t.tr,{children:[e.jsx(t.td,{children:e.jsx(t.strong,{children:"GPS / Location"})}),e.jsx(t.td,{children:"Location"}),e.jsx(t.td,{children:"Location inconsistent with claimed scene"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:e.jsx(t.strong,{children:"Timestamp"})}),e.jsx(t.td,{children:"Time"}),e.jsx(t.td,{children:"Time inconsistent with lighting conditions"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:e.jsx(t.strong,{children:"Subject Distance"})}),e.jsx(t.td,{children:"Distance to focused subject"}),e.jsx(t.td,{children:"Focus distance inconsistent with the subject of picture"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:e.jsx(t.strong,{children:"Depth Map"})}),e.jsx(t.td,{children:"Per-pixel depth from dual cameras/LiDAR"}),e.jsx(t.td,{children:"Flat depth when the subject has more depth variance"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:e.jsx(t.strong,{children:"White Balance"})}),e.jsx(t.td,{children:"Color temperature"}),e.jsx(t.td,{children:"Screen color temperature differs from natural light"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:e.jsx(t.strong,{children:"Ambient Light"})}),e.jsx(t.td,{children:"Environmental light level"}),e.jsx(t.td,{children:"Unusually uniform lighting could indicate screen glow"})]})]})]})]})}function a(i={}){const{wrapper:t}={...s(),...i.components};return t?e.jsx(t,{...i,children:e.jsx(n,{...i})}):n(i)}export{a as default,d as frontmatter};
