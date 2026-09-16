<template>
  <PageRoot flush fill>
    <view class="info-page">
      <view class="tabs">
        <view
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ on: activeKind === tab.id }"
          hover-class="tab--active"
          @tap="switchKind(tab.id)"
        >
          <text class="tab-text">{{ tab.name }}</text>
        </view>
      </view>

      <scroll-view scroll-y class="main-scroll" :show-scrollbar="false">
        <PageLoading v-if="bootLoading || listLoading" />

        <view v-else-if="activeKind === 'private' && !privateUnlocked" class="pin-gate">
          <text class="pin-title">{{ pinMode === 'setup' ? '设置私密 PIN' : '输入私密 PIN' }}</text>
          <text class="pin-sub">
            {{ pinMode === 'setup' ? '首次进入，请设置 4–6 位数字' : '验证通过后可查看私密记录' }}
          </text>
          <input
            class="pin-input"
            type="number"
            password
            :maxlength="6"
            :value="pinInput"
            placeholder="PIN"
            placeholder-class="ph"
            @input="onPinInput"
          />
          <input
            v-if="pinMode === 'setup'"
            class="pin-input"
            type="number"
            password
            :maxlength="6"
            :value="pinConfirm"
            placeholder="再输入一次"
            placeholder-class="ph"
            @input="onPinConfirm"
          />
          <view
            class="primary-btn"
            :class="{ disabled: pinBusy }"
            hover-class="primary-btn--active"
            @tap="handlePinSubmit"
          >
            <text class="primary-btn-text">{{ pinBusy ? '处理中...' : pinMode === 'setup' ? '保存' : '解锁' }}</text>
          </view>
        </view>

        <template v-else>
          <view v-if="!list.length" class="empty">
            <text class="empty-text">暂无记录，点下方新增</text>
          </view>
          <view v-else class="list">
            <view v-for="item in list" :key="item._id" class="card">
              <view class="card-head">
                <text class="card-title">{{ item.title || '未命名' }}</text>
                <view class="card-actions">
                  <text class="link" @tap="openEdit(item)">编辑</text>
                  <text class="link danger" @tap="handleRemove(item)">删除</text>
                </view>
              </view>
              <view v-if="item.account" class="row" @tap="copyText(item.account, '账号')">
                <text class="row-label">账号</text>
                <text class="row-value">{{ item.account }}</text>
                <text class="row-copy">复制</text>
              </view>
              <view v-if="item.secret" class="row" @tap="copyText(item.secret, '密码')">
                <text class="row-label">密码</text>
                <text class="row-value">{{ item.secret }}</text>
                <text class="row-copy">复制</text>
              </view>
              <view v-if="item.url" class="row" @tap="copyText(item.url, '网址')">
                <text class="row-label">网址</text>
                <text class="row-value">{{ item.url }}</text>
                <text class="row-copy">复制</text>
              </view>
              <view v-if="item.note" class="note">
                <text class="note-text">{{ item.note }}</text>
              </view>
            </view>
          </view>
        </template>
      </scroll-view>

      <view
        v-if="!(activeKind === 'private' && !privateUnlocked)"
        class="fab"
        hover-class="fab--active"
        @tap="openCreate"
      >
        <text class="fab-text">新增</text>
      </view>
    </view>

    <view class="sheet-mask" :class="{ show: formOpen }" @tap="closeForm" />
    <view class="sheet" :class="{ open: formOpen }" @touchmove.stop>
      <view class="sheet-handle" />
      <view class="sheet-head">
        <text class="sheet-title">{{ editingId ? '编辑' : '新增' }}</text>
        <text class="sheet-close" @tap="closeForm">关闭</text>
      </view>
      <scroll-view scroll-y class="sheet-body">
        <view class="field">
          <text class="field-label">名称</text>
          <input class="field-input" :value="form.title" placeholder="如公司邮箱" placeholder-class="ph" @input="onForm('title', $event)" />
        </view>
        <view class="field">
          <text class="field-label">账号</text>
          <input class="field-input" :value="form.account" placeholder="账号" placeholder-class="ph" @input="onForm('account', $event)" />
        </view>
        <view class="field">
          <text class="field-label">密码</text>
          <input class="field-input" :value="form.secret" placeholder="密码/密钥" placeholder-class="ph" @input="onForm('secret', $event)" />
        </view>
        <view class="field">
          <text class="field-label">网址</text>
          <input class="field-input" :value="form.url" placeholder="可选" placeholder-class="ph" @input="onForm('url', $event)" />
        </view>
        <view class="field">
          <text class="field-label">备注</text>
          <textarea
            class="field-area"
            :value="form.note"
            placeholder="可选"
            placeholder-class="ph"
            :maxlength="200"
            :auto-height="true"
            :show-confirm-bar="false"
            @input="onForm('note', $event)"
          />
        </view>
      </scroll-view>
      <view class="sheet-foot">
        <view
          class="primary-btn"
          :class="{ disabled: formBusy }"
          hover-class="primary-btn--active"
          @tap="handleSave"
        >
          <text class="primary-btn-text">{{ formBusy ? '保存中...' : '保存' }}</text>
        </view>
      </view>
    </view>
  </PageRoot>
