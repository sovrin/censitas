// censitas' part of the nexitas shell: its name, icon and hue, and its section in the nav.
export default defineAppConfig({
  nexitas: {
    modules: [
      {
        id: 'censitas',
        label: 'Usage',
        description: 'How your sites are used: event counts, nothing about visitors.',
        icon: 'bar-chart',
        accent: 'teal',
      },
    ],
    nav: [{ to: '/sites', label: 'Usage', module: 'censitas' }],
  },
})
