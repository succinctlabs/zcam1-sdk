import{f as i,j as e}from"./index-CTn8ORcW.js";const o={title:"Introduction",description:"undefined"};function r(n){const t={a:"a",div:"div",h1:"h1",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...i(),...n.components};return e.jsxs(e.Fragment,{children:[e.jsx(t.header,{children:e.jsxs(t.h1,{id:"introduction",children:["Introduction",e.jsx(t.a,{"aria-hidden":"true",tabIndex:"-1",href:"#introduction",children:e.jsx(t.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(t.p,{children:"In an era of AI-generated images and sophisticated editing tools, proving that a photo is real matters more than ever. ZCAM gives developers the tools to build authentic images directly into their apps."}),`
`,e.jsx(t.p,{children:"The SDK is built on three core technologies:"}),`
`,e.jsxs(t.ul,{children:[`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"Apple's App Attest"})," guarantees that signing keys are generated and stored in the iPhone's secure enclave, tied to a specific app."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"C2PA"})," embeds verifiable provenance metadata, including capture details and edit history, directly into the image file."]}),`
`,e.jsxs(t.li,{children:[e.jsx(t.strong,{children:"SP1 zero-knowledge proofs"})," optionally wrap verification into succinct, easily verifiable proofs using Succinct's ",e.jsx(t.a,{href:"https://docs.succinct.xyz/docs/sp1/introduction",children:"SP1"})," zkVM."]}),`
`]}),`
`,e.jsx(t.p,{children:"Whether you're building for journalism, insurance, identity verification, or any use case where image authenticity matters, these docs will help you get started."}),`
`,e.jsx("style",{children:`
.doc-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
  margin-bottom: 2rem;
}
.doc-card {
  display: block;
  padding: 1.5rem;
  border: 1px solid var(--vocs-color_border);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;
  background-color: var(--vocs-color_background);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.doc-card:hover {
  border-color: var(--vocs-color_accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.doc-card h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: var(--vocs-color_accent);
}
.doc-card span {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.8;
  display: block;
}
`}),`
`,e.jsxs("div",{className:"doc-cards",children:[e.jsxs("a",{href:"/getting-started/installation",className:"doc-card",children:[e.jsx("h3",{children:"🚀 Getting Started"}),e.jsx("span",{children:"Install the SDK and get up and running with your first zphoto in minutes."})]}),e.jsxs("a",{href:"/sdk/capture",className:"doc-card",children:[e.jsx("h3",{children:"📱 Using the SDK"}),e.jsx("span",{children:"Learn how to build apps with the ZCAM SDK."})]}),e.jsxs("a",{href:"/c2pa-ecosystem/editing_zcam_photos",className:"doc-card",children:[e.jsx("h3",{children:"🔗 C2PA Compatibility"}),e.jsx("span",{children:"Understand how ZCAM works with C2PA and editing tools in the ecosystem."})]}),e.jsxs("a",{href:"/technical-docs/architecture",className:"doc-card",children:[e.jsx("h3",{children:"🔧 Technical Docs"}),e.jsx("span",{children:"Deep dive into the ZCAM architecture, security, and FAQs."})]})]})]})}function a(n={}){const{wrapper:t}={...i(),...n.components};return t?e.jsx(t,{...n,children:e.jsx(r,{...n})}):r(n)}export{a as default,o as frontmatter};
