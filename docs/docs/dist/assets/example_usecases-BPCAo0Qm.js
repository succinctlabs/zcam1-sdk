import{f as r,j as e}from"./index-BKSjBa6b.js";const s={title:"Example Use Cases",description:"undefined"};function t(n){const i={a:"a",aside:"aside",code:"code",div:"div",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...r(),...n.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"example-use-cases",children:["Example Use Cases",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#example-use-cases",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(i.p,{children:["Below are two real-world examples demonstrating how the ZCAM SDK can be integrated to solve different verification challenges. Each example highlights a distinct verification pattern: ",e.jsx(i.strong,{children:"end-user verification"})," (public-facing) versus ",e.jsx(i.strong,{children:"internal verification"})," (backend processing)."]}),`
`,e.jsxs(i.aside,{"data-callout":"info",children:[e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Verification Patterns:"})," While both use cases rely on verifiable photos, they differ in who performs the verification and where it happens:"]}),e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"End-user verification"}),": Public-facing verification where readers/users verify photos themselves (e.g., news platform readers)"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Internal verification"}),": Backend verification where the company verifies photos as part of their internal processes (e.g., insurance claim processing)"]}),`
`]})]}),`
`,e.jsxs(i.h2,{id:"verifiable-news-platform",children:["Verifiable News Platform",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#verifiable-news-platform",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.h3,{id:"use-case-overview",children:["Use Case Overview",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#use-case-overview",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"In today's media landscape, edited and AI-generated photos are a frequent concern for news consumers. A news platform hosting breaking news stories with field reporters may want to ensure their readers that all photos are verifiably authentic and unedited."}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"What We're Building:"})," A complete verifiable journalism system consisting of:"]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"A mobile camera app for field reporters to capture verifiable photos using ZCAM SDK"}),`
`,e.jsx(i.li,{children:"Integration into the news platform's content management system to store and display verifiable photos"}),`
`,e.jsx(i.li,{children:"Public-facing verification tools on the web platform allowing readers to independently verify photo authenticity"}),`
`]}),`
`,e.jsx(i.strong,{children:"Value of Verifiable Photos:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Trust & Credibility"}),": Readers can independently verify that photos haven't been edited or manipulated, building trust in the platform's journalism"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"integration-architecture",children:["Integration Architecture",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#integration-architecture",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The news platform integrates ZCAM SDK in two places:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Mobile Camera App"})," (for reporters): A lightweight iOS app that reporters use to capture verifiable photos"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Web Platform"})," (for readers): Integration of verification functionality so readers can verify photos as authentic"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"mobile-camera-app-integration",children:["Mobile Camera App Integration",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#mobile-camera-app-integration",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The news platform builds a specialized camera app for reporters using the ZCAM SDK:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Installation"}),": Follow the ",e.jsx(i.a,{href:"/getting-started/installation",children:"Installation guide"})," to set up the SDK"]}),`
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
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Upload"}),": Upload the verifiable photo to the news platform's backend for use in articles"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"web-platform-integration",children:["Web Platform Integration",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#web-platform-integration",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
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
`,e.jsxs(i.h2,{id:"car-insurance-claim-app",children:["Car Insurance Claim App",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#car-insurance-claim-app",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.h3,{id:"use-case-overview-1",children:["Use Case Overview",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#use-case-overview-1",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"Most car insurance companies allow policyholders to file claims using photos from their mobile app. This has led to an increase in AI editing scams where claimants manipulate photos to file fraudulent claims. The ZCAM SDK ensures that photos uploaded for claims were taken on an iPhone using the insurance company's app, guaranteeing the photo hasn't been edited or altered since capture."}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"What We're Building:"})," An automated fraud detection system integrated into the insurance claim workflow:"]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Camera functionality within the existing insurance mobile app using ZCAM SDK for photo capture"}),`
`,e.jsx(i.li,{children:"Backend verification service that automatically validates all submitted claim photos"}),`
`,e.jsx(i.li,{children:"Automated triage system that flags suspicious claims based on verification results and metadata analysis"}),`
`]}),`
`,e.jsx(i.strong,{children:"Value of Verifiable Photos:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Fraud Prevention"}),": Automatically detect and reject claims with manipulated or inauthentic photos, preventing fraudulent payouts"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Cost Reduction"}),": Reduce manual review costs by automating verification and flagging only suspicious claims for human review"]}),`
`]}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Verification Pattern:"})," Internal verification — the insurance company verifies photos as part of their backend claim processing workflow."]}),`
`,e.jsxs(i.h3,{id:"integration-architecture-1",children:["Integration Architecture",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#integration-architecture-1",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The insurance company integrates ZCAM SDK in two places:"}),`
`,e.jsxs(i.ol,{children:[`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Mobile App"})," (for policyholders): Integration into the claim filing flow"]}),`
`,e.jsxs(i.li,{children:[e.jsx(i.strong,{children:"Backend Claim Processing"})," (for insurance company): Automated verification during claim triage"]}),`
`]}),`
`,e.jsxs(i.h3,{id:"mobile-app-integration",children:["Mobile App Integration",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#mobile-app-integration",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(i.p,{children:"The ZCAM SDK is integrated into the claim filing flow of the insurance app:"}),`
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
`,e.jsxs(i.h3,{id:"backend-claim-processing-integration",children:["Backend Claim Processing Integration",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#backend-claim-processing-integration",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
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
`]}),`
`,e.jsxs(i.p,{children:[e.jsx(i.strong,{children:"Result"}),": Insurance companies can automatically detect fraudulent claims with manipulated photos, reducing fraud and processing costs while maintaining a smooth experience for legitimate claimants."]})]})}function o(n={}){const{wrapper:i}={...r(),...n.components};return i?e.jsx(i,{...n,children:e.jsx(t,{...n})}):t(n)}export{o as default,s as frontmatter};
