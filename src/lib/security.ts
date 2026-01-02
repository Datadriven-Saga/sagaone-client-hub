/**
 * Validates a webhook URL to prevent SSRF attacks
 * Blocks localhost, private IPs, and cloud metadata endpoints
 */
export function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Apenas URLs HTTPS são permitidas' };
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost variations
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname.startsWith('127.') ||
        hostname === '0.0.0.0' ||
        hostname === '::1') {
      return { valid: false, error: 'URLs localhost não são permitidas' };
    }
    
    // Block private IP ranges (RFC 1918)
    const ipv4Parts = hostname.split('.');
    if (ipv4Parts.length === 4 && ipv4Parts.every(p => !isNaN(parseInt(p)))) {
      const first = parseInt(ipv4Parts[0]);
      const second = parseInt(ipv4Parts[1]);
      
      if (first === 10 ||                                    // 10.0.0.0/8
          (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12
          (first === 192 && second === 168) ||               // 192.168.0.0/16
          (first === 169 && second === 254)) {               // Link-local
        return { valid: false, error: 'IPs privados não são permitidos' };
      }
    }
    
    // Block cloud metadata endpoints
    const blockedHosts = [
      '169.254.169.254',
      'metadata.google.internal',
      'metadata',
      'instance-data',
    ];
    
    if (blockedHosts.some(blocked => hostname.includes(blocked))) {
      return { valid: false, error: 'Endpoints de metadata não são permitidos' };
    }
    
    // Block internal services
    const internalServices = [
      'supabase-kong',
      'supabase-db',
      'postgres',
      'postgresql',
      'internal',
    ];
    
    if (internalServices.some(service => hostname.includes(service))) {
      return { valid: false, error: 'Serviços internos não são permitidos' };
    }
    
    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Formato de URL inválido' };
  }
}
