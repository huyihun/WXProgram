<template>
  <PageRoot :back="false" flush hero fill>
    <view class="home-flip-viewport">
      <view class="home-stage">
        <view class="content content--vip" :style="contentPadStyle">
          <!-- 语录：导航正下方左对齐 -->
          <view class="hero fade-in">
            <text id="homeHeroDesc" class="hero-desc">{{ healingQuote }}</text>
          </view>

          <!-- 分类宫格：留白隐分组 -->
          <view v-for="section in entrySections" :key="section.id" class="entry-section fade-in">
            <view class="entry-list">
              <view
                v-for="item in section.items"
                :key="item.id"
                class="entry-card"
                :class="['size--' + item.size, 'tint--' + item.id]"
                hover-class="entry-card--active"
                @tap="handleEntryTap(item)"
              >
                <view class="entry-icon-box" :class="'ib--' + item.id">
                  <view v-if="item.id === 'notebook'" class="icon-notebook">
                    <view class="icon-notebook-spine" />
                    <view class="icon-notebook-page">
                      <view class="icon-notebook-line" />
                      <view class="icon-notebook-line mid" />
                      <view class="icon-notebook-line short" />
                    </view>
                  </view>
                  <view v-else-if="item.id === 'ledger'" class="icon-ledger">
                    <view class="icon-ledger-ring" />
                    <view class="icon-ledger-core" />
                    <view class="icon-ledger-bars">
                      <view class="bar b1" />
                      <view class="bar b2" />
                      <view class="bar b3" />
                    </view>
                  </view>
                  <view v-else-if="item.id === 'supplies'" class="icon-supplies">
                    <view class="icon-supplies-handle" />
                    <view class="icon-supplies-lid" />
                    <view class="icon-supplies-body" />
                  </view>
                  <view v-else-if="item.id === 'novel'" class="icon-novel">
                    <view class="icon-novel-book">
                      <view class="icon-novel-spine" />
                      <view class="icon-novel-page" />
                    </view>
                  </view>
                  <view v-else-if="item.id === 'wallpaper'" class="icon-wallpaper">
                    <view class="icon-wallpaper-frame" />
                    <view class="icon-wallpaper-pic" />
                  </view>
                  <view v-else-if="item.id === 'resources'" class="icon-resources">
                    <view class="icon-resources-box" />
                    <view class="icon-resources-line l1" />
                    <view class="icon-resources-line l2" />
                  </view>
                  <view v-else-if="item.id === 'serious'" class="icon-serious">
                    <view class="icon-serious-bar" />
                    <view class="icon-serious-dot" />
                  </view>
                  <view v-else-if="item.id === 'diet'" class="icon-diet">
                    <view class="icon-diet-plate" />
                    <view class="icon-diet-leaf" />
                  </view>
                  <view v-else-if="item.id === 'hushen'" class="icon-hushen">
                    <view class="icon-hushen-seal" />
                    <view class="icon-hushen-mark" />
                  </view>
                  <view v-else-if="item.id === 'twin'" class="icon-twin">
                    <view class="icon-twin-face" />
                    <view class="icon-twin-dot" />
                  </view>
                  <view v-else-if="item.id === 'album'" class="icon-album">
                    <view class="fa-back" />
                    <view class="fa-front" />
                  </view>
                  <view v-else-if="item.id === 'theater'" class="icon-theater">
                    <view class="icon-theater-tri" />
                  </view>
                  <view v-else-if="item.id === 'codeAssist'" class="icon-code">
                    <view class="icon-code-left" />
                    <view class="icon-code-slash" />
                    <view class="icon-code-right" />
                  </view>
                </view>
                <view class="entry-text">
                  <text class="entry-name">{{ item.name }}</text>
                  <text v-if="item.size !== 'mini' && item.desc" class="entry-desc">{{ item.desc }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="mood-entry" :style="moodEntryStyle" @tap="moodOpen = true">
      <text v-if="moodEmoji" class="mood-entry-emoji">{{ moodEmoji }}</text>
      <text v-else class="mood-entry-text">心情</text>
    </view>
    <view
      class="ai-float"
      :class="{ dragging: aiDragging, bounce: !aiDragging }"
      :style="aiFloatStyle"
      @touchstart.stop="onAiTouchStart"
      @touchmove.stop.prevent="onAiTouchMove"
      @touchend.stop="onAiTouchEnd"
    >
      <view class="ai-float-ring" />
      <view class="ai-float-core">
        <text class="ai-float-text">AI</text>
      </view>
    </view>

    <MoodPicker :show="moodOpen" @close="moodOpen = false" @change="onMoodChange" />
    <AiChatSheet :show="aiOpen" @close="aiOpen = false" />
    <HomeMusicBar />
  </PageRoot>
</template>

<script setup>
import { MOOD_OPTIONS, getMoodByDate, getToday } from '@/api/notebook'
import { currentMoodKey, ensureMoodThemeBg } from '@/utils/moodTheme'
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'
import MoodPicker from '@/components/MoodPicker.vue'
import AiChatSheet from '@/components/AiChatSheet.vue'
import HomeMusicBar from '@/components/HomeMusicBar.vue'

/** 本地治愈语录，每次回到首页随机展示一句 */
const HEALING_QUOTES = [
  '慢慢来，一切都来得及。',
  // '你不必完美，温柔地对待自己就很好。',
  // '允许自己休息，休息也是进步的一部分。',
  // '今天的你，已经足够好了。',
  // '即使路漫长，也有微光照亮脚下。',
  // '把焦虑轻轻放下，先做一个深呼吸。',
  // '你值得被爱，也值得好好爱自己。',
  // '风雨之后，总会有清澈的天空。',
  // '不必急着抵达，感受沿途本身也很好。',
  // '平静不是没有波澜，是心能安住当下。',
  // '一点点光亮，也能驱散很长的夜。',
  // '难过时也请记得：情绪会过去，你还在。',
  // '把生活过成自己喜欢的样子，就是胜利。',
  // '柔软不是软弱，是勇气的另一种形式。',
  // '愿你被世界温柔以待，也先温柔以自己。',
  // '停下来看看花，日子也会亮一点。',
  // '你走过的每一步，都算数。',
  // '今天先好好吃饭、好好睡觉，明天再说。',
  // '累了就歇一歇，山不会因为你停下而消失。',
  // '所有花都会开，只是时机不同。',
  // '不必和别人比速度，你有自己的节奏。',
  // '有些日子平淡，平淡也是一种安稳。',
  // '你已经很努力了，请别再苛责自己。',
  // '太阳每天都会升起，希望也是。',
  // '把不安说出来，心会轻一点。',
  // '孤独时也要记得，你并不孤单。',
  // '接受不完美，才能真正开始幸福。',
  // '此刻的挣扎，将来都会变成力量。',
  // '对自己好一点，这不是任性。',
  // '时间会悄悄带走许多烦恼。',
  // '你配得上所有温柔的事物。',
  // '深吸一口气，把今天交给慢慢来。',
  // '心若安了，处处都是好光景。',
  // '不必把所有事都扛在肩上。',
  // '有人懂你，就很好；还没有，也可以先懂自己。',
  // '夜晚再长，也等得到天亮。',
  // '小小进步，也值得为自己鼓掌。',
  // '允许情绪来临，也允许它离开。',
  // '世界很大，你只要把自己照顾好。',
  // '今天难过没关系，明天还可以重新开始。',
  // '温柔是一种选择，也请选给自己。',
  // '你不必急着让所有人都满意。',
  // '低谷不是终点，只是一段路过。',
  // '把心放软一点，日子会更舒服。',
  // '一杯水、一次散步，也是疗愈。',
  // '未来尚未写定，你可以慢慢改写。',
  // '不必害怕变慢，变慢有时是为了走得更稳。',
  // '你已经走过了那么多难关，再难也能过。',
  // '生活偶尔吵闹，也请给内心留一片静。',
  // '愿意尝试，就已经很勇敢。',
  // '不必时刻坚强，软弱也被允许。',
  // '把「应该」换成「可以」，轻松会多一点。',
  // '阳光也会路过阴天，请再等等。',
  // '你的感受真实又重要。',
  // '不要用别人的尺子量自己。',
  // '静下心来，会听见自己真正想要什么。',
  // '每一天都是新的开始，哪怕只前进一小步。',
  // '心里有光，就不怕路远。',
  // '好好吃饭，是认真生活的第一步。',
  // '失望之后，仍可以重新期待。',
  // '不必急着回答世界，先听听自己。',
  // '做自己，比做众人眼中的「更好」更重要。',
  // '眼泪落下，心就会空出一点位子装温暖。',
  // '幸运也许迟到，但努力不会白费。',
  // '把今天过好，就是对明天最大的准备。',
  // '你值得被耐心对待。',
  // '喧嚣之外，总有一处安静属于你。',
  // '不必追赶潮流，找到自己的舒服就好。',
  // '困难会过去，而你学会的勇气会留下。',
  // '愿你的善良，被温柔接住。',
  // '发呆也是一种休息，别总责备自己懒。',
  // '日子细碎，幸福往往藏在细节里。',
  // '你可以慢热，也可以慢慢开花。',
  // '与其对着昨天后悔，不如轻轻拥抱今天。',
  // '被看见很重要，先被自己看见。',
  // '把恐惧摆到一边，先去做能做的那一步。',
  // '有光的地方不止远方，也可能就在此刻。',
  // '请相信：你正在成为更好的自己。',
  // '不必解释太多，懂的人自然懂。',
  // '心里空空也没关系，慢慢装进喜欢的事。',
  // '原谅过去的自己，然后继续往前走。',
  // '你不是负担，你是值得被珍惜的存在。',
  // '晚安不是结束，是给明天蓄一点力气。',
  // '偶尔迷茫，说明你正认真面对生活。',
  // '把焦虑拆成小事，一件一件完成就好。',
  // '春天总会来，哪怕你暂时看不见。',
  // '尊重自己的边界，也是一种自我爱护。',
  // '不必样样出色，真心就够珍贵。',
  // '你尽了力，结果就不必过于苛求。',
  // '愿意停留当下，就能感受到更多美好。',
  // '雨停之后，空气也会更清新。',
  // '别人的节奏是别人的，请走自己的路。',
  // '把微笑留给生活，也留给镜子里的自己。',
  // '你可以重新开始，一万次都可以。',
  // '温柔地说话，先对自己温柔地说。',
  // '夜空有星，说明黑暗里也藏着亮。',
  // '哪怕小小幸福，也请认真收下。',
  // '你不必急着长大，好好经历就很好。',
  // '今天辛苦了，给你一个虚拟的拥抱。',
  // '把希望留着，它会在某个清晨回应你。',
]

const entries = ref([
  {
    id: 'notebook',
    name: '记事本',
    desc: '记录计划与感受',
    size: 'large',
    path: '/pages/notebook/index',
  },
  {
    id: 'ledger',
    name: '记账',
    desc: '记录每天花了多少钱',
    size: 'wide',
    path: '/pages/ledger/index',
  },
  {
    id: 'supplies',
    name: '生活用品',
    desc: '必需品库存与剩余量',
    size: 'wide',
    path: '/pages/supplies/index',
  },
])

const novelEntry = {
  id: 'novel',
  name: '小说',
  desc: '东野 · 珍藏',
  size: 'wide',
  path: '/pages/novel/index',
}

const theaterEntry = {
  id: 'theater',
  name: '剧场',
  desc: '从小和太子过命之交',
  size: 'wide',
  path: '/pages/theater/index',
}

const wallpaperEntry = {
  id: 'wallpaper',
  name: '壁纸',
  desc: '精选手机壁纸',
  size: 'wide',
  path: '/pages/wallpaper/index',
}

const resourcesEntry = {
  id: 'resources',
  name: '资源库',
  desc: '简历等实用模板',
  size: 'wide',
  path: '/pages/resources/index',
}

const seriousEntry = {
  id: 'serious',
  name: 'Serious',
  desc: '主人专属认真区',
  size: 'mini',
  path: '/pages/notebook/serious/index',
}

const dietEntry = {
  id: 'diet',
  name: '减肥',
  desc: '饮食运动打卡',
  size: 'mini',
  path: '/pages/diet/index',
}

const hushenEntry = {
  id: 'hushen',
  name: '胡神',
  desc: '胡神 · 专攻',
  size: 'mini',
  path: '/pages/hushen/index',
}

const twinEntry = {
  id: 'twin',
  name: '分身',
  desc: '胡神 AI 分身',
  size: 'mini',
  path: '/pages/twin/index',
}

const albumEntry = {
  id: 'album',
  name: '相册',
  desc: '照片云存档',
  size: 'mini',
  path: '/pages/album/index',
}

const codeAssistEntry = {
  id: 'codeAssist',
  name: '小黑',
  desc: '本机 publish 后对话排查',
  size: 'mini',
  path: '/pages/code-assist/index',
}

function emojiForMoodKey(key) {
  for (let i = 0; i < MOOD_OPTIONS.length; i++) {
    if (MOOD_OPTIONS[i].key === key) return MOOD_OPTIONS[i].emoji
  }
  return ''
}

const moodOpen = ref(false)
const moodEmoji = ref(emojiForMoodKey(currentMoodKey.value))
const moodEntryStyle = ref({})
const aiOpen = ref(false)
const aiDragging = ref(false)
const aiFloatLeft = ref(0)
const aiFloatTop = ref(0)

const AI_FLOAT_SIZE = 56
const AI_FLOAT_PAD = 8
const AI_FLOAT_POS_KEY = 'ai_float_pos_v2'
const AI_TAP_SLOP = 8

let aiTouchStartX = 0
let aiTouchStartY = 0
let aiOriginLeft = 0
let aiOriginTop = 0
let aiMoved = false

const aiFloatStyle = computed(() => {
  return {
    left: aiFloatLeft.value + 'px',
    top: aiFloatTop.value + 'px',
    width: AI_FLOAT_SIZE + 'px',
    height: AI_FLOAT_SIZE + 'px',
  }
})
const contentPadStyle = ref({})
const healingQuote = ref('')
const showPersonal = ref(isOwnerSync())

const entrySections = computed(() => {
  const list = entries.value
  const byId = {}
  for (let i = 0; i < list.length; i++) {
    byId[list[i].id] = list[i]
  }
  const recordItems = [byId.notebook, byId.ledger, byId.supplies].filter(Boolean)

  const sections = [
    {
      id: 'record',
      items: recordItems,
    },
    {
      id: 'leisure',
      items: [novelEntry, theaterEntry, wallpaperEntry, resourcesEntry],
    },
  ]

  if (showPersonal.value) {
    sections.push({
      id: 'personal',
      items: [seriousEntry, dietEntry, hushenEntry, twinEntry, albumEntry, codeAssistEntry],
    })
  }

  return sections
})

onMounted(async () => {
  layoutTopEntries()
  initAiFloatPos()
  await loadOwnerFlag()
  showPersonal.value = isOwnerSync()
})

onShow(() => {
  pickHealingQuote()
  loadMoodEntry()
  ensureMoodThemeBg(false)
})

function pickHealingQuote() {
  const list = HEALING_QUOTES
  if (!list.length) return
  let next = list[Math.floor(Math.random() * list.length)]
  if (list.length > 1 && next === healingQuote.value) {
    next = list[Math.floor(Math.random() * list.length)]
  }
  healingQuote.value = next
}

/** 心情贴胶囊左侧；内容顶距留导航下小间距（语录回到内容流顶部） */
function layoutTopEntries() {
  const sys = uni.getSystemInfoSync()
  const menu = wx.getMenuButtonBoundingClientRect()
  const edgePad = 16
  const contentGap = 12

  if (!menu) {
    const top = (sys.statusBarHeight || 20) + 6
    const moodH = 32
    moodEntryStyle.value = {
      top: top + 'px',
      right: edgePad + 'px',
      height: moodH + 'px',
    }
    contentPadStyle.value = {
      paddingTop: contentGap + 'px',
    }
    return
  }

  const moodRight = sys.windowWidth - menu.left + 8

  moodEntryStyle.value = {
    top: menu.top + 'px',
    right: moodRight + 'px',
    height: menu.height + 'px',
  }
  contentPadStyle.value = {
    paddingTop: contentGap + 'px',
  }
}

function getAiFloatBounds() {
  const sys = uni.getSystemInfoSync()
  const safeBottom = (sys.safeAreaInsets && sys.safeAreaInsets.bottom) || 0
  const minLeft = AI_FLOAT_PAD
  const maxLeft = Math.max(minLeft, sys.windowWidth - AI_FLOAT_SIZE - AI_FLOAT_PAD)
  const minTop = (sys.statusBarHeight || 20) + 4
  const maxTop = Math.max(minTop, sys.windowHeight - AI_FLOAT_SIZE - safeBottom - AI_FLOAT_PAD - 24)
  return { minLeft: minLeft, maxLeft: maxLeft, minTop: minTop, maxTop: maxTop }
}

function clampAiFloat(left, top) {
  const b = getAiFloatBounds()
  let l = left
  let t = top
  if (l < b.minLeft) l = b.minLeft
  if (l > b.maxLeft) l = b.maxLeft
  if (t < b.minTop) t = b.minTop
  if (t > b.maxTop) t = b.maxTop
  return { left: l, top: t }
}

function defaultAiFloatPos() {
  const sys = uni.getSystemInfoSync()
  const menu = wx.getMenuButtonBoundingClientRect()
  // 默认贴最右侧
  const left = sys.windowWidth - AI_FLOAT_SIZE - AI_FLOAT_PAD
  let top = (sys.statusBarHeight || 20) + 48
  if (menu && menu.bottom) {
    top = menu.bottom + 12
  }
  return clampAiFloat(left, top)
}

function initAiFloatPos() {
  try {
    const saved = uni.getStorageSync(AI_FLOAT_POS_KEY)
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      const pos = clampAiFloat(saved.left, saved.top)
      aiFloatLeft.value = pos.left
      aiFloatTop.value = pos.top
      return
    }
  } catch (err) {
    // ignore
  }
  const pos = defaultAiFloatPos()
  aiFloatLeft.value = pos.left
  aiFloatTop.value = pos.top
}

