import{u as t,j as e}from"./index-DYU0ST6z.js";const a={title:"Verifiable News Platform",description:"undefined"};function r(n){const i={a:"a",code:"code",div:"div",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...t(),...n.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"verifiable-news-platform",children:["Verifiable News Platform",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verifiable-news-platform",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(i.p,{children:"Edited and AI-generated photos are a growing concern for news consumers. A news platform can use ZCAM to let readers independently verify that photos are authentic and unedited."}),`
`,e.jsx(i.p,{children:"The system is comprised of:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"A mobile app for field reporters to capture verifiable photos"}),`
`,e.jsx(i.li,{children:"Integration with the platform's CMS to store and display photos"}),`
`,e.jsx(i.li,{children:"Public-facing verification tools so readers can check authenticity themselves"}),`
`]}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Why it matters"}),": Readers can independently verify that photos are authentic, building trust in the platform's journalism."]}),`
`,e.jsxs(i.h2,{id:"architecture",children:["Architecture",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#architecture",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The news platform integrates ZCAM SDK in two places:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Mobile app"})," A lightweight iOS app for reporters to use to capture verifiable photos"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Web platform"}),": For readers to verify photo authenticity directly in articles"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"mobile-app",children:["Mobile App",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#mobile-app",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The news platform builds a specialized camera app for reporters using the ZCAM SDK:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Installation"}),": Setup the SDK using the ",e.jsx(i.a,{href:"/getting-started/installation",children:"installation guide"})]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Camera Setup"}),": Use ",e.jsx(i.code,{children:"react-native-zcam1-capture"})," to initialize the camera:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Call ",e.jsx(i.code,{children:"initCapture()"})," to initialize device keys and attestation"]}),`
`,e.jsxs(i.li,{children:["Use the ",e.jsx(i.code,{children:"<ZCamera>"})," component to render the camera preview"]}),`
`,e.jsxs(i.li,{children:["Call ",e.jsx(i.code,{children:"takePhoto()"})," to capture a photo with verifiable bindings"]}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Proof Generation"})," (Optional): Use ",e.jsx(i.code,{children:"react-native-zcam1-prove"})," to generate zero-knowledge proofs:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Wrap your app with ",e.jsx(i.code,{children:"ProverProvider"})," and use the ",e.jsx(i.code,{children:"useProver()"})," hook"]}),`
`,e.jsxs(i.li,{children:["Call ",e.jsx(i.code,{children:"waitAndEmbedProof()"})," to generate and embed the proof, or use ",e.jsx(i.code,{children:"requestProof()"})," + ",e.jsx(i.code,{children:"useProofRequestStatus()"})," for progress tracking"]}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Upload"}),": Upload the photo to the news platform's backend for use in articles"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"web-platform",children:["Web Platform",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#web-platform",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"On the news platform's website, articles display verifiable photos with verification capabilities:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Photo Display"}),": Photos embedded in articles include C2PA content credentials",`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Users with C2PA browser extensions can automatically see content credentials"}),`
`,e.jsx(i.li,{children:"The platform can display verification status badges"}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Client-Side Verification"}),": Integrate ",e.jsx(i.code,{children:"react-native-zcam1-verify"})," (or web equivalent) to enable verification:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:'Add a "Verify Photo" button for each photo in articles'}),`
`,e.jsxs(i.li,{children:["Call ",e.jsx(i.code,{children:"verifyHash()"})," and ",e.jsx(i.code,{children:"verifyProof()"})," methods to validate authenticity"]}),`
`,e.jsx(i.li,{children:'Display verification results to readers (e.g., "✓ Verified Authentic")'}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Metadata Display"}),": Show readers metadata from the C2PA manifest:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Capture timestamp, device information, app identifier"}),`
`,e.jsx(i.li,{children:"Allow readers to inspect the full verification chain"}),`
`]}),`
`]}),`
`]})]})}function l(n={}){const{wrapper:i}={...t(),...n.components};return i?e.jsx(i,{...n,children:e.jsx(r,{...n})}):r(n)}export{l as default,a as frontmatter};
