/**
 * 分身资料引导填写：题库 + 答案存取
 *
 * 答案以 kind:'memory' + tag:'profile' + qid 存进 ai_twin 单集合（不加新表），
 * 对话时经 formatMemoryDigest 注入（profile 优先排序）。
 */

import { addMemory } from '@/api/aiTwin'

export const PROFILE_TAG = 'profile'

export const PROFILE_QUESTIONS = [
  { id: 'pq_call', label: '我是谁', text: '怎么称呼你？', hint: '名字、昵称或想要的称呼', memLabel: '称呼' },
  { id: 'pq_job', label: '我是谁', text: '你的职业或身份是？', hint: '如：程序员 / 自由职业 / 学生', memLabel: '职业' },
  { id: 'pq_city', label: '我是谁', text: '你在哪个城市生活？', hint: '可精确到区', memLabel: '生活城市' },
  { id: 'pq_birthday', label: '我是谁', text: '你的生日是？', hint: '如：1995-08-23，农历可备注', memLabel: '生日' },
  { id: 'pq_look', label: '外貌形象', text: '你的长相有什么特点？', hint: '身高体型、发型、眼镜等', memLabel: '长相特点' },
  { id: 'pq_wear', label: '外貌形象', text: '平时喜欢穿什么风格？', hint: '如：正装 / 休闲运动', memLabel: '穿着风格' },
  { id: 'pq_char', label: '性格说话', text: '用几个词形容你的性格？', hint: '如：外向、拖延、完美主义', memLabel: '性格' },
  { id: 'pq_talk', label: '性格说话', text: '你的口头禅或说话习惯？', hint: '如：爱说"绝了"、说话直接', memLabel: '说话习惯' },
  { id: 'pq_others', label: '性格说话', text: '朋友眼中你是什么样的人？', hint: '别人对你的常见评价', memLabel: '他人眼中' },
  { id: 'pq_phrase1', label: '语气样本', text: '随手发一句你最常说的话？', hint: '原样打出来，别修饰，如：绝了、干饭去', memLabel: '口头禅样本' },
  { id: 'pq_phrase2', label: '语气样本', text: '再发一句，别人一听就认出是你的？', hint: '最有你个人味道的一句', memLabel: '口头禅样本' },
  { id: 'pq_phrase3', label: '语气样本', text: '你兴奋或不耐烦时会怎么说？', hint: '两种场景各写一句，用换行分隔', memLabel: '口头禅样本' },
  { id: 'pq_family', label: '重要的人', text: '家里有谁？怎么称呼？', hint: '如：父母、伴侣、孩子', memLabel: '家人' },
  { id: 'pq_friend', label: '重要的人', text: '最要好的朋友是谁？', hint: '称呼 + 怎么认识的', memLabel: '挚友' },
  { id: 'pq_workmate', label: '重要的人', text: '工作中常打交道的人？', hint: '称呼 + 关系', memLabel: '同事' },
  { id: 'pq_routine', label: '生活作息', text: '平时几点起床、几点睡？', hint: '如：7点半起，1点睡', memLabel: '作息' },
  { id: 'pq_weekly', label: '生活作息', text: '每周有哪些固定安排？', hint: '如：周五打台球、周日洗车', memLabel: '每周固定安排' },
  { id: 'pq_workrhythm', label: '生活作息', text: '工作节奏是怎样的？', hint: '加班多不多、忙闲时段', memLabel: '工作节奏' },
  { id: 'pq_lovefood', label: '饮食', text: '最爱吃什么？', hint: '菜、零食、饮品都行', memLabel: '爱吃' },
  { id: 'pq_hatefood', label: '饮食', text: '有什么不吃或忌口的？', hint: '如：香菜、内脏、辣', memLabel: '忌口' },
  { id: 'pq_restaurant', label: '饮食', text: '常去的店有哪些？', hint: '店名 + 吃什么', memLabel: '常去的店' },
  { id: 'pq_hobby', label: '喜好雷点', text: '平时的爱好是什么？', hint: '如：游戏、健身、钓鱼', memLabel: '爱好' },
  { id: 'pq_hate', label: '喜好雷点', text: '最讨厌什么？', hint: '行为、事物都行', memLabel: '讨厌' },
  { id: 'pq_collect', label: '喜好雷点', text: '有什么收藏或执念？', hint: '如：球鞋、手办、某个习惯', memLabel: '收藏执念' },
  { id: 'pq_year', label: '目标计划', text: '今年最想完成什么？', hint: '1-3 件最重要的事', memLabel: '年度目标' },
  { id: 'pq_doing', label: '目标计划', text: '正在进行中的事有哪些？', hint: '如：减肥、学车、装修', memLabel: '正在进行' },
  { id: 'pq_long', label: '目标计划', text: '长期目标是什么？', hint: '3-5 年维度', memLabel: '长期目标' },
  { id: 'pq_day', label: '事实约定', text: '有什么重要纪念日？', hint: '日期 + 事件', memLabel: '纪念日' },
  { id: 'pq_promise', label: '事实约定', text: '对分身有什么约定或要求？', hint: '如：提醒作息、不许编造', memLabel: '对分身的约定' },
]

/** 从记忆列表算资料进度：{ answeredMap, answered, total } */
export function getProfileProgress(memories) {
  const list = memories || []
  const answeredMap = {}
  for (let i = 0; i < list.length; i++) {
    const m = list[i]
    if (m && m.tag === PROFILE_TAG && m.qid) answeredMap[m.qid] = true
  }
  return {
    answeredMap: answeredMap,
    answered: Object.keys(answeredMap).length,
    total: PROFILE_QUESTIONS.length,
  }
}

/** 保存一题答案：记忆文本统一「【标签】答案」格式，模型直接可读 */
export async function saveProfileAnswer(question, answer) {
  const a = (answer || '').trim()
  if (!a) throw new Error('先写点什么')
  const text = '【' + (question.memLabel || question.label) + '】' + a
  return addMemory(text, PROFILE_TAG, question.id)
}

/** 语气克隆相关的资料题 qid */
const TONE_QIDS = {
  pq_talk: true,
  pq_char: true,
  pq_others: true,
  pq_phrase1: true,
  pq_phrase2: true,
  pq_phrase3: true,
}

/** 从记忆里抽出语气相关条目，拼成高优先级风格指令文本 */
export function buildStyleText(memories) {
  const list = memories || []
  const lines = []
  for (let i = 0; i < list.length; i++) {
    const m = list[i]
    if (m && m.tag === PROFILE_TAG && TONE_QIDS[m.qid] && m.text) lines.push(m.text)
  }
  return lines.join('\n')
}
