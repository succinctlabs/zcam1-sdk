import{u as s,j as e}from"./index-CjgSA9ef.js";const a={title:"ZK Proof Details",description:"undefined"};function n(i){const t={a:"a",code:"code",div:"div",h1:"h1",h2:"h2",header:"header",li:"li",ol:"ol",p:"p",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...s(),...i.components};return e.jsxs(e.Fragment,{children:[e.jsx(t.header,{children:e.jsxs(t.h1,{id:"zk-proof-details",children:["ZK Proof Details",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#zk-proof-details",children:e.jsx(t.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(t.p,{children:"The SP1 program proves the following:"}),`
`,e.jsxs(t.ol,{children:[`
`,e.jsx(t.li,{children:"The photo bytes matches the expected bytes in the C2PA manifest"}),`
`,e.jsx(t.li,{children:"The Apple Attest attestation is valid"}),`
`,e.jsx(t.li,{children:"The assertion (i.e. signature of the photo hash using the attested key) is valid"}),`
`]}),`
`,e.jsx(t.p,{children:"The photo bytes are provided as input to the proof."}),`
`,e.jsxs(t.h2,{id:"proof-logic",children:["Proof Logic",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#proof-logic",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.table,{children:[e.jsx(t.thead,{children:e.jsxs(t.tr,{children:[e.jsx(t.th,{children:"Step"}),e.jsx(t.th,{children:"Operation"}),e.jsx(t.th,{children:"Guarantees"})]})}),e.jsxs(t.tbody,{children:[e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"1"}),e.jsx(t.td,{children:"Extract manifest from photo bytes"}),e.jsx(t.td,{children:"—"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"2"}),e.jsx(t.td,{children:"Extract bindings and data hash from manifest"}),e.jsx(t.td,{children:"—"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"3"}),e.jsx(t.td,{children:"Compute photo hash"}),e.jsx(t.td,{children:"—"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"4"}),e.jsx(t.td,{children:"Check data hash == photo hash"}),e.jsx(t.td,{children:"Manifest corresponds to this photo"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"5"}),e.jsx(t.td,{children:"Validate attestation"}),e.jsx(t.td,{children:"The attestation is valid and from Apple"})]}),e.jsxs(t.tr,{children:[e.jsx(t.td,{children:"6"}),e.jsx(t.td,{children:"Validate assertion"}),e.jsx(t.td,{children:"Photo hash was signed by the attested key"})]})]})]}),`
`,e.jsxs(t.h2,{id:"attestation-validation",children:["Attestation Validation",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#attestation-validation",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"Guarantees:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"The device key was generated in a genuine Apple Secure Enclave"}),`
`,e.jsxs(t.li,{children:["The key is bound to a specific app (via ",e.jsx(t.code,{children:"app_id"})," / RP ID)"]}),`
`,e.jsxs(t.li,{children:["The device is running a legitimate app (AAGUID = ",e.jsx(t.code,{children:"appattest"})," or ",e.jsx(t.code,{children:"appattestdevelop"}),")"]}),`
`]}),`
`,e.jsx(t.p,{children:"Validates:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"Certificate chain verifies up to Apple Root CA"}),`
`,e.jsx(t.li,{children:"Nonce matches the challenge"}),`
`,e.jsx(t.li,{children:"Public key hash matches the key ID"}),`
`,e.jsx(t.li,{children:"RP ID == SHA256(app_id)"}),`
`,e.jsx(t.li,{children:"AAGUID is a valid Apple attestation identifier"}),`
`]}),`
`,e.jsxs(t.h2,{id:"assertion-validation",children:["Assertion Validation",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#assertion-validation",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(t.p,{children:"Guarantees:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"The photo corresponding to this hash was signed using the ZCAM SDK"}),`
`]}),`
`,e.jsx(t.p,{children:"Validates:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"ECDSA signature over the photo hash using the public key from attestation"}),`
`]}),`
`,e.jsxs(t.h2,{id:"public-outputs",children:["Public Outputs",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#public-outputs",children:e.jsx(t.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsx(t.li,{children:"Photo hash (SHA-256)"}),`
`,e.jsx(t.li,{children:"Apple Root CA certificate"}),`
`]}),`
`,e.jsx(t.p,{children:"These committed values allow verifiers to confirm the proof corresponds to a specific photo and chains to Apple's actual root certificate."})]})}function h(i={}){const{wrapper:t}={...s(),...i.components};return t?e.jsx(t,{...i,children:e.jsx(n,{...i})}):n(i)}export{h as default,a as frontmatter};
