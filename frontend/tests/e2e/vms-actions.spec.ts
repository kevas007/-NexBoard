import { test, expect } from '@playwright/test';

test.describe('VMs - actions de base', () => {
  test.beforeEach(async ({ page }) => {
    // Seed: simuler qu'on est en dev
    await page.addInitScript(() => {
      // Forcer le thème et vider éventuels toasts
      localStorage.setItem('theme', 'dark');
    });
    await page.goto('/');
    // Attendre que la page se charge
    await page.waitForLoadState('networkidle');
    // Aller sur la page VMs via la sidebar
    let vmsLink = page.getByRole('button', { name: /machines virtuelles|virtual machines/i }).first();
    if (!(await vmsLink.isVisible().catch(() => false))) {
      vmsLink = page.getByRole('button', { name: /vm/i }).first();
    }
    await vmsLink.click({ timeout: 5000 }).catch(() => {
      // Fallback: essayer de déclencher l'événement de navigation
      page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'vms' }));
      });
    });
    // Attendre que la page VMs se charge
    await page.waitForLoadState('networkidle');
    // Attendre un peu pour que React rende la page
    await page.waitForTimeout(1000);
  });

  test('affiche et clique sur "Console" et voit un toast', async ({ page }) => {
    // Attendre qu'une carte VM s'affiche
    await expect(page.getByRole('heading', { name: /Machines virtuelles|Virtual Machines/i })).toBeVisible({ timeout: 10000 });
    // Cliquer sur un bouton Console
    const consoleBtn = page.getByRole('button', { name: /console/i }).first();
    await consoleBtn.click();
    // Attendre un toast de succès/attention
    await expect(
      page.getByText(/Console ouverte|fenêtre.*bloquée|Configurez Proxmox/i)
    ).toBeVisible({ timeout: 5000 });
  });
});


