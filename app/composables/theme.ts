type Mode = 'light' | 'dark' | 'auto'

/** The theme as the server knows it: aequitas' setTheme() mirrors the choice into the `ae-theme` cookie. */
export function useThemeMode() {
  const cookie = useCookie<Mode | undefined>('ae-theme')
  return useState<Mode>('theme', () => cookie.value ?? 'auto')
}
