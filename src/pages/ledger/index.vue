<template>
  <PageRoot>
    <view class="ledger-page">
      <view class="today-card">
        <view class="today-top">
          <text class="today-label">今日支出</text>
          <view class="month-link" @tap="goMonth">
            <view class="month-link-row">
              <view class="icon-month">
                <view class="icon-month-bar b1" />
                <view class="icon-month-bar b2" />
                <view class="icon-month-bar b3" />
              </view>
              <text class="month-link-text">本月支出</text>
              <text class="month-link-arrow">›</text>
            </view>
            <text class="month-link-amount">¥{{ formatAmount(monthTotal) }}</text>
          </view>
        </view>
        <text class="today-date">{{ today }}</text>
        <text class="today-total">¥{{ formatAmount(todayTotal) }}</text>
      </view>

      <view class="form-card">
        <view class="form-fields">
          <input
            class="form-input amount-input"
            type="digit"
            v-model="amountText"
            placeholder="0.00"
            :maxlength="10"
          />
          <input
            class="form-input note-input"
            v-model="noteText"
            placeholder="可选，如午餐"
            :maxlength="40"
            confirm-type="done"
            @confirm="handleSave"
          />
        </view>
        <view class="action-save" :class="{ disabled: saving }" @tap="handleSave">
          <text class="action-save-text">{{ saving ? '保存中' : '记下' }}</text>
        </view>
      </view>

      <view class="list-header">
        <text class="list-title">今日明细</text>
        <text class="list-count">{{ todayList.length }} 笔</text>
      </view>

      <PageLoading v-if="loading" />
      <view v-else-if="todayList.length === 0" class="status-tip">今天还没有支出</view>
      <view v-else class="expense-list">
        <view v-for="item in todayList" :key="item._id" class="expense-item">
          <view class="expense-main">
            <text class="expense-amount">¥{{ formatAmount(item.amount) }}</text>
            <text class="expense-note">{{ item.note || '无备注' }}</text>
          </view>
          <view class="expense-side">
            <text class="expense-time">{{ formatTime(item.createdAt) }}</text>
            <text class="expense-del" @tap="handleDelete(item)">删除</text>
          </view>
        </view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import {
  getToday,
  getTodayExpenses,
  getExpensesInRange,
  addExpense,
  removeExpense,
  formatTime,
} from '@/api/ledger'
import { getBillingPeriod } from '@/utils/billingPeriod'

const today = getToday()
const amountText = ref('')
const noteText = ref('')
const todayList = ref([])
const loading = ref(false)
const saving = ref(false)
const monthTotal = ref(0)

const todayTotal = computed(() => {
  let sum = 0
  for (let i = 0; i < todayList.value.length; i++) {
    sum += Number(todayList.value[i].amount) || 0
  }
  return sum
})

onMounted(() => {
  loadToday()
  loadMonthTotal()
})

function formatAmount(n) {
  const num = Number(n) || 0
  return num.toFixed(2)
}

function goMonth() {
  uni.navigateTo({ url: '/pages/ledger/month' })
}

