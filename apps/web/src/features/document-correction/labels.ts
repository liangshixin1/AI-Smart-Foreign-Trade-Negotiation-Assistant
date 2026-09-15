/* [组件导读]
 * 业务名词：信用证是银行按约定单据付款的承诺；MT700 是本项目的信用证报文样式；批注是学生提出的改证意见。
 * 用途：将信用证事实编号、输入项和值转换为中文显示。
 * 为什么与边界：编号用于证据关联，中文名称用于阅读；显示改名不能直接改合同事实编号。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
export function display(value: unknown): string {
  if (value === null || value === undefined) return '未填写'
  if (Array.isArray(value)) return value.map(display).join('；')
  if (typeof value === 'object')
    return Object.entries(value)
      .map(([key, v]) => `${inputLabel(key)}: ${display(v)}`)
      .join('\n')
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '未填写'
}
const labels: Record<string, string> = {
  name: '公司名称',
  address: '地址/地点',
  currency: '币种',
  amount: '金额',
  product: '产品',
  quantity: '数量',
  unit: '单位',
  unit_price: '单价',
  incoterm: '贸易术语',
  place: '地点',
  incoterms_version: '规则年份',
  expiry_date: '有效期',
  expiry_place: '到期地点',
  period_days: '交单天数',
  action: '处理方式',
  template: '条款模板',
  parameter: '参数',
  contract_number: '合同编号',
  'applicant.name': '申请人',
  'beneficiary.name': '受益人',
  'goods.product': '货物',
  'goods.quantity': '数量',
  'goods.unit': '单位',
  'amount.currency': '币种',
  'amount.unit_price': '单价',
  'amount.total': '合同总额',
  'goods.incoterm': '贸易术语',
  'goods.incoterm_place': '贸易术语地点',
  'goods.incoterms_version': 'Incoterms版本',
  'payment.method': '付款方式',
  'shipment.days_after_receipt': '收证后装运天数',
  'shipment.partial_shipments': '分批装运',
  'shipment.transshipment': '转船',
  'shipment.transshipment_via': '转船地点',
  'shipment.transshipment_condition': '转船条件',
  'shipment.receipt_date': '收证日',
  'document.issue_date': '开证日',
  'shipment.latest_date': '最迟装运日',
  'presentation.period_days': '交单期',
  'presentation.expiry_date': '有效期',
  'presentation.expiry_place': '到期地点',
  documents_required: '合同单据清单',
  'contract_only.added_services': '合同增值服务',
  'contract_only.warranty': '服务与质保范围',
  'shipment.ports': '装卸港',
  student_role: '本次任务身份',
  party_address_scope: '主体核验范围',
}
export function inputLabel(key: string): string {
  return labels[key] ?? key
}
export const factLabel = inputLabel
