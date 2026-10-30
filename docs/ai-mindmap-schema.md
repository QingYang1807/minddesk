# Mind Desk JSON v1.0

机器约束在 `mind-desk.schema.json`，运行时通过 Zod 加结构约束共同验证。`schemaVersion` 当前只接受字符串 `1.0`，其他版本明确拒绝，未来通过显式迁移函数升级，不默默猜测旧格式。

## 文档

`documentId` / `rootId` 为非空稳定 ID；`title`、`description` 为文字；`createdAt` / `updatedAt` 为 ISO 日期；`nodes` 为扁平节点数组（1–5000）；`relations` 为跨节点引用；`theme` 为 executive / consulting / creative / dark。

`viewSettings`：`view` 为 map / outline / wbs；`layout` 为 mindmap / right / tree / down / compact / fishbone；`edge` 为 natural / minimal / orthogonal / thin；`positions` 是每种布局独立的节点相对偏移映射，生成时填 `{}`。

## 节点

| 字段 | 约定 |
|---|---|
| id | 文档内唯一，后续编辑不重新生成 |
| parentId | 根为 null，其余必须引用存在节点 |
| order | 同级数字排序；相同值再按 ID 稳定排序 |
| text | 非空，最多 10000 字符，建议简短 |
| note | 详细说明；不挤入主题 |
| type | topic / important / warning / conclusion / note / task |
| tags / icon | 字符串数组 / 图标字符 |
| style | `{emphasis?: boolean}`，保留扩展入口 |
| collapsed | 布尔值 |
| task | 见下方，缺失属性不推测填写 |
| evidence | `{status, source, verification}` |
| metadata | 任意 JSON 对象，应用保留 |

`task` 的所有属性可选：status（todo/doing/done/blocked）、priority（low/medium/high/urgent）、owner、startDate、dueDate、estimate、acceptanceCriteria。日期建议 YYYY-MM-DD，工作量为带单位文字。

`evidence.status`：unverified / fact / hypothesis / suggestion。`fact` 只代表用户或模型声称为事实，不是系统认证；必须核实来源。未知原因写 hypothesis，不编造实验结论。

## 关系与完整性

`relations` 每项为 `{id, sourceId, targetId, type, label}`。父子结构只通过 `parentId` 定义，不能用 relations 替代。关系两端必须存在，业务允许多种关系类型。

额外检查：一个根、根 ID 正确、ID 唯一、无父子环、无孤儿、有效关联端点。错误指出字段路径和原因。导入不兼容格式明确报错。Markdown 仅承载内容层级；完整无损保存使用 JSON。

## AI 修改

创建操作返回完整 Document。其他操作返回：

```json
{"suggestions":[{"kind":"add","parentId":"已有节点ID","text":"建议的新主题","note":"详细说明","reason":"指出遗漏及原因","classification":"hypothesis"}]}
```

kind 支持 add / update / remove / move。update/remove/move 要有 nodeId；add/move 要有有效 parentId；add 要有 text。classification 为 fact / hypothesis / suggestion。后台先在副本上校验整批建议；前端对用户选择的子集再次校验，全部成功后一次写入历史。删除根、循环移动、无效引用均拒绝。每次应用可整体撤销。
