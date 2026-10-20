/** What a site puts in its code to count: the tracker, loaded in the background, and a track()
 *  that does nothing until it has loaded. */
export const trackerSnippet = (origin: string, site: string) =>
  [
    `const TRACKER = '${origin}/v1/track.js?site=${site}'`,
    'let track = () => {}',
    'import(/* @vite-ignore */ TRACKER).then(',
    '  (module) => (track = module.track),',
    '  () => {},',
    ')',
  ].join('\n')
