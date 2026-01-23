import{u as s,j as e}from"./index-BcqIBAMg.js";const r={title:"How it Works",description:"undefined"};function i(n){const t={a:"a",aside:"aside",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...s(),...n.components};return e.jsxs(e.Fragment,{children:[e.jsx(t.header,{children:e.jsxs(t.h1,{id:"how-it-works",children:["How it Works",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#how-it-works",children:e.jsx(t.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(t.p,{children:"ZCAM verifies photo authenticity via a combination of hardware-backed attestation, cryptographic signatures, and optional zero-knowledge proofs."}),`
`,e.jsx(t.p,{children:"When a user takes a photo, ZCAM signs it using an Apple attested, secure enclave key. This attestation is embedded into the photo using the C2PA standard. Optionally, the attestation can be wrapped in a zero-knowledge proof for enhanced privacy."}),`
`,e.jsx(t.p,{children:"The system works in three steps:"}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Capture"}),": Take a photo and sign it with a hardware-backed key, attaching the attestation to the photo."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Prove"})," (optional): Generate a zero-knowledge proof of the signature"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Verify"}),": Validate the photo's authenticity using either bindings or ZK proof verification"]}),`
`]}),`
`,e.jsxs(t.h2,{id:"verification-modes",children:["Verification Modes",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verification-modes",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Bindings verification"})," verifies the Apple App Attest signature directly. It's faster, works offline, and requires no zero-knowledge proofs."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"ZK proof verification"})," generates a zero-knowledge proof for enhanced privacy, but requires network access for proof generation."]}),`
`]}),`
`,e.jsx(t.aside,{"data-callout":"info",children:e.jsxs(t.p,{children:["ZK proofs are ",e.jsx(t.strong,{children:"optional"}),": you can use ZCAM with bindings verification alone, or add ZK proofs when you need additional privacy guarantees."]})}),`
`,e.jsxs(t.h2,{id:"components",children:["Components",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#components",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"The SDK is built on three core technologies:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Apple's App Attest"})," guarantees that signing keys are generated and stored in the iPhone's secure enclave, tied to a specific app."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"C2PA"})," embeds verifiable provenance metadata, including capture details and edit history, directly into the image file."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"SP1 zero-knowledge proofs"})," optionally wrap verification into succinct, easily verifiable proofs using Succinct's ",e.jsx(t.a,{href:"https://docs.succinct.xyz/docs/sp1/introduction",children:"SP1"})," zkVM."]}),`
`]}),`
`,e.jsxs(t.h3,{id:"apple-app-attest-and-secure-enclave",children:["Apple App Attest and Secure Enclave",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#apple-app-attest-and-secure-enclave",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"ZCAM uses the Secure Enclave to store signing keys and Apple's App Attest service to ensure that a photo was signed by the ZCAM SDK."}),`
`,e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"App Attest"})," is designed to let backend services verify that requests are coming from a legitimate app. It works by generating a signing keypair in the device's secure enclave that only the specific app can access. Apple then attests that the keypair was generated on that app and that the app itself has not been tamepred such that any subsequent signatures are guaranteed to originate from it."]}),`
`,e.jsx(t.p,{children:e.jsx(t.img,{src:"/images/diagram_appattest.png",alt:"App Attest protocol diagram"})}),`
`,e.jsx(t.p,{children:"The App Attest protocol provides an attestation from Apple's servers, bound to a unique nonce and the public key of the secure enclave keypair. The app attaches this attestation to requests so the receiving service can verify authenticity."}),`
`,e.jsx(t.p,{children:"ZCAM uses App Attest differently in two ways:"}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsxs(t.li,{children:["The nonce is unique ",e.jsx(t.em,{children:"per photo"})," and is derived on the device itself, rather than received from a backend service."]}),`
`,e.jsx(t.li,{children:"The attestation can be verified directly (bindings verification) or inside a zero-knowledge proof (ZK verification), rather than by a backend service."}),`
`]}),`
`,e.jsxs(t.p,{children:["The ",e.jsx(t.strong,{children:"Secure Enclave"}),` is a coprocessor in Apple devices that provides an isolated environment for cryptographic operations. Keys stored in the Secure Enclave cannot be extracted or copied, are protected even if the device is compromised, and can only be used by the app that created them.
ZCAM stores both the device key (for signing photo hashes) and the content key (for signing C2PA manifests) in the Secure Enclave. This ensures that even if an attacker gains device access, they cannot forge signatures using the ZCAM signing key.`]}),`
`,e.jsxs(t.h3,{id:"c2pa",children:["C2PA",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#c2pa",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"C2PA is an open standard for attaching metadata that is cryptographically bound to an image. A C2PA manifest contains details about the photo, such as device, dimensions, history, and a cryptographic signature over those details."}),`
`,e.jsx(t.p,{children:"The manifest is either embedded directly into the photo file in some metadata section of the file or can be stored separately and referenced using an invisible watermark."}),`
`,e.jsx(t.p,{children:"ZCAM uses C2PA to embed attestation data (and optionally zero-knowledge proofs), proving that the photo was taken on an iPhone and signed using a secure enclave key that only the ZCAM SDK can access."}),`
`,e.jsxs(t.h3,{id:"sp1-zero-knowledge-proofs",children:["SP1 Zero-Knowledge Proofs",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#sp1-zero-knowledge-proofs",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"Zero-knowledge proofs let one party prove to another that a statement is true without revealing anything beyond the statement's validity."}),`
`,e.jsxs(t.p,{children:["ZCAM uses ",e.jsx(t.a,{href:"https://docs.succinct.xyz/docs/sp1/introduction",children:"SP1"}),", Succinct's zero-knowledge virtual machine (zkVM). SP1 proves the correct execution of programs compiled for the RISC-V architecture, meaning it can run and prove programs written in Rust, C++, C, or any language that compiles to RISC-V."]}),`
`,e.jsx(t.p,{children:"SP1 offers three key benefits:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Maintainability"}),": Write ZK programs in standard Rust without custom DSLs or complex circuits"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Faster Development"}),": Skip months of low-level ZK engineering"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Performance"}),": State-of-the-art proving speed and efficiency, benchmarked in production"]}),`
`]}),`
`,e.jsx(t.p,{children:"In ZCAM, SP1 generates proofs that verify the photo was signed with a valid Apple App Attest key, the signature matches the photo hash, and the attestation chain is valid. These proofs are small, fast to verify, and don't reveal the underlying attestation data."}),`
`,e.jsxs(t.p,{children:["As mentioned above, zero knowledge proofs are ",e.jsx(t.em,{children:"optional"}),". You can use ZCAM with bindings verification alone. ZK proofs add privacy guarantees but require internet access to request proofs from the Succinct Prover Network. There is also higher latency given the time required for the network to prove the verification of an attestation."]})]})}function o(n={}){const{wrapper:t}={...s(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(i,{...n})}):i(n)}export{o as default,r as frontmatter};