function saveAiFloatPos() {
  try {
    uni.setStorageSync(AI_FLOAT_POS_KEY, {
      left: aiFloatLeft.value,
      top: aiFloatTop.value,
    })
  } catch (err) {
    // ignore
  }
}

function onAiTouchStart(e) {
  const t = e.touches && e.touches[0]
  if (!t) return
  aiTouchStartX = t.clientX
  aiTouchStartY = t.clientY
  aiOriginLeft = aiFloatLeft.value
  aiOriginTop = aiFloatTop.value
  aiMoved = false
  aiDragging.value = true
}

function onAiTouchMove(e) {
  const t = e.touches && e.touches[0]
  if (!t) return
  const dx = t.clientX - aiTouchStartX
  const dy = t.clientY - aiTouchStartY
  if (!aiMoved && Math.abs(dx) + Math.abs(dy) > AI_TAP_SLOP) {
    aiMoved = true
  }
  const pos = clampAiFloat(aiOriginLeft + dx, aiOriginTop + dy)
  aiFloatLeft.value = pos.left
  aiFloatTop.value = pos.top
}

function onAiTouchEnd() {
  aiDragging.value = false
  if (!aiMoved) {
    aiOpen.value = true
    return
  }
  saveAiFloatPos()
}

async function loadMoodEntry() {
  try {
    const data = await getMoodByDate(getToday())
    if (data && data.moodKey) {
      moodEmoji.value = emojiForMoodKey(data.moodKey)
    } else {
      moodEmoji.value = emojiForMoodKey(currentMoodKey.value)
    }
  } catch (err) {
    console.error('加载首页心情失败', err)
    moodEmoji.value = emojiForMoodKey(currentMoodKey.value)
  }
}