async function loadToday() {
  loading.value = true
  try {
    todayList.value = await getTodayExpenses()
  } catch (err) {
    console.error('加载今日支出失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadMonthTotal() {
  const period = getBillingPeriod(getToday())
  try {
    const rows = await getExpensesInRange(period.start, period.end)
    let sum = 0
    for (let i = 0; i < rows.length; i++) {
      sum += Number(rows[i].amount) || 0
    }
    monthTotal.value = sum
  } catch (err) {
    console.error('加载本月支出失败', err)
  }
}

async function handleSave() {
  if (saving.value) return
  const amount = parseAmount(amountText.value)
  if (amount === null) {
    uni.showToast({ title: '请输入有效金额', icon: 'none' })
    return
  }

  saving.value = true
  try {
    await addExpense({ amount, note: noteText.value.trim() })
    amountText.value = ''
    noteText.value = ''
    await loadToday()
    await loadMonthTotal()
  } catch (err) {
    console.error('保存支出失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

function parseAmount(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  const num = Number(raw)
  if (!num || num <= 0 || !isFinite(num)) return null
  return Math.round(num * 100) / 100
}

async function handleDelete(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: `删除这笔 ¥${formatAmount(item.amount)} 吗？`,
  })
  if (!res.confirm) return

  try {
    await removeExpense(item._id)
    await loadToday()
    await loadMonthTotal()
  } catch (err) {
    console.error('删除支出失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.ledger-page {
  padding-bottom: 48rpx;
}

.today-card {
  background: $color-card;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: $shadow-card;
  margin-bottom: 24rpx;
}

.today-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.today-label {
  font-size: 28rpx;
  color: $color-subtitle;
  line-height: 1.4;
}

.month-link {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 10rpx 16rpx;
  margin: -10rpx -8rpx 0 16rpx;
  background: rgba(74, 159, 232, 0.12);
  border-radius: 16rpx;
}

.month-link-row {
  display: flex;
  align-items: center;
  margin-bottom: 4rpx;
}

.icon-month {
  display: flex;
  align-items: flex-end;
  gap: 3rpx;
  height: 22rpx;
  margin-right: 8rpx;
}

.icon-month-bar {
  width: 5rpx;
  border-radius: 2rpx;
  background: $color-primary-dark;
}

.icon-month-bar.b1 {
  height: 10rpx;
}

.icon-month-bar.b2 {
  height: 16rpx;
}

.icon-month-bar.b3 {
  height: 22rpx;
}

.month-link-text {
  font-size: 28rpx;
  font-weight: 700;
  color: $color-primary-dark;
  letter-spacing: 1rpx;
  line-height: 1.2;
}

.month-link-arrow {
  margin-left: 2rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $color-primary-dark;
  line-height: 1;
}

.month-link-amount {
  font-size: 32rpx;
  font-weight: 700;
  color: #e74c3c;
}

.today-date {
  display: block;
  font-size: 26rpx;
  color: $color-subtitle;
  margin-bottom: 16rpx;
}

.today-total {
  display: block;
  font-size: 64rpx;
  font-weight: 700;
  color: $color-title;
  letter-spacing: 1rpx;
}

.form-card {
  background: $color-card;
  border-radius: 36rpx;
  padding: 54rpx 48rpx 60rpx;
  box-shadow: $shadow-card;
  margin-bottom: 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.form-fields {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 36rpx;
  width: 100%;
}

.form-input {
  height: 144rpx;
  padding: 0 36rpx;
  box-sizing: border-box;
  background: rgba(74, 159, 232, 0.08);
  border-radius: 30rpx;
  color: $color-title;
  text-align: center;
}

.amount-input {
  width: 360rpx;
  font-size: 60rpx;
  font-weight: 700;
}

.note-input {
  width: 420rpx;
  font-size: 34rpx;
}

.action-save {
  margin-top: 54rpx;
  width: 240rpx;
  height: 240rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  box-shadow: 0 18rpx 42rpx rgba(43, 127, 212, 0.35);
}

.action-save.disabled {
  opacity: 0.5;
}

.action-save-text {
  font-size: 51rpx;
  font-weight: 700;
  color: #fff;
}

.list-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16rpx;
  padding: 0 8rpx;
}

.list-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $color-title;
}

.list-count {
  font-size: 24rpx;
  color: $color-subtitle;
}

.status-tip {
  padding: 48rpx 24rpx;
  text-align: center;
  font-size: 26rpx;
  color: $color-subtitle;
}

.expense-list {
  background: $color-card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.expense-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.expense-item:last-child {
  border-bottom: none;
}

.expense-main {
  flex: 1;
  min-width: 0;
}

.expense-amount {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $color-title;
  margin-bottom: 6rpx;
}

.expense-note {
  display: block;
  font-size: 24rpx;
  color: $color-subtitle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expense-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 24rpx;
  flex-shrink: 0;
}

.expense-time {
  font-size: 22rpx;
  color: $color-subtitle;
  margin-bottom: 10rpx;
}

.expense-del {
  font-size: 24rpx;
  color: #e74c3c;
}
</style>
