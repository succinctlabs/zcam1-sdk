import { defineConfig } from 'vocs'

export default defineConfig({
  title: 'ZCAM',
  theme: {
    accentColor: {
      light: '#FE01AC',
      dark: '#FE01AC',
    },
  },
  font: { 
    google: 'Inter'
  }, 
  iconUrl: 'favicon.svg',
  logoUrl: 'Succinct_FullLogo_Magenta.svg',
  sidebar: {'/': [
    {
      text: 'Home',
      link: '/',
    },
     {
      text: 'Overview',
      items: [
        {
          text: 'How it Works',
          link: '/overview/how_it_works',
        },
        {
          text: 'Landscape',
          link: '/overview/landscape',
        },
      ],
    },
    {
      text: 'Features',
      items: [
        {
          text: 'Authenticity',
          link: '/features/authenticity',
        },
        {
          text: 'Privacy',
          link: '/features/privacy',
        },
        {
          text: 'Security',
          link: '/features/security',
        },
      ],
    },
    {
      text: 'Usecases',
      items: [
        {
          text: 'Verifiable News Platform',
          link: '/usecases/verifiable_news_platform',
        },
        {
          text: 'Insurance Claim Verification',
          link: '/usecases/insurance_claim_verification',
        },
      ],
    },
    {
      text: 'Getting Started',
      items: [
        {
          text: 'Installation',
          link: '/getting-started/installation',
        },
        {
          text: 'Quickstart',
          link: '/getting-started/quickstart',
        },
      ],
    },
    {
      text: 'Using the SDK',
      items: [
        {
          text: 'Capture',
          link: '/sdk/capture',
        },
        {
          text: 'Prove',
          link: '/sdk/prove',
        },
        {
          text: 'Verify',
          link: '/sdk/verify',
        },
        {
          text: 'Picker',
          link: '/sdk/picker',
        },
      ],
    },
    {
      text: 'C2PA Compatibility',
      items: [
        {
          text: 'Editing Photos',
          link: '/c2pa-ecosystem/editing_zcam_photos',
        },
      ],
    },
    {
      text: 'Technical Docs',
      items: [
        {
          text: 'Architecture',
          link: '/technical-docs/architecture',
        },
        {
          text: 'ZK Proof Details',
          link: '/technical-docs/zkproof-details',
        },
        {
          text: 'FAQs',
          link: '/technical-docs/faq',
        },
      ],
    }
  ]},
})