function onMoodChange(item) {
  moodEmoji.value = item.emoji || ''
}

function handleEntryTap(item) {
  uni.navigateTo({ url: item.path })
}
</script>

<style lang="scss" scoped>
.home-flip-viewport {
  position: relative;
  height: 100%;
  overflow: hidden;
  z-index: 2;
}

.home-stage {
  position: relative;
  height: 100%;
}

.mood-entry {
  position: fixed;
  z-index: 110;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80rpx;
  min-height: 56rpx;
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.55);
  border: 1rpx solid rgba(74, 159, 232, 0.16);
  box-shadow: 0 4rpx 16rpx rgba(43, 127, 212, 0.06);
  box-sizing: border-box;
}

.mood-entry-emoji {
  font-size: 40rpx;
  line-height: 1;
}

.mood-entry-text {
  font-size: 24rpx;
  font-weight: 400;
  color: $color-subtitle;
  letter-spacing: 4rpx;
  line-height: 1;
}

.ai-float {
  position: fixed;
  z-index: 120;
  border-radius: 50%;
  box-sizing: border-box;
}

.ai-float.dragging {
  opacity: 0.92;
}

.ai-float.bounce {
  animation: aiFloatBounce 1.6s ease-in-out infinite;
}

.ai-float-ring {
  position: absolute;
  inset: -6rpx;
  border-radius: 50%;
  border: 2rpx solid var(--color-primary);
  box-shadow: 0 0 18rpx var(--color-primary);
  opacity: 0.5;
  animation: aiFloatPulse 1.6s ease-in-out infinite;
  pointer-events: none;
}

