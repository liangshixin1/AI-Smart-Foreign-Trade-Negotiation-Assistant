# 6-1 合同事实审校表（阶段 A）

状态：已获教学确认；本文件只记录事实冻结，不包含错误题或私有标准答案。

## 已有来源支持的事实

| fact ID | 值 |
| --- | --- |
| `contract_number` | "NT-SC-2027-0118" |
| `applicant.name` | "Shanghai Hanlin Trading Co., Ltd." |
| `beneficiary.name` | "NovaTech Display Solutions Pte. Ltd." |
| `goods.product` | "NT-IM250 LED display modules" |
| `goods.quantity` | 800 |
| `goods.unit` | "piece" |
| `amount.currency` | "USD" |
| `amount.unit_price` | "285.00" |
| `amount.total` | "228000.00" |
| `goods.incoterm` | "CIF" |
| `goods.incoterm_place` | "Shanghai" |
| `goods.incoterms_version` | "2020" |
| `payment.method` | "100% irrevocable documentary credit at sight" |
| `shipment.days_after_receipt` | 40 |
| `shipment.partial_shipments` | "NOT ALLOWED" |
| `shipment.transshipment` | "ALLOWED" |
| `shipment.transshipment_via` | "Hong Kong" |
| `shipment.transshipment_condition` | "Must not delay the contracted delivery" |
| `contract_only.added_services` | ["One-year spare parts package", "Remote technical support"] |

40天是成交后条款；45天是早期报价/通用背景，保留历史，不能全局替换。5-2允许不同协商路径，新6-1仅采用工单指定的标准场景，不声称学生前关实际已经达成该协议。

## 已确认的新增设定

以下设定已确认，可供后续错误清单和评分规则引用。

| fact ID | 建议值 | 原因 |
| --- | --- | --- |
| `party_address_scope` | "Use Singapore / Shanghai, China as locality only; do not invent street addresses; assess beneficiary name only" | No approved street addresses found in the four source prompts. |
| `shipment.receipt_date` | "2027-03-06" | New teaching date; receipt day excluded, plus 40 calendar days = 2027-04-15. |
| `document.issue_date` | "2027-03-05" | New teaching date, before receipt. |
| `shipment.latest_date` | "2027-04-15" | 5-2 deadline, consistent with proposed receipt date. |
| `presentation.period_days` | 21 | New explicit case agreement; not inferred from old prompts. |
| `presentation.expiry_date` | "2027-05-06" | Proposed latest shipment date plus 21 calendar days; early shipment uses actual shipment date. |
| `presentation.expiry_place` | "Singapore" | New explicit teaching setting; bank and calendar handling still to be defined. |
| `shipment.ports` | {"loading": "Singapore", "discharge": "Shanghai"} | 5-2 logistics context; freeze as explicit case facts. |
| `documents_required` | ["Signed commercial invoice: 3 originals", "Packing list: 3 copies", "Full set clean on-board ocean bills of lading, freight prepaid, to order of issuing bank, notify applicant", "Insurance policy or certificate: 110% invoice value, USD, Institute Cargo Clauses (C)"] | New teaching document list, not an already approved contract extract; precise template parameters need approval. |
| `contract_only.warranty` | "Do not put warranty, spare-parts or remote-support certification requirements in the LC" | Keep service obligations in the contract; no independently approved warranty duration. |
| `student_role` | "Buyer-side trade documentation reviewer; compare the seller-received LC copy with fixed contract and draft amendment instructions" | Preserves learner buyer identity; draft does not make an amendment effective. |

日期建议：2027-03-05开证，03-06收证；收证日不计入，自次日起40个日历日，最迟04-15装运；交单期21天，05-06在新加坡到期。此处是拟新增的教学事实，并非已存在的合同日期。

单据建议：签署商业发票3份正本、装箱单3份副本、全套清洁已装船海运提单（运费预付、开证行指示抬头、通知买方）、发票金额110%的美元保险单或保险凭证（ICC C）。不能把该建议宣称为所有CIF交易的唯一要求。

姓名使用现有全称，地点仅新加坡/中国上海，不编造街道；本版只考查受益人名称。服务与质保留在合同，不新增要求证明这些服务的信用证单据。

## 模式边界

仅目标小节的新发布内容可绑定 lc_correction。training_mode仍为document_review；experience_mode仍为chat/simulation。没有document profile的旧Attempt保留旧模式。新功能默认关闭。

## 来源（已记录原文件 SHA-256）

- `content/prompts/conversation/conversation-chapter-4-section-1.yaml`
- `content/prompts/conversation/conversation-chapter-4-section-2.yaml`
- `content/prompts/conversation/conversation-chapter-5-section-2.yaml`
- `content/prompts/conversation/conversation-chapter-6-section-1.yaml`
