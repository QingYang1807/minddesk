import { test, expect } from '@playwright/test'
import { createDocument, addNode } from '../../packages/core/src/document'
import { templates } from '../../packages/core/src/templates'
const openDocument = async (page: import('@playwright/test').Page, title: string) => {
  await page.goto('/')
  await page.getByRole('button', { name: title, exact: true }).last().click()
  await expect(page.getByLabel('图纸名称')).toHaveValue(title)
}

test('keyboard creation saves and reopens; undo and view changes preserve data', async ({
  page,
  request,
}) => {
  const title = `验收·连续输入 ${Date.now()}`,
    doc = createDocument(title)
  await request.post('/api/documents', { data: doc })
  await openDocument(page, title)
  await page.locator('.react-flow__node').first().click()
  await page.keyboard.press('Tab')
  await page.getByLabel('编辑节点').fill('用户研究')
  await page.getByLabel('编辑节点').press('Enter')
  await page.keyboard.press('Tab')
  await page.getByLabel('编辑节点').fill('深入访谈')
  await page.getByLabel('编辑节点').press('Enter')
  await expect(page.locator('.react-flow__node')).toHaveCount(3)
  await page.keyboard.press('Meta+z')
  await expect(page.locator('.react-flow__node')).toHaveCount(3)
  await page.keyboard.press('Meta+Shift+z')
  await expect(page.getByText('已保存 · 本地')).toBeVisible()
  const saved = await (await request.get(`/api/documents/${doc.documentId}`)).json()
  expect(saved.document.nodes.map((n: { text: string }) => n.text)).toEqual([title, '用户研究', '深入访谈'])
  await page.getByRole('button', { name: '大纲', exact: true }).click()
  await expect(page.locator('.outline-view .outline-row')).toHaveCount(3)
  await page.getByRole('button', { name: 'WBS 任务', exact: true }).click()
  await expect(page.locator('.task-row')).toHaveCount(2)
  await page.getByRole('button', { name: '画布', exact: true }).click()
  await page.getByLabel('布局', { exact: true }).selectOption('tree')
  await page.getByLabel('主题', { exact: true }).selectOption('dark')
  await expect(page.getByText('已保存 · 本地')).toBeVisible()
  const after = await (await request.get(`/api/documents/${doc.documentId}`)).json()
  expect(after.document.nodes).toEqual(saved.document.nodes)
  await page.reload()
  await page.getByRole('button', { name: title, exact: true }).last().click()
  await expect(page.getByLabel('主题', { exact: true })).toHaveValue('dark')
  await page.getByRole('button', { name: '导出', exact: true }).click()
  await expect(page.getByAltText('导出预览')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出文件' }).click()
  expect((await download).suggestedFilename()).toContain('.svg')
})

test('five-level markdown previews before creation and invalid JSON preserves library', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /从文本创建/ }).click()
  await page
    .getByLabel('导入内容')
    .fill('# 五级导入验收\n## 分类\n- 子项\n  - 第三层\n    - 第四层\n      - 第五层')
  await page.getByRole('button', { name: '校验与预览' }).click()
  await expect(page.getByAltText('五级导入验收')).toBeVisible()
  await page.getByRole('button', { name: '创建图纸', exact: true }).click()
  await expect(page.locator('.react-flow__node')).toHaveCount(6)
})

test('screenshots for 30, 80, 150 nodes, layouts, WBS, AI, export and dark theme', async ({
  page,
  request,
}) => {
  await page.goto('/')
  await page.screenshot({ path: 'artifacts/screenshots/01-workspace.png', fullPage: true })
  const blank = createDocument('空白编辑器')
  await request.post('/api/documents', { data: blank })
  await openDocument(page, blank.title)
  await page.screenshot({ path: 'artifacts/screenshots/02-blank.png' })
  for (const count of [30, 80, 150, 200, 500]) {
    const doc = templates[0].create()
    doc.title = `专业产品研发计划 · ${count} 节点`
    doc.nodes[0].text = doc.title
    if (count < doc.nodes.length) doc.nodes = doc.nodes.slice(0, count)
    while (doc.nodes.length < count) {
      const i = doc.nodes.length
      addNode(doc, doc.nodes[1 + (i % 7) * 4]?.id || doc.rootId, `验证工作包 ${i} · 访谈、设计与验收`)
    }
    await request.post('/api/documents', { data: doc })
    await openDocument(page, doc.title)
    await expect(page.locator('.react-flow__node')).toHaveCount(count)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `artifacts/screenshots/map-${count}.png` })
    if (count === 30) {
      for (const layout of ['tree', 'fishbone', 'down']) {
        await page.getByLabel('布局', { exact: true }).selectOption(layout)
        await page.waitForTimeout(450)
        await page.screenshot({ path: `artifacts/screenshots/${layout}.png` })
      }
      await page.getByRole('button', { name: 'WBS 任务', exact: true }).click()
      await page.screenshot({ path: 'artifacts/screenshots/wbs.png' })
      await page.getByRole('button', { name: '画布', exact: true }).click()
      await page.getByLabel('布局', { exact: true }).selectOption('mindmap')
      await page.getByLabel('主题', { exact: true }).selectOption('dark')
      await page.screenshot({ path: 'artifacts/screenshots/dark.png' })
      await page.getByRole('button', { name: '导出', exact: true }).click()
      await page.screenshot({ path: 'artifacts/screenshots/export.png' })
      await page.getByRole('button', { name: '关闭弹窗' }).click()
      await page.getByRole('button', { name: 'AI 助手' }).click()
      await page.screenshot({ path: 'artifacts/screenshots/ai-create.png' })
      await page.getByRole('button', { name: '关闭弹窗' }).click()
    }
  }
})
