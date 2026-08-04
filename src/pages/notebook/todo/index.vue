<template>
  <PageRoot bottom="160rpx">
<!-- 筛选 Tab -->
    <view class="filter-bar">
      <view
        v-for="f in filters"
        :key="f.key"
        class="filter-item"
        :class="{ active: currentFilter === f.key }"
        @tap="handleFilterChange(f.key)"
      >
        {{ f.label }}
      </view>
    </view>

    <!-- 待办列表 -->
    <view v-if="loading" class="status-tip">加载中...</view>
    <view v-else-if="todoList.length === 0" class="empty">
      <text class="empty-text">暂无待办，在下方添加一条吧</text>
    </view>
    <view v-else class="todo-list">
      <view v-for="item in todoList" :key="item._id" class="todo-item">
        <view class="todo-check" @tap="handleToggle(item)">
          <view class="checkbox" :class="{ checked: item.done }">
            <text v-if="item.done" class="check-mark">✓</text>
          </view>
        </view>
        <text class="todo-title" :class="{ done: item.done }">{{ item.title }}</text>
        <text class="todo-delete" @tap="handleDelete(item)">删除</text>
      </view>
    </view>

    <!-- 底部添加栏 -->
    <view class="add-bar">
      <input
        v-model="newTitle"
        class="add-input"
        placeholder="输入待办事项..."
        confirm-type="done"
        @confirm="handleAdd"
      />
      <button class="add-btn" @tap="handleAdd">添加</button>
    </view>
  </PageRoot>
</template>

<script setup>
import { getTodos, addTodo, toggleTodo, removeTodo } from '@/api/notebook'

const filters = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '未完成' },
  { key: 'done', label: '已完成' },
]

const currentFilter = ref('all')
const todoList = ref([])
const newTitle = ref('')
const loading = ref(false)

onShow(() => {
  loadList()
})

async function loadList() {
  loading.value = true
  try {
    todoList.value = await getTodos(currentFilter.value)
  } catch (err) {
    console.error('加载待办失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function handleFilterChange(key) {
  currentFilter.value = key
  loadList()
}

async function handleAdd() {
  const title = newTitle.value.trim()
  if (!title) {
    uni.showToast({ title: '请输入待办内容', icon: 'none' })
    return
  }

  try {
    await addTodo(title)
    newTitle.value = ''
    await loadList()
    uni.showToast({ title: '已添加', icon: 'success' })
  } catch (err) {
    console.error('添加待办失败', err)
    uni.showToast({ title: '添加失败', icon: 'none' })
  }
}

async function handleToggle(item) {
  try {
    await toggleTodo(item._id, !item.done)
    item.done = !item.done
    if (currentFilter.value !== 'all') {
      await loadList()
    }
  } catch (err) {
    console.error('更新待办失败', err)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function handleDelete(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除这条待办吗？',
  })
  if (!res.confirm) return

  try {
    await removeTodo(item._id)
    await loadList()
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (err) {
    console.error('删除待办失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.filter-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.filter-item {
  padding: 12rpx 28rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: $color-subtitle;
  background: rgba(255, 255, 255, 0.6);
}

.filter-item.active {
  background: $color-primary;
  color: #fff;
  font-weight: 500;
}

.status-tip,
.empty {
  text-align: center;
  padding: 80rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: $color-subtitle;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  background: $color-card-glass;
  border: 1rpx solid $color-card-border;
  border-radius: 20rpx;
  box-shadow: $shadow-card;
}

.todo-check {
  margin-right: 20rpx;
  flex-shrink: 0;
}

.checkbox {
  width: 40rpx;
  height: 40rpx;
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
  font-size: 24rpx;
  font-weight: bold;
}

.todo-title {
  flex: 1;
  font-size: 30rpx;
  color: $color-title;
}

.todo-title.done {
  color: $color-subtitle;
  text-decoration: line-through;
}

.todo-delete {
  font-size: 24rpx;
  color: #e74c3c;
  margin-left: 16rpx;
  flex-shrink: 0;
}

.add-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.95);
  border-top: 1rpx solid $color-card-border;
  gap: 16rpx;
}

.add-input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  background: $color-bg;
  border-radius: 36rpx;
  font-size: 28rpx;
}

.add-btn {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 32rpx;
  background: $color-primary;
  color: #fff;
  border-radius: 36rpx;
  font-size: 28rpx;
  border: none;
}
</style>
