import{f as a,j as e}from"./index-BKSjBa6b.js";const r={title:"How it Works",description:"undefined"};function n(i){const t={a:"a",aside:"aside",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...a(),...i.components};return e.jsxs(e.Fragment,{children:[e.jsx(t.header,{children:e.jsxs(t.h1,{id:"how-it-works",children:["How it Works",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#how-it-works",children:e.jsx(t.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(t.h2,{id:"overview",children:["Overview",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#overview",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"ZCAM enables photo authenticity verification through a combination of hardware-backed attestation, cryptographic signatures, and optional zero-knowledge proofs."}),`
`,e.jsx(t.p,{children:"At a high level, ZCAM enables a user to take a photo, then leverages hardware-backed signing keys to sign the validity of the photo. This attestation is then attached to the photo using C2PA. Finally, the attestation can optionally be replaced with a zero knowledge proof that proves the verification of the attestation."}),`
`,e.jsx(t.p,{children:"The system works in three main steps:"}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Capture"}),": Take a photo and sign it with a hardware-backed key"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Prove"})," (optional): Generate a zero-knowledge proof of the signature"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Verify"}),": Validate the photo's authenticity using either bindings or ZK proof verification"]}),`
`]}),`
`,e.jsxs(t.h2,{id:"verification-modes",children:["Verification Modes",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verification-modes",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"ZCAM supports two verification modes:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Bindings verification"}),": Verifies the Apple App Attest signature directly. This mode is faster and works offline. No zero-knowledge proofs are required."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"ZK proof verification"})," (optional): Generates a zero-knowledge proof for enhanced privacy and verifiability. This provides additional cryptographic guarantees but requires network access for proof generation."]}),`
`]}),`
`,e.jsxs(t.p,{children:["The ZK proof step is ",e.jsx(t.strong,{children:"optional"}),"—you can use ZCAM with bindings verification alone, or add ZK proofs for additional privacy guarantees."]}),`
`,e.jsxs(t.h2,{id:"components",children:["Components",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#components",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"This section describes the building blocks of ZCAM: Zero knowledge proofs generated using the SP1 zk virtual machine, C2PA for attaching metadata to an image and Apple's App attest service and secure enclave used for signing the validity of a photo."}),`
`,e.jsxs(t.h3,{id:"zero-knowledge-proofs",children:["Zero-Knowledge Proofs",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#zero-knowledge-proofs",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"Zero-knowledge proofs allow one party (the prover) to prove to another party (the verifier) that a statement is true without revealing any information beyond the validity of the statement itself."}),`
`,e.jsxs(t.h3,{id:"sp1-zero-knowledge-virtual-machine",children:["SP1 Zero-Knowledge Virtual Machine",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#sp1-zero-knowledge-virtual-machine",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.p,{children:["ZCAM uses ",e.jsx(t.a,{href:"https://docs.succinct.xyz/docs/sp1/introduction",children:"SP1"}),", Succinct's zero-knowledge virtual machine (zkVM). SP1 is a zkVM that proves the correct execution of programs compiled for the RISC-V architecture, meaning it can run and prove programs written in Rust, C++, C, or any language that compiles to RISC-V."]}),`
`,e.jsx(t.p,{children:"Key benefits of SP1:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Maintainability"}),": Write ZK programs in standard Rust without custom DSLs or complex circuits"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Faster Development"}),": Skip months of low-level ZK engineering"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Performance"}),": State-of-the-art proving speed and efficiency, benchmarked in production"]}),`
`]}),`
`,e.jsx(t.p,{children:"In ZCAM, SP1 generates proofs that verify:"}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsx(t.li,{children:"The photo was signed using a valid Apple App Attest key"}),`
`,e.jsx(t.li,{children:"The signature corresponds to the photo hash"}),`
`,e.jsx(t.li,{children:"The attestation chain is valid"}),`
`]}),`
`,e.jsx(t.p,{children:"These proofs are small, fast to verify, and don't reveal the underlying attestation data."}),`
`,e.jsx(t.aside,{"data-callout":"info",children:e.jsxs(t.p,{children:[e.jsx(t.strong,{children:"ZK Proofs are Optional"}),": You can use ZCAM with bindings verification alone. ZK proofs add privacy guarantees but require internet access to request proofs from the Succinct Prover Network. There is also higher latency given the time required for the network to prove the verification of an attestation."]})}),`
`,e.jsxs(t.h3,{id:"c2pa",children:["C2PA",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#c2pa",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.p,{children:["C2PA is an open source standard that allows parties to attach metadata that is ",e.jsx(t.em,{children:"cryptographically bound"})," to a specified image. This is done using a ",e.jsx(t.em,{children:"C2PA Manifest"})," which is tied to a specific image, including details and metadata about said image and also a cryptographic signature over these details."]}),`
`,e.jsx(t.p,{children:"The manifest can hold any information about the photo including metadata about what device it was taken on, size of the image etc. The key point is that it is signed using some key that attests to the accuracy of the associated information."}),`
`,e.jsx(t.p,{children:"The manifest is then embedded directly into the photo file. The manner in which this is done depends. For example, it can be embedded into the metadata section of the JPEG file, or can be embedded as an invisible watermark encoding the manifest data."}),`
`,e.jsx(t.p,{children:"ZCAM leverages the C2PA standard to embed verifiable attestation data (and optionally zero-knowledge proofs) that the photo was taken on an iPhone and signed using a secure enclave private key that only the ZCAM SDK can use."}),`
`,e.jsxs(t.h3,{id:"apple-app-attest",children:["Apple App Attest",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#apple-app-attest",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.p,{children:["ZCAM uses Apple's App Attest service to ensure that a ZPhoto was indeed ",e.jsx(t.em,{children:"signed"})," by the ZCAM SDK."]}),`
`,e.jsxs(t.p,{children:["The ",e.jsx(t.em,{children:"intended"})," purpose of App Attest is to ensure requests coming from an app to a backend service is actually from the intended app. i.e. It guarantees that a backend service knows that it's only servicing requests from the associated mobile app."]}),`
`,e.jsxs(t.p,{children:["At a high level, this is done by generating a new signing keypair on the device's secure enclave ",e.jsx(t.em,{children:"that only the specific mobile app can access"}),". There is then a protocol for Apple to ",e.jsx(t.em,{children:"attest"})," to the keypair as having been generated on said mobile app. This ensures any subsequent signatures using the keypair is guaranteed to be from the app."]}),`
`,e.jsx(t.p,{children:e.jsx(t.img,{src:"/images/diagram_appattest.png",alt:"App Attest protocol diagram"})}),`
`,e.jsx(t.p,{children:"Specifically, the App Attest protocol provides an attestation from Apple's backend server that is bound to some unique nonce and the public key of the secure enclave keypair. The app can then send this attestation as part of a request, such that the receiving backend service can verify the attestation."}),`
`,e.jsx(t.p,{children:"Note, ZCAM leverages Apple App Attest, but uses it in a subtle but different way. There are two key differences:"}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsx(t.li,{children:"The unique nonce used in the attestation is actually derived on the app itself, instead of receiving it from some backend service."}),`
`,e.jsx(t.li,{children:"The attestation can be verified either directly (bindings verification) or in a zero knowledge proof (ZK proof verification) instead of by a backend service."}),`
`]}),`
`,e.jsxs(t.h3,{id:"ios-secure-enclave",children:["iOS Secure Enclave",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#ios-secure-enclave",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"The Secure Enclave is a coprocessor found in Apple devices that provides an isolated, secure environment for cryptographic operations. Keys stored in the Secure Enclave:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"Cannot be extracted or copied"}),`
`,e.jsx(t.li,{children:"Are protected even if the device is compromised"}),`
`,e.jsx(t.li,{children:"Can only be used by the specific app that created them"}),`
`,e.jsx(t.li,{children:"Are hardware-backed and tamper-resistant"}),`
`]}),`
`,e.jsx(t.p,{children:"ZCAM uses the Secure Enclave to store both the device key (used for signing photo hashes) and the content key (used for signing C2PA manifests). This ensures that even if an attacker gains access to the device, they cannot forge signatures or create fake zphotos."})]})}function o(i={}){const{wrapper:t}={...a(),...i.components};return t?e.jsx(t,{...i,children:e.jsx(n,{...i})}):n(i)}export{o as default,r as frontmatter};
