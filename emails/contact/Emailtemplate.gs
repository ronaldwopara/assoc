/**
 * ASOSC — Branded HTML email builder
 *
 * Shared across all six form scripts (volunteer, newsletter, membership,
 * vendors, donate, contact). Paste this file unchanged into each project and
 * change only the BRAND block below.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOW THE COPY WORKS
 *
 * Busayo writes plain text in cell A1 of the template tab. This file wraps it
 * in the branded shell. She never edits HTML, and a typo in her wording can
 * never break the layout.
 *
 *   A1  body text (plain, with {{placeholders}})
 *   B1  subject line
 *   B2  button label      (optional — no button if blank)
 *   B3  button URL        (optional)
 *   B4  preheader         (optional preview text in the inbox list)
 *   B5  unsubscribe link  (optional — required for newsletters, see below)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNSUBSCRIBE
 *
 * Canada's anti-spam law requires commercial electronic messages to identify
 * the sender and carry a working unsubscribe mechanism. A form acknowledgement
 * is arguably transactional; a newsletter is not. Pass opts.unsubscribe and a
 * line renders in the footer. Leave it blank and nothing is added, so the same
 * file serves every form.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DARK MODE
 *
 * Mail clients in dark mode rewrite colours. Gmail and Outlook invert
 * backgrounds; Apple Mail recolours text. An email designed in black on white
 * can arrive as grey on charcoal with an invisible logo. Seven defences,
 * layered because no single one covers every client:
 *
 *  1. color-scheme meta tags declaring the email light-only. Apple Mail and
 *     newer Outlook honour this and stop there.
 *  2. Near-black and near-white instead of pure values (#010101 / #fffffe).
 *     Several clients only invert exact #000000 and #ffffff, so stepping one
 *     shade off the extreme sidesteps the rule entirely.
 *  3. A linear-gradient duplicating every background-color. Clients that
 *     invert background-color generally cannot touch a background-image, so
 *     the gradient survives and paints over the inverted colour.
 *  4. -webkit-text-fill-color alongside color. Apple's inversion changes
 *     `color` and ignores `fill-color`, so the fill wins.
 *  5. A prefers-color-scheme block re-forcing everything with !important, for
 *     clients that keep the style tag.
 *  6. [data-ogsc] / [data-ogsb] rules. Outlook.com strips media queries and
 *     prefixes elements with these attributes instead.
 *  7. x-apple-data-detectors reset, so iOS auto-linking an address does not
 *     restyle it blue.
 *
 * Known limit: Gmail strips @import, so webfonts do not load there. The stack
 * falls back to Arial rather than something unpredictable.
 * ─────────────────────────────────────────────────────────────────────────
 */

const BRAND = {
  NAME: 'ASOSC',
  FULL_NAME: 'Africans Society of Strathcona County',
  TAGLINE: 'Empowering Africans to enrich the social, economic, and cultural fabric of Strathcona County and beyond',

  // Cloudinary source is .webp, which Outlook and several older clients cannot
  // render — the logo would show as a broken image. f_png forces a conversion
  // on delivery, so this URL is a real PNG despite the .webp on the end.
  LOGO_URL: 'https://res.cloudinary.com/daldas2e7/image/upload/f_png,q_auto,w_400/v1786052977/asosc/about.webp',

  SITE_URL: 'https://www.asosc.ca',
  EMAIL: 'info@asosc.ca',
  PHONE: '(587) 566-3212',
  PHONE_TEL: '+15875663212',
  FACEBOOK: 'https://www.facebook.com/people/Africans-Society-of-Strathcona-County/61550552301286/',
  INSTAGRAM: 'https://www.instagram.com/africansocietystrathconacounty',

  // Social icons must be hosted PNGs. Email clients do not render SVG or icon
  // fonts, and a base64 data URI is stripped by Gmail and Outlook, so a real
  // hosted URL is the only approach that works everywhere.
  //
  // TO TURN ICONS ON:
  //   1. Upload facebook.png and instagram.png to Cloudinary.
  //   2. Paste the EXACT delivery URLs Cloudinary gives you below. Do not
  //      hand-build them — the version segment (v1234...) is assigned on
  //      upload and a guessed URL returns a broken image.
  //   3. Set ICONS_READY to true.
  //
  // While ICONS_READY is false the footer renders text links instead. Plainer,
  // but it can never show broken image icons, which looks worse than no icons.
  ICON_FACEBOOK: '',
  ICON_INSTAGRAM: '',
  ICONS_READY: false,
  LOCATION: 'Strathcona County, AB',

  // Sampled from the live site. Near-black rather than pure, see defence 2.
  INK: '#2F2B28',
  PAPER: '#FFFFFE',
  WASH: '#F7F7F7',
  ACCENT: '#F08F3B',
  ACCENT_INK: '#2F2B28',             // charcoal on orange; white on orange fails contrast
  MUTED: '#5a5a5a',
  HAIRLINE: '#e6e2de',

  FONT: "'Poppins', 'Segoe UI', Arial, Helvetica, sans-serif",
  MAX_WIDTH: 640,
};

