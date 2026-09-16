import { ref } from 'vue'

/** 当前页是否已滚动离开顶部（供 CustomNav 吸顶底色） */
export const navPageScrolled = ref(false)

export function setNavPageScrolled(scrollTop) {
  navPageScrolled.value = (scrollTop || 0) > 4
}
