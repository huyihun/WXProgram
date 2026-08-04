<template>
  <PageRoot>
    <view class="supplies-page">
      <view class="page-toolbar">
        <view class="toolbar-left">
          <text class="total-label">总价值</text>
          <text class="total-value">¥{{ totalValue }}</text>
        </view>
        <view class="toolbar-right">
          <text class="list-count">{{ list.length }} 件</text>
          <text class="btn-add-open" @tap="openAdd">新增</text>
        </view>
      </view>

      <view v-if="loading" class="status-tip">加载中...</view>
      <view v-else class="group-list">
        <view v-for="group in clothingGroups" :key="group.id" class="group-block">
          <view class="group-header" @tap="toggleGroup(group.id)">
            <text class="group-name">{{ group.name }}</text>
            <text class="group-count">{{ group.items.length }} 件</text>
            <text class="group-arrow" :class="{ open: expanded[group.id] }">›</text>
          </view>
          <view v-if="expanded[group.id]" class="group-body">
            <view v-if="group.items.length === 0" class="group-empty">暂无</view>
            <view v-else class="supply-list">
              <view v-for="item in group.items" :key="item._id" class="supply-item">
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
                </view>
                <view class="rating-row">
                  <text
                    v-for="star in 5"
                    :key="star"
                    class="star"
                    :class="{ on: star <= item.rating }"
                  >★</text>
                </view>
                <text v-if="item.review" class="review-text">{{ item.review }}</text>
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
        </view>
      </view>
    </view>

    <view v-if="modalOpen" class="modal-mask" @tap="closeModal" @touchmove.stop.prevent />
    <view v-if="modalOpen" class="modal-panel" @tap.stop @touchmove.stop>
      <text class="modal-title">{{ editingId ? '编辑' : '新增' }}个人服装</text>
      <view class="subtype-row">
        <text
          v-for="opt in CLOTHING_SUBTYPES"
          :key="opt.id"
          class="subtype-chip"
          :class="{ on: form.subtype === opt.id }"
          @tap="setSubtype(opt.id)"
        >{{ opt.name }}</text>
      </view>
      <input class="field" v-model="form.name" placeholder="名称" :maxlength="30" />
      <input class="field" v-model="form.brand" placeholder="品牌" :maxlength="30" />
      <input class="field" type="digit" v-model="form.price" placeholder="价格" :maxlength="10" />
      <input class="field" v-model="form.quality" placeholder="规格/品质" :maxlength="20" />
      <input class="field" v-model="form.channel" placeholder="进货渠道" :maxlength="30" />
      <view class="rating-editor">
        <text class="rating-label">评价</text>
        <view class="rating-stars">
          <text
            v-for="star in 5"
            :key="star"
            class="star star-lg"
            :class="{ on: star <= form.rating }"
            @tap="setRating(star)"
          >★</text>
        </view>
      </view>
      <textarea
        class="field-review"
        v-model="form.review"
        placeholder="写点评价…"
        :maxlength="200"
        :auto-height="true"
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
  listRatedItems,
  addRatedItem,
  updateRatedItem,
  removeRatedItem,
} from '@/api/supplyRated'

const CATEGORY = 'clothing'

const CLOTHING_SUBTYPES = [
  { id: 'tops', name: '衣服' },
  { id: 'pants', name: '裤子' },
  { id: 'underwear', name: '内裤' },
  { id: 'socks', name: '袜子' },
  { id: 'shoes', name: '鞋子' },
]

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
  rating: 5,
  review: '',
  subtype: 'tops',
})

/** 五组默认全部收起 */
const expanded = ref({
  tops: false,
  pants: false,
  underwear: false,
  socks: false,
  shoes: false,
})

const totalValue = computed(() => {
  let sum = 0
  for (let i = 0; i < list.value.length; i++) {
    sum += Number(list.value[i].price) || 0
  }
  return sum.toFixed(2)
})

