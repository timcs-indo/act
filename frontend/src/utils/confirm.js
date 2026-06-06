// Global confirmation modal system
// Usage: import confirm from './utils/confirm'
//        const ok = await confirm.ask('Hapus item ini?')
//        if (ok) { /* do delete */ }
//
// Or with more options:
//        await confirm.ask({
//          title: 'Konfirmasi',
//          message: 'Yakin ingin menghapus?',
//          confirmText: 'Ya, Hapus',
//          cancelText: 'Batal',
//          danger: true
//        })

let listeners = []
let currentResolve = null
let currentConfig = null

const subscribe = (listener) => {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

const notify = () => {
  listeners.forEach(l => l(currentConfig))
}

const ask = (messageOrConfig) => {
  return new Promise((resolve) => {
    // Resolve previous one as false (cancel) if still open
    if (currentResolve) currentResolve(false)

    const config = typeof messageOrConfig === 'string'
      ? { message: messageOrConfig }
      : messageOrConfig

    currentConfig = {
      title: config.title || 'Konfirmasi',
      message: config.message || 'Apakah Anda yakin?',
      confirmText: config.confirmText || 'Ya, Lanjutkan',
      cancelText: config.cancelText || 'Batal',
      danger: config.danger !== undefined ? config.danger : true,
      icon: config.icon || (config.danger !== false ? '⚠️' : '❓')
    }
    currentResolve = resolve
    notify()
  })
}

const resolve = (result) => {
  if (currentResolve) {
    currentResolve(result)
    currentResolve = null
    currentConfig = null
    notify()
  }
}

// askChoice: Multiple options modal (e.g., Google Calendar style "Single / All")
// options: [{ label, value, danger?, icon? }]
// Returns: selected value or null on cancel
const askChoice = (config) => {
  return new Promise((resolve) => {
    if (currentResolve) currentResolve(null)

    currentConfig = {
      type: 'choice',
      title: config.title || 'Pilih',
      message: config.message || 'Pilih salah satu opsi',
      options: config.options || [],
      cancelText: config.cancelText || 'Batal',
      icon: config.icon || '❓',
      danger: config.danger || false
    }
    currentResolve = resolve
    notify()
  })
}

const confirmHelper = {
  subscribe,
  ask,
  askChoice,
  confirm: () => resolve(true),
  cancel: () => resolve(false),
  selectOption: (value) => resolve(value)
}

export default confirmHelper