.ai-float.dragging .ai-float-ring {
  animation: none;
}

.ai-float-core {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 35% 30%, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  border: 2rpx solid var(--color-card-soft);
  box-shadow: var(--shadow-icon);
}

.ai-float-text {
  font-size: 28rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: #fff;
  text-shadow: 0 2rpx 6rpx rgba(0, 40, 80, 0.35);
}

@keyframes aiFloatBounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10rpx);
  }
}

@keyframes aiFloatPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.85;
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

.content {
  position: relative;
  z-index: 1;
  padding: 36rpx 40rpx 160rpx;
  box-sizing: border-box;
}

/* 语录：内容流顶部，导航正下方左对齐 */
.hero {
  margin-bottom: 28rpx;
  padding-top: 6rpx;
}

.hero .hero-desc {
  font-size: 37rpx;
  font-weight: 800;
  line-height: 1.5;
}

.hero-desc {
  display: block;
  font-size: 32rpx;
  font-weight: 400;
  color: $color-primary-dark;
  line-height: 1.75;
  letter-spacing: 2rpx;
  opacity: 0.92;
  text-shadow:
    0 1rpx 2rpx rgba(255, 255, 255, 0.95),
    0 0 12rpx rgba(255, 255, 255, 0.72),
    0 2rpx 8rpx rgba(255, 255, 255, 0.55);
}

