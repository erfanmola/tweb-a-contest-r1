/*
 * https://github.com/morethanwords/tweb/blob/807ee08db1292c99760356b74735912643290add/src/helpers/fixFirefoxSvg.ts#L7
 */

export default function fixFirefoxSvg(text: string) {
  const svgIndex = text.indexOf('<svg');
  if (svgIndex !== 0) {
    text = text.slice(svgIndex);
  }

  const [, , width, height] = text.match(/viewBox="(.+?)"/)![1].split(' ');
  // eslint-disable-next-line no-control-regex
  text = text.replace(/>/, ` width="${width}" height="${height}">`).replace(/[^\x00-\x7F]/g, '');
  return text;
}
