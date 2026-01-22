import{f as s,j as e}from"./index-2BHdsCVf.js";const a={title:"Example Use Cases",description:"undefined"};function r(n){const i={a:"a",aside:"aside",code:"code",div:"div",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...s(),...n.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"example-use-cases",children:["Example Use Cases",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#example-use-cases",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(i.p,{children:["Below are two real-world examples demonstrating how the ZCAM SDK can be integrated to solve verification challenges. Each example highlights a distinct verification pattern: ",e.jsx(i.strong,{children:"end-user verification"})," (public-facing) versus ",e.jsx(i.strong,{children:"internal verification"})," (backend processing)."]}),`
`,e.jsxs(i.aside,{"data-callout":"info",children:[e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Verification Patterns:"})," While both use cases rely on verifiable zPhotos, they differ in who performs verification and where it happens:"]}),e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"End-user verification"}),": Public-facing verification where readers verify zPhotos themselves (e.g., news platform readers)"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Internal verification"}),": Backend verification where a company verifies zPhotos as part of internal processes (e.g., insurance claim processing)"]}),`
`]})]}),`
`,e.jsxs(i.h2,{id:"verifiable-news-platform",children:["Verifiable News Platform",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verifiable-news-platform",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.h3,{id:"use-case-overview",children:["Use Case Overview",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#use-case-overview",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"Edited and AI-generated imagery are common concerns for news consumers. A news platform with field reporters may want to ensure readers that photos are verifiably authentic and unedited."}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"What We're Building:"})," A verifiable journalism system consisting of:"]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"A mobile camera app for reporters to capture verifiable zPhotos using the ZCAM SDK"}),`
`,e.jsx(i.li,{children:"Integration into the news platform's CMS to store and display verifiable zPhotos"}),`
`,e.jsx(i.li,{children:"Public-facing verification tools allowing readers to independently verify authenticity"}),`
`]}),`
`,e.jsx(i.strong,{children:"Value of Verifiable zPhotos:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Trust & Credibility"}),": Readers can independently confirm that zPhotos haven't been edited, building confidence in the reporting"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"integration-architecture",children:["Integration Architecture",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#integration-architecture",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The news platform integrates the ZCAM SDK in two places:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Mobile Camera App"})," (for reporters): A lightweight iOS app reporters use to capture verifiable zPhotos"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Web Platform"})," (for readers): Verification functionality so readers can validate zPhotos"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"mobile-camera-app-integration",children:["Mobile Camera App Integration",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#mobile-camera-app-integration",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"Steps for the reporter app:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Installation"}),": Follow the ",e.jsx(i.a,{href:"/getting-started/installation",children:"Installation guide"})," to set up the SDK"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Camera Setup"}),": Use ",e.jsx(i.code,{children:"react-native-zcam1-capture"})," to initialize the camera:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Call ",e.jsx(i.code,{children:"initCapture()"})," to initialize device keys and attestation"]}),`
`,e.jsxs(i.li,{children:["Use the ",e.jsx(i.code,{children:"<ZCamera>"})," component to render the camera preview"]}),`
`,e.jsxs(i.li,{children:["Call ",e.jsx(i.code,{children:"takePhoto()"})," to capture a zPhoto with verifiable bindings"]}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Proof Generation"})," (Optional): Use ",e.jsx(i.code,{children:"react-native-zcam1-prove"})," to generate zero-knowledge proofs:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Wrap your app with ",e.jsx(i.code,{children:"ProverProvider"})," and use the ",e.jsx(i.code,{children:"useProver()"})," hook"]}),`
`,e.jsxs(i.li,{children:["Call ",e.jsx(i.code,{children:"waitAndEmbedProof()"})," to generate and embed the proof, or use ",e.jsx(i.code,{children:"requestProof()"})," + ",e.jsx(i.code,{children:"useProofRequestStatus()"})," for progress tracking"]}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Upload"}),": Upload the verifiable zPhoto to the news platform's backend for use in articles"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"web-platform-integration",children:["Web Platform Integration",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#web-platform-integration",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"On the news platform's website, articles display verifiable zPhotos with verification controls:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Photo Display"}),": Embedded zPhotos include C2PA content credentials",`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Users with C2PA browser extensions can view content credentials"}),`
`,e.jsx(i.li,{children:"The platform can show verification status badges"}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Client-Side Verification"}),": Integrate ",e.jsx(i.code,{children:"react-native-zcam1-verify"})," (or web equivalent):",`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:'Add a "Verify" button for each zPhoto'}),`
`,e.jsxs(i.li,{children:["Call ",e.jsx(i.code,{children:"verifyHash()"})," and ",e.jsx(i.code,{children:"verifyProof()"})," to validate authenticity"]}),`
`,e.jsx(i.li,{children:'Display verification results (e.g., "✓ Verified Authentic")'}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Metadata Display"}),": Surface fields from the C2PA manifest:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Capture timestamp, device information, app identifier"}),`
`,e.jsx(i.li,{children:"Allow readers to inspect the verification chain"}),`
`]}),`
`]}),`
`]}),`
`,e.jsxs(i.h2,{id:"car-insurance-claim-app",children:["Car Insurance Claim App",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#car-insurance-claim-app",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.h3,{id:"use-case-overview-1",children:["Use Case Overview",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#use-case-overview-1",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"Insurance companies often accept photos submitted via mobile apps. That has increased incentive for AI editing scams where claimants manipulate images to fraudulently file claims. The ZCAM SDK ensures zPhotos uploaded for claims were taken on an iPhone using the insurer's app and have not been altered since capture."}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"What We're Building:"})," An automated fraud detection system integrated into the claims workflow:"]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Camera functionality inside the insurer's mobile app using the ZCAM SDK"}),`
`,e.jsx(i.li,{children:"A backend verification service that automatically validates submitted zPhotos"}),`
`,e.jsx(i.li,{children:"An automated triage system that flags suspicious claims based on verification and metadata analysis"}),`
`]}),`
`,e.jsx(i.strong,{children:"Value of Verifiable zPhotos:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Fraud Prevention"}),": Automatically detect and reject claims with manipulated or inauthentic zPhotos"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Cost Reduction"}),": Reduce manual review by automating verification and escalating only suspicious cases"]}),`
`]}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Verification Pattern:"})," Internal verification — the insurer verifies zPhotos as part of backend claim processing."]}),`
`,e.jsxs(i.h3,{id:"integration-architecture-1",children:["Integration Architecture",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#integration-architecture-1",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The insurer integrates the ZCAM SDK in two places:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Mobile App"})," (for policyholders): Integration into the claim filing flow"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Backend Claim Processing"}),": Automated verification during claim triage"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"mobile-app-integration",children:["Mobile App Integration",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#mobile-app-integration",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The ZCAM SDK is integrated into the claim filing flow:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Installation"}),": Follow the ",e.jsx(i.a,{href:"/getting-started/installation",children:"Installation guide"})]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Camera Integration"}),": Inject the ",e.jsx(i.code,{children:"<ZCamera>"})," component where users photograph their vehicle:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"The SDK provides camera preview functionality"}),`
`,e.jsxs(i.li,{children:["Call ",e.jsx(i.code,{children:"takePhoto()"})," to capture a verifiable zPhoto"]}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Proof Generation"})," (Optional): Use ",e.jsx(i.code,{children:"react-native-zcam1-prove"})," to attach zero-knowledge proofs:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Use ",e.jsx(i.code,{children:"waitAndEmbedProof()"})," to generate and embed proofs"]}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Claim Submission"}),": Attach verifiable zPhotos to the claim and upload to the backend"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"backend-claim-processing-integration",children:["Backend Claim Processing Integration",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#backend-claim-processing-integration",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"On the backend, verification is part of claim triage:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Automated Verification"}),": Automatically verify all attached zPhotos:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Integrate ",e.jsx(i.code,{children:"react-native-zcam1-verify"})," (or server-side equivalent)"]}),`
`,e.jsxs(i.li,{children:["For each zPhoto, call ",e.jsx(i.code,{children:"verifyHash()"})," and ",e.jsx(i.code,{children:"verifyProof()"})]}),`
`,e.jsx(i.li,{children:"Confirm the zPhoto was taken using the insurer's app"}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Metadata Analysis"}),": Use C2PA fields to validate the claim:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Verify location matches the claim"}),`
`,e.jsx(i.li,{children:"Check timestamp aligns with the incident time"}),`
`,e.jsx(i.li,{children:"Validate device and app identifiers"}),`
`]}),`
`]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Claim Decision"}),": Based on verification:",`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Verification passes"}),": Proceed with normal processing"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Verification fails"}),": Flag for manual review or deny"]}),`
`]}),`
`]}),`
`]}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Result"}),": Insurers can automatically detect fraudulent claims with manipulated zPhotos, reducing fraud and processing costs while preserving a smooth experience for legitimate claimants."]})]})}function l(n={}){const{wrapper:i}={...s(),...n.components};return i?e.jsx(i,{...n,children:e.jsx(r,{...n})}):r(n)}export{l as default,a as frontmatter};
