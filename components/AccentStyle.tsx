// One accent per screen (section 6): a game or daily page sets --accent for the
// whole document, header included, for as long as it is mounted.
export function AccentStyle({ accent }: { accent: string }) {
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) return null;
  return <style dangerouslySetInnerHTML={{ __html: `:root{--accent:${accent}}` }} />;
}
