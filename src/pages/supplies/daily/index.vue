<template>
  <PageRoot>
    <view class="supplies-page">
      <view v-if="emptyTips.length" class="empty-tips">
        <text v-for="tip in emptyTips" :key="tip.id" class="empty-tip">{{ tip.text }}</text>
      </view>

      <view class="page-toolbar">
        <view class="toolbar-left">
          <text class="total-label">总价值</text>
          <text class="total-value">¥{{ totalValue }}</text>
        </view>
        <view class="toolbar-right">
          <text class="list-count">{{ list.length }} 件</text>
          <text class="btn-add-open" @tap="openAdd">新增消耗品</text>
        </view>
      </view>

      <view v-if="loading" class="status-tip">加载中...</view>
      <view v-else-if="list.length === 0" class="status-tip">还没有日常消耗品，先添加一件吧</view>
      <view v-else class="supply-list">
        <view v-for="item in list" :key="item._id" class="supply-item">
          <view class="supply-top">
            <text class="supply-name">{{ item.name }}</text>
            <text class="supply-price">¥{{ formatAmount(item.price) }}</text>
          </view>
          <view class="supply-meta">
            <text class="meta-text">品牌 {{ item.brand || '—' }}</text>
            <text class="meta-dot">·</text>
            <text class="meta-text">规格 {{ item.quality || '—' }}</text>
            <text class="meta-dot">·</text>
            <text class="meta-text">渠道 {{ item.channel || '—' }}</text>
            <text class="meta-dot">·</text>
            <text class="meta-text">日耗 {{ item.dailyConsume || 0 }}%</text>
          </view>
          <view class="remain-row">
            <view
              class="remain-bar"
              :id="'bar-' + item._id"
              @touchstart.stop="onBarStart(item, $event)"
              @touchmove.stop.prevent="onBarMove(item, $event)"
              @touchend.stop="onBarEnd(item)"
              @touchcancel.stop="onBarEnd(item)"
            >
              <view class="remain-track" />
              <view
                class="remain-fill"
                :class="{ low: item.remainPercent <= 20 }"
                :style="{ width: remainWidth(item.remainPercent) }"
              >
                <view class="remain-thumb" />
              </view>
            </view>
            <view class="remain-input-wrap">
              <input
                class="remain-input"
                type="number"
                :value="String(item.remainPercent)"
                :maxlength="3"
                @blur="onRemainInput(item, $event)"
                @confirm="onRemainInput(item, $event)"
              />
              <text class="remain-unit">%</text>
            </view>
          </view>
          <view class="supply-actions">
            <view class="btn-icon" @tap="handleDelete(item)">
              <view class="icon-trash">
                <view class="icon-trash-cap" />
                <view class="icon-trash-lid" />
                <view class="icon-trash-body">
                  <view class="icon-trash-line" />
                  <view class="icon-trash-line" />
                </view>
              </view>
            </view>
            <view class="btn-icon" @tap="openEdit(item)">
              <view class="icon-edit">
                <view class="icon-edit-paper">
                  <view class="icon-edit-line" />
                  <view class="icon-edit-line short" />
                </view>
                <view class="icon-edit-pen">
                  <view class="icon-edit-nib" />
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="modalOpen" class="modal-mask" @tap="closeModal" @touchmove.stop.prevent />
    <view v-if="modalOpen" class="modal-panel" @tap.stop @touchmove.stop>
      <text class="modal-title">{{ editingId ? '编辑消耗品' : '新增消耗品' }}</text>
      <input class="field" v-model="form.name" placeholder="名称，如洗衣液" :maxlength="30" />
      <input class="field" v-model="form.brand" placeholder="品牌" :maxlength="30" />
      <input class="field" type="digit" v-model="form.price" placeholder="价格" :maxlength="10" />
      <input
        class="field"
        v-model="form.quality"
        placeholder="质量/规格，如 500ml"
        :maxlength="20"
      />
      <input class="field" v-model="form.channel" placeholder="进货渠道" :maxlength="30" />
      <input
        class="field"
        type="digit"
        v-model="form.dailyConsume"
        placeholder="每日消耗进度%，如 5"
        :maxlength="3"
      />
      <view class="modal-actions">
        <text class="btn-cancel" @tap="closeModal">取消</text>
        <text class="btn-confirm" :class="{ disabled: saving }" @tap="handleSave">
          {{ saving ? '保存中…' : '保存' }}
        </text>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import {
  listSupplies,
  addSupply,
  updateSupply,
  removeSupply,
  syncDailyConsume,
} from '@/api/supplies'

const list = ref([])
const loading = ref(false)
const saving = ref(false)
const modalOpen = ref(false)
const editingId = ref('')
const form = ref({
  name: '',
  brand: '',
  price: '',
  quality: '',
  channel: '',
  dailyConsume: '',
})

/** 拖进度条时缓存条形区域，避免每次 touchmove 都 query */
const barRects = {}
const draggingId = ref('')

