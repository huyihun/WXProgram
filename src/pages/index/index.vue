<template>
  <PageRoot :back="false" flush hero fill>
    <view class="home-flip-viewport">
      <view class="home-stage">
        <view class="content content--vip" :style="contentPadStyle">
          <!-- Hero：问候轻、语录主 -->
          <view class="hero fade-in hero--vip">
            <text class="greeting">{{ greeting }}</text>
            <view class="hero-quote">
              <!-- 主人多条：上下滚动轮播 -->
              <swiper
                v-if="isOwner && quoteSlideList.length > 1"
                class="quote-swiper"
                vertical
                autoplay
                circular
                :interval="3000"
                :duration="500"
                :indicator-dots="false"
              >
                <swiper-item v-for="(text, idx) in quoteSlideList" :key="'quote-' + idx">
                  <view class="quote-slide">
                    <text class="hero-desc">{{ text }}</text>
                  </view>
                </swiper-item>
              </swiper>
              <!-- 非主人 / 主人仅一条：静态展示 -->
              <text v-else-if="quoteDisplayText" id="homeHeroDesc" class="hero-desc">
                {{ quoteDisplayText }}
              </text>
              <!-- 仅主人：icon 入口，弹框增删改，不跳转 -->
              <view v-if="isOwner" class="quote-ops">
                <view class="quote-ico" hover-class="quote-ico--active" @tap.stop="openQuoteAdd">
                  <view class="ico-plus">
                    <view class="ico-plus-h" />
                    <view class="ico-plus-v" />
                  </view>
                </view>
                <view class="quote-ico" hover-class="quote-ico--active" @tap.stop="openQuoteList">
                  <view class="ico-lines">
                    <view class="ico-lines-row" />
                    <view class="ico-lines-row mid" />
                    <view class="ico-lines-row short" />
                  </view>
                </view>
              </view>
            </view>
          </view>

          <!-- 分类宫格：记录 / 游戏 / 休闲 -->
          <view v-for="(section, sIndex) in entrySections" :key="section.id" class="entry-section">
            <view class="section-head">
              <view class="section-accent" />
              <view class="section-title-wrap">
                <text class="section-title">{{ section.title }}</text>
                <text class="section-sub">{{ section.sub }}</text>
              </view>
              <view class="section-line" />
            </view>
            <view class="entry-list">
              <view
                v-for="(item, index) in section.items"
                :key="item.id"
                class="entry-card"
                :class="'entry-delay-' + (sIndex * 4 + index)"
                hover-class="entry-card--active"
                @tap="handleEntryTap(item)"
              >
                <view class="entry-icon-box">
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
                  <view v-else-if="item.id === 'diet'" class="icon-diet">
                    <view class="icon-diet-plate" />
                    <view class="icon-diet-leaf" />
                  </view>
                </view>
                <text class="entry-name">{{ item.name }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 左上角：心情头像；其右侧为天气坞 -->
    <view class="mood-entry" :style="moodEntryStyle" @tap="moodOpen = true">
      <image v-if="moodImageUrl" class="mood-entry-img" :src="moodImageUrl" mode="aspectFill" />
      <text v-else class="mood-entry-text">心情</text>
    </view>
    <view v-if="weather" class="weather-dock" :style="weatherDockStyle" @tap="toggleWeatherCity">
      <video
        v-if="weatherFxSrc"
        id="weatherFxVideo"
        class="weather-dock-video"
        :src="weatherFxSrc"
        :controls="false"
        :show-center-play-btn="false"
        :show-play-btn="false"
        :show-fullscreen-btn="false"
        :enable-progress-gesture="false"
        :show-mute-btn="false"
        object-fit="cover"
        muted
        loop
        autoplay
        @error="onWeatherFxError"
      />
      <view class="weather-dock-tint" />
      <view class="weather-dock-body" :class="weatherTextClass">
        <text class="weather-temp">{{ weatherTemp }}</text>
        <view class="weather-meta">
          <view class="weather-cond">
            <view class="wx-ico" :class="'ico-' + weatherIconKind" />
            <text class="weather-cond-text">{{ weatherCondText }}</text>
          </view>
          <view class="weather-city-row">
            <text class="weather-city">{{ weatherCity }}</text>
            <view class="weather-toggle" :class="{ busy: weatherBusy }">
              <view class="toggle-spin" :class="{ spin: weatherBusy }">
                <view class="spin-arc spin-arc-a" />
                <view class="spin-arc spin-arc-b" />
                <view class="spin-tip tip-a" />
                <view class="spin-tip tip-b" />
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 主人：新增 / 编辑语录 -->
    <view v-if="quoteEditOpen" class="modal-mask" @tap="closeQuoteEdit" @touchmove.stop.prevent />
    <view v-if="quoteEditOpen" class="modal-panel" @tap.stop @touchmove.stop>
      <text class="modal-title">{{ quoteEditingId ? '编辑语录' : '新增语录' }}</text>
      <textarea
        class="field-area"
        v-model="quoteDraft"
        placeholder="写下这句经典语录..."
        :maxlength="200"
        :focus="quoteInputFocus"
        :show-confirm-bar="false"
      />
      <view class="modal-actions">
        <text class="btn-cancel" @tap="closeQuoteEdit">取消</text>
        <text class="btn-confirm" :class="{ disabled: quoteSaving }" @tap="saveQuoteEdit">
          {{ quoteSaving ? '保存中…' : '保存' }}
        </text>
      </view>
    </view>

    <!-- 主人：语录列表 -->
    <view v-if="quoteListOpen" class="modal-mask" @tap="closeQuoteList" @touchmove.stop.prevent />
    <view v-if="quoteListOpen" class="modal-panel modal-panel--list" @tap.stop @touchmove.stop>
      <view class="list-head">
        <text class="modal-title list-title">经典语录</text>
        <text class="list-close" @tap="closeQuoteList">关闭</text>
      </view>
      <view v-if="quoteListLoading" class="list-empty">加载中...</view>
      <view v-else-if="myQuotes.length === 0" class="list-empty">还没有语录</view>
      <scroll-view v-else scroll-y class="quote-list-scroll">
        <view v-for="item in myQuotes" :key="item._id" class="quote-list-item">
          <text class="quote-list-content">{{ item.content }}</text>
          <view class="quote-list-foot">
            <text class="quote-list-time">{{ formatQuoteTime(item.createdAt) }}</text>
            <view class="quote-list-actions">
              <text class="quote-link" @tap="openQuoteEditItem(item)">编辑</text>
              <text class="quote-link danger" @tap="removeQuoteItem(item)">删除</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <MoodPicker :show="moodOpen" @close="moodOpen = false" @change="onMoodChange" />
    <HomeMusicBar />
  </PageRoot>
</template>

<script setup>
import { getMoodByDate, getToday } from '@/api/notebook'
import { listMoodEmojis, resolveMoodImageUrls, getMoodEmojiByKey, prefetchMoodCatalog } from '@/api/moodCatalog'
import { getQuotes, addQuote, updateQuote, removeQuote, formatQuoteTime } from '@/api/quotes'
import { loadHomeWeather, COMMON_CITIES } from '@/api/weather'
import { getWeatherFxLocalPath } from '@/utils/weatherFx'
import { loadOwnerFlag, isOwnerSync } from '@/utils/owner'
import { applyMoodThemeFromItem, registerMoodThemes } from '@/utils/moodTheme'
import MoodPicker from '@/components/MoodPicker.vue'
import HomeMusicBar from '@/components/HomeMusicBar.vue'

/** 本地治愈语录，每次回到首页随机展示一句 */
const HEALING_QUOTES = [
  '你不必完美，温柔地对待自己就很好。',
  '慢慢来，一切都来得及。',
  '允许自己休息，休息也是进步的一部分。',
  '今天的你，已经足够好了。',
  '即使路漫长，也有微光照亮脚下。',
  '把焦虑轻轻放下，先做一个深呼吸。',
  '你值得被爱，也值得好好爱自己。',
  '风雨之后，总会有清澈的天空。',
  '不必急着抵达，感受沿途本身也很好。',
  '平静不是没有波澜，是心能安住当下。',
  '一点点光亮，也能驱散很长的夜。',
  '难过时也请记得：情绪会过去，你还在。',
  '把生活过成自己喜欢的样子，就是胜利。',
  '柔软不是软弱，是勇气的另一种形式。',
  '愿你被世界温柔以待，也先温柔以自己。',
  '停下来看看花，日子也会亮一点。',
  '你走过的每一步，都算数。',
  '今天先好好吃饭、好好睡觉，明天再说。',
  '累了就歇一歇，山不会因为你停下而消失。',
  '所有花都会开，只是时机不同。',
  '不必和别人比速度，你有自己的节奏。',
  '有些日子平淡，平淡也是一种安稳。',
  '你已经很努力了，请别再苛责自己。',
  '太阳每天都会升起，希望也是。',
  '把不安说出来，心会轻一点。',
  '孤独时也要记得，你并不孤单。',
  '接受不完美，才能真正开始幸福。',
  '此刻的挣扎，将来都会变成力量。',
  '对自己好一点，这不是任性。',
  '时间会悄悄带走许多烦恼。',
  '你配得上所有温柔的事物。',
  '深吸一口气，把今天交给慢慢来。',
  '心若安了，处处都是好光景。',
  '不必把所有事都扛在肩上。',
  '有人懂你，就很好；还没有，也可以先懂自己。',
  '夜晚再长，也等得到天亮。',
  '小小进步，也值得为自己鼓掌。',
  '允许情绪来临，也允许它离开。',
  '世界很大，你只要把自己照顾好。',
  '今天难过没关系，明天还可以重新开始。',
  '温柔是一种选择，也请选给自己。',
  '你不必急着让所有人都满意。',
  '低谷不是终点，只是一段路过。',
  '把心放软一点，日子会更舒服。',
  '一杯水、一次散步，也是疗愈。',
  '未来尚未写定，你可以慢慢改写。',
  '不必害怕变慢，变慢有时是为了走得更稳。',
  '你已经走过了那么多难关，再难也能过。',
  '生活偶尔吵闹，也请给内心留一片静。',
  '愿意尝试，就已经很勇敢。',
  '不必时刻坚强，软弱也被允许。',
  '把「应该」换成「可以」，轻松会多一点。',
  '阳光也会路过阴天，请再等等。',
  '你的感受真实又重要。',
  '不要用别人的尺子量自己。',
  '静下心来，会听见自己真正想要什么。',
  '每一天都是新的开始，哪怕只前进一小步。',
  '心里有光，就不怕路远。',
  '好好吃饭，是认真生活的第一步。',
  '失望之后，仍可以重新期待。',
  '不必急着回答世界，先听听自己。',
  '做自己，比做众人眼中的「更好」更重要。',
  '眼泪落下，心就会空出一点位子装温暖。',
  '幸运也许迟到，但努力不会白费。',
  '把今天过好，就是对明天最大的准备。',
  '你值得被耐心对待。',
  '喧嚣之外，总有一处安静属于你。',
  '不必追赶潮流，找到自己的舒服就好。',
  '困难会过去，而你学会的勇气会留下。',
  '愿你的善良，被温柔接住。',
  '发呆也是一种休息，别总责备自己懒。',
  '日子细碎，幸福往往藏在细节里。',
  '你可以慢热，也可以慢慢开花。',
  '与其对着昨天后悔，不如轻轻拥抱今天。',
  '被看见很重要，先被自己看见。',
  '把恐惧摆到一边，先去做能做的那一步。',
  '有光的地方不止远方，也可能就在此刻。',
  '请相信：你正在成为更好的自己。',
  '不必解释太多，懂的人自然懂。',
  '心里空空也没关系，慢慢装进喜欢的事。',
  '原谅过去的自己，然后继续往前走。',
  '你不是负担，你是值得被珍惜的存在。',
  '晚安不是结束，是给明天蓄一点力气。',
  '偶尔迷茫，说明你正认真面对生活。',
  '把焦虑拆成小事，一件一件完成就好。',
  '春天总会来，哪怕你暂时看不见。',
  '尊重自己的边界，也是一种自我爱护。',
  '不必样样出色，真心就够珍贵。',
  '你尽了力，结果就不必过于苛求。',
  '愿意停留当下，就能感受到更多美好。',
  '雨停之后，空气也会更清新。',
  '别人的节奏是别人的，请走自己的路。',
  '把微笑留给生活，也留给镜子里的自己。',
  '你可以重新开始，一万次都可以。',
  '温柔地说话，先对自己温柔地说。',
  '夜空有星，说明黑暗里也藏着亮。',
  '哪怕小小幸福，也请认真收下。',
  '你不必急着长大，好好经历就很好。',
  '今天辛苦了，给你一个虚拟的拥抱。',
  '把希望留着，它会在某个清晨回应你。',
]

const isOwner = ref(false)

const entries = ref([
  {
    id: 'notebook',
    name: '记事本',
    desc: '记录灵感与待办',
    path: '/pages/notebook/index',
  },
  {
    id: 'ledger',
    name: '记账',
    desc: '记录每天花了多少钱',
    path: '/pages/ledger/index',
  },
  {
    id: 'supplies',
    name: '生活用品',
    desc: '必需品库存与剩余量',
    path: '/pages/supplies/index',
  },
  {
    id: 'diet',
    name: '减肥',
    desc: '体重与饮食记录',
    path: '/pages/diet/index',
    ownerOnly: true,
  },
])

const novelEntry = {
  id: 'novel',
  name: '小说',
  desc: '东野圭吾作品集',
  path: '/pages/novel/index',
}

const moodOpen = ref(false)
const moodImageUrl = ref('')
const moodEntryStyle = ref({})
const weatherDockStyle = ref({})
const contentPadStyle = ref({})
const healingQuote = ref('')
const myQuotes = ref([])
const quoteEditOpen = ref(false)
const quoteListOpen = ref(false)
const quoteListLoading = ref(false)
const quoteEditingId = ref('')
const quoteDraft = ref('')
const quoteSaving = ref(false)
const quoteInputFocus = ref(false)

const quoteSlideList = computed(() => {
  const list = []
  for (let i = 0; i < myQuotes.value.length; i++) {
    const text = myQuotes.value[i].content
    if (text) list.push(text)
  }
  return list
})

/** 非主人用本地语录；主人仅一条时静态展示 */
const quoteDisplayText = computed(() => {
  if (isOwner.value) {
    if (quoteSlideList.value.length === 1) return quoteSlideList.value[0]
    return ''
  }
  return healingQuote.value
})

const weather = ref(null)
const weatherBusy = ref(false)
const weatherTextPhase = ref('') // '' | 'out' | 'in'
const weatherFxSrc = ref('')
let weatherFxToken = 0

function visibleEntry(item) {
  if (!item) return null
  if (item.ownerOnly && !isOwner.value) return null
  return item
}

const entrySections = computed(() => {
  const list = entries.value
  const byId = {}
  for (let i = 0; i < list.length; i++) {
    byId[list[i].id] = list[i]
  }
  const recordItems = [
    visibleEntry(byId.notebook),
    visibleEntry(byId.ledger),
    visibleEntry(byId.supplies),
    visibleEntry(byId.diet),
  ].filter(Boolean)

  return [
    {
      id: 'record',
      title: '记录',
      sub: 'RECORD',
      items: recordItems,
    },
    {
      id: 'leisure',
      title: '休闲',
      sub: 'LEISURE',
      items: [novelEntry],
    },
  ]
})

const weatherTextClass = computed(() => {
  if (weatherTextPhase.value === 'out') return 'is-out'
  if (weatherTextPhase.value === 'in') return 'is-in'
  return ''
})

const weatherTemp = computed(() => {
  if (!weather.value || weather.value.temp === '' || weather.value.temp == null) return '--°'
  return weather.value.temp + '°'
})

const weatherCondText = computed(() => {
  return (weather.value && weather.value.text) || ''
})

const weatherCity = computed(() => {
  return (weather.value && weather.value.city) || ''
})

const weatherIconKind = computed(() => {
  const n = Number(weather.value && weather.value.icon)
  if (!isFinite(n)) return 'cloudy'
  if (n === 100 || n === 150) return 'sunny'
  if ((n >= 101 && n <= 104) || (n >= 151 && n <= 154)) return 'cloudy'
  if (n >= 302 && n <= 304) return 'storm'
  if (n >= 300 && n <= 399) return 'rainy'
  if (n >= 400 && n <= 499) return 'snowy'
  if (n >= 500 && n <= 515) return 'fog'
  return 'cloudy'
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '超级 VIP，夜色专属'
  if (hour < 12) return '早安，超级 VIP'
  if (hour < 14) return '中午好，天龙人'
  if (hour < 18) return '下午好，超级 VIP'
  return '晚上好，超凡时刻'
})

onMounted(() => {
  layoutTopEntries()
  pickHealingQuote()
  loadMoodEntry()
  refreshWeather()
  refreshOwnerAndQuotes()
})

onUnmounted(() => {
  clearWeatherFx()
})

onShow(() => {
  loadMoodEntry()
  if (!weather.value) refreshWeather()
  refreshOwnerAndQuotes()
})

async function refreshOwner() {
  isOwner.value = await loadOwnerFlag()
  if (!isOwner.value) isOwner.value = isOwnerSync()
}

/** 非主人维持原状；主人拉取私有语录供上下轮播 */
async function refreshOwnerAndQuotes() {
  await refreshOwner()
  if (!isOwner.value) {
    myQuotes.value = []
    return
  }
  await loadHomeQuotes()
}

function pickHealingQuote() {
  const list = HEALING_QUOTES
  if (!list.length) return
  let next = list[Math.floor(Math.random() * list.length)]
  if (list.length > 1 && next === healingQuote.value) {
    next = list[Math.floor(Math.random() * list.length)]
  }
  healingQuote.value = next
}

async function loadHomeQuotes() {
  try {
    myQuotes.value = await getQuotes()
  } catch (err) {
    console.error('加载首页语录失败', err)
    myQuotes.value = []
  }
}

function openQuoteAdd() {
  quoteEditingId.value = ''
  quoteDraft.value = ''
  quoteEditOpen.value = true
  quoteInputFocus.value = false
  nextTick(() => {
    quoteInputFocus.value = true
  })
}

function openQuoteEditItem(item) {
  quoteEditingId.value = item._id
  quoteDraft.value = item.content || ''
  quoteEditOpen.value = true
  quoteInputFocus.value = false
  nextTick(() => {
    quoteInputFocus.value = true
  })
}

function closeQuoteEdit() {
  quoteEditOpen.value = false
  quoteEditingId.value = ''
  quoteDraft.value = ''
  quoteInputFocus.value = false
}

async function saveQuoteEdit() {
  if (quoteSaving.value) return
  const content = quoteDraft.value.trim()
  if (!content) {
    uni.showToast({ title: '请输入语录内容', icon: 'none' })
    return
  }
  quoteSaving.value = true
  try {
    if (quoteEditingId.value) {
      await updateQuote(quoteEditingId.value, content)
      uni.showToast({ title: '已更新', icon: 'success' })
    } else {
      await addQuote(content)
      uni.showToast({ title: '已添加', icon: 'success' })
    }
    closeQuoteEdit()
    await loadHomeQuotes()
  } catch (err) {
    console.error('保存语录失败', err)
    uni.showToast({ title: '保存失败，请检查云数据库', icon: 'none' })
  } finally {
    quoteSaving.value = false
  }
}

async function openQuoteList() {
  quoteListOpen.value = true
  quoteListLoading.value = true
  try {
    myQuotes.value = await getQuotes()
  } catch (err) {
    console.error('加载语录列表失败', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    quoteListLoading.value = false
  }
}

function closeQuoteList() {
  quoteListOpen.value = false
}

async function removeQuoteItem(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除这句语录吗？',
  })
  if (!res.confirm) return
  try {
    await removeQuote(item._id)
    myQuotes.value = myQuotes.value.filter((q) => q._id !== item._id)
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (err) {
    console.error('删除语录失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

watch(weatherIconKind, () => {
  syncWeatherFx()
})

function clearWeatherFx() {
  weatherFxToken += 1
  weatherFxSrc.value = ''
}

function onWeatherFxError() {
  weatherFxSrc.value = ''
}

async function syncWeatherFx() {
  if (!weather.value) {
    clearWeatherFx()
    return
  }
  const kind = weatherIconKind.value
  const token = ++weatherFxToken
  try {
    const path = await getWeatherFxLocalPath(kind)
    if (token !== weatherFxToken) return
    if (!weather.value) return
    if (weatherIconKind.value !== kind) return
    if (!path) {
      weatherFxSrc.value = ''
      return
    }
    if (weatherFxSrc.value === path) return
    weatherFxSrc.value = path
    await wait(32)
    if (token !== weatherFxToken) return
    try {
      uni.createVideoContext('weatherFxVideo').play()
    } catch (e) {
      // autoplay 已开
    }
  } catch (err) {
    console.error('加载天气视频失败', err)
    if (token !== weatherFxToken) return
    weatherFxSrc.value = ''
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function refreshWeather() {
  try {
    const data = await loadHomeWeather({ force: false })
    if (!data) return
    if (data.temp === '' || data.temp == null) return
    weather.value = data
    syncWeatherFx()
  } catch (err) {
    console.error('加载天气失败', err)
  }
}

async function toggleWeatherCity() {
  if (weatherBusy.value) return
  weatherBusy.value = true
  weatherTextPhase.value = 'out'

  const cur = (weather.value && weather.value.city) || COMMON_CITIES[0]
  const idx = COMMON_CITIES.indexOf(cur)
  const next = COMMON_CITIES[idx === 0 ? 1 : 0]

  try {
    await new Promise((resolve) => setTimeout(resolve, 160))
    const data = await loadHomeWeather({ city: next, force: true })
    if (data) {
      weather.value = data
      syncWeatherFx()
    }
    weatherTextPhase.value = 'in'
    await new Promise((resolve) => setTimeout(resolve, 280))
  } catch (err) {
    console.error('切换天气失败', err)
  } finally {
    weatherTextPhase.value = ''
    weatherBusy.value = false
  }
}

/** 左上角心情头像；天气坞紧挨其右侧；内容区顶距避开这一行 */
function layoutTopEntries() {
  const sys = uni.getSystemInfoSync()
  const menu = wx.getMenuButtonBoundingClientRect()
  const edgePad = 16
  const gap = 10
  // 头像 64px；天气坞同高、更窄
  const avatarSize = 64
  const dockW = 148
  const dockH = avatarSize
  const contentGap = 28
  const statusTop = (sys.statusBarHeight || 20) + 6
  const top = menu && menu.top ? menu.top : statusTop
  const rowH = avatarSize
  const navBottom = menu && menu.height ? menu.top + menu.height : top + 32
  const padTop = Math.max(48, top + rowH - navBottom + contentGap)

  moodEntryStyle.value = {
    top: top + 'px',
    left: edgePad + 'px',
    width: avatarSize + 'px',
    height: avatarSize + 'px',
  }
  weatherDockStyle.value = {
    top: top + 'px',
    left: edgePad + avatarSize + gap + 'px',
    width: dockW + 'px',
    height: dockH + 'px',
  }
  contentPadStyle.value = {
    paddingTop: padTop + 'px',
  }
}

async function applyMoodEntryItem(item) {
  if (!item) {
    moodImageUrl.value = ''
    return
  }
  applyMoodThemeFromItem(item)
  if (!item.fileID) {
    moodImageUrl.value = ''
    return
  }
  const urlMap = await resolveMoodImageUrls([item])
  moodImageUrl.value = urlMap[item.fileID] || ''
}

async function loadMoodEntry() {
  try {
    const list = await listMoodEmojis()
    registerMoodThemes(list)
    const data = await getMoodByDate(getToday())
    let item = null
    if (data && data.moodKey) {
      item = await getMoodEmojiByKey(data.moodKey)
    }
    // 今日未选心情时，默认展示云目录第一个
    if (!item && list.length) {
      item = list[0]
    }
    await applyMoodEntryItem(item)
    prefetchMoodCatalog()
  } catch (err) {
    console.error('加载首页心情失败', err)
  }
}

function onMoodChange(item) {
  if (!item) return
  applyMoodThemeFromItem(item)
  moodImageUrl.value = item.imageUrl || ''
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
  z-index: 111;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.72);
  border: 3rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 6rpx 20rpx rgba(43, 127, 212, 0.14);
  box-sizing: border-box;
}

.mood-entry-img {
  width: 100%;
  height: 100%;
  display: block;
}

.mood-entry-text {
  font-size: 22rpx;
  font-weight: 500;
  color: $color-subtitle;
  letter-spacing: 2rpx;
  line-height: 1;
}

.content {
  position: relative;
  z-index: 1;
  padding: 48rpx 40rpx 80rpx;
  box-sizing: border-box;
}

.hero {
  margin-bottom: 56rpx;
  padding-top: 8rpx;
}

.content--vip .greeting {
  font-size: 44rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  white-space: nowrap;
  color: $color-primary-dark;
}

.content--vip .hero-desc {
  font-size: 28rpx;
  font-weight: 600;
}

.content--vip .entry-name {
  font-size: 26rpx;
  font-weight: 700;
}

.hero--vip {
  /* 天气坞是 fixed，问候不再额外缩右，保证一行显示 */
  padding-right: 0;
}

.greeting {
  display: block;
  font-size: 48rpx;
  font-weight: 500;
  color: $color-primary-dark;
  letter-spacing: 6rpx;
  margin-bottom: 12rpx;
  white-space: nowrap;
}

.weather-dock {
  position: fixed;
  z-index: 110;
  display: flex;
  align-items: center;
  min-height: 0;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.28);
  border: 1rpx solid rgba(255, 255, 255, 0.42);
  box-shadow: 0 6rpx 20rpx rgba(43, 127, 212, 0.1);
  box-sizing: border-box;
}

.weather-dock-video {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  border-radius: 999rpx;
}

.weather-dock-tint {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
  background: rgba(232, 244, 252, 0.42);
}

.weather-dock-body {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10rpx;
  width: 100%;
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.weather-dock-body.is-out {
  opacity: 0;
  transform: translateY(-8rpx);
}

.weather-dock-body.is-in {
  animation: weatherTextIn 0.28s ease;
}

.weather-temp {
  flex-shrink: 0;
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1;
  letter-spacing: 0;
  text-shadow: 0 1rpx 4rpx rgba(255, 255, 255, 0.75);
}

.weather-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4rpx;
}

.weather-cond {
  display: flex;
  align-items: center;
  gap: 4rpx;
  margin-top: 0;
}

.weather-cond-text {
  font-size: 18rpx;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.weather-city-row {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 0;
}

.weather-city {
  font-size: 18rpx;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.weather-toggle {
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 159, 232, 0.12);
  box-sizing: border-box;
}

.weather-toggle.busy {
  background: rgba(74, 159, 232, 0.22);
}

.toggle-spin {
  position: relative;
  width: 20rpx;
  height: 20rpx;
}

.toggle-spin.spin {
  animation: weatherSpin 0.65s cubic-bezier(0.4, 0, 0.2, 1);
}

.spin-arc {
  position: absolute;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  border: 2rpx solid transparent;
  box-sizing: border-box;
}

.spin-arc-a {
  left: 2rpx;
  top: 0;
  border-top-color: $color-primary;
  border-right-color: $color-primary;
  transform: rotate(-20deg);
}

.spin-arc-b {
  right: 2rpx;
  bottom: 0;
  border-bottom-color: $color-primary;
  border-left-color: $color-primary;
  transform: rotate(-20deg);
}

.spin-tip {
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
}

.spin-tip.tip-a {
  top: 0;
  right: 1rpx;
  border-width: 0 0 7rpx 6rpx;
  border-color: transparent transparent $color-primary transparent;
  transform: rotate(28deg);
}

.spin-tip.tip-b {
  bottom: 0;
  left: 1rpx;
  border-width: 7rpx 6rpx 0 0;
  border-color: $color-primary transparent transparent transparent;
  transform: rotate(28deg);
}

/* 天气状况 CSS 图标 */
.wx-ico {
  position: relative;
  width: 22rpx;
  height: 22rpx;
  flex-shrink: 0;
}

.wx-ico.ico-sunny::before {
  content: '';
  position: absolute;
  left: 6rpx;
  top: 6rpx;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #f5a623;
  box-shadow: 0 0 0 3rpx rgba(245, 166, 35, 0.25);
}

.wx-ico.ico-cloudy::before,
.wx-ico.ico-rainy::before,
.wx-ico.ico-snowy::before,
.wx-ico.ico-storm::before {
  content: '';
  position: absolute;
  left: 2rpx;
  top: 8rpx;
  width: 18rpx;
  height: 12rpx;
  border-radius: 10rpx;
  background: rgba(107, 143, 168, 0.55);
}

.wx-ico.ico-cloudy::after,
.wx-ico.ico-rainy::after,
.wx-ico.ico-snowy::after {
  content: '';
  position: absolute;
  left: 10rpx;
  top: 4rpx;
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: rgba(107, 143, 168, 0.7);
}

.wx-ico.ico-rainy::before {
  box-shadow:
    4rpx 16rpx 0 -6rpx $color-primary,
    11rpx 18rpx 0 -6rpx $color-primary,
    18rpx 16rpx 0 -6rpx $color-primary;
}

.wx-ico.ico-snowy::before {
  box-shadow:
    6rpx 17rpx 0 -5rpx rgba(120, 160, 200, 0.95),
    14rpx 19rpx 0 -5rpx rgba(120, 160, 200, 0.95);
}

.wx-ico.ico-storm::after {
  content: '';
  position: absolute;
  left: 12rpx;
  top: 12rpx;
  width: 0;
  height: 0;
  border-left: 5rpx solid transparent;
  border-right: 5rpx solid transparent;
  border-top: 11rpx solid #f5a623;
}

.wx-ico.ico-fog::before,
.wx-ico.ico-fog::after {
  content: '';
  position: absolute;
  left: 2rpx;
  right: 2rpx;
  height: 3rpx;
  border-radius: 2rpx;
  background: rgba(107, 143, 168, 0.55);
}

.wx-ico.ico-fog::before {
  top: 8rpx;
  box-shadow: 0 8rpx 0 rgba(107, 143, 168, 0.4);
}

.wx-ico.ico-fog::after {
  top: 16rpx;
  left: 6rpx;
  right: 6rpx;
}

@keyframes weatherSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes weatherTextIn {
  from {
    opacity: 0;
    transform: translateY(8rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-quote {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.quote-swiper {
  flex: 1;
  min-width: 0;
  height: 100rpx;
}

.quote-slide {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
}

.hero-desc {
  flex: 1;
  min-width: 0;
  width: 100%;
  font-size: 28rpx;
  font-weight: 400;
  color: $color-primary-dark;
  line-height: 1.75;
  letter-spacing: 1rpx;
  opacity: 0.92;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 轮播视口约两行，超出省略 */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.quote-ops {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
  padding-top: 4rpx;
}

.quote-ico {
  width: 52rpx;
  height: 52rpx;
  border-radius: 16rpx;
  background: rgba(74, 159, 232, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.quote-ico--active {
  opacity: 0.75;
}

.ico-plus {
  position: relative;
  width: 22rpx;
  height: 22rpx;
}

.ico-plus-h,
.ico-plus-v {
  position: absolute;
  background: $color-primary-dark;
  border-radius: 2rpx;
}

.ico-plus-h {
  left: 0;
  right: 0;
  top: 9rpx;
  height: 4rpx;
}

.ico-plus-v {
  top: 0;
  bottom: 0;
  left: 9rpx;
  width: 4rpx;
}

.ico-lines {
  width: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 5rpx;
}

.ico-lines-row {
  height: 3rpx;
  border-radius: 2rpx;
  background: $color-primary-dark;
}

.ico-lines-row.mid {
  width: 86%;
}

.ico-lines-row.short {
  width: 64%;
}

.modal-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
}

.modal-panel {
  position: fixed;
  left: 48rpx;
  right: 48rpx;
  top: 50%;
  transform: translateY(-50%);
  background: $color-card;
  border-radius: 28rpx;
  padding: 36rpx 32rpx 32rpx;
  box-shadow: 0 16rpx 48rpx rgba(43, 127, 212, 0.18);
  z-index: 201;
  box-sizing: border-box;
}

.modal-panel--list {
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  padding-bottom: 24rpx;
}

.modal-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 24rpx;
  text-align: center;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.list-title {
  margin-bottom: 0;
  text-align: left;
}

.list-close {
  font-size: 26rpx;
  font-weight: 600;
  color: $color-subtitle;
  padding: 8rpx 4rpx;
}

.list-empty {
  padding: 64rpx 0;
  text-align: center;
  font-size: 28rpx;
  color: $color-subtitle;
}

.quote-list-scroll {
  max-height: 56vh;
  margin-top: 12rpx;
}

.quote-list-item {
  padding: 22rpx 0;
  border-bottom: 1rpx solid rgba(74, 159, 232, 0.12);
}

.quote-list-item:last-child {
  border-bottom: none;
}

.quote-list-content {
  display: block;
  font-size: 28rpx;
  color: $color-title;
  line-height: 1.6;
}

.quote-list-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
}

.quote-list-time {
  font-size: 22rpx;
  color: $color-subtitle;
}

.quote-list-actions {
  display: flex;
  gap: 24rpx;
}

.quote-link {
  font-size: 26rpx;
  font-weight: 600;
  color: $color-primary-dark;
}

.quote-link.danger {
  color: #c45c5c;
}

.field-area {
  width: 100%;
  min-height: 200rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
  box-sizing: border-box;
  background: rgba(74, 159, 232, 0.08);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: $color-title;
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 20rpx;
  padding: 22rpx 0;
}

.btn-cancel {
  color: $color-subtitle;
  background: rgba(0, 0, 0, 0.04);
}

.btn-confirm {
  color: #fff;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
}

.btn-confirm.disabled {
  opacity: 0.6;
}

.entry-section {
  margin-top: 32rpx;
}

.entry-section:first-of-type {
  margin-top: 28rpx;
}

.section-head {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 18rpx;
  padding-left: 4rpx;
}

.section-accent {
  width: 10rpx;
  height: 36rpx;
  margin-right: 14rpx;
  border-radius: 4rpx;
  background: linear-gradient(180deg, $color-primary 0%, $color-primary-dark 100%);
  transform: skewY(-8deg);
  flex-shrink: 0;
}

.section-title-wrap {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  z-index: 1;
}

.section-title {
  font-size: 42rpx;
  font-weight: 800;
  color: $color-title;
  letter-spacing: 6rpx;
  line-height: 1.1;
}

.section-sub {
  font-size: 18rpx;
  font-weight: 600;
  color: $color-primary;
  letter-spacing: 3rpx;
  opacity: 0.55;
  transform: translateY(-4rpx);
}

.section-line {
  flex: 1;
  height: 6rpx;
  margin-left: 16rpx;
  border-radius: 999rpx;
  background: linear-gradient(
    90deg,
    rgba(74, 159, 232, 0.35) 0%,
    rgba(74, 159, 232, 0.08) 55%,
    transparent 100%
  );
  transform: skewX(-12deg);
}

.entry-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 14rpx;
}

.entry-card {
  box-sizing: border-box;
  width: calc((100% - 42rpx) / 4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16rpx 6rpx 12rpx;
  background: $color-card-soft;
  border-radius: 18rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.92);
  box-shadow: $shadow-card-elevated;
  transform: translateY(0);
  transition:
    opacity 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.entry-card--active {
  opacity: 0.94;
  transform: translateY(2rpx);
  box-shadow: $shadow-card-pressed;
}

.entry-icon-box {
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  background: linear-gradient(145deg, $color-primary 0%, $color-primary-dark 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10rpx;
  flex-shrink: 0;
  box-sizing: border-box;
  box-shadow: $shadow-icon;
}

.entry-icon-box > view {
  transform: scale(0.78);
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
  background: $color-primary-dark;
  opacity: 0.55;
}

.icon-novel-page {
  position: absolute;
  left: 14rpx;
  right: 8rpx;
  top: 10rpx;
  bottom: 10rpx;
  border-radius: 2rpx;
  background: linear-gradient(180deg, rgba(74, 159, 232, 0.2) 0%, rgba(74, 159, 232, 0.08) 100%);
}

.icon-diet {
  position: relative;
  width: 44rpx;
  height: 44rpx;
}

.icon-diet-plate {
  position: absolute;
  left: 4rpx;
  right: 4rpx;
  top: 10rpx;
  bottom: 6rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.92);
  box-sizing: border-box;
}

.icon-diet-leaf {
  position: absolute;
  right: 6rpx;
  top: 4rpx;
  width: 14rpx;
  height: 20rpx;
  border-radius: 0 12rpx 12rpx 12rpx;
  background: rgba(255, 255, 255, 0.88);
  transform: rotate(28deg);
}

.entry-name {
  display: block;
  width: 100%;
  font-size: 20rpx;
  font-weight: 600;
  color: $color-title;
  letter-spacing: 0.5rpx;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 1.3;
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

.fade-in-delay {
  animation: fadeIn 0.7s ease-out 0.12s both;
}

/* 不用事先 opacity:0：部分机型 animation 不触发时菜单会永久隐藏 */
.entry-delay-0 {
  animation: fadeIn 0.55s ease-out 0.18s both;
}

.entry-delay-1 {
  animation: fadeIn 0.55s ease-out 0.26s both;
}

.entry-delay-2 {
  animation: fadeIn 0.55s ease-out 0.34s both;
}

.entry-delay-3 {
  animation: fadeIn 0.55s ease-out 0.42s both;
}

.entry-delay-4 {
  animation: fadeIn 0.55s ease-out 0.5s both;
}

.entry-delay-5 {
  animation: fadeIn 0.55s ease-out 0.58s both;
}

.entry-delay-6 {
  animation: fadeIn 0.55s ease-out 0.66s both;
}
</style>
