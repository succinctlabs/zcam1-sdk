import{u as s,j as e}from"./index-BcqIBAMg.js";const r={title:"Architecture",description:"undefined"};function n(t){const i={a:"a",aside:"aside",code:"code",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",li:"li",ol:"ol",p:"p",pre:"pre",span:"span",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...s(),...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"architecture",children:["Architecture",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#architecture",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(i.h2,{id:"overview",children:["Overview",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#overview",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The ZCAM SDK allows an integrating app to:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsx(i.li,{children:"Take a picture"}),`
`,e.jsx(i.li,{children:"Generate and sign a valid C2PA manifest over the photo including bindings of a signature of a photo using an Apple attested key and associated attestation."}),`
`,e.jsx(i.li,{children:"Generate a verifiable SP1 proof that the photo signature is valid, was signed using a key bound to the app, and corresponds to the photo, attaching that to a valid C2PA manifest"}),`
`]}),`
`,e.jsx(i.p,{children:"The core flow uses cryptographic keys stored on the device's Secure Enclave to sign and attest that a photo was taken using the device's camera and has not been tampered with."}),`
`,e.jsx(i.aside,{"data-callout":"info",children:e.jsx(i.p,{children:"A verifiable photo is defined as a photo that is guaranteed to have been captured on the iPhone camera, using the SDK, and not tampered before it was signed."})}),`
`,e.jsxs(i.h2,{id:"cryptographic-keys",children:["Cryptographic Keys",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#cryptographic-keys",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The ZCAM architecture generates and leverages two keys:"}),`
`,e.jsxs(i.table,{children:[e.jsx(i.thead,{children:e.jsxs(i.tr,{children:[e.jsx(i.th,{children:"Key"}),e.jsx(i.th,{children:"Purpose"}),e.jsx(i.th,{children:"Apple Attested"})]})}),e.jsxs(i.tbody,{children:[e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Device Key"})}),e.jsx(i.td,{children:"Signs over a hash of the photo"}),e.jsx(i.td,{children:"Yes"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Content Key"})}),e.jsx(i.td,{children:"Signs the C2PA manifest"}),e.jsx(i.td,{children:"No"})]})]})]}),`
`,e.jsx(i.p,{children:"Both keys live in the Secure Enclave of the iPhone device. Importantly, the device key is specifically attested to have been generated on the Secure Enclave and is scoped to the specific app."}),`
`,e.jsxs(i.h2,{id:"photo-lifecycle",children:["Photo Lifecycle",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#photo-lifecycle",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"A photo progresses through three states to become a verifiable authentic photo:"}),`
`,e.jsxs(i.table,{children:[e.jsx(i.thead,{children:e.jsxs(i.tr,{children:[e.jsx(i.th,{children:"State"}),e.jsx(i.th,{children:"C2PA Assertion"}),e.jsx(i.th,{children:"Description"})]})}),e.jsxs(i.tbody,{children:[e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Raw"})}),e.jsx(i.td,{children:"None"}),e.jsx(i.td,{children:"Original photo taken by phone, including metadata. No verifiable, attested traits."})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Verifiable"})}),e.jsx(i.td,{children:e.jsx(i.code,{children:"succinct.bindings"})}),e.jsx(i.td,{children:"Embeds a C2PA manifest including a signature using an Apple attested key over the photo and a verifiable attestation from Apple of the signing key. These can also be used as inputs to generate a zero knowledge proof"})]}),e.jsxs(i.tr,{children:[e.jsx(i.td,{children:e.jsx(i.strong,{children:"Proven"})}),e.jsx(i.td,{children:e.jsx(i.code,{children:"succinct.proof"})}),e.jsx(i.td,{children:"Embeds a C2PA manifest including a verifiable zero knowledge proof that the photo was signed using a valid Apple attested key."})]})]})]}),`
`,e.jsx(e.Fragment,{children:e.jsx(i.pre,{className:"shiki shiki-themes github-light github-dark-dimmed",style:{backgroundColor:"#fff","--shiki-dark-bg":"#22272e",color:"#24292e","--shiki-dark":"#adbac7"},tabIndex:"0",children:e.jsxs(i.code,{children:[e.jsxs(i.span,{className:"line",children:[e.jsx(i.span,{style:{color:"#24292E","--shiki-dark":"#ADBAC7"},children:"Raw Photo → ["}),e.jsx(i.span,{style:{color:"#032F62",textDecoration:"underline","--shiki-dark":"#96D0FF","--shiki-dark-text-decoration":"inherit"},children:"Capture"}),e.jsx(i.span,{style:{color:"#24292E","--shiki-dark":"#ADBAC7"},children:"] → Verifiable Photo → ["}),e.jsx(i.span,{style:{color:"#032F62",textDecoration:"underline","--shiki-dark":"#96D0FF","--shiki-dark-text-decoration":"inherit"},children:"Prove"}),e.jsx(i.span,{style:{color:"#24292E","--shiki-dark":"#ADBAC7"},children:"] → Proven photo"})]}),`
`,e.jsx(i.span,{className:"line",children:e.jsx(i.span,{style:{color:"#24292E","--shiki-dark":"#ADBAC7"},children:"                         (bindings)                    (proof)"})})]})})}),`
`,e.jsxs(i.h2,{id:"flow",children:["Flow",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#flow",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.h3,{id:"1-initialization",children:["1. Initialization",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#1-initialization",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The SDK first gets initialized. The main logic here is to generate or load the two necessary keys (device key and content key)."}),`
`,e.jsxs(i.h3,{id:"2-capture",children:["2. Capture",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#2-capture",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.p,{children:["The capture step allows a user to take a photo and output a ",e.jsx(i.em,{children:"provable"})," photo."]}),`
`,e.jsx(i.p,{children:"When a user wants to take a photo, the SDK opens the camera screen. After the photo is taken, the SDK embeds a valid C2PA manifest by doing the following:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsx(i.li,{children:"The photo is hashed, then signed using the device key. This outputs an Apple Attest assertion including a signature over the hash."}),`
`,e.jsxs(i.li,{children:["The C2PA manifest is initialized with a ",e.jsx(i.em,{children:"capture"})," action including metadata: time of photo, OS, device model, software version, etc."]}),`
`,e.jsxs(i.li,{children:["A ",e.jsx(i.code,{children:"succinct.bindings"})," assertion is added to the manifest including data necessary to prove that the photo was signed using a valid Apple attested key."]}),`
`]}),`
`,e.jsx(i.p,{children:e.jsx(i.img,{src:"/images/diagram_capture.png",alt:"Capture flow diagram"})}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Output:"})," A verifiable photo with a valid C2PA manifest containing metadata and an assertion that the photo was signed with an Apple attested key."]}),`
`,e.jsx(i.aside,{"data-callout":"info",children:e.jsx(i.p,{children:"Note: A verifiable photo can both be verified on its own by verifying the attestation in the C2PA manifest, and also be used as input to generate a zero knowledge proof to hide the attestation"})}),`
`,e.jsxs(i.h3,{id:"3-prove",children:["3. Prove",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#3-prove",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.p,{children:["The prove step takes the provable photo with C2PA manifest including a ",e.jsx(i.code,{children:"succinct.bindings"})," assertion and generates a proof verifying its validity. This is done by using the SP1 Prover Network to prove the ZCAM program with the photo (and C2PA manifest) as input."]}),`
`,e.jsx(i.p,{children:"The SDK receives the proof from the network, then updates the photo and C2PA manifest:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["The ",e.jsx(i.code,{children:"succinct.bindings"})," assertion is removed"]}),`
`,e.jsxs(i.li,{children:["A ",e.jsx(i.code,{children:"succinct.proof"})," assertion is added containing the verifiable proof"]}),`
`]}),`
`,e.jsx(i.p,{children:e.jsx(i.img,{src:"/images/diagram_prove.png",alt:"Capture flow diagram"})}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Output:"})," The final verifiable photo with a valid C2PA manifest including a verifiable proof."]}),`
`,e.jsxs(i.h3,{id:"4-verify",children:["4. Verify",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#4-verify",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The SDK includes logic for parsing and verifying the proof from the C2PA manifest:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Extract the manifest from the photo"}),`
`,e.jsx(i.li,{children:"Verify the proof in the manifest"}),`
`,e.jsx(i.li,{children:"Verify the photo hash matches the manifest"}),`
`]})]})}function d(t={}){const{wrapper:i}={...s(),...t.components};return i?e.jsx(i,{...t,children:e.jsx(n,{...t})}):n(t)}export{d as default,r as frontmatter};
