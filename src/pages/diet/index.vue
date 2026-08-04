<template>
  <PageRoot>
    <view class="diet-page">
      <!-- 头部：打卡 -->
      <view class="header">
        <view class="header-main">
          <text class="title">减肥之旅</text>
          <text class="checkin-day">{{ checkinLabel }}</text>
        </view>
        <text
          class="checkin-btn"
          :class="{ done: checkedToday, disabled: checkinBusy }"
          @tap="handleCheckin"
        >
          {{ checkedToday ? '今日已打卡' : '今日打卡' }}
        </text>
      </view>

      <!-- 今日待办 -->
      <view class="section">
        <view class="section-head">
          <view class="section-accent" />
          <text class="section-title">今日待办</text>
        </view>
        <view class="todo-add">
          <input
            v-model="todoDraft"
            class="todo-input"
            placeholder="如：跑步 1 公里、俯卧撑 100 个"
            confirm-type="done"
            :maxlength="60"
            @confirm="handleAddTodo"
          />
          <text class="todo-add-btn" @tap="handleAddTodo">添加</text>
        </view>
        <view v-if="todosLoading" class="status-tip">加载中...</view>
        <view v-else-if="todos.length === 0" class="status-tip">今天还没有待办</view>
        <view v-else class="todo-list">
          <view v-for="item in todos" :key="item._id" class="todo-item">
            <view class="todo-check" @tap="handleToggleTodo(item)">
              <view class="checkbox" :class="{ checked: item.done }">
                <text v-if="item.done" class="check-mark">✓</text>
              </view>
            </view>
            <text class="todo-title" :class="{ done: item.done }">{{ item.title }}</text>
            <text class="link-danger" @tap="handleRemoveTodo(item)">删除</text>
          </view>
        </view>
      </view>

      <!-- 今日饮食 -->
      <view class="section">
        <view class="section-head">
          <view class="section-accent" />
          <text class="section-title">今日饮食</text>
          <text class="section-action" :class="{ disabled: mealSaving }" @tap="handleSaveMeal">
            {{ mealSaving ? '保存中…' : '保存' }}
          </text>
        </view>
        <text class="field-label">中午吃什么</text>
        <textarea
          v-model="lunch"
          class="field-area"
          placeholder="记录今天的午餐..."
          :maxlength="200"
          :show-confirm-bar="false"
        />
        <text class="field-label">晚上吃什么</text>
        <textarea
          v-model="dinner"
          class="field-area"
          placeholder="记录今天的晚餐..."
          :maxlength="200"
          :show-confirm-bar="false"
        />
      </view>

      <!-- 不能吃喝 -->
      <view class="section">
        <view class="section-head">
          <view class="section-accent" />
          <text class="section-title">不能吃 / 不能喝</text>
          <text class="section-action" @tap="openForbiddenAdd">添加</text>
        </view>
        <view class="forbid-cols">
          <view class="forbid-col">
            <text class="forbid-label">不能吃</text>
            <view v-if="foodList.length === 0" class="forbid-empty">暂无</view>
            <view v-for="item in foodList" :key="item._id" class="forbid-item">
              <text class="forbid-name">{{ item.name }}</text>
              <text class="link-danger" @tap="handleRemoveForbidden(item)">删</text>
            </view>
          </view>
          <view class="forbid-col">
            <text class="forbid-label">不能喝</text>
            <view v-if="drinkList.length === 0" class="forbid-empty">暂无</view>
            <view v-for="item in drinkList" :key="item._id" class="forbid-item">
              <text class="forbid-name">{{ item.name }}</text>
              <text class="link-danger" @tap="handleRemoveForbidden(item)">删</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 科学书籍 -->
      <view class="section">
        <view class="section-head">
          <view class="section-accent" />
          <text class="section-title">科学书籍</text>
          <text class="section-action" @tap="openBookAdd">添加</text>
        </view>
        <view v-if="books.length === 0" class="status-tip">暂无书籍</view>
        <view v-else class="book-list">
          <view v-for="item in books" :key="item._id" class="book-item">
            <view class="book-body">
              <text class="book-title">{{ item.title }}</text>
              <text v-if="item.note" class="book-note">{{ item.note }}</text>
            </view>
            <text class="link-danger" @tap="handleRemoveBook(item)">删除</text>
          </view>
        </view>
      </view>

      <!-- 失败复盘 -->
      <view class="section">
        <view class="section-head">
          <view class="section-accent" />
          <text class="section-title">失败复盘</text>
          <text
            class="section-action"
            :class="{ disabled: reflectSaving }"
            @tap="handleSaveReflection"
          >
            {{ reflectSaving ? '保存中…' : '保存今日' }}
          </text>
        </view>
        <textarea
          v-model="reflectDraft"
          class="field-area"
          placeholder="今天哪里没做到？写一点分析与总结..."
          :maxlength="500"
          :show-confirm-bar="false"
        />
        <view v-if="historyReflections.length" class="reflect-history">
          <text class="history-label">最近复盘</text>
          <view v-for="item in historyReflections" :key="item._id" class="reflect-item">
            <view class="reflect-top">
              <text class="reflect-date">{{ item.date }}</text>
              <text class="link-danger" @tap="handleRemoveReflection(item)">删除</text>
            </view>
            <text class="reflect-content">{{ item.content }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 禁忌弹框 -->
    <view v-if="forbidModalOpen" class="modal-mask" @tap="closeForbidModal" @touchmove.stop.prevent />
    <view v-if="forbidModalOpen" class="modal-panel" @tap.stop @touchmove.stop>
      <text class="modal-title">添加禁忌</text>
      <view class="kind-row">
        <text
          class="kind-chip"
          :class="{ active: forbidKind === 'food' }"
          @tap="forbidKind = 'food'"
        >
          不能吃
        </text>
        <text
          class="kind-chip"
          :class="{ active: forbidKind === 'drink' }"
          @tap="forbidKind = 'drink'"
        >
          不能喝
        </text>
      </view>
      <input
        v-model="forbidName"
        class="field"
        placeholder="名称，如奶茶、油炸食品"
        :maxlength="30"
      />
      <view class="modal-actions">
        <text class="btn-cancel" @tap="closeForbidModal">取消</text>
        <text class="btn-confirm" :class="{ disabled: forbidSaving }" @tap="handleAddForbidden">
          {{ forbidSaving ? '保存中…' : '保存' }}
        </text>
      </view>
    </view>

    <!-- 书籍弹框 -->
    <view v-if="bookModalOpen" class="modal-mask" @tap="closeBookModal" @touchmove.stop.prevent />
    <view v-if="bookModalOpen" class="modal-panel" @tap.stop @touchmove.stop>
      <text class="modal-title">添加书籍</text>
      <input v-model="bookTitle" class="field" placeholder="书名" :maxlength="40" />
      <textarea
        v-model="bookNote"
        class="field-area field-area--modal"
        placeholder="一句话科学依据 / 简介（选填）"
        :maxlength="120"
        :show-confirm-bar="false"
      />
      <view class="modal-actions">
        <text class="btn-cancel" @tap="closeBookModal">取消</text>
        <text class="btn-confirm" :class="{ disabled: bookSaving }" @tap="handleAddBook">
          {{ bookSaving ? '保存中…' : '保存' }}
        </text>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import {
  getToday,
  getTodayTodos,
  addTodo,
  toggleTodo,
  removeTodo,
  getTodayMeal,
  saveTodayMeal,
  listForbidden,
  addForbidden,
  removeForbidden,
  ensureDefaultBooks,
  addBook,
  removeBook,
  getCheckinStats,
  checkinToday,
  getTodayReflection,
  saveTodayReflection,
  listReflections,
  removeReflection,
} from '@/api/diet'
import { loadOwnerFlag } from '@/utils/owner'

const todos = ref([])
const todosLoading = ref(false)
const todoDraft = ref('')

const lunch = ref('')
const dinner = ref('')
const mealSaving = ref(false)

const forbidden = ref([])
const forbidModalOpen = ref(false)
const forbidKind = ref('food')
const forbidName = ref('')
const forbidSaving = ref(false)

const books = ref([])
const bookModalOpen = ref(false)
const bookTitle = ref('')
const bookNote = ref('')
const bookSaving = ref(false)

const checkinTotal = ref(0)
const checkedToday = ref(false)
const checkinBusy = ref(false)

const reflectDraft = ref('')
const reflectSaving = ref(false)
const reflections = ref([])

const foodList = computed(() => forbidden.value.filter((item) => item.kind !== 'drink'))
const drinkList = computed(() => forbidden.value.filter((item) => item.kind === 'drink'))

const checkinLabel = computed(() => {
  if (!checkinTotal.value) return '尚未打卡，从今天开始'
  return '打卡第 ' + checkinTotal.value + ' 天'
})

const historyReflections = computed(() => {
  const today = getToday()
  return reflections.value.filter((item) => item.date !== today)
})

onShow(async () => {
  const ok = await loadOwnerFlag()
  if (!ok) {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
    }, 400)
    return
  }
  loadAll()
})

