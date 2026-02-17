import { expect, test } from '@playwright/test'

test('intro shows live area and twitch link', async ({ page }) => {
  await page.goto('/#/intro')
  await expect(page.getByRole('heading', { name: 'WarChess' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ouvrir le direct Twitch Chess/i })).toHaveAttribute(
    'href',
    /https:\/\/www\.twitch\.tv\/chess/,
  )
})

test('settings theme switch updates root class', async ({ page }) => {
  await page.goto('/#/settings')
  const root = page.locator('html')

  await page.getByText('Impact rouge').click()
  await expect(root).toHaveClass(/theme-halo-red/)

  await page.getByText('Neon cyan').click()
  await expect(root).toHaveClass(/theme-halo-blue/)
})

test('match center renders key actions', async ({ page }) => {
  await page.goto('/#/matchs')
  await expect(page.getByRole('heading', { name: 'Centre des matchs' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nouveau match' })).toBeVisible()
})

test('leaderboard page renders even if api unavailable', async ({ page }) => {
  await page.goto('/#/leaderboard')
  await expect(page.getByRole('heading', { name: 'Classement WarChess' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Lancer un match/i }).first()).toBeVisible()
})
