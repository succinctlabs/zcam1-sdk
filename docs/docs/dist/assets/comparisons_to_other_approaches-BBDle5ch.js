import{f as r,j as e}from"./index-2BHdsCVf.js";const a={title:"ZCAM vs Other Approaches",description:"undefined"};function i(t){const n={a:"a",aside:"aside",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...r(),...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.header,{children:e.jsxs(n.h1,{id:"zcam-vs-other-approaches",children:["ZCAM vs Other Approaches",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#zcam-vs-other-approaches",children:e.jsx(n.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(n.p,{children:"Numerous technologies exist for image authenticity and provenance. These solutions address different problem spaces and offer varying trade-offs."}),`
`,e.jsx(n.aside,{"data-callout":"info",children:e.jsx(n.p,{children:"ZCAM provides a complete mobile-first solution for photo authenticity: hardware-backed attestation, optional zero-knowledge proofs, embedded verification data, and a simple verified/not-verified output tailored to human-captured zPhotos."})}),`
`,e.jsx(n.p,{children:"Below is a feature comparison showing what each approach provides. See the sections below for more detail."}),`
`,e.jsxs(n.h2,{id:"comparison-table",children:["Comparison Table",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#comparison-table",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.table,{children:[e.jsx(n.thead,{children:e.jsxs(n.tr,{children:[e.jsx(n.th,{children:"Approach"}),e.jsx(n.th,{children:"Hardware Attestation"}),e.jsx(n.th,{children:"ZK Proofs"}),e.jsx(n.th,{children:"Embedded Verification"}),e.jsx(n.th,{children:"User-friendly Output"}),e.jsx(n.th,{children:"Camera Photos"}),e.jsx(n.th,{children:"Use Case"})]})}),e.jsxs(n.tbody,{children:[e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"ZCAM"})}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"Complete mobile photo authenticity solution"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"C2PA (generic)"})}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"Edit history tracking and provenance"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"Physical Camera"})}),e.jsx(n.td,{children:"❓"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"Some cameras support hardware-backed signing; support varies"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"JPEG Trust"})}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"Trust evaluation framework (leverages C2PA)"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"SynthID"})}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"AI watermarking and detection"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"AI Content Marking"})}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"AI-generated content marking (watermarking or C2PA)"})]})]})]}),`
`,e.jsxs(n.h2,{id:"other-tooling",children:["Other tooling",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#other-tooling",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.h3,{id:"c2pa",children:["C2PA",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#c2pa",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["C2PA is a content credential standard that creates a ",e.jsx(n.em,{children:"verifiable history"})," for images."]}),`
`,e.jsx(n.p,{children:'It is not specific to "authentic" photos: C2PA can be applied to camera captures and AI-generated images alike. A C2PA manifest records origin and edit history; each manifest is signed using public-key cryptography.'}),`
`,e.jsx(n.strong,{children:"Key differences from ZCAM:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"C2PA doesn't require hardware attestation; any signing key can be used."}),`
`,e.jsx(n.li,{children:"C2PA focuses on edit history, while ZCAM focuses on capture authenticity."}),`
`,e.jsx(n.li,{children:"ZCAM uses C2PA as the container format but adds hardware-backed guarantees."}),`
`,e.jsx(n.li,{children:"C2PA is a general-purpose tool for attaching historical metadata; ZCAM focuses on proving the authenticity of an image."}),`
`]}),`
`,e.jsxs(n.p,{children:["More technical information is available in the ",e.jsx(n.a,{href:"/overview/how_it_works",children:"How it Works"})," section under C2PA."]}),`
`,e.jsxs(n.h3,{id:"jpeg-trust",children:["JPEG Trust",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#jpeg-trust",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"JPEG Trust provides a framework for evaluating an image's trustworthiness. It leverages C2PA manifests to build trust profiles and evaluators that help determine authenticity."}),`
`,e.jsx(n.strong,{children:"Key differences from ZCAM:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"JPEG Trust is an evaluation framework, not a capture/verification system."}),`
`,e.jsx(n.li,{children:"It can consume ZCAM-generated C2PA manifests."}),`
`,e.jsx(n.li,{children:"Focuses on trust scoring rather than raw cryptographic verification."}),`
`]}),`
`,e.jsxs(n.h3,{id:"synthid",children:["SynthID",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#synthid",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"SynthID (Google) is an invisible watermark framework that embeds resilient data into images. JUMBF metadata can be stripped or altered by edits; SynthID uses ML-based embeddings that a reader model can detect."}),`
`,e.jsx(n.strong,{children:"Key differences from ZCAM:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"SynthID focuses on AI-detection; ZCAM focuses on authenticity verification."}),`
`,e.jsx(n.li,{children:"ZCAM provides cryptographic guarantees; SynthID provides probabilistic detection."}),`
`]}),`
`,e.jsxs(n.h3,{id:"iptc-photo-metadata",children:["IPTC Photo Metadata",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#iptc-photo-metadata",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"IPTC Photo Metadata defines standardized fields and labels for image metadata. It is a metadata format rather than a verification system."}),`
`,e.jsx(n.strong,{children:"Key differences from ZCAM:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"IPTC is a metadata format, not a verification system."}),`
`,e.jsx(n.li,{children:"Can be used alongside ZCAM for standardized metadata fields."}),`
`,e.jsx(n.li,{children:"No cryptographic guarantees or hardware attestation."}),`
`]}),`
`,e.jsxs(n.h3,{id:"ai-content-marking",children:["AI Content Marking",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#ai-content-marking",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"Several companies provide tools for marking AI-generated content:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Meta Watermarking"}),": Durable watermarks for AI-generated content that aim to survive cropping and edits."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"OpenAI C2PA"}),": OpenAI-generated images include C2PA manifests indicating the generation source."]}),`
`]}),`
`,e.jsx(n.strong,{children:"Key differences from ZCAM:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"These solutions mark AI-generated content; ZCAM verifies authentic human-captured zPhotos."}),`
`,e.jsx(n.li,{children:"They lack hardware attestation."}),`
`,e.jsx(n.li,{children:"Different goals: provenance/marking for AI content vs. cryptographic authenticity verification for human-captured zPhotos."}),`
`]}),`
`,e.jsxs(n.h2,{id:"when-to-use-zcam",children:["When to Use ZCAM",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#when-to-use-zcam",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"ZCAM is the right choice when you need:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Hardware-backed authenticity"}),": Guarantees that zPhotos were taken on a specific device"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Cryptographic verification"}),": Strong cryptographic proofs versus probabilistic detection"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Mobile-first"}),": Designed for iOS (Android support planned)"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Simple verification"}),": Easy API that returns verified/not-verified without requiring manifest parsing"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"End-to-end solution"}),": From capture to verification with optional ZK proof integration"]}),`
`]}),`
`,e.jsx(n.p,{children:"Consider other approaches when:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"You need to mark AI-generated content (use SynthID or AI Content Marking)"}),`
`,e.jsx(n.li,{children:"You want a general-purpose edit history system (use generic C2PA)"}),`
`,e.jsx(n.li,{children:"You need watermarking resilient to heavy editing (use SynthID)"}),`
`,e.jsx(n.li,{children:"You're working with non-mobile platforms (use C2PA or other standards)"}),`
`]})]})}function d(t={}){const{wrapper:n}={...r(),...t.components};return n?e.jsx(n,{...t,children:e.jsx(i,{...t})}):i(t)}export{d as default,a as frontmatter};