/* 留白隐分组：组间距区分区块，无标题 */
.entry-section {
  margin-top: 36rpx;
}

.entry-section:first-of-type {
  margin-top: 8rpx;
}

/* Bento 网格：4 列，大小混排 */
.entry-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 132rpx;
  gap: 20rpx;
}

/* 毛玻璃卡片，透出心情主题渐变 */
.entry-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 12rpx 6rpx 10rpx;
  background-color: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(40rpx) saturate(1.4);
  -webkit-backdrop-filter: blur(40rpx) saturate(1.4);
  border: 1rpx solid rgba(255, 255, 255, 0.8);
  border-radius: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(107, 68, 35, 0.06);
  box-sizing: border-box;
  transform: translateY(0);
  transition:
    opacity 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.entry-card--active {
  opacity: 0.94;
  transform: translateY(2rpx);
  box-shadow: 0 2rpx 10rpx rgba(107, 68, 35, 0.1);
}

/* 大卡 2×2：图标左上、文字左下 */
.size--large {
  grid-column: span 2;
  grid-row: span 2;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0;
  padding: 26rpx;
}

/* 宽卡 2×1：横向图标 + 文字 */
.size--wide {
  grid-column: span 2;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 18rpx;
  padding: 0 24rpx;
}

.entry-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.size--large .entry-text {
  flex: none;
  width: 100%;
}

