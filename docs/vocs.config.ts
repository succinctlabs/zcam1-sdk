import { defineConfig } from "vocs";

export default defineConfig({
  title: "ZCAM",
  theme: {
    accentColor: "#FE01AC",
    colorScheme: "light",
  },
  font: {
    google: "Inter",
  },
  iconUrl: "/favicon.svg",
  logoUrl: "/Succinct_FullLogo_Magenta.svg",
  sidebar: {
    "/": [
      {
        text: "Home",
        link: "/",
      },
      {
        text: "Overview",
        items: [
          {
            text: "How it Works",
            link: "/overview/how_it_works",
          },
          {
            text: "Landscape",
            link: "/overview/landscape",
          },
          {
            text: "C2PA",
            link: "/overview/c2pa",
          },
        ],
      },
      {
        text: "Features",
        items: [
          {
            text: "Authenticity",
            link: "/features/authenticity",
          },
          {
            text: "Privacy",
            link: "/features/privacy",
          },
          {
            text: "Security",
            link: "/features/security",
          },
        ],
      },
      {
        text: "Usecases",
        items: [
          {
            text: "Verifiable News Platform",
            link: "/usecases/verifiable_news_platform",
          },
          {
            text: "Insurance Claim Verification",
            link: "/usecases/insurance_claim_verification",
          },
        ],
      },
      {
        text: "Getting Started",
        items: [
          {
            text: "Installation",
            link: "/getting-started/installation",
          },
          {
            text: "Quickstart",
            link: "/getting-started/quickstart",
          },
        ],
      },
      {
        text: "Using the SDK",
        collapsed: true,
        items: [
          {
            text: "Overview",
            link: "/sdk",
          },
          {
            text: "Capture",
            collapsed: true,
            items: [
              {
                text: "initCapture",
                link: "/sdk/capture/initCapture",
              },
              {
                text: "ZCamera",
                link: "/sdk/capture/ZCamera",
              },
              {
                text: "takePhoto",
                link: "/sdk/capture/takePhoto",
              },
              {
                text: "previewFile",
                link: "/sdk/capture/previewFile",
              },
              {
                text: "getMinZoom",
                link: "/sdk/capture/getMinZoom",
              },
              {
                text: "getMaxZoom",
                link: "/sdk/capture/getMaxZoom",
              },
              {
                text: "focusAtPoint",
                link: "/sdk/capture/focusAtPoint",
              },
              {
                text: "setZoomAnimated",
                link: "/sdk/capture/setZoomAnimated",
              },
              {
                text: "hasUltraWideCamera",
                link: "/sdk/capture/hasUltraWideCamera",
              },
              {
                text: "isDepthSupported",
                link: "/sdk/capture/isDepthSupported",
              },
              {
                text: "getSwitchOverZoomFactors",
                link: "/sdk/capture/getSwitchOverZoomFactors",
              },
              {
                text: "startVideoRecording",
                link: "/sdk/capture/startVideoRecording",
              },
              {
                text: "stopVideoRecording",
                link: "/sdk/capture/stopVideoRecording",
              },
              {
                text: "Types",
                link: "/sdk/capture/types",
              },
            ],
          },
          {
            text: "Prove",
            collapsed: true,
            items: [
              {
                text: "ProverProvider",
                link: "/sdk/prove/ProverProvider",
              },
              {
                text: "useProver",
                link: "/sdk/prove/useProver",
              },
              {
                text: "requestProof",
                link: "/sdk/prove/requestProof",
              },
              {
                text: "getProofStatus",
                link: "/sdk/prove/getProofStatus",
              },
              {
                text: "useProofRequestStatus",
                link: "/sdk/prove/useProofRequestStatus",
              },
              {
                text: "embedProof",
                link: "/sdk/prove/embedProof",
              },
              {
                text: "waitAndEmbedProof",
                link: "/sdk/prove/waitAndEmbedProof",
              },
              {
                text: "Types",
                link: "/sdk/prove/types",
              },
            ],
          },
          {
            text: "Verify",
            collapsed: true,
            items: [
              {
                text: "VerifiableFile",
                link: "/sdk/verify/VerifiableFile",
              },
              {
                text: "verifyBindings",
                link: "/sdk/verify/verifyBindings",
              },
              {
                text: "verifyProof",
                link: "/sdk/verify/verifyProof",
              },
              {
                text: "dataHash",
                link: "/sdk/verify/dataHash",
              },
              {
                text: "captureMetadata",
                link: "/sdk/verify/captureMetadata",
              },
              {
                text: "Types",
                link: "/sdk/verify/types",
              },
            ],
          },
          {
            text: "Verify (browser)",
            link: "/sdk/verify-browser",
            collapsed: true,
            items: [
              {
                text: "VerifiableFile",
                link: "/sdk/verify-browser/VerifiableFile",
              },
              {
                text: "verifyBindings",
                link: "/sdk/verify-browser/verifyBindings",
              },
              {
                text: "verifyProof",
                link: "/sdk/verify-browser/verifyProof",
              },
              {
                text: "dataHash",
                link: "/sdk/verify-browser/dataHash",
              },
              {
                text: "captureMetadata",
                link: "/sdk/verify-browser/captureMetadata",
              },
              {
                text: "authenticityStatus",
                link: "/sdk/verify-browser/authenticityStatus",
              },
              {
                text: "c2paReader",
                link: "/sdk/verify-browser/c2paReader",
              },
              {
                text: "Types",
                link: "/sdk/verify-browser/types",
              },
            ],
          },
          {
            text: "Picker (React Native)",
            collapsed: true,
            items: [
              {
                text: "ZImagePicker",
                link: "/sdk/picker/ZImagePicker",
              },
              {
                text: "privateDirectory",
                link: "/sdk/picker/privateDirectory",
              },
              {
                text: "authenticityStatus",
                link: "/sdk/picker/authenticityStatus",
              },
            ],
          },
        ],
      },
      {
        text: "Technical Docs",
        items: [
          {
            text: "Architecture",
            link: "/technical-docs/architecture",
          },
          {
            text: "ZK Proof Details",
            link: "/technical-docs/zkproof-details",
          },
          {
            text: "FAQs",
            link: "/technical-docs/faq",
          },
        ],
      },
    ],
  },
});
