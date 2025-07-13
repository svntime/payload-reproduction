import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { postStatusOptions } from '_community/collections/Posts/index.js'
import * as path from 'path'
import { fileURLToPath } from 'url'

import { ensureCompilationIsDone, initPageConsoleErrorCatch } from '../helpers.js'
import { AdminUrlUtil } from '../helpers/adminUrlUtil.js'
import { initPayloadE2ENoConfig } from '../helpers/initPayloadE2ENoConfig.js'
import { TEST_TIMEOUT_LONG } from '../playwright.config.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

test.describe('Community', () => {
  let page: Page
  let url: AdminUrlUtil

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT_LONG)

    const { payload, serverURL } = await initPayloadE2ENoConfig({ dirname })
    url = new AdminUrlUtil(serverURL, 'posts')

    const context = await browser.newContext()
    page = await context.newPage()
    initPageConsoleErrorCatch(page)
    await ensureCompilationIsDone({ page, serverURL })
  })

  test('all selected rows are updated with bulk update', async () => {
    await page.goto(url.list)

    await page.getByRole('row', { name: 'Post 50' }).getByRole('checkbox').click()
    await page.getByRole('row', { name: 'Post 49' }).getByRole('checkbox').click()
    await page.getByRole('textbox').fill('Post 21')
    await page.getByRole('row', { name: 'Post 21' }).getByRole('checkbox').click()

    // Confirm selection summary
    await expect(page.getByText('selected')).toHaveText('3 selected')

    // Bulk update flow
    await page.getByRole('button', { name: 'Edit' }).click()
    await page
      .locator('div')
      .filter({ hasText: /^Select a value$/ })
      .nth(1)
      .click()
    await page.getByRole('option', { name: 'Status' }).click()
    await page
      .locator('div')
      .filter({ hasText: /^Select a value$/ })
      .nth(1)
      .click()
    await page.getByRole('option', { name: postStatusOptions.important.value }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // this will fail, because Payload includes search query param in PATCH request
    // where[and][0][or][0][title][like] = post 21
    await expect(page.locator('text=Updated 3 Posts successfully.')).toBeVisible()
  })
})
