# 可复制的 AI 生成提示词

请作为专业信息架构师，为以下主题生成 Mind Desk v1.0 思维导图：

**主题：在这里写你的需求**
**分析方式：自由脑暴 / MECE / 产品规划 / 根因分析 / WBS / 决策分析**

只输出一个 JSON 对象，不要 Markdown 代码围栏。建议 4–8 个一级分类，每类 2–5 个子节点，按需要继续拆解。节点文字短而清晰；解释放在 note。分类尽量完整、互斥、粒度相近。不编造事实、统计、证据、负责人、日期或验证结论；未知属性保持空，推测标为 hypothesis。

遵循这个结构（用你生成的稳定唯一 ID 替换示例 ID）：

```json
{
  "schemaVersion": "1.0",
  "documentId": "doc-example-001",
  "title": "主题标题",
  "description": "分析目的与边界",
  "createdAt": "2026-10-30T00:00:00.000Z",
  "updatedAt": "2026-10-30T00:00:00.000Z",
  "rootId": "root",
  "nodes": [
    {
      "id": "root", "parentId": null, "order": 0, "text": "主题标题",
      "note": "", "type": "topic", "tags": [], "icon": "", "style": {},
      "collapsed": false, "task": {},
      "evidence": {"status": "unverified", "source": "", "verification": ""},
      "metadata": {}
    },
    {
      "id": "branch-1", "parentId": "root", "order": 0, "text": "第一个分类",
      "note": "分类说明", "type": "topic", "tags": [], "icon": "", "style": {},
      "collapsed": false, "task": {},
      "evidence": {"status": "suggestion", "source": "", "verification": ""},
      "metadata": {}
    }
  ],
  "relations": [],
  "viewSettings": {"view": "map", "layout": "mindmap", "edge": "natural", "positions": {}},
  "theme": "creative"
}
```

根节点只能有一个，parentId 为 null。每个非根节点必须引用已有父节点，不能形成环，order 按同级从 0 递增。跨节点引用单独放 relations：`{"id":"rel-1","sourceId":"a","targetId":"b","type":"dependency","label":"依赖"}`。

任务的 type 可设 task，task 可填写 status、priority、owner、startDate、dueDate、estimate、acceptanceCriteria。没有依据的属性不要生成。根因分析使用 fishbone 布局，根节点代表问题结果，一级主题代表原因分类，其下为待验证原因。可用主题：creative、executive、consulting、dark；可用布局：mindmap、right、tree、down、compact、fishbone。

生成后自行检查 ID 唯一、无环、父引用有效、关系端点有效、只有一个根。用户会在 Mind Desk 导入界面校验和预览后再保存。