const clothingGroups = computed(() => {
  const map = {}
  for (let i = 0; i < CLOTHING_SUBTYPES.length; i++) {
    map[CLOTHING_SUBTYPES[i].id] = []
  }
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i]
    const key = item.subtype && map[item.subtype] ? item.subtype : 'tops'
    map[key].push(item)
  }
  return CLOTHING_SUBTYPES.map((opt) => ({
    id: opt.id,
    name: opt.name,
    items: map[opt.id],
  }))
})

onShow(() => {
  loadList()
})

function formatAmount(n) {
  return (Number(n) || 0).toFixed(2)
}

function setRating(star) {
  form.value.rating = star
}

function setSubtype(id) {
  form.value.subtype = id
}

function toggleGroup(id) {
  const next = {}
  const keys = Object.keys(expanded.value)
  for (let i = 0; i < keys.length; i++) {
    next[keys[i]] = expanded.value[keys[i]]
  }
  next[id] = !expanded.value[id]
  expanded.value = next
}

function resetForm() {
  form.value = {
    name: '',
    brand: '',
    price: '',
    quality: '',
    channel: '',
    rating: 5,
    review: '',
    subtype: 'tops',
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
    rating: Number(item.rating) || 5,
    review: item.review || '',
    subtype: item.subtype || 'tops',
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
    list.value = await listRatedItems(CATEGORY)
  } catch (err) {
    console.error('加载个人服装失败', err)
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

  const payload = {
    name,
    brand: (form.value.brand || '').trim(),
    price,
    quality: (form.value.quality || '').trim(),
    channel: (form.value.channel || '').trim(),
    rating: form.value.rating || 5,
    review: (form.value.review || '').trim(),
    subtype: form.value.subtype || 'tops',
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateRatedItem(editingId.value, payload)
    } else {
      await addRatedItem({ ...payload, category: CATEGORY })
    }
    modalOpen.value = false
    resetForm()
    editingId.value = ''
    await loadList()
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (err) {
    console.error('保存个人服装失败', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function handleDelete(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '删除「' + item.name + '」吗？',
  })
  if (!res.confirm) return
  try {
    await removeRatedItem(item._id)
    await loadList()
  } catch (err) {
    console.error('删除个人服装失败', err)
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.supplies-page {
  padding-bottom: 48rpx;
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

.group-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.group-block {
  background: $color-card;
  border-radius: 24rpx;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  gap: 16rpx;
}

.group-name {
  flex: 1;
  font-size: 30rpx;
  font-weight: 700;
  color: $color-title;
}

.group-count {
  font-size: 24rpx;
  color: $color-subtitle;
}

.group-arrow {
  font-size: 36rpx;
  color: $color-primary;
  font-weight: 300;
  transform: rotate(90deg);
  transition: transform 0.2s ease;
}

.group-arrow.open {
  transform: rotate(-90deg);
}

.group-body {
  padding: 0 24rpx 24rpx;
}

.group-empty {
  padding: 16rpx 8rpx 8rpx;
  font-size: 26rpx;
  color: $color-subtitle;
  text-align: center;
}

.supply-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.supply-item {
  box-shadow: none;
  background: rgba(74, 159, 232, 0.06);
  border-radius: 24rpx;
  padding: 44rpx 36rpx 40rpx;
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

.rating-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 20rpx;
}

.star {
  font-size: 32rpx;
  line-height: 1;
  color: rgba(0, 0, 0, 0.15);
}

.star.on {
  color: #f5a623;
}

.star-lg {
  font-size: 44rpx;
  padding: 4rpx;
}

.review-text {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  color: $color-title;
  line-height: 1.5;
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
  max-height: 80vh;
  overflow-y: auto;
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

.subtype-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.subtype-chip {
  font-size: 26rpx;
  color: $color-subtitle;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 999rpx;
  padding: 12rpx 22rpx;
}

.subtype-chip.on {
  color: #fff;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  font-weight: 600;
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

.rating-editor {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
  padding: 0 4rpx;
}

.rating-label {
  font-size: 28rpx;
  color: $color-title;
  font-weight: 600;
}

.rating-stars {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.field-review {
  width: 100%;
  min-height: 140rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
  box-sizing: border-box;
  background: rgba(74, 159, 232, 0.08);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: $color-title;
  line-height: 1.5;
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
