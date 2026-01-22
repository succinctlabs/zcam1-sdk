import{f as r,j as e}from"./index-DS39NnaK.js";const a={title:"Use Cases",description:"undefined"};function t(n){const i={a:"a",code:"code",div:"div",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...r(),...n.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"use-cases",children:["Use Cases",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#use-cases",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(i.p,{children:"Below are two real-world examples of how the ZCAM SDK can be integrated to solve different verification challenges."}),`
`,e.jsxs(i.p,{children:["These examples highlight two distinct patterns: ",e.jsx(i.strong,{children:"end-user verification"}),", where readers or customers verify photos themselves, and ",e.jsx(i.strong,{children:"internal verification"}),", where verification happens in backend processing."]}),`
`,e.jsxs(i.h2,{id:"verifiable-news-platform",children:["Verifiable News Platform",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verifiable-news-platform",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
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
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Upload"}),": Upload the zphoto to the news platform's backend for use in articles"]}),`
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
`]}),`
`,e.jsxs(i.h2,{id:"insurance-claim-verification",children:["Insurance Claim Verification",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#insurance-claim-verification",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"Insurance companies allow policyholders to file claims using photos from their mobile app. This has led to an increase in fraud where claimants manipulate photos before submission. ZCAM ensures that claim photos were taken on the policyholder's device using the official app, and haven't been edited since capture."}),`
`,e.jsx(i.p,{children:"The system is comprised of:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Camera functionality within the insurance app using ZCAM for capture"}),`
`,e.jsx(i.li,{children:"Backend verification that automatically validates all submitted photos"}),`
`,e.jsx(i.li,{children:"Automated triage that flags claims with suspicious or unverifiable photos"}),`
`]}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Why it matters"}),": Automatically detect and reject claims with manipulated photos, reducing fraud and manual review costs."]}),`
`,e.jsxs(i.h3,{id:"architecture-1",children:["Architecture",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#architecture-1",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The insurance app integrates ZCAM SDK in two places:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Mobile app"}),": Policyholders capture zphotos during claim filing."]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Backend processing"}),": The insurance company verifies photos automatically during claim triage."]}),`
`]}),`
`,e.jsxs(i.h3,{id:"mobile-app-1",children:["Mobile App",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#mobile-app-1",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The ZCAM SDK integrates into the claim landing flow:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Installation"}),": Follow the ",e.jsx(i.a,{href:"/getting-started/installation",children:"Installation guide"})," to set up the SDK"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Camera Integration"}),": Inject the ",e.jsx(i.code,{children:"<ZCamera>"})," component into the claim flow where users must photograph their vehicle:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"The SDK provides camera preview functionality"}),`
`,e.jsxs(i.li,{children:["Call ",e.jsx(i.code,{children:"takePhoto()"})," to capture a verifiable photo"]}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Proof Generation"})," (Optional): Use ",e.jsx(i.code,{children:"react-native-zcam1-prove"})," to attach zero-knowledge proofs:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Use ",e.jsx(i.code,{children:"waitAndEmbedProof()"})," to generate and embed proofs"]}),`
`,e.jsx(i.li,{children:"This provides additional cryptographic guarantees and privacy"}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Claim Submission"}),": When the user completes the claim flow, attach verifiable photos to the claim filing and upload to the insurance company's backend"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"backend-processing",children:["Backend Processing",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#backend-processing",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"On the insurance company's backend, verification is integrated into the automated claim triage process:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Automated Verification"}),": When a claim enters the triage flow, the system automatically verifies all attached photos:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Integrate ",e.jsx(i.code,{children:"react-native-zcam1-verify"})," (or server-side equivalent) into the backend"]}),`
`,e.jsxs(i.li,{children:["For each photo, call ",e.jsx(i.code,{children:"verifyHash()"})," and ",e.jsx(i.code,{children:"verifyProof()"})," methods"]}),`
`,e.jsx(i.li,{children:"Check that the photo was taken using the insurance company's app"}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Metadata Analysis"}),": Leverage metadata from the C2PA manifest:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Verify location data matches the claim location"}),`
`,e.jsx(i.li,{children:"Check timestamp aligns with the reported incident time"}),`
`,e.jsx(i.li,{children:"Validate device and app information"}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Claim Decision"}),": Based on verification results:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Verification passes"}),": Proceed with normal claim processing"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Verification fails"}),": Flag claim for manual review or deny if photos are inauthentic"]}),`
`]}),`
`]}),`
`]})]})}function l(n={}){const{wrapper:i}={...r(),...n.components};return i?e.jsx(i,{...n,children:e.jsx(t,{...n})}):t(n)}export{l as default,a as frontmatter};
