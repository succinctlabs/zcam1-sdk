import { defineConfig } from 'vocs'

export default defineConfig({
  title: 'ZCAM SDK',
  sidebar: [
    {
      text: 'Overview',
      items: [
        {
          text: 'Introduction',
          link: '/overview/introduction',
        },
        {
          text: 'How it Works',
          link: '/overview/how_it_works',
        },
        {
          text: 'ZCAM vs Other Approaches',
          link: '/overview/comparisons_to_other_approaches',
        },
        {
          text: 'Example Usecases',
          link: '/overview/example_usecases',
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
          text: 'Editing ZCAM Photos',
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
  ],
})