.entry-icon-box {
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  background: linear-gradient(145deg, $color-primary 0%, $color-primary-dark 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  box-shadow: $shadow-icon;
}

.size--large .entry-icon-box {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
}

/* 图标 glyph 随盒尺寸缩放 */
.entry-icon-box > view {
  transform: scale(0.9);
  transform-origin: center center;
}

.size--large .entry-icon-box > view {
  transform: scale(1.2);
}

/* 专属色 tint：卡片渐变着色，点到为止 */
.tint--notebook {
  background-image: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.04) 55%, transparent 100%);
}

.tint--ledger {
  background-image: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(52, 211, 153, 0.04) 55%, transparent 100%);
}

.tint--supplies {
  background-image: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.04) 55%, transparent 100%);
}

.tint--novel {
  background-image: linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, rgba(244, 114, 182, 0.04) 55%, transparent 100%);
}

.tint--theater {
  background-image: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(248, 113, 113, 0.04) 55%, transparent 100%);
}

.tint--wallpaper {
  background-image: linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(56, 189, 248, 0.04) 55%, transparent 100%);
}

.tint--resources {
  background-image: linear-gradient(135deg, rgba(20, 184, 166, 0.12) 0%, rgba(45, 212, 191, 0.04) 55%, transparent 100%);
}

.tint--serious {
  background-image: linear-gradient(135deg, rgba(71, 85, 105, 0.12) 0%, rgba(100, 116, 139, 0.04) 55%, transparent 100%);
}

.tint--diet {
  background-image: linear-gradient(135deg, rgba(132, 204, 22, 0.12) 0%, rgba(163, 230, 53, 0.04) 55%, transparent 100%);
}

.tint--hushen {
  background-image: linear-gradient(135deg, rgba(184, 134, 11, 0.14) 0%, rgba(212, 160, 23, 0.04) 55%, transparent 100%);
}

.tint--twin {
  background-image: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(167, 139, 250, 0.04) 55%, transparent 100%);
}

.tint--album {
  background-image: linear-gradient(135deg, rgba(251, 113, 133, 0.12) 0%, rgba(253, 164, 175, 0.04) 55%, transparent 100%);
}

.tint--codeAssist {
  background-image: linear-gradient(135deg, rgba(34, 211, 238, 0.12) 0%, rgba(3, 105, 161, 0.04) 55%, transparent 100%);
}

