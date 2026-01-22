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
      text: 'Overview',
      items: [
        {
          text: 'Home',
          link: '/',
        },
        {
          text: 'How it Works',
          link: '/overview/how_it_works',
        },
        {
          text: 'Landscape',
          link: '/overview/landscape',
        },
        {
          text: 'Use Cases',
          link: '/overview/use_cases',
        }
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
        {
          text: 'Hardware Camera Support',
          link: '/c2pa-ecosystem/hardware_camera_support',
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
          text: 'Security',
          link: '/technical-docs/security',
        },
        {
          text: 'FAQs',
          link: '/technical-docs/faq',
        },
      ],
    }
  ]},
})
