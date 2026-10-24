import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeSvg, isSafeUrl } from './sanitize';
import { XSS_PAYLOADS } from './xss-corpus';

describe('Frontend XSS Sanitization & URL Safety', () => {
  it('sanitizeHtml should neutralize all payloads in the XSS corpus', () => {
    for (const payload of XSS_PAYLOADS) {
      const sanitized = sanitizeHtml(payload.raw);

      if (payload.dangerousTags) {
        for (const tag of payload.dangerousTags) {
          expect(sanitized.toLowerCase()).not.toContain(`<${tag}`);
          expect(sanitized.toLowerCase()).not.toContain(`</${tag}>`);
        }
      }

      if (payload.dangerousAttributes) {
        for (const attr of payload.dangerousAttributes) {
          expect(sanitized.toLowerCase()).not.toContain(`${attr}=`);
        }
      }

      if (payload.dangerousProtocols) {
        for (const proto of payload.dangerousProtocols) {
          expect(sanitized.toLowerCase()).not.toContain(`href="${proto}`);
          expect(sanitized.toLowerCase()).not.toContain(`href='${proto}`);
        }
      }
    }
  });

  it('isSafeUrl should only accept http, https, mailto, tel and relative paths', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://localhost:3000')).toBe(true);
    expect(isSafeUrl('mailto:test@example.com')).toBe(true);
    expect(isSafeUrl('/docs/guide.md')).toBe(true);
    expect(isSafeUrl('./relative.md')).toBe(true);
    expect(isSafeUrl('#section-1')).toBe(true);

    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
    expect(isSafeUrl('javascript\n:alert(1)')).toBe(false);
  });

  it('sanitizeSvg should purge malicious scripts and handlers from SVGs', () => {
    const maliciousSvg = `<svg onload="alert(1)"><script>alert(2)</script><rect width="10" height="10"/></svg>`;
    const safeSvg = sanitizeSvg(maliciousSvg);

    expect(safeSvg).not.toContain('<script');
    expect(safeSvg).not.toContain('onload=');
    expect(safeSvg).toContain('<rect');
  });
});
