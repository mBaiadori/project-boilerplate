/**
 * Corpus representativo de payloads XSS comuns para testes de segurança da UI.
 */
export const XSS_PAYLOADS = [
  {
    name: 'script tag',
    raw: '<script>alert(1)</script>',
    dangerousTags: ['script'],
  },
  {
    name: 'img onerror',
    raw: '<img src="invalid-image" onerror="alert(1)">',
    dangerousAttributes: ['onerror'],
  },
  {
    name: 'svg onload',
    raw: '<svg onload="alert(1)"><circle r="10"/></svg>',
    dangerousAttributes: ['onload'],
  },
  {
    name: 'javascript url in link',
    raw: '<a href="javascript:alert(1)">Click here</a>',
    dangerousProtocols: ['javascript:'],
  },
  {
    name: 'vbscript url',
    raw: '<a href="vbscript:msgbox(1)">Click</a>',
    dangerousProtocols: ['vbscript:'],
  },
  {
    name: 'iframe with srcdoc',
    raw: '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    dangerousTags: ['iframe'],
  },
  {
    name: 'data text/html link',
    raw: '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click</a>',
    dangerousProtocols: ['data:'],
  },
  {
    name: 'onload in body/style/svg',
    raw: '<body onload="alert(1)">Body text</body>',
    dangerousAttributes: ['onload'],
  },
];
