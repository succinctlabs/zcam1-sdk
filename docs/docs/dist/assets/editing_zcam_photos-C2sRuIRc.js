import{u as r,j as e}from"./index-BlODdH4X.js";const a={title:"Editing a ZCAM Photo",description:"undefined"};function n(t){const i={a:"a",div:"div",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...r(),...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"editing-a-zcam-photo",children:["Editing a ZCAM Photo",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#editing-a-zcam-photo",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(i.p,{children:"All zPhotos captured with ZCAM are C2PA-compatible, so any C2PA-aware editor can preserve the original capture manifest while adding an edit manifest."}),`
`,e.jsx(i.p,{children:"Common editing tools today include Capture One, Adobe Lightroom, and PhotoLab. Capture One and Adobe Lightroom support C2PA exports; PhotoLab does not. Typically editors include the content credentials on export."}),`
`,e.jsxs(i.h2,{id:"exporting-with-content-credentials",children:["Exporting with Content Credentials",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#exporting-with-content-credentials",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"When exporting a zPhoto from Capture One, include the C2PA content credentials in the export settings. This preserves the original capture manifest and adds an edit manifest describing the changes."}),`
`,e.jsx(i.p,{children:e.jsx(i.img,{src:"/images/screenshot_captureone_c2pa.png",alt:"Exporting with content credentials in Capture One"})}),`
`,e.jsx(i.p,{children:"After export, the image will contain a C2PA manifest that includes both the original capture information and the edit history."}),`
`,e.jsx(i.p,{children:e.jsx(i.img,{src:"/images/screenshot_manifest_captureone.png",alt:"C2PA manifest showing capture and edit history"})}),`
`,e.jsxs(i.h2,{id:"verification-limitations-after-editing",children:["Verification Limitations After Editing",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verification-limitations-after-editing",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"Both bindings verification and ZK proof verification will fail if a zPhoto is edited. This happens because:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"The Apple App Attest signature (used by bindings verification) covers the hash of the original image"}),`
`,e.jsx(i.li,{children:"The ZK proof (used by proof verification) also attests to the original image hash"}),`
`,e.jsx(i.li,{children:"Editing changes the image bytes and therefore the hash"}),`
`,e.jsx(i.li,{children:"As a result, signature and proof verification fail when the hashes no longer match"}),`
`]}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Important"}),": Although C2PA edit manifests can preserve the original capture and add edit history, the cryptographic signature/proof tied to the original image will not verify against the edited bytes."]}),`
`,e.jsx(i.p,{children:"If you must edit a zPhoto after capture, you need to generate a new signature or proof after editing; otherwise verification will fail."}),`
`,e.jsxs(i.h3,{id:"future-work-zk-proofs-for-edit-chains",children:["Future Work: ZK Proofs for Edit Chains",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#future-work-zk-proofs-for-edit-chains",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"In principle, zero-knowledge proofs could be extended to verify edit chains while preserving privacy. A ZK proof could assert that:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsx(i.li,{children:"The original zPhoto was captured authentically"}),`
`,e.jsx(i.li,{children:"Each edit in the chain was made or authorized by trusted editors"}),`
`,e.jsx(i.li,{children:"The final image hash corresponds to the verified edit chain"}),`
`]}),`
`,e.jsx(i.p,{children:"This approach would require:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Proof generation after each edit (incurs computation cost)"}),`
`,e.jsx(i.li,{children:"Including edit history in the proof circuit"}),`
`,e.jsx(i.li,{children:"More complex SP1 programs to verify multiple C2PA manifests and their relationships"}),`
`]}),`
`,e.jsx(i.p,{children:"For now, users who need edits should either generate a new signature/proof after editing or accept that verification of the edited image will fail. The current implementation focuses on verifying the original capture, which provides the strongest guarantees for unedited zPhotos."})]})}function s(t={}){const{wrapper:i}={...r(),...t.components};return i?e.jsx(i,{...t,children:e.jsx(n,{...t})}):n(t)}export{s as default,a as frontmatter};
