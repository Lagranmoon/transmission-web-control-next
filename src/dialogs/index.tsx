// 对话框入口：宿主组件按 uiStore.dialogs 栈渲染具体对话框。
// 各对话框实现由 DialogHost 直接按需引入，此处不再重复 re-export（避免新增对话框要改两处）。
export { DialogHost } from './DialogHost'
