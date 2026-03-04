export default {
  target: 'all',
  name: 'User Select',
  description: 'Enables text selection on old client builds that disable it globally.',
  authors: ['Oldcord Team'],
  mandatory: false,
  configurable: true,
  defaultEnabled: true,
  compatibleBuilds: '2015',
  incompatiblePlugins: [],
  debug: false,
  startAt: 'DOMContentLoaded',

  start() {
    if (!window.release_date?.endsWith('_2015')) return;

    const style = document.createElement('style');
    style.id = 'oldplunger-user-select';
    style.textContent = `
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    document.head.appendChild(style);
  },
};