const emptyTips = computed(() => {
  return list.value
    .filter((item) => Number(item.remainPercent) <= 0)
    .map((item) => ({
      id: item._id,
      text: '老登，你的' + (item.name || '消耗品') + '用完了，赶紧去买',
    }))
})

const totalValue = computed(() => {
  let sum = 0
  for (let i = 0; i < list.value.length; i++) {
    sum += Number(list.value[i].price) || 0
  }
  return sum.toFixed(2)
})

onShow(() => {
  loadList()
})

function formatAmount(n) {
  return (Number(n) || 0).toFixed(2)
}

function remainWidth(n) {
  let v = Number(n)
  if (!isFinite(v) || v < 0) v = 0
  if (v > 100) v = 100
  return v + '%'
}

function clampRemain(n) {
  let v = Number(n)
  if (!isFinite(v)) v = 0
  if (v < 0) v = 0
  if (v > 100) v = 100
  return Math.round(v)
}

function resetForm() {
  form.value = {
    name: '',
    brand: '',
    price: '',
    quality: '',
    channel: '',
    dailyConsume: '',
  }
}

function openAdd() {
  editingId.value = ''
  resetForm()
  modalOpen.value = true
}

function openEdit(item) {
  editingId.value = item._id
  form.value = {
    name: item.name || '',
    brand: item.brand || '',
    price: String(item.price != null ? item.price : ''),
    quality: item.quality || '',
    channel: item.channel || '',
    dailyConsume: String(item.dailyConsume != null ? item.dailyConsume : ''),
  }
  modalOpen.value = true
}

function closeModal() {
  if (saving.value) return
  modalOpen.value = false
}

async function loadList() {
  loading.value = true
  try {
    const raw = await listSupplies()
    list.value = await syncDailyConsume(raw)
  } catch (err) {
    console.error('加载日常消耗品失败', err)
    uni.showToast({ title: '加载失败，请检查云数据库', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (saving.value) return
  const name = (form.value.name || '').trim()
  if (!name) {
    uni.showToast({ title: '请填写名称', icon: 'none' })
    return
  }
  const price = Number(form.value.price)
  if (!form.value.price || !isFinite(price) || price < 0) {
    uni.showToast({ title: '请输入有效价格', icon: 'none' })
    return
  }

  let daily = form.value.dailyConsume === '' ? 0 : Number(form.value.dailyConsume)
  if (!isFinite(daily) || daily < 0) {
    uni.showToast({ title: '每日消耗请填 0–100', icon: 'none' })
    return
  }
  if (daily > 100) daily = 100

  const payload = {
    name,
    brand: (form.value.brand || '').trim(),
    price,
    quality: (form.value.quality || '').trim(),
    channel: (form.value.channel || '').trim(),
    dailyConsume: Math.round(daily),
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateSupply(editingId.value, payload)
    } else {
      await addSupply({ ...payload, remainPercent: 100 })
    }
    modalOpen.value = false
    resetForm()
    editingId.value = ''
    await loadList()
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (err) {
    console.error('保存日常消耗品失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

function applyRemainFromTouch(item, e) {
  const rect = barRects[item._id]
  if (!rect || !rect.width) return
  const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
  if (!touch) return
  item.remainPercent = clampRemain(((touch.clientX - rect.left) / rect.width) * 100)
}

function onBarStart(item, e) {
  draggingId.value = item._id
  uni
    .createSelectorQuery()
    .select('#bar-' + item._id)
    .boundingClientRect((rect) => {
      barRects[item._id] = rect
      applyRemainFromTouch(item, e)
    })
    .exec()
}

function onBarMove(item, e) {
  if (draggingId.value !== item._id) return
  applyRemainFromTouch(item, e)
}

async function saveRemain(item, value) {
  const next = clampRemain(value)
  item.remainPercent = next
  try {
    await updateSupply(item._id, { remainPercent: next })
  } catch (err) {
    console.error('更新剩余量失败', err)
    uni.showToast({ title: '更新失败', icon: 'none' })
    loadList()
  }
}

async function onBarEnd(item) {
  if (draggingId.value !== item._id) return
  draggingId.value = ''
  await saveRemain(item, item.remainPercent)
}

async function onRemainInput(item, e) {
  const raw = e && e.detail ? e.detail.value : ''
  await saveRemain(item, raw)
}

async function handleDelete(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '删除「' + item.name + '」吗？',
  })
  if (!res.confirm) return
  try {
    await removeSupply(item._id)
    await loadList()
  } catch (err) {
    console.error('删除日常消耗品失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.supplies-page {
  padding-bottom: 48rpx;
}

.empty-tips {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.empty-tip {
  display: block;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: rgba(231, 76, 60, 0.1);
  border: 1rpx solid rgba(231, 76, 60, 0.25);
  color: #c0392b;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.5;
}

.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 40rpx;
  padding: 0 4rpx;
}

.toolbar-left {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  min-width: 0;
}

.total-label {
  font-size: 24rpx;
  color: $color-subtitle;
}

.total-value {
  font-size: 32rpx;
  font-weight: 700;
  color: #e74c3c;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-shrink: 0;
}

.list-count {
  font-size: 24rpx;
  color: $color-subtitle;
}

.btn-add-open {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  border-radius: 999rpx;
  padding: 12rpx 24rpx;
}

.status-tip {
  padding: 48rpx 24rpx;
  text-align: center;
  font-size: 26rpx;
  color: $color-subtitle;
}

.supply-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.supply-item {
  background: $color-card;
  border-radius: 24rpx;
  padding: 44rpx 36rpx 40rpx;
  box-shadow: $shadow-card;
}

.supply-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}

.supply-name {
  flex: 1;
  font-size: 32rpx;
  font-weight: 700;
  color: $color-title;
}

.supply-price {
  font-size: 30rpx;
  font-weight: 700;
  color: #e74c3c;
}

.supply-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 14rpx;
  gap: 8rpx;
}

.meta-text {
  font-size: 24rpx;
  color: $color-subtitle;
}

.meta-dot {
  font-size: 24rpx;
  color: $color-subtitle;
}

.remain-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 28rpx;
}

.remain-bar {
  position: relative;
  flex: 1;
  height: 48rpx;
}

.remain-track {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 18rpx;
  margin-top: -9rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.06);
}

.remain-fill {
  position: absolute;
  left: 0;
  top: 50%;
  height: 18rpx;
  margin-top: -9rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, $color-primary, $color-primary-dark);
  min-width: 18rpx;
}

.remain-fill.low {
  background: linear-gradient(90deg, #ef9a9a, #e74c3c);
}

.remain-thumb {
  position: absolute;
  right: -14rpx;
  top: 50%;
  width: 28rpx;
  height: 28rpx;
  margin-top: -14rpx;
  border-radius: 50%;
  background: #fff;
  border: 5rpx solid $color-primary;
  box-sizing: border-box;
  box-shadow: 0 2rpx 10rpx rgba(43, 127, 212, 0.28);
}

.remain-fill.low .remain-thumb {
  border-color: #e74c3c;
}

.remain-input-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 2rpx;
}

.remain-input {
  width: 72rpx;
  height: 52rpx;
  padding: 0 6rpx;
  box-sizing: border-box;
  text-align: center;
  font-size: 26rpx;
  font-weight: 700;
  color: $color-title;
  background: rgba(74, 159, 232, 0.08);
  border-radius: 12rpx;
}

.remain-unit {
  font-size: 24rpx;
  font-weight: 700;
  color: $color-title;
}

.supply-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
}

