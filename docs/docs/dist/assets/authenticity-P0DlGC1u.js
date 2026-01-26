import{u as a,j as e}from"./index-BwsPFJ5d.js";const s={title:"Authenticity",description:"undefined"};function n(i){const t={a:"a",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...a(),...i.components};return e.jsxs(e.Fragment,{children:[e.jsx(t.header,{children:e.jsxs(t.h1,{id:"authenticity",children:["Authenticity",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#authenticity",children:e.jsx(t.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(t.h2,{id:"what-makes-a-photo-authentic",children:["What Makes a Photo Authentic?",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#what-makes-a-photo-authentic",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"An authentic photo is one that was genuinely captured by a camera."}),`
`,e.jsx(t.p,{children:"With ZCAM, authenticity means:"}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Captured by the device camera"}),": The image bytes came directly from the iPhone's camera sensor."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Signed at capture time"}),": A cryptographic signature was created immediately, before any editing could occur."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Tamper-evident"}),": Any modification to the image breaks the signature."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Verifiable by anyone"}),": Anyone can cryptographically verify the photo."]}),`
`]}),`
`,e.jsxs(t.h2,{id:"verifiable-photos-today",children:["Verifiable Photos Today",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verifiable-photos-today",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.p,{children:["Until now, the only way to get a ",e.jsx(t.strong,{children:"verifiably authentic photo"})," that was cryptographically attested at capture time was to use a C2PA-compatible hardware camera."]}),`
`,e.jsxs(t.p,{children:["These cameras exist, but they're rare and expensive. For example, the Leica M11-P is around ",e.jsx(t.em,{children:"$9,000"}),", Sony C2PA supported cameras are anywhere between ",e.jsx(t.em,{children:"$5,000-$6,500"}),", and the Nikon Z9 ",e.jsx(t.em,{children:"$5,500"}),"."]}),`
`,e.jsx(t.p,{children:"This creates a significant barrier. The cost puts authentic capture out of reach for most people. Even from a usability standpoint, carrying a dedicated camera isn't practical for everyday moments."}),`
`,e.jsxs(t.p,{children:["Meanwhile, ",e.jsx(t.strong,{children:"billions of photos are taken on smartphones every day"}),"."]}),`
`,e.jsxs(t.h2,{id:"zcam-authentic-capture-on-every-iphone",children:["ZCAM: Authentic Capture on Every iPhone",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#zcam-authentic-capture-on-every-iphone",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"ZCAM takes a fundamentally different approach to enable anybody to take verifiably authentic photos using their iPhones."}),`
`,e.jsxs(t.h3,{id:"hardware-rooted-authenticity",children:["Hardware-Rooted Authenticity",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#hardware-rooted-authenticity",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.p,{children:["Every ZCAM photo is signed using Apple's ",e.jsx(t.strong,{children:"Secure Enclave"})," and ",e.jsx(t.strong,{children:"App Attest"}),":"]}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"The signing key is generated and stored in tamper-resistant hardware"}),`
`,e.jsx(t.li,{children:"The key is bound to a specific app on a specific device"}),`
`,e.jsx(t.li,{children:"Apple's attestation chains to their root certificate"}),`
`]}),`
`,e.jsx(t.p,{children:`This means the signature isn't just a signing key "vouching" for the authenticity of a photo. Rather, it indicates, "Apple's hardware guarantees this key exists on a genuine iPhone running this specific app."`}),`
`,e.jsxs(t.h3,{id:"ubiquitous-authentic-capture",children:["Ubiquitous Authentic Capture",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#ubiquitous-authentic-capture",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.p,{children:["There are over ",e.jsx(t.strong,{children:"1.5 billion active iPhones"})," worldwide. ZCAM turns every one of them into a verifiable camera, making hardware-attested photography accessible to everyone."]}),`
`,e.jsxs(t.h2,{id:"immutability-after-capture",children:["Immutability After Capture",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#immutability-after-capture",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"Once a photo is captured and signed:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Editing the image"})," invalidates the signature"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Stripping the metadata"})," removes the proof (but verifiers will reject unsigned photos)"]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Re-signing"})," would require access to the original device's Secure Enclave key"]}),`
`]}),`
`,e.jsx(t.p,{children:"The signature is bound to the exact bytes of the captured image. Changing the picture results in the verification failing."})]})}function h(i={}){const{wrapper:t}={...a(),...i.components};return t?e.jsx(t,{...i,children:e.jsx(n,{...i})}):n(i)}export{h as default,s as frontmatter};
