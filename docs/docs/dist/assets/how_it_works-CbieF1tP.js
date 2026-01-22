import{f as r,j as e}from"./index-2BHdsCVf.js";const s={title:"How it Works",description:"undefined"};function n(t){const i={a:"a",aside:"aside",div:"div",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...r(),...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"how-it-works",children:["How it Works",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#how-it-works",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(i.p,{children:"ZCAM verifies photos through a combination of hardware-backed attestation, cryptographic signatures, and optional zero-knowledge proofs."}),`
`,e.jsx(i.p,{children:"The system works in three stages:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Capture"}),": Take a photo and sign it with a hardware-backed key"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Prove"})," (optional): Generate a zero-knowledge proof of the signature"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Verify"}),": Validate the photo's authenticity using either bindings or ZK proof verification"]}),`
`]}),`
`,e.jsx(i.p,{children:"The sections below explain each step in more detail."}),`
`,e.jsxs(i.h2,{id:"capture",children:["Capture",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#capture",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"This stage covers how a zPhoto is captured, signed, and packaged with embedded metadata."}),`
`,e.jsxs(i.h3,{id:"apple-app-attest",children:["Apple App Attest",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#apple-app-attest",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"ZCAM uses Apple App Attest to ensure a zPhoto was created and signed by the ZCAM SDK. App Attest enables the device to generate a signing keypair inside the Secure Enclave that only the app can use. Apple can then attest that the keypair was created on that device and bound to the app."}),`
`,e.jsx(i.p,{children:"The App Attest attestation is bound to a nonce and the public key of the Secure Enclave keypair. ZCAM uses App Attest in two notable ways:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsx(i.li,{children:"The attestation nonce is derived on the device rather than being supplied by a backend."}),`
`,e.jsx(i.li,{children:"The attestation can be verified directly (bindings verification) or encapsulated inside a zero-knowledge proof."}),`
`]}),`
`,e.jsx(i.p,{children:e.jsx(i.img,{src:"/images/diagram_appattest.png",alt:"App Attest protocol diagram"})}),`
`,e.jsxs(i.h3,{id:"ios-secure-enclave",children:["iOS Secure Enclave",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#ios-secure-enclave",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The Secure Enclave is a coprocessor providing an isolated environment for cryptographic operations. Keys stored there:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Cannot be extracted or copied"}),`
`,e.jsx(i.li,{children:"Are protected even if the device is compromised"}),`
`,e.jsx(i.li,{children:"Can only be used by the app that created them"}),`
`,e.jsx(i.li,{children:"Are hardware-backed and tamper-resistant"}),`
`]}),`
`,e.jsx(i.p,{children:"ZCAM stores two key types in the Secure Enclave: the device key (signs photo hashes) and the content key (signs C2PA manifests). This prevents key extraction and makes it infeasible to forge zPhotos."}),`
`,e.jsxs(i.h3,{id:"c2pa",children:["C2PA",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#c2pa",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"C2PA (Content Credentials) is the container format ZCAM uses to bind attestations and metadata to an image. A C2PA manifest can include device information, timestamps, image properties, and edit history; the manifest is cryptographically signed and embedded into the image (for example, via JUMBF or JPEG metadata)."}),`
`,e.jsx(i.p,{children:"ZCAM embeds capture attestations and optionally proofs into the C2PA manifest so the image itself carries the data needed for later verification."}),`
`,e.jsxs(i.h2,{id:"prove",children:["Prove",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#prove",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"This stage is optional: for stronger privacy and succinct verification, ZCAM can convert attestation verification into a zero-knowledge proof."}),`
`,e.jsxs(i.h3,{id:"zero-knowledge-proofs",children:["Zero-Knowledge Proofs",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#zero-knowledge-proofs",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"Zero-knowledge proofs let a prover convince a verifier that a statement is true without revealing underlying data. In ZCAM, proofs assert that:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsx(i.li,{children:"The capture was signed with a valid App Attest key"}),`
`,e.jsx(i.li,{children:"The signature corresponds to the photo hash"}),`
`,e.jsx(i.li,{children:"The attestation chain is valid"}),`
`]}),`
`,e.jsxs(i.h3,{id:"sp1-zkvm",children:["SP1 zkVM",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#sp1-zkvm",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.p,{children:["ZCAM uses ",e.jsx(i.a,{href:"https://docs.succinct.xyz/docs/sp1/introduction",children:"SP1"}),", Succinct's zkVM, to generate proofs. SP1 proves correct execution of programs compiled for RISC-V, so developers can write verification logic in Rust (or other RISC-V targets) and have SP1 produce succinct proofs."]}),`
`,e.jsx(i.p,{children:"Key benefits:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Maintainability"}),": Use standard Rust instead of a custom DSL"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Faster development"}),": Avoid low-level ZK circuit engineering"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Performance"}),": Small, fast-to-verify proofs"]}),`
`]}),`
`,e.jsx(i.aside,{"data-callout":"info",children:e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"ZK Proofs are optional"}),": You can use ZCAM with bindings verification alone. Generating a proof requires network access (to the prover network) and will add latency, but it provides stronger privacy by avoiding disclosure of raw attestations."]})}),`
`,e.jsxs(i.h2,{id:"verify",children:["Verify",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verify",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"Verification validates a zPhoto using either direct bindings verification or proof verification."}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Bindings verification"}),": Verify the App Attest signature and C2PA manifest directly. This mode is fast, works offline, and returns a clear verified/not-verified result."]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"ZK proof verification"})," (optional): Verify a succinct SP1 proof that attests to the validity of the capture and attestation chain. Proof verification is quick and preserves privacy but requires that a proof be generated first."]}),`
`]})]})}function o(t={}){const{wrapper:i}={...r(),...t.components};return i?e.jsx(i,{...t,children:e.jsx(n,{...t})}):n(t)}export{o as default,s as frontmatter};