</template>

<script setup>
import {
  listByKind,
  addRecord,
  updateRecord,
  removeRecord,
  getPinDoc,
  setPin,
  verifyPin,
} from '@/api/infoRecords'

const tabs = [
  { id: 'work', name: '工作' },
  { id: 'life', name: '生活' },
  { id: 'private', name: '私密' },
]

const activeKind = ref('work')
const bootLoading = ref(true)
const listLoading = ref(false)
const list = ref([])

const privateUnlocked = ref(false)
const pinMode = ref('verify')
const pinInput = ref('')
const pinConfirm = ref('')
const pinBusy = ref(false)
let pinReady = false

const formOpen = ref(false)
const formBusy = ref(false)
const editingId = ref('')
const form = ref({
  title: '',
  account: '',
  secret: '',
  url: '',
  note: '',
})

onMounted(async () => {
  try {
    await ensurePinMode()
    await loadList()
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    bootLoading.value = false
  }
})

async function ensurePinMode() {
  if (pinReady) return
  const doc = await getPinDoc()
  pinMode.value = doc ? 'verify' : 'setup'
  pinReady = true
}

async function switchKind(kind) {
  if (kind === activeKind.value) return
  activeKind.value = kind
  if (kind === 'private') {
    await ensurePinMode()
    if (!privateUnlocked.value) {
      list.value = []
      return
    }
  }
  await loadList()
}

async function loadList() {
  if (activeKind.value === 'private' && !privateUnlocked.value) {
    list.value = []
    return
  }
  listLoading.value = true
  try {
    list.value = await listByKind(activeKind.value)
  } catch (e) {
    console.error(e)
    list.value = []
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    listLoading.value = false
  }
}

function onPinInput(e) {
  pinInput.value = (e.detail && e.detail.value) || ''
}

function onPinConfirm(e) {
  pinConfirm.value = (e.detail && e.detail.value) || ''
}

function validPin(value) {
  return /^\d{4,6}$/.test(value)
}

async function handlePinSubmit() {
  if (pinBusy.value) return
  const a = String(pinInput.value || '').trim()
  if (!validPin(a)) {
    uni.showToast({ title: '请输入 4–6 位数字', icon: 'none' })
    return
  }

  pinBusy.value = true
  try {
    if (pinMode.value === 'setup') {
      const b = String(pinConfirm.value || '').trim()
      if (a !== b) {
        uni.showToast({ title: '两次不一致', icon: 'none' })
        return
      }
      await setPin(a)
      pinMode.value = 'verify'
      privateUnlocked.value = true
      pinInput.value = ''
      pinConfirm.value = ''
      uni.showToast({ title: '已设置', icon: 'success' })
      await loadList()
      return
    }

    const ok = await verifyPin(a)
    if (!ok) {
      uni.showToast({ title: 'PIN 错误', icon: 'none' })
      return
    }
    privateUnlocked.value = true
    pinInput.value = ''
    await loadList()
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '操作失败', icon: 'none' })
  } finally {
    pinBusy.value = false
  }
}

function copyText(text, label) {
  if (!text) return
  uni.setClipboardData({
    data: String(text),
    success() {
      uni.showToast({ title: label + '已复制', icon: 'none' })
    },
  })
}

function emptyForm() {
  return { title: '', account: '', secret: '', url: '', note: '' }
}

function openCreate() {
  editingId.value = ''
  form.value = emptyForm()
  formOpen.value = true
}

function openEdit(item) {
  editingId.value = item._id
  form.value = {
    title: item.title || '',
    account: item.account || '',
    secret: item.secret || '',
    url: item.url || '',
    note: item.note || '',
  }
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
}

function onForm(key, e) {
  form.value[key] = (e.detail && e.detail.value) || ''
}

async function handleSave() {
  if (formBusy.value) return
  const title = (form.value.title || '').trim()
  if (!title) {
    uni.showToast({ title: '请填写名称', icon: 'none' })
    return
  }
  formBusy.value = true
  try {
    if (editingId.value) {
      await updateRecord(editingId.value, form.value)
    } else {
      await addRecord(activeKind.value, form.value)
    }
    formOpen.value = false
    uni.showToast({ title: '已保存', icon: 'success' })
    await loadList()
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    formBusy.value = false
  }
}

