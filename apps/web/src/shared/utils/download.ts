/* [组件导读]
 * 业务名词：访问令牌用于接口身份验证；Attempt 是一次训练记录，角色分学生、教师和技术人员。
 * 用途：将收到的二进制文件交给浏览器下载。
 * 为什么与边界：临时对象地址用于本地下载，使用后需要释放，避免重复下载积累内存。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
/** 将后端返回的二进制内容保存为本地文件，集中隔离浏览器 DOM API。 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