/**
 * Wraps plain body text in the branded shell.
 *
 * @param {string} bodyText  already placeholder-substituted plain text
 * @param {Object} opts      { buttonLabel, buttonUrl, preheader }
 * @return {string} full HTML document
 */
function buildBrandedEmail(bodyText, opts) {
  const o = opts || {};
  const blocks = splitIntoBlocks(String(bodyText || ''));

  const greeting = blocks.greeting;
  const paragraphs = blocks.paragraphs;
  const signature = blocks.signature;

  const p = function (text, last) {
    return '<p class="tx" style="margin:0 0 ' + (last ? '4' : '18') + 'px 0;' +
           'font-family:' + BRAND.FONT + ';font-size:16px;line-height:1.65;' +
           'color:' + BRAND.INK + ';-webkit-text-fill-color:' + BRAND.INK + ';">' +
           escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
  };

  const button = (o.buttonLabel && o.buttonUrl) ? [
    '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;">',
      '<tr><td class="btn" align="center" bgcolor="' + BRAND.ACCENT + '"',
        ' style="border-radius:28px;background-color:' + BRAND.ACCENT + ';',
        'background-image:linear-gradient(' + BRAND.ACCENT + ',' + BRAND.ACCENT + ');">',
        '<a href="' + escapeAttr(o.buttonUrl) + '" target="_blank"',
          ' style="display:inline-block;padding:14px 32px;font-family:' + BRAND.FONT + ';',
          'font-size:16px;font-weight:700;text-decoration:none;',
          'color:' + BRAND.ACCENT_INK + ';-webkit-text-fill-color:' + BRAND.ACCENT_INK + ';">',
          escapeHtml(o.buttonLabel),
        '</a>',
      '</td></tr>',
    '</table>',
  ].join('') : '';

  const logo = BRAND.LOGO_URL
    ? '<img src="' + escapeAttr(BRAND.LOGO_URL) + '" alt="' + escapeAttr(BRAND.NAME) + '"' +
      ' width="140" style="width:140px;max-width:45%;height:auto;display:block;margin:0 auto;border:0;">'
    : '<span style="font-family:' + BRAND.FONT + ';font-size:26px;font-weight:700;letter-spacing:1px;' +
      'color:' + BRAND.ACCENT + ';-webkit-text-fill-color:' + BRAND.ACCENT + ';">' +
      escapeHtml(BRAND.NAME) + '</span>';

  const link = function (href, text) {
    return '<a href="' + escapeAttr(href) + '" target="_blank" class="onink"' +
      ' style="color:' + BRAND.ACCENT + ';-webkit-text-fill-color:' + BRAND.ACCENT + ';' +
      'text-decoration:none;">' + escapeHtml(text) + '</a>';
  };

  const addressCell = [
    link('mailto:' + BRAND.EMAIL, BRAND.EMAIL),
    '<span style="opacity:.45;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>',
    link('tel:' + BRAND.PHONE_TEL, BRAND.PHONE),
    '<br>',
    link(BRAND.SITE_URL, 'www.asosc.ca'),
  ].join('');

  // Footer logo. Same asset as the header but smaller, matching the reference
  // pattern of closing with the mark.
  const footerLogo = BRAND.LOGO_URL
    ? '<a href="' + escapeAttr(BRAND.SITE_URL) + '" target="_blank"' +
      ' style="text-decoration:none;display:inline-block;">' +
      '<img src="' + escapeAttr(BRAND.LOGO_URL) + '" alt="' + escapeAttr(BRAND.NAME) + '"' +
      ' width="48" style="width:48px;height:auto;display:block;border:0;">' +
      '</a>'
    : '';

  /**
   * Social row. Icons are hosted PNGs in a centre-aligned table, one per cell,
   * each with display:block and an explicit width attribute so Outlook does
   * not insert phantom whitespace under them. Falls back to text links when
   * the icon assets have not been uploaded yet, so the footer is never broken
   * images.
   */
  const socialIcon = function (href, src, label) {
    return '<td align="center" style="padding:0 9px;">' +
      '<a href="' + escapeAttr(href) + '" target="_blank" style="text-decoration:none;">' +
      '<img src="' + escapeAttr(src) + '" alt="' + escapeAttr(label) + '"' +
      ' width="24" height="24" style="display:block;width:24px;height:24px;border:0;">' +
      '</a></td>';
  };

  const iconsUsable = BRAND.ICONS_READY && BRAND.ICON_FACEBOOK && BRAND.ICON_INSTAGRAM;

  const socialRow = iconsUsable
    ? '<table role="presentation" align="left" border="0" cellpadding="0" cellspacing="0"' +
      ' style="margin:0 0 6px 0;"><tr>' +
      socialIcon(BRAND.FACEBOOK, BRAND.ICON_FACEBOOK, 'Facebook') +
      socialIcon(BRAND.INSTAGRAM, BRAND.ICON_INSTAGRAM, 'Instagram') +
      '</tr></table>'
    : '<div class="onink" style="font-family:' + BRAND.FONT + ';font-size:13px;' +
      'margin-bottom:6px;color:' + BRAND.ACCENT + ';' +
      '-webkit-text-fill-color:' + BRAND.ACCENT + ';">' +
      link(BRAND.FACEBOOK, 'Facebook') +
      '<span style="opacity:.45;">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>' +
      link(BRAND.INSTAGRAM, 'Instagram') +
      '</div>';

  // Optional. Accepts a URL or a mailto:. Renders nothing when blank, which is
  // why this file stays identical across all six form projects.
  const unsubscribeRow = o.unsubscribe
    ? '<div class="onink" style="font-family:' + BRAND.FONT + ';font-size:11px;' +
      'line-height:1.6;margin-top:10px;color:' + BRAND.ACCENT + ';' +
      '-webkit-text-fill-color:' + BRAND.ACCENT + ';opacity:.7;">' +
      '<a href="' + escapeAttr(o.unsubscribe) + '" target="_blank" class="onink"' +
      ' style="color:' + BRAND.ACCENT + ';-webkit-text-fill-color:' + BRAND.ACCENT + ';' +
      'text-decoration:underline;">Unsubscribe</a>' +
      '<span style="opacity:.6;"> from these emails</span></div>'
    : '';

  return [
'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
'<html xmlns="http://www.w3.org/1999/xhtml" lang="en">',
'<head>',
  '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  // Defence 1
  '<meta name="color-scheme" content="light only">',
  '<meta name="supported-color-schemes" content="light only">',
  '<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">',
  '<title>' + escapeHtml(BRAND.NAME) + '</title>',
  '<!--[if mso]><xml><o:OfficeDocumentSettings>',
    '<o:PixelsPerInch>96</o:PixelsPerInch>',
  '</o:OfficeDocumentSettings></xml><![endif]-->',
  '<style>',
    "@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');",
    'body,table,td,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}',
    'img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}',
    // Defence 7
    'a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;',
      'font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;',
      'line-height:inherit!important;}',
    // Defence 5
    '@media (prefers-color-scheme: dark){',
      '.shell,.card,body{background-color:' + BRAND.PAPER + '!important;',
        'background-image:linear-gradient(' + BRAND.PAPER + ',' + BRAND.PAPER + ')!important;}',
      '.tx,.tx *,h1,h2,p,span,strong,em,li{color:' + BRAND.INK + '!important;',
        '-webkit-text-fill-color:' + BRAND.INK + '!important;}',
      '.ink{background-color:' + BRAND.INK + '!important;',
        'background-image:linear-gradient(' + BRAND.INK + ',' + BRAND.INK + ')!important;}',
      '.accent,.btn{background-color:' + BRAND.ACCENT + '!important;',
        'background-image:linear-gradient(' + BRAND.ACCENT + ',' + BRAND.ACCENT + ')!important;}',
      '.btn a{color:' + BRAND.ACCENT_INK + '!important;',
        '-webkit-text-fill-color:' + BRAND.ACCENT_INK + '!important;}',
      '.onink,.onink a{color:' + BRAND.ACCENT + '!important;',
        '-webkit-text-fill-color:' + BRAND.ACCENT + '!important;}',
      '.wash{background-color:' + BRAND.WASH + '!important;',
        'background-image:linear-gradient(' + BRAND.WASH + ',' + BRAND.WASH + ')!important;}',
    '}',
    // Defence 6 — Outlook.com strips media queries, uses these attributes
    '[data-ogsc] .tx,[data-ogsc] .tx *,[data-ogsc] h2,[data-ogsc] p{',
      'color:' + BRAND.INK + '!important;-webkit-text-fill-color:' + BRAND.INK + '!important;}',
    '[data-ogsb] .shell,[data-ogsb] .card{background-color:' + BRAND.PAPER + '!important;}',
    '[data-ogsb] .ink{background-color:' + BRAND.INK + '!important;}',
    '[data-ogsb] .accent,[data-ogsb] .btn{background-color:' + BRAND.ACCENT + '!important;}',
    '[data-ogsc] .onink,[data-ogsc] .onink a{color:' + BRAND.ACCENT + '!important;}',
    '@media only screen and (max-width:620px){',
      '.card{width:100%!important;}',
      '.pad{padding:24px 20px!important;}',
      '.stack{display:block!important;width:100%!important;text-align:center!important;}',
    '}',
  '</style>',
'</head>',
// Defence 3 applied to body itself
'<body class="shell" style="margin:0;padding:0;width:100%;background-color:' + BRAND.WASH + ';' +
  'background-image:linear-gradient(' + BRAND.WASH + ',' + BRAND.WASH + ');">',

  // Preheader: shown in the inbox list, hidden in the message
  '<div style="display:none;font-size:1px;color:' + BRAND.WASH + ';line-height:1px;' +
    'max-height:0;max-width:0;opacity:0;overflow:hidden;">',
    escapeHtml(o.preheader || stripToPreview(paragraphs[0] || '')),
    '&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;',
  '</div>',

  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"',
    ' class="shell" bgcolor="' + BRAND.WASH + '" style="background-color:' + BRAND.WASH + ';',
    'background-image:linear-gradient(' + BRAND.WASH + ',' + BRAND.WASH + ');">',
    '<tr><td align="center" style="padding:24px 12px;">',

      '<table role="presentation" class="card" width="' + BRAND.MAX_WIDTH + '" cellpadding="0"',
        ' cellspacing="0" border="0" bgcolor="' + BRAND.PAPER + '"',
        ' style="width:' + BRAND.MAX_WIDTH + 'px;max-width:100%;background-color:' + BRAND.PAPER + ';',
        'background-image:linear-gradient(' + BRAND.PAPER + ',' + BRAND.PAPER + ');',
        'border:1px solid ' + BRAND.HAIRLINE + ';border-radius:10px;overflow:hidden;">',

        // Header
        '<tr><td class="ink" align="center" bgcolor="' + BRAND.INK + '"',
          ' style="padding:26px;background-color:' + BRAND.INK + ';',
          'background-image:linear-gradient(' + BRAND.INK + ',' + BRAND.INK + ');">',
          logo,
        '</td></tr>',
        '<tr><td class="accent" bgcolor="' + BRAND.ACCENT + '"',
          ' style="height:5px;line-height:5px;font-size:5px;background-color:' + BRAND.ACCENT + ';',
          'background-image:linear-gradient(' + BRAND.ACCENT + ',' + BRAND.ACCENT + ');">&nbsp;</td></tr>',

        // Body
        '<tr><td class="pad" style="padding:32px 34px;">',
          greeting
            ? '<h2 class="tx" style="margin:0 0 18px 0;font-family:' + BRAND.FONT + ';font-size:21px;' +
              'font-weight:700;color:' + BRAND.INK + ';-webkit-text-fill-color:' + BRAND.INK + ';">' +
              escapeHtml(greeting) + '</h2>'
            : '',
          paragraphs.map(function (t) { return p(t, false); }).join(''),
          button,
          signature.length
            ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"' +
              ' style="margin-top:26px;border-top:1px solid ' + BRAND.HAIRLINE + ';"><tr>' +
              '<td style="padding-top:20px;">' +
              signature.map(function (t, i) { return p(t, i === signature.length - 1); }).join('') +
              '</td></tr></table>'
            : '',
        '</td></tr>',

        // Footer. Centred stack: logo, social icons, contacts, copyright.
        '<tr><td class="ink" align="center" bgcolor="' + BRAND.INK + '"',
          ' style="padding:30px 24px 26px 24px;background-color:' + BRAND.INK + ';',
          'background-image:linear-gradient(' + BRAND.INK + ',' + BRAND.INK + ');">',

          // Logo on the left, social + contact links on the right — one row
          // instead of several stacked centered blocks, to keep the footer shorter.
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">',
          '<tr>',
          '<td class="stack" width="48" valign="top" align="left" style="padding-right:16px;">',
          footerLogo,
          '</td>',
          '<td class="stack" valign="top" align="left">',
          socialRow,
          '<div class="onink" style="font-family:' + BRAND.FONT + ';font-size:13px;',
            'line-height:1.7;color:' + BRAND.ACCENT + ';',
            '-webkit-text-fill-color:' + BRAND.ACCENT + ';">',
            addressCell,
          '</div>',
          '</td>',
          '</tr>',
          '</table>',

          '<div style="height:1px;line-height:1px;font-size:1px;margin:18px auto 14px auto;',
            'width:70%;background-color:' + BRAND.ACCENT + ';',
            'background-image:linear-gradient(' + BRAND.ACCENT + ',' + BRAND.ACCENT + ');',
            'opacity:.3;">&nbsp;</div>',

          '<div class="onink" style="font-family:' + BRAND.FONT + ';font-size:11px;',
            'line-height:1.6;color:' + BRAND.ACCENT + ';',
            '-webkit-text-fill-color:' + BRAND.ACCENT + ';opacity:.7;">',
            '&copy; ' + new Date().getFullYear() + ' ' + escapeHtml(BRAND.FULL_NAME) + '<br>',
            escapeHtml(BRAND.LOCATION),
          '</div>',
          unsubscribeRow,

        '</td></tr>',

      '</table>',
    '</td></tr>',
  '</table>',
'</body>',
'</html>',
  ].join('');
}

// ============================================================ TEXT SHAPING

/**
 * Splits Busayo's plain text into a greeting, body paragraphs, and a
 * signature. Keeps her writing intact; only decides where the visual breaks
 * go so she never has to think about markup.
 */
function splitIntoBlocks(text) {
  const parts = text.replace(/\r\n/g, '\n').split(/\n\s*\n/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);

  let greeting = '';
  if (parts.length && /^(hi|hello|hey|dear)\b/i.test(parts[0]) && parts[0].length < 80) {
    greeting = parts.shift();
  }

  // Trailing short lines with no sentence punctuation read as a sign-off.
  const signature = [];
  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    const looksLikeSignoff = last.length < 90 && !/[.!?]$/.test(last.split('\n').pop().trim());
    if (!looksLikeSignoff) break;
    signature.unshift(parts.pop());
  }

  return { greeting: greeting, paragraphs: parts, signature: signature };
}

function stripToPreview(s) {
  return String(s).replace(/\s+/g, ' ').trim().slice(0, 110);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/\n/g, '');
}