/* 入口专属渐变图标 */
.ib--notebook {
  background: linear-gradient(145deg, #6366f1 0%, #8b5cf6 100%);
}

.ib--ledger {
  background: linear-gradient(145deg, #10b981 0%, #34d399 100%);
}

.ib--supplies {
  background: linear-gradient(145deg, #f59e0b 0%, #fbbf24 100%);
}

.ib--novel {
  background: linear-gradient(145deg, #ec4899 0%, #f472b6 100%);
}

.ib--theater {
  background: linear-gradient(145deg, #ef4444 0%, #f87171 100%);
}

.ib--wallpaper {
  background: linear-gradient(145deg, #0ea5e9 0%, #38bdf8 100%);
}

.ib--resources {
  background: linear-gradient(145deg, #14b8a6 0%, #2dd4bf 100%);
}

.ib--serious {
  background: linear-gradient(145deg, #475569 0%, #64748b 100%);
}

.ib--diet {
  background: linear-gradient(145deg, #84cc16 0%, #a3e635 100%);
}

.ib--hushen {
  background: linear-gradient(145deg, #b8860b 0%, #d4a017 100%);
}

.ib--twin {
  background: linear-gradient(145deg, #8b5cf6 0%, #a78bfa 100%);
}

.ib--album {
  background: linear-gradient(145deg, #fb7185 0%, #fda4af 100%);
}

.ib--codeAssist {
  background: linear-gradient(145deg, #22d3ee 0%, #0ea5e9 55%, #0369a1 100%);
}

/* 记事本：书脊 + 内页粗线 */
.icon-notebook {
  position: relative;
  width: 44rpx;
  height: 52rpx;
}

.icon-notebook-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 10rpx;
  border-radius: 5rpx 0 0 5rpx;
  background: #fff;
}

.icon-notebook-page {
  position: absolute;
  left: 8rpx;
  right: 0;
  top: 0;
  bottom: 0;
  border-radius: 0 10rpx 10rpx 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7rpx;
  padding: 0 10rpx;
  box-sizing: border-box;
}

.icon-notebook-line {
  height: 4rpx;
  border-radius: 2rpx;
  background: $color-primary-dark;
  opacity: 0.45;
}

.icon-notebook-line.mid {
  width: 86%;
}

.icon-notebook-line.short {
  width: 58%;
}

/* 记账：粗币环 + 柱 */
.icon-ledger {
  position: relative;
  width: 50rpx;
  height: 44rpx;
}

.icon-ledger-ring {
  position: absolute;
  left: 0;
  top: 4rpx;
  width: 30rpx;
  height: 30rpx;
  border: 5rpx solid #fff;
  border-radius: 50%;
  box-sizing: border-box;
}

.icon-ledger-core {
  position: absolute;
  left: 11rpx;
  top: 15rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #fff;
}

.icon-ledger-bars {
  position: absolute;
  right: 0;
  bottom: 2rpx;
  display: flex;
  align-items: flex-end;
  gap: 5rpx;
  height: 34rpx;
}

.icon-ledger-bars .bar {
  width: 7rpx;
  border-radius: 4rpx;
  background: #fff;
}

.icon-ledger-bars .b1 {
  height: 14rpx;
}
.icon-ledger-bars .b2 {
  height: 22rpx;
}
.icon-ledger-bars .b3 {
  height: 32rpx;
}

/* 生活用品：提手盒 */
.icon-supplies {
  position: relative;
  width: 48rpx;
  height: 44rpx;
}

.icon-supplies-handle {
  position: absolute;
  left: 14rpx;
  top: 0;
  width: 20rpx;
  height: 14rpx;
  border: 4rpx solid #fff;
  border-bottom: none;
  border-radius: 12rpx 12rpx 0 0;
  box-sizing: border-box;
}

.icon-supplies-lid {
  position: absolute;
  left: 0;
  top: 12rpx;
  width: 48rpx;
  height: 10rpx;
  border-radius: 5rpx;
  background: #fff;
}

.icon-supplies-body {
  position: absolute;
  left: 5rpx;
  top: 20rpx;
  width: 38rpx;
  height: 24rpx;
  border-radius: 0 0 10rpx 10rpx;
  background: rgba(255, 255, 255, 0.92);
}

/* 小说：书本 */
.icon-novel {
  position: relative;
  width: 44rpx;
  height: 52rpx;
}

.icon-novel-book {
  position: absolute;
  inset: 0;
  border-radius: 4rpx 8rpx 8rpx 4rpx;
  background: #fff;
  overflow: hidden;
}

.icon-novel-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 10rpx;
  background: rgba(74, 159, 232, 0.35);
}

.icon-novel-page {
  position: absolute;
  left: 14rpx;
  top: 10rpx;
  right: 8rpx;
  bottom: 10rpx;
  border-radius: 2rpx;
  background: rgba(74, 159, 232, 0.12);
}

/* 壁纸：相框 */
.icon-wallpaper {
  position: relative;
  width: 44rpx;
  height: 44rpx;
}

.icon-wallpaper-frame {
  position: absolute;
  left: 6rpx;
  top: 4rpx;
  right: 6rpx;
  bottom: 4rpx;
  border-radius: 6rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  box-sizing: border-box;
}

.icon-wallpaper-pic {
  position: absolute;
  left: 14rpx;
  top: 12rpx;
  right: 14rpx;
  bottom: 12rpx;
  border-radius: 3rpx;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.15));
}

/* 资源库：文件夹 */
.icon-resources {
  position: relative;
  width: 44rpx;
  height: 44rpx;
}

.icon-resources-box {
  position: absolute;
  left: 6rpx;
  top: 12rpx;
  right: 6rpx;
  bottom: 6rpx;
  border-radius: 6rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  box-sizing: border-box;
}

.icon-resources-line {
  position: absolute;
  left: 14rpx;
  right: 14rpx;
  height: 3rpx;
  border-radius: 2rpx;
  background: rgba(255, 255, 255, 0.9);
}

.icon-resources-line.l1 {
  top: 20rpx;
}

.icon-resources-line.l2 {
  top: 28rpx;
}

/* Serious：感叹号 */
.icon-serious {
  position: relative;
  width: 40rpx;
  height: 44rpx;
}

.icon-serious-bar {
  position: absolute;
  left: 17rpx;
  top: 4rpx;
  width: 6rpx;
  height: 22rpx;
  border-radius: 3rpx;
  background: rgba(255, 255, 255, 0.95);
}

.icon-serious-dot {
  position: absolute;
  left: 17rpx;
  bottom: 4rpx;
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
}

/* 减肥：盘子 + 叶 */
.icon-diet {
  position: relative;
  width: 44rpx;
  height: 44rpx;
}

.icon-diet-plate {
  position: absolute;
  left: 4rpx;
  top: 10rpx;
  width: 36rpx;
  height: 26rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  box-sizing: border-box;
}

.icon-diet-leaf {
  position: absolute;
  right: 2rpx;
  top: 2rpx;
  width: 14rpx;
  height: 18rpx;
  border-radius: 0 12rpx 2rpx 12rpx;
  background: rgba(255, 255, 255, 0.9);
  transform: rotate(28deg);
}

/* 胡神：印信 */
.icon-hushen {
  position: relative;
  width: 44rpx;
  height: 44rpx;
}

.icon-hushen-seal {
  position: absolute;
  left: 4rpx;
  top: 4rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  box-sizing: border-box;
}

.icon-hushen-mark {
  position: absolute;
  left: 18rpx;
  top: 12rpx;
  width: 8rpx;
  height: 20rpx;
  border-radius: 3rpx;
  background: rgba(255, 255, 255, 0.95);
}

/* 分身：人脸轮廓 */
.icon-twin {
  position: relative;
  width: 44rpx;
  height: 44rpx;
}

.icon-twin-face {
  position: absolute;
  left: 8rpx;
  top: 6rpx;
  width: 28rpx;
  height: 32rpx;
  border-radius: 50% 50% 46% 46%;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  box-sizing: border-box;
}

.icon-twin-dot {
  position: absolute;
  left: 18rpx;
  top: 16rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 10rpx 0 0 rgba(255, 255, 255, 0.95);
}

/* 相册：双层相框 */
.icon-album {
  position: relative;
  width: 44rpx;
  height: 44rpx;
}

.icon-album .fa-back {
  position: absolute;
  left: 4rpx;
  top: 6rpx;
  width: 30rpx;
  height: 26rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.6);
  border-radius: 6rpx;
  transform: rotate(-8deg);
  box-sizing: border-box;
}

.icon-album .fa-front {
  position: absolute;
  left: 12rpx;
  top: 13rpx;
  width: 30rpx;
  height: 26rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  border-radius: 6rpx;
  background: rgba(255, 255, 255, 0.18);
  box-sizing: border-box;
}

/* 剧场：播放三角 */
.icon-theater {
  position: relative;
  width: 44rpx;
  height: 44rpx;
}

.icon-theater-tri {
  position: absolute;
  left: 13rpx;
  top: 10rpx;
  width: 0;
  height: 0;
  border-top: 12rpx solid transparent;
  border-bottom: 12rpx solid transparent;
  border-left: 20rpx solid rgba(255, 255, 255, 0.95);
}

/* 小黑：代码括号示意（不用模板里的花括号，避免编译成插值） */
.icon-code {
  position: relative;
  width: 44rpx;
  height: 44rpx;
}

.icon-code-left,
.icon-code-right {
  position: absolute;
  top: 8rpx;
  width: 12rpx;
  height: 28rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.95);
  box-sizing: border-box;
}

.icon-code-left {
  left: 4rpx;
  border-right: none;
  border-radius: 8rpx 0 0 8rpx;
}

.icon-code-right {
  right: 4rpx;
  border-left: none;
  border-radius: 0 8rpx 8rpx 0;
}

.icon-code-slash {
  position: absolute;
  left: 20rpx;
  top: 11rpx;
  width: 3rpx;
  height: 22rpx;
  border-radius: 2rpx;
  background: rgba(255, 255, 255, 0.85);
  transform: rotate(18deg);
}

.entry-name {
  display: block;
  width: 100%;
  font-size: 24rpx;
  font-weight: 700;
  color: $color-title;
  letter-spacing: 1rpx;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 1.3;
  text-shadow:
    0 1rpx 2rpx rgba(255, 255, 255, 0.9),
    0 0 8rpx rgba(255, 255, 255, 0.55);
}

.size--wide .entry-name,
.size--large .entry-name {
  text-align: left;
}

.size--wide .entry-name {
  font-size: 26rpx;
  font-weight: 700;
}

.size--large .entry-name {
  font-size: 32rpx;
  font-weight: 800;
}

.entry-desc {
  display: block;
  width: 100%;
  margin-top: 4rpx;
  font-size: 20rpx;
  font-weight: 500;
  color: $color-primary-dark;
  letter-spacing: 1rpx;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 1.35;
  text-shadow:
    0 1rpx 2rpx rgba(255, 255, 255, 0.85),
    0 0 6rpx rgba(255, 255, 255, 0.45);
}

.size--large .entry-desc {
  font-size: 22rpx;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.7s ease-out forwards;
}
</style>
