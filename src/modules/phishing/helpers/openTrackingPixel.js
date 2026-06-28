/**
 * Email-client-safe open tracking pixels.
 * Placed at the top and bottom of the body so clients load them as soon as the message is opened.
 */
export function buildOpenTrackingPixels(openPixelUrl) {
    const img = [
        `<img src="${openPixelUrl}" width="1" height="1" alt="" border="0"`,
        'style="width:1px;height:1px;max-width:1px;max-height:1px;border:0;margin:0;padding:0;line-height:1;font-size:1px" />'
    ].join(" ");

    const outlookVml = [
        "<!--[if mso]>",
        '<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:1px;height:1px;">',
        `<v:fill type="frame" src="${openPixelUrl}" />`,
        "<v:textbox inset=\"0,0,0,0\"></v:textbox>",
        "</v:rect>",
        "<![endif]-->"
    ].join("");

    return `${outlookVml}${img}`;
}

export function injectOpenTrackingPixels(html, openPixelUrl) {
    const pixels = buildOpenTrackingPixels(openPixelUrl);

    if (/<body[^>]*>/i.test(html)) {
        return html
            .replace(/<body([^>]*)>/i, `<body$1>${pixels}`)
            .replace(/<\/body>/i, `${pixels}</body>`);
    }

    return `${pixels}${html}${pixels}`;
}
