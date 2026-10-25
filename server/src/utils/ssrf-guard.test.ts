import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isPrivateOrReservedIP, validateUrlForSSRF } from './ssrf-guard.js';

describe('SSRF Guard: Proteção contra Server-Side Request Forgery', () => {
  describe('isPrivateOrReservedIP', () => {
    it('deve identificar loopback IPv4', () => {
      assert.strictEqual(isPrivateOrReservedIP('127.0.0.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('127.0.1.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('127.255.255.254'), true);
    });

    it('deve identificar loopback e unspecified IPv6', () => {
      assert.strictEqual(isPrivateOrReservedIP('::1'), true);
      assert.strictEqual(isPrivateOrReservedIP('::'), true);
      assert.strictEqual(isPrivateOrReservedIP('0:0:0:0:0:0:0:1'), true);
    });

    it('deve identificar link-local de metadados de nuvem (169.254.169.254)', () => {
      assert.strictEqual(isPrivateOrReservedIP('169.254.169.254'), true);
      assert.strictEqual(isPrivateOrReservedIP('169.254.1.1'), true);
    });

    it('deve identificar redes RFC1918 privadas', () => {
      assert.strictEqual(isPrivateOrReservedIP('10.0.0.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('172.16.0.5'), true);
      assert.strictEqual(isPrivateOrReservedIP('172.31.255.255'), true);
      assert.strictEqual(isPrivateOrReservedIP('192.168.1.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('192.168.0.254'), true);
    });

    it('deve identificar IPv4-mapped IPv6', () => {
      assert.strictEqual(isPrivateOrReservedIP('::ffff:127.0.0.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('::ffff:169.254.169.254'), true);
      assert.strictEqual(isPrivateOrReservedIP('::ffff:10.0.0.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('::ffff:7f00:1'), true);
      assert.strictEqual(isPrivateOrReservedIP('::ffff:7f00:0001'), true);
      assert.strictEqual(isPrivateOrReservedIP('0:0:0:0:0:ffff:127.0.0.1'), true);
      assert.strictEqual(isPrivateOrReservedIP('0000:0000:0000:0000:0000:ffff:7f00:0001'), true);
    });

    it('deve permitir IPs públicos legítimos', () => {
      assert.strictEqual(isPrivateOrReservedIP('8.8.8.8'), false);
      assert.strictEqual(isPrivateOrReservedIP('1.1.1.1'), false);
      assert.strictEqual(isPrivateOrReservedIP('140.82.121.4'), false); // GitHub
    });
  });

  describe('validateUrlForSSRF', () => {
    it('deve rejeitar protocolos não HTTP(S)', async () => {
      await assert.rejects(
        () => validateUrlForSSRF('file:///etc/passwd'),
        /Protocolo não permitido/
      );
      await assert.rejects(
        () => validateUrlForSSRF('ftp://example.com'),
        /Protocolo não permitido/
      );
      await assert.rejects(
        () => validateUrlForSSRF('gopher://127.0.0.1:70'),
        /Protocolo não permitido/
      );
    });

    it('deve rejeitar URLs apontando diretamente para localhost ou IPs privados', async () => {
      await assert.rejects(
        () => validateUrlForSSRF('http://127.0.0.1:8080/admin'),
        /Endereço de destino restrito/
      );
      await assert.rejects(
        () => validateUrlForSSRF('http://localhost:3000'),
        /Endereço de destino restrito/
      );
      await assert.rejects(
        () => validateUrlForSSRF('http://169.254.169.254/latest/meta-data/'),
        /Endereço de destino restrito/
      );
      await assert.rejects(
        () => validateUrlForSSRF('http://[::1]:8080'),
        /Endereço de destino restrito/
      );
      await assert.rejects(
        () => validateUrlForSSRF('http://[::ffff:7f00:1]:8080'),
        /Endereço de destino restrito/
      );
      await assert.rejects(
        () => validateUrlForSSRF('http://[0:0:0:0:0:ffff:127.0.0.1]:8080'),
        /Endereço de destino restrito/
      );
    });
  });

  describe('safeFetch (IP Pinning)', () => {
    it('deve rejeitar URL com IP restrito mesmo antes de conectar', async () => {
      const { safeFetch } = await import('./ssrf-guard.js');
      await assert.rejects(
        () => safeFetch('http://127.0.0.1:9999/api'),
        /Endereço de destino restrito/
      );
    });
  });
});
