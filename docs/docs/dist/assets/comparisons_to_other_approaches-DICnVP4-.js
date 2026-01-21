import{f as r,j as e}from"./index-BKSjBa6b.js";const s={title:"ZCAM vs Other Approaches",description:"undefined"};function i(t){const n={a:"a",aside:"aside",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...r(),...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.header,{children:e.jsxs(n.h1,{id:"zcam-vs-other-approaches",children:["ZCAM vs Other Approaches",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#zcam-vs-other-approaches",children:e.jsx(n.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(n.p,{children:"There already exist numerous technologies in the authenticity and verifiability of images space. These solutions, however, solve for slightly different problem spaces and provide varying levels of functionality."}),`
`,e.jsx(n.aside,{"data-callout":"info",children:e.jsx(n.p,{children:"ZCAM provides a complete solution for mobile photo authenticity verification. It combines hardware-backed attestation, optional zero-knowledge proofs, embedded verification data, and simple verification output (verified/not verified) into a single integrated system designed specifically for human-taken photos on mobile devices."})}),`
`,e.jsx(n.p,{children:"Below is a feature comparison showing what each approach provides. See further sections below for more details on other tools and advantages that ZCAM can provide."}),`
`,e.jsxs(n.h2,{id:"comparison-table",children:["Comparison Table",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#comparison-table",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.table,{children:[e.jsx(n.thead,{children:e.jsxs(n.tr,{children:[e.jsx(n.th,{children:"Approach"}),e.jsx(n.th,{children:"Hardware Attestation"}),e.jsx(n.th,{children:"ZK Proofs"}),e.jsx(n.th,{children:"Embedded Verification"}),e.jsx(n.th,{children:"User-friendly Output"}),e.jsx(n.th,{children:"Camera Photos"}),e.jsx(n.th,{children:"Use Case"})]})}),e.jsxs(n.tbody,{children:[e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"ZCAM"})}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"Complete mobile photo authenticity solution"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"C2PA (generic)"})}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"Edit history tracking, content provenance"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"Physical Camera"})}),e.jsx(n.td,{children:"❓"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"For C2PA-compatible cameras, note only some cameras support hardware-backed signing"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"JPEG Trust"})}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"Trust evaluation framework (leverages C2PA)"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"SynthID"})}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"AI watermarking and detection"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"AI Content Marking"})}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"✅"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"❌"}),e.jsx(n.td,{children:"AI-generated content marking (watermarking or C2PA)"})]})]})]}),`
`,e.jsxs(n.h2,{id:"other-tooling",children:["Other tooling",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#other-tooling",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.h3,{id:"c2pa",children:["C2PA",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#c2pa",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["The C2PA content credential standard aims to create a ",e.jsx(n.em,{children:"verifiable history"})," of a given image."]}),`
`,e.jsxs(n.p,{children:["Note, it is ",e.jsx(n.em,{children:"not"}),' specific to "authentic" images, i.e. it can be applied to both camera-captured pictures, as well as AI-generated images. It creates a specification for attaching contextual metadata as an image evolves over time. For example, an initial image can be captured using a camera or generated using AI. An initial ',e.jsx(n.em,{children:"C2PA Manifest"})," is attached to the image indicating its origin. Thereafter, as edits are made (using C2PA-compatible editors), new manifests are attached indicating the edits made (e.g. cropping, brightness balancing, etc.). All of these manifests are signed using public key cryptography."]}),`
`,e.jsx(n.strong,{children:"Key Differences from ZCAM:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"C2PA doesn't require hardware attestation. any signing key can be used to sign attestations."}),`
`,e.jsx(n.li,{children:"C2PA focuses on edit history, while ZCAM focuses on capture authenticity"}),`
`,e.jsx(n.li,{children:"ZCAM uses C2PA as the container format but adds hardware-backed guarantees"}),`
`,e.jsx(n.li,{children:"C2PA is a more flexible, generic tooling for attaching historical metadata to an image, ZCAM focuses on proving authenticity of an iamge."}),`
`]}),`
`,e.jsxs(n.p,{children:["More technical information can be found in the ",e.jsx(n.a,{href:"/overview/how_it_works",children:"How it Works"})," section under C2PA."]}),`
`,e.jsxs(n.h3,{id:"jpeg-trust",children:["JPEG Trust",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#jpeg-trust",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["JPEG Trust provides a framework for evaluating the trustworthiness of an image. It is actually compatible with C2PA, and relies ",e.jsx(n.em,{children:"on"})," the data encoded in C2PA manifests."]}),`
`,e.jsxs(n.p,{children:["The main value here is the ability to create trust ",e.jsx(n.em,{children:"profiles"})," and ",e.jsx(n.em,{children:"evaluators"})," that leverage the bound data, which allows users to conclude the authenticity for a given photo."]}),`
`,e.jsx(n.strong,{children:"Key Differences from ZCAM:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"JPEG Trust is an evaluation framework, not a capture/verification system"}),`
`,e.jsx(n.li,{children:"It can work with ZCAM-generated C2PA manifests"}),`
`,e.jsx(n.li,{children:"Focuses on trust scoring rather than cryptographic verification"}),`
`]}),`
`,e.jsxs(n.h3,{id:"synthid",children:["SynthID",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#synthid",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"SynthID, developed by Google, is an invisible watermark framework that can embed data into an image in a more resilient format. Solutions that use the JUMBF metadata are susceptible to getting the metadata stripped, the photo getting edited/cropped, etc. The actual embedded data is based on an AI model, and can later be read and analyzed by another model that decides whether a photo is AI-generated or not."}),`
`,e.jsx(n.strong,{children:"Key Differences from ZCAM:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"SynthID focuses on AI detection, ZCAM focuses on authenticity verification"}),`
`,e.jsx(n.li,{children:"ZCAM provides cryptographic guarantees, SynthID provides probabilistic detection"}),`
`]}),`
`,e.jsxs(n.h3,{id:"iptc-photo-metadata",children:["IPTC Photo Metadata",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#iptc-photo-metadata",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"The IPTC Photo Metadata simply defines standardized nomenclature and labeling for the aforementioned protocols. It's a metadata standard rather than a verification system."}),`
`,e.jsx(n.strong,{children:"Key Differences from ZCAM:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"IPTC is a metadata format, not a verification system"}),`
`,e.jsx(n.li,{children:"Can be used alongside ZCAM for standardized metadata fields"}),`
`,e.jsx(n.li,{children:"No cryptographic guarantees or hardware attestation"}),`
`]}),`
`,e.jsxs(n.h3,{id:"ai-content-marking",children:["AI Content Marking",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#ai-content-marking",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"Several companies provide solutions for marking AI-generated content, using different approaches:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Meta Watermarking"}),": Meta adds watermarks specifically to AI-generated content. These watermarks are meant to be durable, handling cropping and edit actions, etc."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"OpenAI C2PA"}),": OpenAI (e.g. ChatGPT) generated images include C2PA manifests indicating they were generated using DALL-E and on ChatGPT. This is also included in Azure's OpenAI service."]}),`
`]}),`
`,e.jsx(n.strong,{children:"Key Differences from ZCAM:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"These solutions focus on marking AI-generated content, while ZCAM verifies authentic human-captured photos"}),`
`,e.jsx(n.li,{children:"No hardware attestation in these implementations"}),`
`,e.jsx(n.li,{children:"Different goals: provenance/marking for AI content vs. authenticity verification for human-captured photos"}),`
`,e.jsx(n.li,{children:"Watermark-based (Meta) or C2PA-based (OpenAI) rather than hardware-backed cryptographic verification"}),`
`]}),`
`,e.jsxs(n.h2,{id:"when-to-use-zcam",children:["When to Use ZCAM",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#when-to-use-zcam",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"ZCAM is the right choice when you need:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Hardware-backed authenticity"}),": Guarantees that photos were taken on a specific device"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Cryptographic verification"}),": Strong cryptographic proofs rather than probabilistic detection"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Mobile-first"}),": Designed specifically for iOS (and planned Android) mobile apps"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Simple verification"}),": Easy-to-use API that returns verified/not verified without requiring manifest parsing"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Complete solution"}),": End-to-end flow from capture to verification with optional ZK proof integration"]}),`
`]}),`
`,e.jsx(n.p,{children:"Consider other approaches when:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"You need to mark AI-generated content (use SynthID or AI Content Marking solutions)"}),`
`,e.jsx(n.li,{children:"You want a general-purpose edit history system (use generic C2PA)"}),`
`,e.jsx(n.li,{children:"You need watermarking resilient to heavy editing (use SynthID)"}),`
`,e.jsx(n.li,{children:"You're working with non-mobile platforms (use C2PA or other standards)"}),`
`]})]})}function d(t={}){const{wrapper:n}={...r(),...t.components};return n?e.jsx(n,{...t,children:e.jsx(i,{...t})}):i(t)}export{d as default,s as frontmatter};
