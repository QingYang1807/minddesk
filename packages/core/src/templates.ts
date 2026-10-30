import { addNode, createDocument } from './document'
import type { LayoutKind, MindDocument } from './document'
const definitions = [
  {
    id: 'lifecycle',
    name: '产品全生命周期',
    category: '产品规划',
    description: '从洞察到增长，让每个阶段都有清晰的方向。',
    theme: 'creative',
    layout: 'mindmap',
    branches: [
      ['市场与用户研究', '目标用户与使用场景', '用户访谈与痛点', '竞品与市场机会'],
      ['产品定位', '价值主张', '差异化优势', '商业模式假设'],
      ['目标与指标', '北极星指标', '成功标准', '数据采集方案'],
      ['需求与设计', '需求优先级', '用户旅程与原型', '交互与视觉规范'],
      ['技术与研发', '系统架构与接口', '里程碑与任务拆解', '代码评审与集成'],
      ['测试与上线', '功能与性能验证', '灰度发布与回滚', '上线验收清单'],
      ['运营与增长', '用户反馈闭环', '转化与留存实验', '内容与渠道计划'],
      ['复盘与迭代', '目标达成分析', '经验与问题沉淀', '下一阶段路线图'],
    ],
  },
  {
    id: 'architecture',
    name: '软件架构设计',
    category: '技术设计',
    description: '连接业务目标、架构决策与工程约束。',
    theme: 'executive',
    layout: 'right',
    branches: [
      ['业务目标', '核心用户旅程', '领域边界', '规模预期'],
      ['功能架构', '核心服务', '外部集成', '权限模型'],
      ['技术架构', '服务划分', 'API 契约', '部署拓扑'],
      ['数据架构', '数据模型', '一致性策略', '备份与恢复'],
      ['非功能需求', '可用性 SLO', '性能预算', '容量规划'],
      ['安全与隐私', '威胁建模', '数据分类', '审计策略'],
      ['运维与演进', '可观测性', '故障应急', '迁移路线'],
    ],
  },
  {
    id: 'wbs',
    name: '项目 WBS 任务拆解',
    category: '项目管理',
    description: '从项目目标到可验收的工作包。',
    theme: 'consulting',
    layout: 'down',
    branches: [
      ['启动与规划', '目标与范围确认', '干系人访谈', '里程碑基线'],
      ['需求工作包', '需求调研', '需求规格评审', '需求验收'],
      ['设计工作包', '技术方案', '接口契约', '设计评审'],
      ['实现工作包', '核心功能开发', '集成验证', '代码质量检查'],
      ['验证工作包', '测试计划', '缺陷闭环', '性能验证'],
      ['交付工作包', '部署手册', '用户验收', '项目复盘'],
    ],
  },
  {
    id: 'rca',
    name: '软件系统故障根因分析',
    category: '思考方法',
    description: '区分现象、原因假设与证据，找到下一步验证动作。',
    theme: 'consulting',
    layout: 'fishbone',
    branches: [
      ['人员与协作', '值班交接遗漏？', '知识覆盖不足？', '操作复核缺失？'],
      ['流程与变更', '发布审批缺失？', '回滚流程未演练？', '变更窗口冲突？'],
      ['应用与代码', '并发竞争？', '资源未释放？', '异常处理不足？'],
      ['基础设施', '容量不足？', '网络抖动？', '磁盘延迟？'],
      ['数据与依赖', '上游超时？', '数据倾斜？', '缓存失效？'],
      ['监控与测试', '告警覆盖不足？', '测试场景缺失？', '观测盲区？'],
    ],
  },
  {
    id: 'agent',
    name: 'AI Agent 应用设计',
    category: 'AI 工程',
    description: '让智能体从演示走向可靠的真实工作流。',
    theme: 'creative',
    layout: 'mindmap',
    branches: [
      ['场景与目标', '用户任务', '输入输出边界', '成功指标'],
      ['工具与权限', '工具注册', '最小权限', '人工确认点'],
      ['上下文工程', '检索与引用', '窗口预算', '压缩策略'],
      ['记忆系统', '短期工作记忆', '长期知识', '遗忘与更新'],
      ['工作流与模型', '任务规划', '模型路由', '失败恢复'],
      ['评测与观测', '黄金数据集', '执行轨迹', '成本与延迟'],
      ['安全与治理', '提示注入防护', '敏感信息处理', '审计与回放'],
    ],
  },
  {
    id: 'decision',
    name: '技术方案决策',
    category: '思考方法',
    description: '让约束、取舍与结论经得起讨论。',
    theme: 'executive',
    layout: 'tree',
    branches: [
      ['目标与约束', '业务成功标准', '预算与交期', '现有技术栈'],
      ['备选方案', '方案 A：自建', '方案 B：开源', '方案 C：托管服务'],
      ['评价标准', '功能适配', '维护成本', '扩展与迁移'],
      ['成本与收益', '初始投入', '持续成本', '预期收益假设'],
      ['风险与假设', '供应商锁定', '团队学习曲线', '待验证假设'],
      ['实验与结论', '最小验证实验', '评价记录', '决策与复查时间'],
    ],
  },
] as const
export const templates = definitions.map((t) => ({
  ...t,
  create: (): MindDocument => {
    const doc = createDocument(t.name)
    doc.description = t.description
    doc.theme = t.theme
    doc.viewSettings.layout = t.layout as LayoutKind
    t.branches.forEach((b) => {
      const parent = addNode(doc, doc.rootId, b[0])
      b.slice(1).forEach((text) => {
        const node = addNode(doc, parent.id, text)
        if (t.id === 'wbs') {
          node.type = 'task'
          node.task = { status: 'todo', acceptanceCriteria: '请填写可验证的交付条件' }
        }
        if (t.id === 'rca') {
          node.evidence.status = 'hypothesis'
          node.note = '待验证：请补充日志、实验或现场证据'
        }
      })
    })
    return doc
  },
}))
export function methodDocument(method: string) {
  if (method === '5 Whys') {
    const doc = createDocument('5 Whys · 从现象到验证')
    let parent = doc.rootId
    ;[
      '问题：具体发生了什么？',
      '直接原因是什么？',
      '为什么会出现这个原因？',
      '更深层的机制是什么？',
      '潜在根因假设',
      '验证方案与反例',
    ].forEach((text) => {
      const n = addNode(doc, parent, text)
      n.evidence.status = 'hypothesis'
      parent = n.id
    })
    return doc
  }
  const doc = templates[method === 'WBS' ? 2 : method === 'RCA' ? 3 : method === '决策分析' ? 5 : 0].create()
  if (method === 'MECE') {
    doc.title = 'MECE · 结构化问题拆解'
    doc.nodes[0].text = doc.title
    doc.description = '检查分类是否重叠、是否遗漏，以及拆解粒度是否一致。'
  }
  return doc
}
