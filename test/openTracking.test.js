import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
    injectOpenTrackingPixels,
    buildOpenTrackingPixels
} from "../src/modules/phishing/helpers/openTrackingPixel.js";
import {
    normalizeTrackingBase,
    resolveTrackingDomainForEmail,
    resolveTrackingBaseSync,
    isLocalTrackingDomain
} from "../src/modules/phishing/helpers/trackingDomain.js";

const PIXEL_URL = "https://api.lumisec.tech/api/phishing/track/open/abc123?t=1";

describe("open tracking pixel", () => {
    it("embeds pixel at top and bottom of body", () => {
        const html = "<html><body><p>Hello</p></body></html>";
        const out = injectOpenTrackingPixels(html, PIXEL_URL);
        const firstBody = out.indexOf("<body");
        const firstPixel = out.indexOf(PIXEL_URL);
        const lastBody = out.lastIndexOf("</body>");
        const lastPixel = out.lastIndexOf(PIXEL_URL);

        assert.ok(firstPixel > firstBody, "pixel should appear right after <body>");
        assert.ok(lastPixel < lastBody, "pixel should appear before </body>");
        assert.notEqual(firstPixel, lastPixel, "pixel should appear twice");
    });

    it("prepends and appends pixel when body tag is missing", () => {
        const html = "<p>Fragment</p>";
        const out = injectOpenTrackingPixels(html, PIXEL_URL);
        assert.ok(out.startsWith("<!--[if mso]>"), "should start with outlook fallback");
        assert.ok(out.endsWith(buildOpenTrackingPixels(PIXEL_URL)), "should end with pixel block");
    });

    it("includes standard img tag for the open URL", () => {
        const pixels = buildOpenTrackingPixels(PIXEL_URL);
        assert.match(pixels, /<img src="https:\/\/api\.lumisec\.tech\/api\/phishing\/track\/open\/abc123\?t=1"/);
        assert.match(pixels, /width="1" height="1"/);
    });
});

describe("tracking domain resolution for deploy", () => {
    const savedEnv = {
        NGROK_URL: process.env.NGROK_URL,
        PHISHING_TRACKING_DOMAIN: process.env.PHISHING_TRACKING_DOMAIN,
        API_PUBLIC_URL: process.env.API_PUBLIC_URL
    };

    before(() => {
        delete process.env.NGROK_URL;
        delete process.env.PHISHING_TRACKING_DOMAIN;
        delete process.env.API_PUBLIC_URL;
    });

    after(() => {
        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it("normalizes API_PUBLIC_URL to /api/phishing base", () => {
        assert.equal(
            normalizeTrackingBase("https://api.lumisec.tech"),
            "https://api.lumisec.tech/api/phishing"
        );
    });

    it("prefers public env over localhost saved on campaign", async () => {
        process.env.API_PUBLIC_URL = "https://api.lumisec.tech";

        const { domain, source } = await resolveTrackingDomainForEmail({
            campaign: { trackingDomain: "http://localhost:3000/api/phishing" },
            storedSettings: { trackingDomain: "http://localhost:3000/api/phishing" }
        });

        assert.equal(domain, "https://api.lumisec.tech/api/phishing");
        assert.equal(source, "environment");
    });

    it("resolveTrackingBaseSync uses public env when job carries localhost", () => {
        process.env.API_PUBLIC_URL = "https://api.lumisec.tech";
        const base = resolveTrackingBaseSync("http://localhost:3000/api/phishing");
        assert.equal(base, "https://api.lumisec.tech/api/phishing");
    });

    it("detects localhost domains", () => {
        assert.equal(isLocalTrackingDomain("http://localhost:3000/api/phishing"), true);
        assert.equal(isLocalTrackingDomain("https://api.lumisec.tech/api/phishing"), false);
    });
});