async function loadAll() {
  todosLoading.value = true
  try {
    const [todoList, meal, forbidList, bookList, stats, todayReflect, reflectList] =
      await Promise.all([
        getTodayTodos(),
        getTodayMeal(),
        listForbidden(),
        ensureDefaultBooks(),
        getCheckinStats(),
        getTodayReflection(),
        listReflections(),
      ])
    todos.value = todoList
    lunch.value = meal.lunch || ''
    dinner.value = meal.dinner || ''
    forbidden.value = forbidList
    books.value = bookList
    checkinTotal.value = stats.total
    checkedToday.value = stats.checkedToday
    reflectDraft.value = todayReflect.content || ''
    reflections.value = reflectList
  } catch (err) {
    console.error('加载减肥数据失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    todosLoading.value = false
  }
}

async function handleCheckin() {
  if (checkedToday.value || checkinBusy.value) return
  checkinBusy.value = true
  try {
    await checkinToday()
    const stats = await getCheckinStats()
    checkinTotal.value = stats.total
    checkedToday.value = stats.checkedToday
    uni.showToast({ title: '打卡成功', icon: 'success' })
  } catch (err) {
    console.error('打卡失败', err)
    uni.showToast({ title: '打卡失败', icon: 'none' })
  } finally {
    checkinBusy.value = false
  }
}

async function handleAddTodo() {
  const title = todoDraft.value.trim()
  if (!title) {
    uni.showToast({ title: '请输入待办', icon: 'none' })
    return
  }
  try {
    await addTodo(title)
    todoDraft.value = ''
    todos.value = await getTodayTodos()
  } catch (err) {
    console.error('添加待办失败', err)
    uni.showToast({ title: '添加失败', icon: 'none' })
  }
}

async function handleToggleTodo(item) {
  try {
    await toggleTodo(item._id, !item.done)
    item.done = !item.done
  } catch (err) {
    console.error('更新待办失败', err)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function handleRemoveTodo(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除这条待办吗？',
  })
  if (!res.confirm) return
  try {
    await removeTodo(item._id)
    todos.value = todos.value.filter((row) => row._id !== item._id)
  } catch (err) {
    console.error('删除待办失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

async function handleSaveMeal() {
  if (mealSaving.value) return
  mealSaving.value = true
  try {
    await saveTodayMeal(lunch.value, dinner.value)
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (err) {
    console.error('保存饮食失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    mealSaving.value = false
  }
}

function openForbiddenAdd() {
  forbidKind.value = 'food'
  forbidName.value = ''
  forbidModalOpen.value = true
}

function closeForbidModal() {
  forbidModalOpen.value = false
}

async function handleAddForbidden() {
  if (forbidSaving.value) return
  const name = forbidName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入名称', icon: 'none' })
    return
  }
  forbidSaving.value = true
  try {
    await addForbidden(name, forbidKind.value)
    closeForbidModal()
    forbidden.value = await listForbidden()
  } catch (err) {
    console.error('添加禁忌失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    forbidSaving.value = false
  }
}

async function handleRemoveForbidden(item) {
  try {
    await removeForbidden(item._id)
    forbidden.value = forbidden.value.filter((row) => row._id !== item._id)
  } catch (err) {
    console.error('删除禁忌失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

function openBookAdd() {
  bookTitle.value = ''
  bookNote.value = ''
  bookModalOpen.value = true
}

function closeBookModal() {
  bookModalOpen.value = false
}

async function handleAddBook() {
  if (bookSaving.value) return
  const title = bookTitle.value.trim()
  if (!title) {
    uni.showToast({ title: '请输入书名', icon: 'none' })
    return
  }
  bookSaving.value = true
  try {
    await addBook(title, bookNote.value.trim())
    closeBookModal()
    books.value = await ensureDefaultBooks()
  } catch (err) {
    console.error('添加书籍失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    bookSaving.value = false
  }
}

async function handleRemoveBook(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除这本书吗？',
  })
  if (!res.confirm) return
  try {
    await removeBook(item._id)
    books.value = books.value.filter((row) => row._id !== item._id)
  } catch (err) {
    console.error('删除书籍失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

async function handleSaveReflection() {
  if (reflectSaving.value) return
  reflectSaving.value = true
  try {
    await saveTodayReflection(reflectDraft.value)
    reflections.value = await listReflections()
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (err) {
    console.error('保存复盘失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    reflectSaving.value = false
  }
}

async function handleRemoveReflection(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除这条复盘吗？',
  })
  if (!res.confirm) return
  try {
    await removeReflection(item._id)
    reflections.value = reflections.value.filter((row) => row._id !== item._id)
  } catch (err) {
    console.error('删除复盘失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.diet-page {
  padding: 8rpx 0 48rpx;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 36rpx;
  padding: 28rpx 24rpx;
  background: $color-card-soft;
  border-radius: 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 8rpx 24rpx rgba(43, 127, 212, 0.08);
}

.header-main {
  flex: 1;
  min-width: 0;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 8rpx;
}

.checkin-day {
  display: block;
  font-size: 26rpx;
  color: $color-primary-dark;
  font-weight: 600;
}

.checkin-btn {
  flex-shrink: 0;
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  border-radius: 999rpx;
  padding: 16rpx 28rpx;
}

.checkin-btn.done {
  color: $color-subtitle;
  background: rgba(0, 0, 0, 0.06);
}

.checkin-btn.disabled {
  opacity: 0.6;
}

.section {
  margin-bottom: 40rpx;
}

.section-head {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  gap: 12rpx;
}

.section-accent {
  width: 8rpx;
  height: 28rpx;
  border-radius: 4rpx;
  background: $color-primary;
  flex-shrink: 0;
}

.section-title {
  flex: 1;
  font-size: 32rpx;
  font-weight: 700;
  color: $color-title;
}

.section-action {
  font-size: 26rpx;
  font-weight: 600;
  color: $color-primary-dark;
  padding: 8rpx 4rpx;
}

.section-action.disabled {
  opacity: 0.5;
}

.status-tip {
  text-align: center;
  padding: 32rpx 0;
  font-size: 26rpx;
  color: $color-subtitle;
}

.todo-add {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.todo-input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  background: rgba(74, 159, 232, 0.08);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: $color-title;
}

.todo-add-btn {
  flex-shrink: 0;
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
  background: $color-primary;
  border-radius: 16rpx;
  padding: 18rpx 28rpx;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 22rpx 20rpx;
  background: $color-card-soft;
  border-radius: 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.9);
}

.todo-check {
  margin-right: 16rpx;
  flex-shrink: 0;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid $color-primary;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox.checked {
  background: $color-primary;
}

.check-mark {
  color: #fff;
  font-size: 22rpx;
  font-weight: bold;
}

.todo-title {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: $color-title;
}

.todo-title.done {
  color: $color-subtitle;
  text-decoration: line-through;
}

.link-danger {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #c45c5c;
  margin-left: 12rpx;
}

.field-label {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
  margin-bottom: 10rpx;
}

.field-area {
  width: 100%;
  min-height: 140rpx;
  padding: 18rpx 22rpx;
  margin-bottom: 16rpx;
  box-sizing: border-box;
  background: rgba(74, 159, 232, 0.08);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: $color-title;
  line-height: 1.55;
}

.field-area--modal {
  min-height: 120rpx;
}

.forbid-cols {
  display: flex;
  gap: 16rpx;
}

.forbid-col {
  flex: 1;
  min-width: 0;
  background: $color-card-soft;
  border-radius: 16rpx;
  padding: 18rpx 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.9);
}

.forbid-label {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: $color-primary-dark;
  margin-bottom: 12rpx;
}

.forbid-empty {
  font-size: 24rpx;
  color: $color-subtitle;
  padding: 8rpx 0;
}

.forbid-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
  padding: 10rpx 0;
  border-top: 1rpx solid rgba(74, 159, 232, 0.1);
}

.forbid-name {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  color: $color-title;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.book-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.book-item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 22rpx 20rpx;
  background: $color-card-soft;
  border-radius: 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.9);
}

.book-body {
  flex: 1;
  min-width: 0;
}

.book-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 6rpx;
}

.book-note {
  display: block;
  font-size: 24rpx;
  color: $color-subtitle;
  line-height: 1.5;
}

.reflect-history {
  margin-top: 12rpx;
}

.history-label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $color-subtitle;
  margin-bottom: 12rpx;
}

.reflect-item {
  padding: 18rpx 0;
  border-top: 1rpx solid rgba(74, 159, 232, 0.12);
}

.reflect-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.reflect-date {
  font-size: 24rpx;
  color: $color-subtitle;
}

.reflect-content {
  display: block;
  font-size: 26rpx;
  color: $color-title;
  line-height: 1.55;
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

.modal-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 24rpx;
  text-align: center;
}

.kind-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.kind-chip {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  font-weight: 600;
  color: $color-subtitle;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 16rpx;
  padding: 16rpx 0;
}

.kind-chip.active {
  color: #fff;
  background: $color-primary;
}

.field {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  margin-bottom: 16rpx;
  box-sizing: border-box;
  background: rgba(74, 159, 232, 0.08);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: $color-title;
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
</style>
