import{f as r,j as e}from"./index-BKSjBa6b.js";const a={title:"Editing a ZCAM Photo",description:"undefined"};function t(n){const i={a:"a",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...r(),...n.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"editing-a-zcam-photo",children:["Editing a ZCAM Photo",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#editing-a-zcam-photo",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(i.p,{children:"All ZCAM photos are C2PA compatible, meaning that any editing software that supports C2PA can be used to edit ZCAM photos while maintaining the original capture manifests."}),`
`,e.jsx(i.p,{children:"The three main editing software options used today are: Capture One, Adobe Lightroom, and PhotoLab."}),`
`,e.jsxs(i.p,{children:["Currently, Capture One and Adobe Lightroom ",e.jsx(i.em,{children:"support"})," C2PA, while PhotoLab does ",e.jsx(i.em,{children:"not"}),". Generally, the flow is to include the content credentials on export."]}),`
`,e.jsxs(i.h2,{id:"exporting-with-content-credentials",children:["Exporting with Content Credentials",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#exporting-with-content-credentials",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"When exporting a ZCAM photo from Capture One, you can include the C2PA content credentials in the export settings. This preserves the original capture manifest and adds an edit manifest indicating the changes made."}),`
`,e.jsx(i.p,{children:e.jsx(i.img,{src:"/images/screenshot_captureone_c2pa.png",alt:"Exporting with content credentials in Capture One"})}),`
`,e.jsx(i.p,{children:"After export, the resulting image will contain a C2PA manifest that includes both the original capture information and the edit history."}),`
`,e.jsx(i.p,{children:e.jsx(i.img,{src:"/images/screenshot_manifest_captureone.png",alt:"C2PA manifest showing capture and edit history"})}),`
`,e.jsxs(i.h2,{id:"verification-limitations-after-editing",children:["Verification Limitations After Editing",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verification-limitations-after-editing",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Both bindings verification and ZK proof verification break when a photo is edited."})," This is because:"]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"The Apple App Attest signature (used in bindings verification) is over the hash of the original image"}),`
`,e.jsx(i.li,{children:"The ZK proof (used in proof verification) also verifies the original photo hash"}),`
`,e.jsx(i.li,{children:"When a photo is edited, the image bytes change, causing the hash to change"}),`
`,e.jsx(i.li,{children:"The signature/proof verification fails because the hash no longer matches"}),`
`]}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Important"}),": Even though C2PA edit manifests can preserve the original capture manifest and add edit history, the actual signature verification will fail because the signature is over the hash of the original image bytes, which no longer match the edited image."]}),`
`,e.jsx(i.p,{children:"If you need to edit photos after capture, you must generate a new signature/proof after editing, or accept that verification will fail for edited photos."}),`
`,e.jsxs(i.h3,{id:"future-zk-proofs-for-edit-chains",children:["Future: ZK Proofs for Edit Chains",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#future-zk-proofs-for-edit-chains",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"In theory, zero-knowledge proofs could be extended to verify entire edit chains while maintaining privacy. A ZK proof could verify that:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsx(i.li,{children:"The original photo was captured authentically"}),`
`,e.jsx(i.li,{children:"Each edit in the chain was legitimate (signed by authorized editors)"}),`
`,e.jsx(i.li,{children:"The final photo hash matches the edit chain"}),`
`]}),`
`,e.jsx(i.p,{children:"This would allow privacy-preserving verification even after edits, addressing concerns about maintaining authenticity through editing workflows (such as those used by news organizations like the BBC)."}),`
`,e.jsx(i.p,{children:"However, this approach requires:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Proof generation after each edit"}),": Each edit would need a new proof, adding computational cost"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Maintaining edit history in the proof"}),": The proof circuit would need to verify the entire edit chain"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"More complex proof circuits"}),": The SP1 program would need to verify multiple C2PA manifests and their relationships"]}),`
`]}),`
`,e.jsx(i.p,{children:"For now, users who need to edit photos should:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Generate a ",e.jsx(i.strong,{children:"new signature/proof"})," after editing (this requires re-capturing or re-signing the edited image)"]}),`
`,e.jsx(i.li,{children:"Or accept that verification will fail for edited photos (the original capture manifest and edit history will still be preserved in C2PA, but signature verification will fail)"}),`
`]}),`
`,e.jsx(i.p,{children:"The current implementation focuses on verifying the original capture, which provides the strongest guarantees for unedited photos."})]})}function s(n={}){const{wrapper:i}={...r(),...n.components};return i?e.jsx(i,{...n,children:e.jsx(t,{...n})}):t(n)}export{s as default,a as frontmatter};