function handleRemove(item) {
  uni.showModal({
    title: '删除记录',
    content: '确定删除「' + (item.title || '未命名') + '」？',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await removeRecord(item._id)
        uni.showToast({ title: '已删除', icon: 'none' })
        await loadList()
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '删除失败', icon: 'none' })
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.info-page {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8rpx 32rpx 0;
  box-sizing: border-box;
}

.tabs {
  display: flex;
  gap: 14rpx;
  flex-shrink: 0;
  margin-bottom: 16rpx;
}

.tab {
  flex: 1;
  height: 64rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab.on {
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
}

.tab-text {
  font-size: 28rpx;
  font-weight: 600;
  color: $color-title;
}

.tab.on .tab-text {
  color: #fff;
}

.tab--active {
  opacity: 0.88;
}

.main-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
}

.pin-gate {
  margin-top: 32rpx;
  padding: 32rpx 24rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: $shadow-card;
}

.pin-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: $color-title;
  margin-bottom: 10rpx;
}

.pin-sub {
  display: block;
  font-size: 24rpx;
  color: $color-subtitle;
  margin-bottom: 28rpx;
  line-height: 1.5;
}

.pin-input {
  height: 80rpx;
  border-radius: 14rpx;
  background: $color-card-soft;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: $color-title;
  margin-bottom: 18rpx;
  letter-spacing: 8rpx;
}

.empty {
  padding: 80rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 26rpx;
  color: $color-subtitle;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding-bottom: 24rpx;
}

.card {
  background: rgba(255, 255, 255, 0.88);
  border-radius: 22rpx;
  padding: 22rpx 24rpx 12rpx;
  box-shadow: $shadow-card;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.card-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 700;
  color: $color-title;
  margin-right: 14rpx;
}

.card-actions {
  display: flex;
  gap: 18rpx;
  flex-shrink: 0;
}

.link {
  font-size: 24rpx;
  color: $color-primary;
}

.link.danger {
  color: #c45c4a;
}

.row {
  display: flex;
  align-items: center;
  min-height: 56rpx;
  padding: 6rpx 0;
  border-top: 1rpx solid rgba(0, 0, 0, 0.04);
}

.row-label {
  width: 64rpx;
  flex-shrink: 0;
  font-size: 22rpx;
  color: $color-subtitle;
}

.row-value {
  flex: 1;
  font-size: 26rpx;
  color: $color-title;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-copy {
  flex-shrink: 0;
  margin-left: 14rpx;
  font-size: 22rpx;
  color: $color-primary;
}

.note {
  padding: 10rpx 0 6rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.04);
}

.note-text {
  font-size: 24rpx;
  color: $color-subtitle;
  line-height: 1.55;
}

.primary-btn {
  height: 80rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.primary-btn.disabled {
  opacity: 0.55;
}

.primary-btn--active {
  opacity: 0.9;
}

.primary-btn-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
}

.fab {
  flex-shrink: 0;
  margin: 16rpx 0 calc(24rpx + env(safe-area-inset-bottom));
  height: 88rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 28rpx rgba(107, 68, 35, 0.22);
}

.fab--active {
  opacity: 0.92;
}

.fab-text {
  font-size: 30rpx;
  font-weight: 700;
  color: #fff;
}

.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(40, 28, 20, 0.35);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.25s ease, visibility 0.25s ease;
  z-index: 200;
}

.sheet-mask.show {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 72vh;
  display: flex;
  flex-direction: column;
  background: $color-card;
  border-radius: 28rpx 28rpx 0 0;
  transform: translateY(100%);
  transition: transform 0.25s ease;
  z-index: 201;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  pointer-events: none;
}

.sheet.open {
  transform: translateY(0);
  pointer-events: auto;
}

.sheet-handle {
  width: 64rpx;
  height: 8rpx;
  border-radius: 8rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 16rpx auto 0;
  flex-shrink: 0;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 32rpx 14rpx;
  flex-shrink: 0;
}

.sheet-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $color-title;
}

.sheet-close {
  font-size: 26rpx;
  color: $color-primary;
  padding: 8rpx;
}

.sheet-body {
  flex: 1;
  height: 0;
  padding: 0 32rpx;
  box-sizing: border-box;
}

.sheet-foot {
  padding: 14rpx 32rpx 20rpx;
  flex-shrink: 0;
}

.field {
  margin-bottom: 20rpx;
}

.field-label {
  display: block;
  font-size: 22rpx;
  color: $color-subtitle;
  margin-bottom: 8rpx;
}

.field-input {
  height: 72rpx;
  border-radius: 14rpx;
  background: $color-card-soft;
  padding: 0 22rpx;
  font-size: 28rpx;
  color: $color-title;
}

.field-area {
  min-height: 110rpx;
  width: 100%;
  border-radius: 14rpx;
  background: $color-card-soft;
  padding: 18rpx 22rpx;
  font-size: 26rpx;
  color: $color-title;
  box-sizing: border-box;
}

.ph {
  color: rgba(141, 110, 99, 0.55);
}
</style>
