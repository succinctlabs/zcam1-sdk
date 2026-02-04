import{u as a,j as e}from"./index-CjgSA9ef.js";const s={title:"C2PA",description:"undefined"};function i(t){const n={a:"a",aside:"aside",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...a(),...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.header,{children:e.jsxs(n.h1,{id:"c2pa",children:["C2PA",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#c2pa",children:e.jsx(n.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(n.h2,{id:"what-is-c2pa",children:["What is C2PA?",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#what-is-c2pa",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["The ",e.jsx(n.strong,{children:"Coalition for Content Provenance and Authenticity (C2PA)"})," is an open technical standard for embedding provenance information directly into digital media files. It provides a standardized way to record where content came from, how it was created, and what modifications have been made."]}),`
`,e.jsx(n.p,{children:"C2PA was developed by a consortium including Adobe, Microsoft, Intel, and the BBC, among others. The standard enables tools to attach cryptographically signed metadata that travels with the content."}),`
`,e.jsxs(n.h2,{id:"zcam-and-c2pa",children:["ZCAM and C2PA",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#zcam-and-c2pa",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"ZCAM uses C2PA as its container format but adds hardware-backed guarantees that C2PA alone cannot provide."}),`
`,e.jsx(n.p,{children:"Where C2PA tracks history with any signing key, ZCAM guarantees the photo was captured on a specific device using keys that can't be extracted or forged. This transforms C2PA from a provenance system into an authenticity system."}),`
`,e.jsxs(n.table,{children:[e.jsx(n.thead,{children:e.jsxs(n.tr,{children:[e.jsx(n.th,{children:"Aspect"}),e.jsx(n.th,{children:"Standard C2PA"}),e.jsx(n.th,{children:"ZCAM + C2PA"})]})}),e.jsxs(n.tbody,{children:[e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"Signing Key"})}),e.jsx(n.td,{children:"Any certificate"}),e.jsx(n.td,{children:"Hardware-backed Secure Enclave key"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"Key Binding"})}),e.jsx(n.td,{children:"To an identity or organization"}),e.jsx(n.td,{children:"To a specific device and app"})]}),e.jsxs(n.tr,{children:[e.jsx(n.td,{children:e.jsx(n.strong,{children:"Guarantees"})}),e.jsx(n.td,{children:'"This manifest was signed by X platform"'}),e.jsx(n.td,{children:'"This photo was captured on a real iPhone"'})]})]})]}),`
`,e.jsxs(n.h2,{id:"c2pa-background",children:["C2PA Background",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#c2pa-background",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.h3,{id:"manifests",children:["Manifests",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#manifests",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["A C2PA ",e.jsx(n.strong,{children:"manifest"})," is a signed data structure embedded in or linked to a media file. Each manifest contains:"]}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Claims"}),": Statements about the content (who made it, what tool was used, when it was created)"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Assertions"}),": Specific metadata like thumbnail hashes, ingredient lists, or action history"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Signature"}),": A cryptographic signature binding the claims to the content"]}),`
`]}),`
`,e.jsx(n.p,{children:`A single photo can have multiple manifests creating a manifest chain. Each manifest indicates how the photo changed and what tool was used for said change. Additionally, each manifest is signed by whatever
party made the edit, creating an auditable chain of history for a given image.`}),`
`,e.jsx(n.p,{children:"A C2PA manifest contains details about the photo, such as device, dimensions, history, and a cryptographic signature over those details."}),`
`,e.jsx(n.p,{children:"Anyone can then verify a manifest by verifying the signature of the manifest, ensuring the signing key chains to some trusted root certificate, then reading the contents of the actual manifest itself."}),`
`,e.jsxs(n.h3,{id:"c2pa-provenance",children:["C2PA Provenance",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#c2pa-provenance",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["C2PA provides ",e.jsx(n.strong,{children:"provenance"}),". It answers questions like:"]}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"What tool created this content?"}),`
`,e.jsx(n.li,{children:"Who signed the manifest?"}),`
`,e.jsx(n.li,{children:"What edits were made?"}),`
`]}),`
`,e.jsx(n.p,{children:"However, C2PA alone doesn't guarantee the content is authentic. C2PA is used equally for tagging AI-generated images. Signing infrastructure for tooling can get attacked and signatures could be forged. The standard focuses on the history of a photo."}),`
`,e.jsxs(n.h2,{id:"editing-c2pa-photos",children:["Editing C2PA Photos",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#editing-c2pa-photos",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"All photos captured with ZCAM are C2PA-compatible, so any editor supporting C2PA can preserve the original capture manifest while adding an edit manifest."}),`
`,e.jsx(n.p,{children:"For example, two of the most used editing platforms today, Capture One and Adobe Lightroom, both support C2PA."}),`
`,e.jsx(n.p,{children:"When exporting from a C2PA-compatible editor, include the content credentials in the export settings."}),`
`,e.jsxs("figure",{style:{display:"flex",flexDirection:"column",alignItems:"center",margin:"1.5rem 0"},children:[e.jsx("img",{src:"/images/screenshot_captureone_c2pa.png",alt:"Exporting with content credentials in Capture One",style:{maxWidth:"60%",borderRadius:"8px",boxShadow:"0 2px 8px rgba(0,0,0,0.1)"}}),e.jsx("figcaption",{style:{marginTop:"0.5rem",fontSize:"0.875rem",color:"#666"},children:"Capture One export with content credentials"})]}),`
`,e.jsx(n.p,{children:"This preserves the original capture manifest and adds an edit manifest describing the changes."}),`
`,e.jsxs("figure",{style:{display:"flex",flexDirection:"column",alignItems:"center",margin:"1.5rem 0"},children:[e.jsx("img",{src:"/images/screenshot_manifest_captureone.png",alt:"C2PA manifest showing capture and edit history",style:{maxWidth:"60%",borderRadius:"8px",boxShadow:"0 2px 8px rgba(0,0,0,0.1)"}}),e.jsx("figcaption",{style:{marginTop:"0.5rem",fontSize:"0.875rem",color:"#666"},children:"C2PA manifest including CaptureOne edits"})]}),`
`,e.jsxs(n.h3,{id:"verification-after-editing",children:["Verification After Editing",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verification-after-editing",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"Both bindings verification and ZK proof verification will fail on edited ZCAM photos. This happens because:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:["The Apple App Attest signature covers the hash of the ",e.jsx(n.em,{children:"original"})," image."]}),`
`,e.jsxs(n.li,{children:["The ZK proof attests to the ",e.jsx(n.em,{children:"original"})," image hash."]}),`
`,e.jsx(n.li,{children:"Editing changes the image bytes and therefore the hash."}),`
`,e.jsx(n.li,{children:"Signature and proof verification fail when hashes no longer match."}),`
`]}),`
`,e.jsx(n.aside,{"data-callout":"warning",children:e.jsx(n.p,{children:"Although C2PA edit manifests preserve the original capture and add edit history, the cryptographic signature/proof tied to the original image will not verify against the edited bytes."})}),`
`,e.jsx(n.p,{children:"If you need to edit a ZCAM photo, you must generate a new signature or proof after editing for verification to succeed."}),`
`,e.jsxs(n.h2,{id:"future-work-zk-proofs-for-edit-chains",children:["Future Work: ZK Proofs for Edit Chains",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#future-work-zk-proofs-for-edit-chains",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"We are currently investigating how to also guarantee authenticity for edit history."}),`
`,e.jsx(n.p,{children:'Zero-knowledge proofs could be extended to verify edit chains while preserving privacy. A ZK proof could assert that the original photo was taken authentically, and edits were made to the original photo which resulted in the final exported photo. This would require proof generation after each edit and more complex SP1 programs to analyze C2PA manifests along with the "before" and exported photos.'}),`
`,e.jsx(n.p,{children:"For now, the implementation focuses on verifying the original capture, which provides the strongest guarantees for unedited photos."})]})}function d(t={}){const{wrapper:n}={...a(),...t.components};return n?e.jsx(n,{...t,children:e.jsx(i,{...t})}):i(t)}export{d as default,s as frontmatter};
