/**
 * @test LoginPage - No Hardcoded Credentials
 * @description Verifica que o LoginPage NAO contem credenciais pre-preenchidas
 *
 * @type Unit
 *
 * AIDEV-SECURITY: Este teste garante que credenciais de dev nao vazem para producao
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('LoginPage - Security', () => {
  const loginSource = readFileSync(
    resolve(__dirname, '../../../../src/renderer/pages/Login.tsx'),
    'utf-8',
  );

  it('should NOT contain hardcoded email credentials', () => {
    // Verifica que nenhum useState inicializa com email hardcoded
    const emailStateRegex = /useState\s*\(\s*['"][^'"]*@[^'"]*['"]\s*\)/;
    expect(loginSource).not.toMatch(emailStateRegex);
  });

  it('should NOT contain hardcoded password credentials', () => {
    // Verifica que nenhum useState inicializa com senha hardcoded
    // Procura useState com string nao-vazia que nao seja null
    const passwordPatterns = [
      /useState\s*\(\s*'(?!')[^']+'\s*\).*password/i,
      /password.*useState\s*\(\s*'(?!')[^']+'\s*\)/i,
    ];

    // Abordagem mais direta: busca linhas com "password" e useState com valor
    const lines = loginSource.split('\n');
    const passwordLines = lines.filter(
      (line) =>
        line.toLowerCase().includes('password') &&
        line.includes('useState') &&
        /useState\s*\(\s*['"][^'"]+['"]\s*\)/.test(line),
    );

    expect(passwordLines).toHaveLength(0);
  });

  it('should initialize email and password as empty strings', () => {
    // Verifica que as linhas de useState para email e password usam string vazia
    const lines = loginSource.split('\n');

    const emailLine = lines.find(
      (l) => /\[email/.test(l) && l.includes('useState('),
    );
    const passwordLine = lines.find(
      (l) => /\[password/.test(l) && l.includes('useState('),
    );

    expect(emailLine).toBeDefined();
    expect(passwordLine).toBeDefined();
    expect(emailLine).toMatch(/useState\s*\(\s*['"]{2}\s*\)/);
    expect(passwordLine).toMatch(/useState\s*\(\s*['"]{2}\s*\)/);
  });

  it('should NOT contain AIDEV-TODO about removing dev credentials', () => {
    expect(loginSource).not.toContain('Remover credenciais de dev');
  });
});
