/**
 * @fileoverview Unit tests for which origins may open a Socket.io connection
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * Android's WebSocket sends an Origin made from the URL it connects to, so
 * the app's connections arrive with Origin https://api.aryv-app.com. That
 * was not in CORS_ORIGIN, and every one was refused.
 */

import { SocketService } from '../../services/SocketService';

describe('SocketService.isSameOrigin', () => {
  it("accepts the server's own address, as Android's WebSocket sends it", () => {
    expect(SocketService.isSameOrigin('https://api.aryv-app.com', { host: 'api.aryv-app.com' })).toBe(true);
    expect(SocketService.isSameOrigin('https://API.aryv-app.com', { host: 'api.aryv-app.com' })).toBe(true);
  });

  it('accepts it when a proxy forwards the public host', () => {
    expect(SocketService.isSameOrigin('https://api.aryv-app.com', {
      host: 'aryv-platform.railway.internal:8080', 'x-forwarded-host': 'api.aryv-app.com',
    })).toBe(true);
  });

  it('refuses other sites and malformed origins', () => {
    expect(SocketService.isSameOrigin('https://evil.example', { host: 'api.aryv-app.com' })).toBe(false);
    expect(SocketService.isSameOrigin('https://api.aryv-app.com.evil.example', { host: 'api.aryv-app.com' })).toBe(false);
    expect(SocketService.isSameOrigin('null', { host: 'api.aryv-app.com' })).toBe(false);
    expect(SocketService.isSameOrigin('https://api.aryv-app.com', {})).toBe(false);
  });
});
