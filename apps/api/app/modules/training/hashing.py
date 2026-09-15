# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途与原因: 对结构化内容进行稳定序列化并计算摘要; 用于比较快照和幂等请求, 键顺序变化不
# [导读] 应导致不同摘要。
# [导读] 结构: stable_hash。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
import hashlib
import json


# [导读] 排序键后计算内容摘要, 用来识别同一业务内容; 它用于一致性核验, 不用于加密隐藏原文。
def stable_hash(payload: object) -> str:
    value = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(value.encode()).hexdigest()