.btn-icon {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-trash {
  width: 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.icon-trash-cap {
  width: 12rpx;
  height: 5rpx;
  border-radius: 3rpx 3rpx 0 0;
  background: #e74c3c;
}

.icon-trash-lid {
  width: 32rpx;
  height: 5rpx;
  border-radius: 2rpx;
  background: #e74c3c;
  margin-bottom: 2rpx;
}

.icon-trash-body {
  width: 24rpx;
  height: 26rpx;
  border: 3rpx solid #e74c3c;
  border-top: none;
  border-radius: 0 0 4rpx 4rpx;
  display: flex;
  justify-content: space-evenly;
  align-items: flex-end;
  padding-bottom: 4rpx;
  box-sizing: border-box;
}

.icon-trash-line {
  width: 2rpx;
  height: 14rpx;
  background: #e74c3c;
  border-radius: 2rpx;
}

.icon-edit {
  position: relative;
  width: 36rpx;
  height: 36rpx;
}

.icon-edit-paper {
  position: absolute;
  left: 2rpx;
  top: 4rpx;
  width: 24rpx;
  height: 28rpx;
  border: 3rpx solid $color-primary;
  border-radius: 5rpx;
  box-sizing: border-box;
  background: rgba(74, 159, 232, 0.08);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5rpx;
  padding: 0 4rpx;
}

.icon-edit-line {
  height: 3rpx;
  border-radius: 2rpx;
  background: $color-primary;
  opacity: 0.55;
}

.icon-edit-line.short {
  width: 60%;
}

.icon-edit-pen {
  position: absolute;
  right: 2rpx;
  bottom: 4rpx;
  width: 8rpx;
  height: 24rpx;
  background: $color-primary;
  border-radius: 3rpx 3rpx 1rpx 1rpx;
  transform: rotate(42deg);
  box-shadow: 0 0 0 3rpx #fff;
}

.icon-edit-nib {
  position: absolute;
  left: 0;
  bottom: -7rpx;
  width: 0;
  height: 0;
  border-left: 4rpx solid transparent;
  border-right: 4rpx solid transparent;
  border-top: 7rpx solid $color-primary;
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
  opacity: 0.5;
}
</style>
